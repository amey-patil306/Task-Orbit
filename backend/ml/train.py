"""Train and evaluate the three Task Orbit models (SPEC section 10, PLAN_V2 section 6).

  A. overload classifier  - low / medium / high per day       (vs rule: hours / availability)
  B. time estimator       - real hours a task will take       (vs the student's own estimate)
  C. late-risk classifier - will this task be submitted late  (vs the rule-based risk score)

For A and C we compare Logistic Regression, Random Forest and Gradient Boosting with
cross-validated macro-F1 on the training students, then report the winner on held-out
students. Splits are always BY STUDENT (GroupShuffleSplit / GroupKFold), so no student's data
is in both train and test.

Run from backend/ after generate_dataset:   .venv\\Scripts\\python -m ml.train
Writes ml/artifacts/: overload_clf.joblib, time_reg.joblib, risk_clf.joblib, metrics.json, figures/*.png
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, mean_absolute_error, precision_score,
                             r2_score, recall_score)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.features import OVERLOAD_FEATURES, RISK_FEATURES, TIME_FEATURES  # noqa: E402

HERE = Path(__file__).resolve().parent
DATA, ART = HERE / "data", HERE / "artifacts"
FIG = ART / "figures"
SEED = 42
VERSION = "v1-" + datetime.now(timezone.utc).strftime("%Y%m%d")
LABELS = ["low", "medium", "high"]


def split(df):
    """80/20 split by student."""
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, test_idx = next(gss.split(df, groups=df["student_id"]))
    return df.iloc[train_idx], df.iloc[test_idx]


def candidates_classifier(balanced: bool):
    cw = "balanced" if balanced else None
    return {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight=cw)),
        # Kept small for the free backend's memory (SPEC: at most 100 trees).
        "random_forest": RandomForestClassifier(n_estimators=100, max_depth=12, min_samples_leaf=5,
                                                class_weight=cw, n_jobs=-1, random_state=SEED),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=SEED),
    }


def pick_best(models, X, y, groups, scoring):
    cv = GroupKFold(n_splits=5)
    scores = {}
    for name, model in models.items():
        scores[name] = round(float(cross_val_score(model, X, y, groups=groups, cv=cv, scoring=scoring, n_jobs=1).mean()), 4)
        print(f"    {name:20s} CV {scoring}: {scores[name]}")
    best = max(scores, key=scores.get)
    return best, scores


def importances(model, features):
    est = model[-1] if hasattr(model, "steps") else model
    if hasattr(est, "feature_importances_"):
        vals = est.feature_importances_
    else:
        vals = np.abs(est.coef_).mean(axis=0) if est.coef_.ndim > 1 else np.abs(est.coef_)
        vals = vals / vals.sum()
    return dict(sorted(((f, round(float(v), 4)) for f, v in zip(features, vals)), key=lambda kv: -kv[1]))


# ---------------------------------------------------------------- Model A

def train_overload():
    print("\n[A] Overload classifier")
    df = pd.read_csv(DATA / "overload.csv")
    train, test = split(df)
    X, y = train[OVERLOAD_FEATURES], train["label"]
    best, cv = pick_best(candidates_classifier(balanced=True), X, y, train["student_id"], "f1_macro")
    model = candidates_classifier(balanced=True)[best].fit(X, y)

    pred = model.predict(test[OVERLOAD_FEATURES])
    rule = test["rule_label"]  # the rule engine's label for the same day
    m = {
        "model": best, "cv_macro_f1": cv,
        "rows": len(df), "test_rows": len(test), "test_students": int(test["student_id"].nunique()),
        "class_balance": df["label"].value_counts(normalize=True).round(3).to_dict(),
        "ml": {"accuracy": round(accuracy_score(test["label"], pred), 4), "macro_f1": round(f1_score(test["label"], pred, average="macro"), 4)},
        "rules": {"accuracy": round(accuracy_score(test["label"], rule), 4), "macro_f1": round(f1_score(test["label"], rule, average="macro"), 4)},
        "confusion_ml": confusion_matrix(test["label"], pred, labels=LABELS).tolist(),
        "confusion_rules": confusion_matrix(test["label"], rule, labels=LABELS).tolist(),
        "labels": LABELS,
        "feature_importance": importances(model, OVERLOAD_FEATURES),
    }
    m["improvement_macro_f1_points"] = round(100 * (m["ml"]["macro_f1"] - m["rules"]["macro_f1"]), 1)
    print(f"    held-out macro-F1  ML {m['ml']['macro_f1']}  vs rules {m['rules']['macro_f1']}  ({m['improvement_macro_f1_points']:+} pts)")
    joblib.dump({"model": model, "features": OVERLOAD_FEATURES, "version": VERSION}, ART / "overload_clf.joblib", compress=3)
    return m


# ---------------------------------------------------------------- Model B

def train_time():
    print("\n[B] Time estimator")
    df = pd.read_csv(DATA / "time.csv")
    train, test = split(df)
    X, y = train[TIME_FEATURES], train["actual_hours"]
    models = {
        "ridge": make_pipeline(StandardScaler(), Ridge()),
        "random_forest": RandomForestRegressor(n_estimators=100, max_depth=12, min_samples_leaf=5, n_jobs=-1, random_state=SEED),
        "gradient_boosting": GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=SEED),
    }
    best, cv = pick_best(models, X, y, train["student_id"], "neg_mean_absolute_error")
    model = models[best].fit(X, y)

    pred = model.predict(test[TIME_FEATURES])
    raw = test["estimated_hours"]
    m = {
        "model": best, "cv_neg_mae": cv, "rows": len(df), "test_rows": len(test),
        "ml": {"mae": round(mean_absolute_error(test["actual_hours"], pred), 3), "r2": round(r2_score(test["actual_hours"], pred), 3)},
        "raw_estimate": {"mae": round(mean_absolute_error(test["actual_hours"], raw), 3), "r2": round(r2_score(test["actual_hours"], raw), 3)},
        "feature_importance": importances(model, TIME_FEATURES),
    }
    m["mae_reduction_pct"] = round(100 * (1 - m["ml"]["mae"] / m["raw_estimate"]["mae"]), 1)
    print(f"    held-out MAE  ML {m['ml']['mae']} h  vs student estimate {m['raw_estimate']['mae']} h  ({m['mae_reduction_pct']}% lower)")
    joblib.dump({"model": model, "features": TIME_FEATURES, "version": VERSION}, ART / "time_reg.joblib", compress=3)
    return m, test.assign(pred=pred)


# ---------------------------------------------------------------- Model C

def rule_risk(df):
    """Same idea as the rule-based early-warning score in analytics.student_risk, per task."""
    score = (np.minimum(6, 3 * df["overdue_tasks"]) + np.minimum(3, df["overloaded_days_7d"])
             + np.where((df["n_past"] >= 3) & (df["late_rate"] >= 0.3), 3, np.where((df["n_past"] >= 3) & (df["late_rate"] >= 0.15), 1, 0))
             + np.where(df["stress"] >= 4, 2, 0) + np.where((df["started"] == 0) & (df["days_left"] <= 1), 1, 0))
    return (score >= 3).astype(int)


def train_risk():
    print("\n[C] Late-submission risk")
    df = pd.read_csv(DATA / "risk.csv")
    train, test = split(df)
    X, y = train[RISK_FEATURES], train["late"]
    best, cv = pick_best(candidates_classifier(balanced=True), X, y, train["student_id"], "f1_macro")
    model = candidates_classifier(balanced=True)[best].fit(X, y)

    proba = model.predict_proba(test[RISK_FEATURES])[:, 1]
    pred = (proba >= 0.5).astype(int)
    rule = rule_risk(test)
    y_test = test["late"]

    def scores(p):
        return {"accuracy": round(accuracy_score(y_test, p), 4), "macro_f1": round(f1_score(y_test, p, average="macro"), 4),
                "precision_late": round(precision_score(y_test, p, zero_division=0), 4),
                "recall_late": round(recall_score(y_test, p, zero_division=0), 4)}

    m = {
        "model": best, "cv_macro_f1": cv, "rows": len(df), "test_rows": len(test),
        "late_rate": round(float(df["late"].mean()), 3),
        "ml": scores(pred), "rules": scores(rule),
        "confusion_ml": confusion_matrix(y_test, pred).tolist(),
        "confusion_rules": confusion_matrix(y_test, rule).tolist(),
        "feature_importance": importances(model, RISK_FEATURES),
    }
    m["improvement_macro_f1_points"] = round(100 * (m["ml"]["macro_f1"] - m["rules"]["macro_f1"]), 1)
    print(f"    held-out macro-F1  ML {m['ml']['macro_f1']}  vs rules {m['rules']['macro_f1']}  ({m['improvement_macro_f1_points']:+} pts)")
    joblib.dump({"model": model, "features": RISK_FEATURES, "version": VERSION}, ART / "risk_clf.joblib", compress=3)
    return m


# ---------------------------------------------------------------- report figures

def figures(metrics, time_test):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    FIG.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"figure.dpi": 130, "font.size": 9})

    def confusion(ax, cm, labels, title):
        ax.imshow(cm, cmap="Blues")
        ax.set_xticks(range(len(labels)), labels)
        ax.set_yticks(range(len(labels)), labels)
        ax.set_xlabel("Predicted")
        ax.set_ylabel("Actual")
        ax.set_title(title)
        for i in range(len(labels)):
            for j in range(len(labels)):
                ax.text(j, i, cm[i][j], ha="center", va="center", color="white" if cm[i][j] > np.max(cm) / 2 else "black")

    for key, labels, name in [("overload", LABELS, "Overload (Model A)"), ("risk", ["on time", "late"], "Late risk (Model C)")]:
        fig, axes = plt.subplots(1, 2, figsize=(7.5, 3.4))
        confusion(axes[0], metrics[key]["confusion_rules"], labels, f"Rules  (macro-F1 {metrics[key]['rules']['macro_f1']:.2f})")
        confusion(axes[1], metrics[key]["confusion_ml"], labels, f"ML  (macro-F1 {metrics[key]['ml']['macro_f1']:.2f})")
        fig.suptitle(name)
        fig.tight_layout()
        fig.savefig(FIG / f"confusion_{key}.png")
        plt.close(fig)

    for key, name in [("overload", "Model A"), ("time", "Model B"), ("risk", "Model C")]:
        imp = list(metrics[key]["feature_importance"].items())[:10][::-1]
        fig, ax = plt.subplots(figsize=(5.5, 3.4))
        ax.barh([k for k, _ in imp], [v for _, v in imp], color="#6366f1")
        ax.set_title(f"{name}: top features ({metrics[key]['model'].replace('_', ' ')})")
        fig.tight_layout()
        fig.savefig(FIG / f"importance_{key}.png")
        plt.close(fig)

    fig, ax = plt.subplots(figsize=(5, 4))
    sample = time_test.sample(min(800, len(time_test)), random_state=SEED)
    ax.scatter(sample["actual_hours"], sample["estimated_hours"], s=8, alpha=0.4, label="student's estimate", color="#94a3b8")
    ax.scatter(sample["actual_hours"], sample["pred"], s=8, alpha=0.5, label="ML estimate", color="#6366f1")
    lim = float(sample["actual_hours"].max()) + 1
    ax.plot([0, lim], [0, lim], "k--", lw=1)
    ax.set_xlabel("Actual hours")
    ax.set_ylabel("Predicted hours")
    ax.set_title(f"Model B: MAE {metrics['time']['raw_estimate']['mae']} h → {metrics['time']['ml']['mae']} h")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIG / "time_estimates.png")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.5, 3.2))
    names = ["Overload (A)", "Late risk (C)"]
    x = np.arange(2)
    ax.bar(x - 0.18, [metrics["overload"]["rules"]["macro_f1"], metrics["risk"]["rules"]["macro_f1"]], 0.36, label="Rules", color="#cbd5e1")
    ax.bar(x + 0.18, [metrics["overload"]["ml"]["macro_f1"], metrics["risk"]["ml"]["macro_f1"]], 0.36, label="ML", color="#6366f1")
    ax.axhline(0.8, color="#dc2626", lw=1, ls="--", label="target 0.80")
    ax.set_xticks(x, names)
    ax.set_ylim(0, 1)
    ax.set_ylabel("Macro-F1 (held-out students)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIG / "ml_vs_rules.png")
    plt.close(fig)


def main():
    ART.mkdir(exist_ok=True)
    metrics = {"model_version": VERSION, "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
               "data": "synthetic (ml/generate_dataset.py)", "split": "80/20 by student (GroupShuffleSplit), 5-fold GroupKFold CV"}
    metrics["overload"] = train_overload()
    metrics["time"], time_test = train_time()
    metrics["risk"] = train_risk()
    (ART / "metrics.json").write_text(json.dumps(metrics, indent=2))
    figures(metrics, time_test)
    sizes = {p.name: f"{p.stat().st_size / 1e6:.2f} MB" for p in ART.glob("*.joblib")}
    print(f"\nSaved {VERSION}: {sizes}")


if __name__ == "__main__":
    main()
