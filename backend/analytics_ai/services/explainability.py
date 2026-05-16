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
    passing_grade = float(prediction.get("passing_grade", 75.0) or 75.0)

    risk_probability = float(
        prediction.get("risk_probability", prediction.get("probability_student_fails", 0) or 0)
    )
    risk_level = str(prediction.get("risk_level", "low") or "low").lower()

    reasons = []
    if avg_grade < passing_grade:
        reasons.append(f"average grade below the passing grade ({avg_grade:.1f}% vs {passing_grade:.1f}%)")
    if late_rate > 0.4:
        reasons.append(f"high late submission rate ({late_rate * 100:.0f}%)")
    if missing_rate > 0.3:
        reasons.append(f"missing submissions ({missing_rate * 100:.0f}% missing rate)")
    if engagement_score < 40:
        reasons.append(f"low engagement ({engagement_score:.0f}%)")
    if grade_trend < 0:
        reasons.append(f"declining grade trend ({grade_trend:.1f} points)")

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


def generate_intervention_suggestions(features, settings=None):
    passing_grade = 75.0
    if isinstance(settings, dict):
        passing_grade = float(settings.get("passing_grade", settings.get("analytics_passing_grade", passing_grade)))
    elif settings is not None:
        passing_grade = float(getattr(settings, "analytics_passing_grade", getattr(settings, "passing_grade", passing_grade)))

    avg_grade = float(features.get("average_grade", features.get("avg_grade", 0)) or 0)
    missing_rate = float(features.get("missing_rate", 0) or 0)
    engagement_score = float(features.get("engagement_score", 0) or 0)
    grade_trend = float(features.get("grade_trend", 0) or 0)

    suggestions = []
    if missing_rate > 0:
        suggestions.append("Send assignment reminder for missing submissions.")
    if avg_grade < passing_grade:
        suggestions.append("Provide remediation for low grades.")
    if engagement_score < 0.40:
        suggestions.append("Schedule consultation for low engagement.")
    if grade_trend < 0:
        suggestions.append("Use weekly monitoring for declining grade trend.")

    if not suggestions:
        suggestions.append("Continue regular monitoring.")
    return suggestions
