from pathlib import Path
import logging

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
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


def train_student_risk_model(test_size=0.2, random_state=42):
    dataset = build_training_dataset()
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

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": model,
        "feature_columns": MODEL_FEATURE_COLUMNS,
    }
    joblib.dump(payload, MODEL_PATH)
    logger.info(
        "Analytics AI model trained and saved.",
        extra={"model_path": str(MODEL_PATH), "samples": int(len(dataset))},
    )

    return {
        "status": "model trained",
        "accuracy": round(accuracy, 4),
        "samples": int(len(dataset)),
        "model_path": str(MODEL_PATH),
    }


def train_model(test_size=0.2, random_state=42):
    return train_student_risk_model(test_size=test_size, random_state=random_state)
