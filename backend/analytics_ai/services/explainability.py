def _to_percentage(value):
    numeric = float(value or 0)
    if numeric <= 1:
        return numeric * 100.0
    return numeric


def generate_student_risk_explanation(features, prediction):
    avg_grade = float(features.get("average_grade", features.get("avg_grade", 0)) or 0)
    late_rate = float(features.get("late_rate", 0) or 0)
    missing_rate = float(features.get("missing_rate", 0) or 0)
    engagement_score = _to_percentage(features.get("engagement_score", 0))
    grade_trend = float(features.get("grade_trend", 0) or 0)

    risk_probability = float(
        prediction.get("risk_probability", prediction.get("probability_student_fails", 0) or 0)
    )
    risk_level = str(prediction.get("risk_level", "low") or "low").lower()

    reasons = []
    if avg_grade < 60:
        reasons.append("low average grade")
    if late_rate > 0.4:
        reasons.append("frequent late submissions")
    if missing_rate > 0.3:
        reasons.append("multiple missing assignments")
    if engagement_score < 40:
        reasons.append("low LMS engagement")
    if grade_trend < 0:
        reasons.append("declining performance trend")

    if not reasons:
        return (
            f"Student currently shows {risk_level} risk. Performance indicators are generally stable, "
            f"with an estimated failure probability of {risk_probability * 100:.0f}%."
        )

    reason_text = ", ".join(reasons[:-1]) + f" and {reasons[-1]}" if len(reasons) > 1 else reasons[0]
    return (
        f"Student shows {risk_level} risk due to {reason_text}. "
        f"Estimated failure probability is {risk_probability * 100:.0f}%."
    )
