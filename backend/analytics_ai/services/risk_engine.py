DEFAULT_RISK_SETTINGS = {
    "low_risk_max": 0.30,
    "medium_risk_max": 0.60,
    "high_risk_min": 0.60,
    "passing_grade": 75.0,
}


def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, float(value)))


def get_risk_settings():
    try:
        from users_app.models import SiteSettings

        settings_obj, _ = SiteSettings.objects.get_or_create(id=1)
        return {
            "low_risk_max": settings_obj.analytics_low_risk_max,
            "medium_risk_max": settings_obj.analytics_medium_risk_max,
            "high_risk_min": settings_obj.analytics_high_risk_min,
            "passing_grade": settings_obj.analytics_passing_grade,
        }
    except Exception:
        return DEFAULT_RISK_SETTINGS.copy()


def _setting(settings, key):
    if settings is None:
        settings = DEFAULT_RISK_SETTINGS
    model_field = f"analytics_{key}"
    if isinstance(settings, dict):
        return settings.get(key, settings.get(model_field, DEFAULT_RISK_SETTINGS[key]))
    return getattr(settings, model_field, getattr(settings, key, DEFAULT_RISK_SETTINGS[key]))


def classify_risk(failure_probability, settings=None):
    probability = _clamp(failure_probability)
    low_max = _clamp(_setting(settings, "low_risk_max"))
    medium_max = _clamp(_setting(settings, "medium_risk_max"))
    high_min = _clamp(_setting(settings, "high_risk_min"))

    if probability >= high_min:
        return "high"
    if probability <= low_max:
        return "low"
    if probability <= medium_max:
        return "medium"
    return "high"


def evaluate_at_risk(features, failure_probability, settings=None):
    passing_grade = float(_setting(settings, "passing_grade"))
    high_min = _clamp(_setting(settings, "high_risk_min"))
    average_grade = float(features.get("average_grade", features.get("avg_grade", 0)) or 0)
    return bool(_clamp(failure_probability) >= high_min or average_grade < passing_grade)


def predicted_outcome(features, failure_probability, settings=None):
    return "At Risk of Failure" if evaluate_at_risk(features, failure_probability, settings) else "Likely to Pass"


def calculate_risk_score(average_grade, late_rate, missing_rate, settings=None):
    passing_grade = max(float(_setting(settings, "passing_grade")), 1.0)
    low_grade_factor = _clamp((passing_grade - float(average_grade)) / passing_grade)
    late_submission_factor = _clamp(float(late_rate) / 0.4) if float(late_rate) > 0 else 0.0
    missing_submission_factor = _clamp(float(missing_rate) / 0.3) if float(missing_rate) > 0 else 0.0
    behavior_factor = (0.7 * late_submission_factor) + (0.3 * missing_submission_factor)
    risk_score = _clamp((0.6 * low_grade_factor) + (0.4 * behavior_factor))
    risk_level = classify_risk(risk_score, settings)

    return round(risk_score, 4), risk_level
