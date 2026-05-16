from pathlib import Path
import warnings

try:
    import joblib
except ImportError:  # pragma: no cover
    joblib = None
import pandas as pd
from analytics_ai.services.risk_engine import classify_risk, get_risk_settings

try:
    from sklearn.exceptions import InconsistentVersionWarning
except Exception:  # pragma: no cover
    InconsistentVersionWarning = None

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "models" / "student_risk_model.pkl"
MODEL_FEATURE_COLUMNS = [
    "avg_grade",
    "late_rate",
    "missing_rate",
    "engagement_score",
    "grade_trend",
    "total_submissions",
]


def _probability_to_level(risk_probability):
    risk_level = classify_risk(float(risk_probability), get_risk_settings())
    return risk_level, risk_level.upper()


class TrainedModelPredictor:
    def __init__(self, model_path=None):
        self.model_path = Path(model_path) if model_path else MODEL_PATH
        self._bundle = None

    def _load_bundle(self):
        if self._bundle is None:
            if joblib is None:
                raise ImportError("joblib is not installed.")
            if not self.model_path.exists():
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            # Suppress known sklearn model-version pickle noise in runtime logs.
            # This does not change model-loading behavior; it only reduces warning spam.
            if InconsistentVersionWarning is not None:
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
                    self._bundle = joblib.load(self.model_path)
            else:
                self._bundle = joblib.load(self.model_path)
        return self._bundle

    def predict(self, features):
        bundle = self._load_bundle()
        model = bundle["model"] if isinstance(bundle, dict) else bundle
        feature_columns = bundle.get("feature_columns", MODEL_FEATURE_COLUMNS) if isinstance(bundle, dict) else MODEL_FEATURE_COLUMNS

        base_feature_map = {
            "avg_grade": float(features.get("avg_grade", features.get("average_grade", 0))),
            "average_grade": float(features.get("average_grade", features.get("avg_grade", 0))),
            "late_rate": float(features.get("late_rate", 0)),
            "missing_rate": float(features.get("missing_rate", 0)),
            "engagement_score": float(features.get("engagement_score", 0)),
            "grade_trend": float(features.get("grade_trend", 0)),
            "total_submissions": float(features.get("total_submissions", 0)),
        }
        row_values = {name: float(base_feature_map.get(name, 0.0)) for name in feature_columns}
        row_df = pd.DataFrame([row_values], columns=feature_columns)

        probability_fail = float(model.predict_proba(row_df)[0][1])
        risk_level, risk_level_label = _probability_to_level(probability_fail)
        return {
            "risk_probability": round(probability_fail, 4),
            "risk_level": risk_level,
            "risk_level_label": risk_level_label,
            "prediction_source": "ml",
        }


class RuleFallbackPredictor:
    def predict(self, features):
        average_grade = float(features.get("average_grade", 0))
        late_rate = float(features.get("late_rate", 0))
        missing_rate = float(features.get("missing_rate", 0))
        engagement_score = float(features.get("engagement_score", 0))

        grade_factor = max(min((60.0 - average_grade) / 60.0, 1.0), 0.0)
        behavior_factor = max(min((late_rate + missing_rate) / 2.0, 1.0), 0.0)
        engagement_factor = 1.0 - max(min(engagement_score, 1.0), 0.0)

        probability = (0.5 * grade_factor) + (0.3 * behavior_factor) + (0.2 * engagement_factor)
        risk_probability = round(max(min(probability, 1.0), 0.0), 4)
        risk_level, risk_level_label = _probability_to_level(risk_probability)
        return {
            "risk_probability": risk_probability,
            "risk_level": risk_level,
            "risk_level_label": risk_level_label,
            "prediction_source": "rule",
        }


def get_failure_predictor(prefer_trained=True):
    if prefer_trained and joblib is not None and MODEL_PATH.exists():
        return TrainedModelPredictor()
    return RuleFallbackPredictor()
