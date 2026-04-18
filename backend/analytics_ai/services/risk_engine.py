def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, float(value)))


def calculate_risk_score(average_grade, late_rate, missing_rate):
    low_grade_factor = _clamp((60.0 - float(average_grade)) / 60.0)
    late_submission_factor = _clamp(float(late_rate) / 0.4) if float(late_rate) > 0 else 0.0
    missing_submission_factor = _clamp(float(missing_rate) / 0.3) if float(missing_rate) > 0 else 0.0
    behavior_factor = (0.7 * late_submission_factor) + (0.3 * missing_submission_factor)
    risk_score = _clamp((0.6 * low_grade_factor) + (0.4 * behavior_factor))

    if risk_score >= 0.6:
        risk_level = "high"
    elif risk_score >= 0.3:
        risk_level = "medium"
    else:
        risk_level = "low"

    return round(risk_score, 4), risk_level
