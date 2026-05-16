import json

try:
    import joblib
except ImportError:  # pragma: no cover
    joblib = None

from analytics_ai.ml.train_model import METRICS_PATH, MODEL_PATH


def _safe_divide(numerator, denominator):
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _calculate_binary_metrics(actual_values, predicted_values):
    total = len(actual_values)
    if total == 0:
        return {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "total_samples": 0,
            "samples": 0,
            "train_samples": 0,
            "test_samples": 0,
            "true_positive": 0,
            "true_negative": 0,
            "false_positive": 0,
            "false_negative": 0,
            "TP": 0,
            "TN": 0,
            "FP": 0,
            "FN": 0,
        }

    paired_values = list(zip(actual_values, predicted_values))
    true_positive = sum(1 for actual, predicted in paired_values if actual == 1 and predicted == 1)
    true_negative = sum(1 for actual, predicted in paired_values if actual == 0 and predicted == 0)
    false_positive = sum(1 for actual, predicted in paired_values if actual == 0 and predicted == 1)
    false_negative = sum(1 for actual, predicted in paired_values if actual == 1 and predicted == 0)

    accuracy = _safe_divide(true_positive + true_negative, total)
    precision = _safe_divide(true_positive, true_positive + false_positive)
    recall = _safe_divide(true_positive, true_positive + false_negative)
    f1_score = _safe_divide(2 * precision * recall, precision + recall)

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1_score, 4),
        "total_samples": total,
        "samples": total,
        "train_samples": 0,
        "test_samples": total,
        "true_positive": true_positive,
        "true_negative": true_negative,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "TP": true_positive,
        "TN": true_negative,
        "FP": false_positive,
        "FN": false_negative,
    }


def _normalize_training_metrics(metrics):
    if not isinstance(metrics, dict):
        return None

    normalized = {
        "accuracy": float(metrics.get("accuracy", 0.0) or 0.0),
        "precision": float(metrics.get("precision", 0.0) or 0.0),
        "recall": float(metrics.get("recall", 0.0) or 0.0),
        "f1_score": float(metrics.get("f1_score", 0.0) or 0.0),
        "total_samples": int(metrics.get("total_samples", metrics.get("samples", 0)) or 0),
        "samples": int(metrics.get("samples", metrics.get("total_samples", 0)) or 0),
        "train_samples": int(metrics.get("train_samples", 0) or 0),
        "test_samples": int(metrics.get("test_samples", 0) or 0),
        "true_positive": int(metrics.get("true_positive", metrics.get("TP", 0)) or 0),
        "true_negative": int(metrics.get("true_negative", metrics.get("TN", 0)) or 0),
        "false_positive": int(metrics.get("false_positive", metrics.get("FP", 0)) or 0),
        "false_negative": int(metrics.get("false_negative", metrics.get("FN", 0)) or 0),
    }
    normalized["TP"] = normalized["true_positive"]
    normalized["TN"] = normalized["true_negative"]
    normalized["FP"] = normalized["false_positive"]
    normalized["FN"] = normalized["false_negative"]
    return normalized


def load_latest_training_metrics():
    if METRICS_PATH.exists():
        try:
            metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            normalized = _normalize_training_metrics(metrics)
            if normalized is not None:
                return normalized
        except (OSError, ValueError, TypeError):
            pass

    if MODEL_PATH.exists() and joblib is not None:
        try:
            bundle = joblib.load(MODEL_PATH)
        except Exception:  # pragma: no cover
            return None
        if isinstance(bundle, dict):
            normalized = _normalize_training_metrics(bundle.get("evaluation_metrics"))
            if normalized is not None:
                return normalized

    return None


def get_at_risk_model_metrics(instructor=None, course_id=None):
    del instructor, course_id

    metrics = load_latest_training_metrics()
    if metrics is None:
        metrics = _calculate_binary_metrics([], [])
        metrics["message"] = "No saved held-out training metrics found. Retrain the RandomForest model to generate evaluation results."
        metrics["evaluation_scope"] = "held_out_test_set"
        metrics["model_type"] = "RandomForestClassifier"
        return metrics

    metrics["evaluation_scope"] = "held_out_test_set"
    metrics["model_type"] = "RandomForestClassifier"
    return metrics
