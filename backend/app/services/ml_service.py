"""ML overload forecast with a rule-based fallback (section 10, serving rules).

Models are loaded once at app start. Until the ML phase trains
backend/ml/artifacts/overload_clf.joblib, every forecast falls back to the
rule engine and reports source = "rules".
"""
import json
import logging
from datetime import timedelta
from pathlib import Path

from .workload_engine import daily_load

log = logging.getLogger(__name__)

ARTIFACTS = Path(__file__).resolve().parents[2] / "ml" / "artifacts"
RULES_VERSION = "rules-v0"
MIN_CONFIDENCE = 0.5

_model = None
_model_version = None


def init_app(app) -> None:
    """Load the overload classifier if it exists. Missing or broken files just mean 'use rules'."""
    global _model, _model_version
    path = ARTIFACTS / "overload_clf.joblib"
    if not path.exists():
        app.logger.info("No ML model found at %s - using rule-based forecasts", path)
        return
    try:
        import joblib

        _model = joblib.load(path)
        metrics = ARTIFACTS / "metrics.json"
        _model_version = json.loads(metrics.read_text()).get("model_version", "ml") if metrics.exists() else "ml"
        app.logger.info("Loaded ML model %s", _model_version)
    except Exception:  # noqa: BLE001 - never let a bad model file stop the app
        app.logger.exception("Could not load ML model - using rule-based forecasts")
        _model = None


def model_loaded() -> bool:
    return _model is not None


def _ml_predictions(tasks, availability, today, days):
    """Return {date_iso: (label, probability)} or None when ML is unavailable.

    Filled in during the ML phase using ml/features.py (the same code used in training).
    """
    if _model is None:
        return None
    try:
        from ml.features import features_for_days  # noqa: PLC0415 - created in the ML phase

        X, dates = features_for_days(tasks, availability, today, days)
        probs = _model.predict_proba(X)
        out = {}
        for d, row in zip(dates, probs):
            best = row.argmax()
            out[d] = (str(_model.classes_[best]), float(row[best]))
        return out
    except Exception:  # noqa: BLE001
        log.exception("ML prediction failed - falling back to rules")
        return None


def forecast(tasks, availability: dict, today, days: int = 7) -> dict:
    """Risk (low/medium/high) for each of the next `days` days."""
    rows = daily_load(tasks, availability, today, today + timedelta(days=days - 1), today)
    ml = _ml_predictions(tasks, availability, today, days)

    result, used_ml = [], False
    for row in rows:
        label, prob = (ml or {}).get(row["date"], (None, None))
        if label is not None and prob >= MIN_CONFIDENCE:
            result.append({"date": row["date"], "risk": label, "probability": round(prob, 2)})
            used_ml = True
        else:
            result.append({"date": row["date"], "risk": row["rule_label"], "probability": None})

    return {
        "days": result,
        "model_version": _model_version if used_ml else RULES_VERSION,
        "source": "ml" if used_ml else "rules",
    }


def ml_labels(tasks, availability: dict, today, days: int) -> dict:
    """{date_iso: label} for the workload page; empty when no model is loaded."""
    ml = _ml_predictions(tasks, availability, today, days) or {}
    return {d: label for d, (label, prob) in ml.items() if prob >= MIN_CONFIDENCE}
