import json
import logging
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from analytics_ai.ml.dataset_builder import build_training_dataset

logger = logging.getLogger(__name__)


MODEL_FEATURE_COLUMNS = [
    "avg_grade",
    "late_rate",
    "missing_rate",
    "engagement_score",
    "grade_trend",
    "total_submissions",
]

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "student_risk_model.pkl"
METRICS_PATH = MODEL_DIR / "student_risk_model_metrics.json"


def _build_evaluation_metrics(*, accuracy, precision, recall, f1, dataset_size, train_size, test_size, true_positive, true_negative, false_positive, false_negative):
    return {
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "total_samples": int(dataset_size),
        "samples": int(dataset_size),
        "train_samples": int(train_size),
        "test_samples": int(test_size),
        "true_positive": int(true_positive),
        "true_negative": int(true_negative),
        "false_positive": int(false_positive),
        "false_negative": int(false_negative),
        "TP": int(true_positive),
        "TN": int(true_negative),
        "FP": int(false_positive),
        "FN": int(false_negative),
    }


def train_student_risk_model(test_size=0.2, random_state=42, courses=None):
    dataset = build_training_dataset(courses=courses)
    if dataset.empty:
        raise ValueError("Dataset is empty. No student-course rows available for training.")

    target_series = dataset["fail"]
    class_count = int(target_series.nunique())
    if class_count < 2:
        raise ValueError("Dataset requires both fail=0 and fail=1 samples for model training.")

    x_data = dataset[MODEL_FEATURE_COLUMNS]
    y_data = target_series

    class_counts = y_data.value_counts()
    min_class_count = int(class_counts.min()) if not class_counts.empty else 0

    if min_class_count < 2:
        x_train, x_test, y_train, y_test = train_test_split(
            x_data,
            y_data,
            test_size=test_size,
            random_state=random_state,
        )
    else:
        x_train, x_test, y_train, y_test = train_test_split(
            x_data,
            y_data,
            test_size=test_size,
            random_state=random_state,
            stratify=y_data,
        )

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=random_state,
        class_weight="balanced",
    )
    model.fit(x_train, y_train)
    if not hasattr(model, "predict_proba"):
        raise ValueError("Trained model does not support predict_proba.")

    # Ensure prediction input keeps training feature names to avoid sklearn warnings.
    x_test_named = (
        x_test[MODEL_FEATURE_COLUMNS]
        if isinstance(x_test, pd.DataFrame)
        else pd.DataFrame(x_test, columns=MODEL_FEATURE_COLUMNS)
    )
    predictions = model.predict(x_test_named)
    accuracy = float(accuracy_score(y_test, predictions))
    precision = float(precision_score(y_test, predictions, zero_division=0))
    recall = float(recall_score(y_test, predictions, zero_division=0))
    f1 = float(f1_score(y_test, predictions, zero_division=0))
    true_negative, false_positive, false_negative, true_positive = confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1],
    ).ravel()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    evaluation_metrics = _build_evaluation_metrics(
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        f1=f1,
        dataset_size=len(dataset),
        train_size=len(x_train),
        test_size=len(x_test),
        true_positive=true_positive,
        true_negative=true_negative,
        false_positive=false_positive,
        false_negative=false_negative,
    )
    payload = {
        "model": model,
        "feature_columns": MODEL_FEATURE_COLUMNS,
        "evaluation_metrics": evaluation_metrics,
    }
    joblib.dump(payload, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(evaluation_metrics, indent=2), encoding="utf-8")
    logger.info(
        "Analytics AI model trained and saved.",
        extra={"model_path": str(MODEL_PATH), "samples": int(len(dataset))},
    )

    return {
        "status": "model trained",
        **evaluation_metrics,
        "model_path": str(MODEL_PATH),
        "metrics_path": str(METRICS_PATH),
    }


def train_model(test_size=0.2, random_state=42, courses=None):
    return train_student_risk_model(test_size=test_size, random_state=random_state, courses=courses)
