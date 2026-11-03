"""Serving the three trained models, with rule fallbacks (SPEC section 10, "Serving rules").

- Models are loaded ONCE at app start, not per request.
- If a model file is missing, a prediction raises, or the model is unsure (top class
  probability below 0.5), the rule-based answer is used and `source` says "rules".
- Features come from ml/features.py, the same code used in training.
"""
import json
import logging
from datetime import timedelta
from pathlib import Path

import pandas as pd

from .workload_engine import daily_load

log = logging.getLogger(__name__)

ARTIFACTS = Path(__file__).resolve().parents[2] / "ml" / "artifacts"
RULES_VERSION = "rules-v0"
MIN_CONFIDENCE = 0.5

_models: dict = {}  # name -> {"model", "features", "version"}
_metrics: dict = {}


def init_app(app) -> None:
    """Load whatever models exist. Missing or broken files only mean 'use the rules'."""
    _models.clear()
    try:
        import joblib  # noqa: PLC0415 - only needed when models exist
    except ImportError:
        app.logger.warning("joblib/scikit-learn not installed - using rule-based predictions")
        return
    for name in ("overload_clf", "time_reg", "risk_clf"):
        path = ARTIFACTS / f"{name}.joblib"
        if not path.exists():
            continue
        try:
            _models[name] = joblib.load(path)
        except Exception:  # noqa: BLE001 - a bad model file must never stop the app
            app.logger.exception("Could not load %s - falling back to rules", name)
    metrics = ARTIFACTS / "metrics.json"
    if metrics.exists():
        _metrics.update(json.loads(metrics.read_text()))
    app.logger.info("ML models loaded: %s", sorted(_models) or "none (rules only)")


def status() -> dict:
    return {"models": sorted(_models), "model_version": _metrics.get("model_version")}


def _frame(bundle, rows):
    return pd.DataFrame(rows)[bundle["features"]]


# ---------------------------------------------------------------- Model A: overload forecast

def _overload_ml(tasks, availability, today, days, speed_ratio, class_ratio=None):
    """{date_iso: (label, probability)} or None."""
    bundle = _models.get("overload_clf")
    if bundle is None:
        return None
    try:
        from ml.features import overload_features  # noqa: PLC0415

        rows = overload_features(tasks, availability, today, days, speed_ratio, class_ratio)
        probs = bundle["model"].predict_proba(_frame(bundle, rows))
        classes = list(bundle["model"].classes_)
        return {r["date"]: (classes[p.argmax()], float(p.max())) for r, p in zip(rows, probs)}
    except Exception:  # noqa: BLE001
        log.exception("Overload prediction failed - using rules")
        return None


def forecast(tasks, availability: dict, today, days: int = 7, speed_ratio: float = 1.0, class_ratio=None) -> dict:
    """Risk (low/medium/high) for each of the next `days` days."""
    rows = daily_load(tasks, availability, today, today + timedelta(days=days - 1), today)
    ml = _overload_ml(tasks, availability, today, days, speed_ratio, class_ratio) or {}

    result, used_ml = [], False
    for row in rows:
        label, prob = ml.get(row["date"], (None, None))
        if label is not None and prob >= MIN_CONFIDENCE:
            result.append({"date": row["date"], "risk": label, "probability": round(prob, 2), "rule_label": row["rule_label"]})
            used_ml = True
        else:
            result.append({"date": row["date"], "risk": row["rule_label"], "probability": None, "rule_label": row["rule_label"]})
    return {
        "days": result,
        "model_version": _models["overload_clf"]["version"] if used_ml else RULES_VERSION,
        "source": "ml" if used_ml else "rules",
        "speed_ratio": speed_ratio,
    }


def ml_labels(tasks, availability: dict, today, days: int, speed_ratio: float = 1.0, class_ratio=None) -> dict:
    """{date_iso: label} for the workload page; empty when no confident prediction."""
    ml = _overload_ml(tasks, availability, today, days, speed_ratio, class_ratio) or {}
    return {d: label for d, (label, prob) in ml.items() if prob >= MIN_CONFIDENCE}


# ---------------------------------------------------------------- Model B: real hours

def estimate_hours(task, speed_ratio: float = 1.0, class_avg_ratio: float | None = None, class_done: int = 0):
    """Predicted real hours for a task, or None when the model isn't available."""
    bundle = _models.get("time_reg")
    if bundle is None:
        return None
    try:
        from ml.features import time_features  # noqa: PLC0415

        value = float(bundle["model"].predict(_frame(bundle, [time_features(task, speed_ratio, class_avg_ratio, class_done)]))[0])
        return round(max(0.5, value) * 2) / 2  # nearest half hour
    except Exception:  # noqa: BLE001
        log.exception("Time estimate failed")
        return None


# ---------------------------------------------------------------- Model C: late-submission risk

def late_probability(task, open_tasks, done_tasks, availability: dict, today, stress):
    """Probability (0-1) this task is submitted late, or None when the model isn't available."""
    bundle = _models.get("risk_clf")
    if bundle is None:
        return None
    try:
        from ml.features import risk_features  # noqa: PLC0415

        row = risk_features(task, open_tasks, done_tasks, availability, today, stress)
        return float(bundle["model"].predict_proba(_frame(bundle, [row]))[0][1])
    except Exception:  # noqa: BLE001
        log.exception("Risk prediction failed")
        return None
