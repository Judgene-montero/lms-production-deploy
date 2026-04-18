import ast
import ast
import math
import re
from collections import OrderedDict, defaultdict

from django.core.exceptions import ValidationError

from courses.models import (
    ActivitySubmission,
    AttendanceRecord,
    CourseActivity,
    GradingComponentScore,
    GradingScheme,
)


DEFAULT_CUSTOM_TRANSMUTATION_TABLE = [
    {"min": 97, "max": 100, "value": 100},
    {"min": 93, "max": 96.99, "value": 97},
    {"min": 90, "max": 92.99, "value": 94},
    {"min": 87, "max": 89.99, "value": 91},
    {"min": 83, "max": 86.99, "value": 88},
    {"min": 80, "max": 82.99, "value": 85},
    {"min": 75, "max": 79.99, "value": 80},
    {"min": 0, "max": 74.99, "value": 70},
]

ATTENDANCE_SCORES = {
    AttendanceRecord.STATUS_PRESENT: 100.0,
    AttendanceRecord.STATUS_LATE: 75.0,
    AttendanceRecord.STATUS_ABSENT: 0.0,
    AttendanceRecord.STATUS_EXCUSED: 100.0,
}

ACTIVITY_CATEGORY_LABELS = OrderedDict(
    [
        ("assignment", "Assignments"),
        ("project", "Projects"),
        ("material", "Materials"),
        ("quiz", "Quizzes"),
        ("exam", "Exams"),
        ("attendance", "Attendance"),
        ("other", "Other Activities"),
    ]
)

ACTIVITY_CATEGORY_ALIASES = {
    "assignment": {"assignment", "assignments", "task", "tasks", "homework", "homeworks"},
    "project": {"project", "projects"},
    "material": {"material", "materials", "resource", "resources", "reference", "references"},
    "quiz": {"quiz", "quizzes"},
    "exam": {"exam", "exams", "test", "tests", "midterm", "midterms", "final", "finals"},
    "attendance": {"attendance", "attendances"},
    "other": {"other", "others", "uncategorized"},
}

SAFE_FORMULA_FUNCTIONS = {
    "min": min,
    "max": max,
    "abs": abs,
    "round": round,
}


def _safe_float(value, field_name="value"):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field_name} must be numeric.") from exc
    if not math.isfinite(number):
        raise ValidationError(f"{field_name} must be finite.")
    return number


def _clamp_0_100(value):
    return max(0.0, min(100.0, float(value)))


def _normalize_name(value):
    text = str(value or "").strip().lower()
    return text[:-1] if text.endswith("s") else text


def _slugify_identifier(value, fallback="value"):
    slug = re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip("_")
    if not slug:
        slug = fallback
    if slug[0].isdigit():
        slug = f"v_{slug}"
    return slug


def _config_dict(value):
    return value if isinstance(value, dict) else {}


def _formula_round(value):
    return round(_clamp_0_100(value), 2)


def _activity_category_for(activity):
    activity_type_name = _normalize_name(getattr(getattr(activity, "activity_type", None), "name", ""))
    assessment_type = _normalize_name(getattr(activity, "assessment_type", ""))

    if activity_type_name == "attendance":
        return "attendance"
    if activity_type_name == "project":
        return "project"
    if activity_type_name == "material":
        return "material"
    if activity_type_name == "assignment" or activity_type_name == "task" or activity_type_name == "homework":
        return "assignment"
    if activity_type_name == "quiz" and assessment_type == CourseActivity.ASSESSMENT_EXAM:
        return "exam"
    if activity_type_name == "quiz":
        return "quiz"
    return "other"


def _activity_category_label(category_key):
    return ACTIVITY_CATEGORY_LABELS.get(category_key, ACTIVITY_CATEGORY_LABELS["other"])


def _activities_for_category(category_key, activities_by_id):
    return sorted(
        [activity_id for activity_id, activity in activities_by_id.items() if _activity_category_for(activity) == category_key]
    )


def _component_rule_map(scheme):
    config = _config_dict(getattr(scheme, "custom_config", {}))
    rules = config.get("component_rules") or []
    result = {}
    if not isinstance(rules, list):
        return result

    for item in rules:
        if not isinstance(item, dict):
            continue
        component_name = str(item.get("component_name") or item.get("name") or "").strip()
        if not component_name:
            continue
        category_key = _normalize_name(item.get("category_key") or item.get("category"))
        if category_key not in ACTIVITY_CATEGORY_LABELS:
            category_key = None
        try:
            drop_lowest_count = int(item.get("drop_lowest_count") or 0)
        except (TypeError, ValueError):
            drop_lowest_count = 0
        result[_normalize_name(component_name)] = {
            "category_key": category_key,
            "drop_lowest_count": max(drop_lowest_count, 0),
            "auto_include_matches": _as_bool(item.get("auto_include_matches"), True),
        }
    return result


def _as_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return bool(default)


def _scheme_bool(scheme, key, default):
    config = _config_dict(getattr(scheme, "custom_config", {}))
    raw = config.get(key, default)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return bool(raw)
    if isinstance(raw, str):
        lowered = raw.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return bool(default)


def _scheme_percent(scheme, key, default):
    config = _config_dict(getattr(scheme, "custom_config", {}))
    raw = config.get(key, default)
    value = _safe_float(raw, field_name=key)
    if value < 0 or value > 100:
        raise ValidationError(f"{key} must be between 0 and 100.")
    return value


def _attendance_average_map(course, student_ids):
    if not student_ids:
        return {}
    records = AttendanceRecord.objects.filter(session__course=course, student_id__in=student_ids).values_list(
        "student_id", "status"
    )
    buckets = defaultdict(list)
    for student_id, status in records:
        buckets[int(student_id)].append(ATTENDANCE_SCORES.get(status, 0.0))

    result = {}
    for student_id in student_ids:
        values = buckets.get(int(student_id), [])
        result[int(student_id)] = round(sum(values) / len(values), 2) if values else 0.0
    return result


def normalize_score(activity, raw_score, total_points=None, passfail_threshold=60.0):
    """Normalize raw activity score to 0..100, or None for excluded activity types."""
    grading_type = str(getattr(activity, "grading_type", "points") or "points").strip().lower()

    if grading_type == "none":
        return None

    if raw_score is None:
        return None

    if grading_type == "passfail":
        if isinstance(raw_score, str):
            lowered = raw_score.strip().lower()
            passed = lowered in {"pass", "passed", "true", "1", "yes"}
            return 100.0 if passed else 0.0

        numeric_score = _safe_float(raw_score, field_name="passfail score")
        threshold = _safe_float(passfail_threshold, field_name="passfail_threshold")
        if threshold < 0 or threshold > 100:
            raise ValidationError("passfail_threshold must be between 0 and 100.")

        if total_points is not None:
            denominator = _safe_float(total_points, field_name="total points")
            percent_score = 0.0 if denominator <= 0 else (numeric_score / denominator) * 100.0
        else:
            percent_score = numeric_score

        passed = _clamp_0_100(percent_score) >= threshold
        return 100.0 if passed else 0.0

    numeric_score = _safe_float(raw_score, field_name="score")

    if grading_type == "points":
        denominator = _safe_float(
            total_points if total_points is not None else getattr(activity, "points", 0),
            field_name="total points",
        )
        if denominator <= 0:
            return 0.0
        normalized = (numeric_score / denominator) * 100.0
        return round(_clamp_0_100(normalized), 2)

    if grading_type == "percent":
        return round(_clamp_0_100(numeric_score), 2)

    raise ValidationError(f"Unsupported activity grading type '{grading_type}' for activity {getattr(activity, 'id', None)}.")


def validate_custom_transmutation_table(table, require_full_coverage=True):
    if not isinstance(table, list) or not table:
        raise ValidationError("custom_config.transmutation_table must be a non-empty list.")

    rows = []
    for item in table:
        if not isinstance(item, dict):
            raise ValidationError("Each transmutation row must be an object.")
        row_min = _safe_float(item.get("min"), field_name="transmutation min")
        row_max = _safe_float(item.get("max"), field_name="transmutation max")
        row_value = _safe_float(item.get("value"), field_name="transmutation value")
        if row_min < 0 or row_max > 100:
            raise ValidationError("Transmutation min/max must be within 0..100.")
        if row_min > row_max:
            raise ValidationError("Transmutation row min must not exceed max.")
        if row_value < 0 or row_value > 100:
            raise ValidationError("Transmutation row value must be between 0 and 100.")
        rows.append({"min": row_min, "max": row_max, "value": row_value})

    rows.sort(key=lambda row: row["min"])

    epsilon = 0.000001
    for index in range(1, len(rows)):
        prev = rows[index - 1]
        curr = rows[index]
        if curr["min"] < prev["max"] - epsilon:
            raise ValidationError("Transmutation table has overlapping ranges.")
        if require_full_coverage and curr["min"] > prev["max"] + 0.01 + epsilon:
            raise ValidationError("Transmutation table has a gap between ranges.")

    if require_full_coverage:
        if rows[0]["min"] > 0 + epsilon:
            raise ValidationError("Transmutation table must start at 0.")
        if rows[-1]["max"] < 100 - epsilon:
            raise ValidationError("Transmutation table must end at 100.")

    return rows


def apply_custom_transform(weighted_total, custom_config):
    """Apply custom transmutation table mapping to a 0..100 weighted total."""
    score = round(_clamp_0_100(weighted_total), 2)
    config = _config_dict(custom_config)
    table = config.get("transmutation_table") or DEFAULT_CUSTOM_TRANSMUTATION_TABLE
    validated_table = validate_custom_transmutation_table(table, require_full_coverage=True)

    for row in validated_table:
        if row["min"] <= score <= row["max"]:
            return round(row["value"], 2)

    # Should not happen with full-coverage validation, but keep safe fallback.
    return round(score, 2)


def _validate_formula_ast(node):
    allowed_nodes = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.Mod,
        ast.Pow,
        ast.USub,
        ast.UAdd,
        ast.Constant,
        ast.Name,
        ast.Load,
        ast.Call,
    )

    for child in ast.walk(node):
        if not isinstance(child, allowed_nodes):
            raise ValidationError("Custom formula contains unsupported syntax.")
        if isinstance(child, ast.Call):
            if not isinstance(child.func, ast.Name) or child.func.id not in SAFE_FORMULA_FUNCTIONS:
                raise ValidationError("Custom formula uses an unsupported function.")


def evaluate_custom_formula(expression, variables):
    text = str(expression or "").strip()
    if not text:
        raise ValidationError("Custom formula cannot be empty.")

    try:
        parsed = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        raise ValidationError("Custom formula is invalid.") from exc

    _validate_formula_ast(parsed)

    safe_globals = {"__builtins__": {}}
    safe_locals = {key: float(value) for key, value in variables.items()}
    safe_locals.update(SAFE_FORMULA_FUNCTIONS)

    try:
        result = eval(compile(parsed, "<grading-formula>", "eval"), safe_globals, safe_locals)
    except Exception as exc:
        raise ValidationError("Custom formula could not be evaluated.") from exc

    return _formula_round(_safe_float(result, "custom formula result"))


def _final_transform(weighted_total, scheme):
    """Final transform layer. Keeps formula behavior while enforcing 0..100 output."""
    weighted_total = _clamp_0_100(weighted_total)
    if scheme.grading_type == GradingScheme.TYPE_ZERO_BASED:
        return round(weighted_total, 2)
    if scheme.grading_type == GradingScheme.TYPE_TRANSMUTED:
        return round(_clamp_0_100(50.0 + (weighted_total * 0.5)), 2)
    if scheme.grading_type == GradingScheme.TYPE_CUSTOM:
        return apply_custom_transform(weighted_total, getattr(scheme, "custom_config", {}) or {})
    raise ValidationError(f"Unsupported course grading type '{scheme.grading_type}'.")


def _validate_component_weights(components):
    if not components:
        raise ValidationError("At least one grading component is required.")

    total_weight = 0.0
    for component in components:
        weight = _safe_float(component.weight, field_name=f"weight for component '{component.name}'")
        if weight < 0 or weight > 100:
            raise ValidationError(f"Weight for component '{component.name}' must be between 0 and 100.")
        total_weight += weight

    if abs(total_weight - 100.0) > 0.0001:
        raise ValidationError("Total component weights must equal 100%.")


def _legacy_component_activity_ids(component, activities_by_id):
    lowered = _normalize_name(component.name)
    for category_key, aliases in ACTIVITY_CATEGORY_ALIASES.items():
        if lowered in aliases or any(alias in lowered for alias in aliases):
            return _activities_for_category(category_key, activities_by_id)
    return []


def _resolve_component_activity_ids(component, activities_by_id, scheme, allow_legacy_component_mapping):
    raw_ids = component.activity_ids if isinstance(component.activity_ids, list) else []
    config = _config_dict(getattr(scheme, "custom_config", {}))
    auto_detect_activities = _as_bool(config.get("auto_detect_activities"), True)
    rule = _component_rule_map(scheme).get(_normalize_name(component.name), {})

    inferred_ids = []
    category_key = rule.get("category_key")
    if category_key:
        inferred_ids = _activities_for_category(category_key, activities_by_id)
    elif allow_legacy_component_mapping:
        inferred_ids = _legacy_component_activity_ids(component, activities_by_id)

    if auto_detect_activities and rule.get("auto_include_matches", True):
        raw_ids = list(raw_ids) + list(inferred_ids)
    elif not raw_ids:
        raw_ids = inferred_ids

    if not raw_ids:
        # Backward-compatible mode: keep legacy/unmapped components as empty mappings
        # so grade sheet can still render and compute (component contributes 0).
        if allow_legacy_component_mapping:
            return []
        raise ValidationError(f"Component '{component.name}' has no activity_ids mapping.")

    cleaned_ids = []
    for raw_id in raw_ids:
        try:
            activity_id = int(raw_id)
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"Component '{component.name}' has invalid activity ID value.") from exc
        if activity_id not in activities_by_id:
            raise ValidationError(f"Component '{component.name}' references unknown activity ID {activity_id}.")
        cleaned_ids.append(activity_id)

    return sorted(set(cleaned_ids))


def _validate_no_component_overlap(component_activity_ids):
    seen = {}
    for component_name, activity_ids in component_activity_ids.items():
        for activity_id in activity_ids:
            if activity_id in seen:
                raise ValidationError(
                    f"Activity ID {activity_id} is assigned to multiple components: '{seen[activity_id]}' and '{component_name}'."
                )
            seen[activity_id] = component_name


def _load_grading_context(course, students):
    scheme = GradingScheme.objects.filter(course=course).prefetch_related("components").first()
    if not scheme:
        return None

    components = list(scheme.components.all())
    _validate_component_weights(components)

    activities = list(CourseActivity.objects.filter(course=course).select_related("activity_type"))
    activities_by_id = {int(activity.id): activity for activity in activities}

    treat_missing_as_zero = _scheme_bool(scheme, "treat_missing_as_zero", True)
    passfail_threshold = _scheme_percent(scheme, "passfail_threshold", 60.0)
    allow_legacy_component_mapping = _scheme_bool(scheme, "allow_legacy_component_mapping", True)
    allow_component_overlap = _scheme_bool(scheme, "allow_component_overlap", False)
    component_rule_map = _component_rule_map(scheme)

    component_activity_ids = OrderedDict()
    for component in components:
        resolved_ids = _resolve_component_activity_ids(
            component,
            activities_by_id,
            scheme,
            allow_legacy_component_mapping=allow_legacy_component_mapping,
        )
        component_activity_ids[component.name] = resolved_ids

    if not allow_component_overlap:
        _validate_no_component_overlap(component_activity_ids)

    student_ids = [int(student.id) for student in students]

    submissions = (
        ActivitySubmission.objects.filter(
            student_id__in=student_ids,
            activity__course=course,
            status__in=["submitted", "graded"],
            grade__isnull=False,
        )
        .select_related("activity", "activity__activity_type")
        .order_by("student_id", "activity_id", "-submitted_at", "-id")
    )

    submissions_by_student = defaultdict(dict)
    for row in submissions:
        student_id = int(row.student_id)
        activity_id = int(row.activity_id)
        if activity_id not in submissions_by_student[student_id]:
            submissions_by_student[student_id][activity_id] = row

    overrides = GradingComponentScore.objects.filter(component__in=components, student_id__in=student_ids)
    override_by_student_component = {}
    for row in overrides:
        override_by_student_component[(int(row.student_id), int(row.component_id))] = row

    attendance_map = _attendance_average_map(course, student_ids)
    detected_activities = [
        {
            "id": int(activity.id),
            "title": activity.title,
            "category_key": _activity_category_for(activity),
            "category_label": _activity_category_label(_activity_category_for(activity)),
            "activity_type": str(getattr(activity.activity_type, "name", "") or ""),
            "assessment_type": str(getattr(activity, "assessment_type", "") or ""),
            "grading_type": str(getattr(activity, "grading_type", "") or ""),
            "points": float(getattr(activity, "points", 0) or 0),
        }
        for activity in activities
    ]

    return {
        "scheme": scheme,
        "components": components,
        "activities_by_id": activities_by_id,
        "detected_activities": detected_activities,
        "component_activity_ids": component_activity_ids,
        "component_rule_map": component_rule_map,
        "submissions_by_student": submissions_by_student,
        "override_by_student_component": override_by_student_component,
        "attendance_map": attendance_map,
        "treat_missing_as_zero": treat_missing_as_zero,
        "passfail_threshold": passfail_threshold,
        "allow_legacy_component_mapping": allow_legacy_component_mapping,
    }


def _activity_score_entry(activity, submission, attendance_percent, treat_missing_as_zero, passfail_threshold):
    raw_score = submission.grade if submission else None
    derived_from_attendance = False
    if raw_score is None and not bool(getattr(activity.activity_type, "requires_points", True)):
        raw_score = attendance_percent
        derived_from_attendance = True

    if derived_from_attendance:
        normalized = round(_clamp_0_100(raw_score), 2)
    else:
        normalized = normalize_score(
            activity,
            raw_score,
            total_points=getattr(activity, "points", None),
            passfail_threshold=passfail_threshold,
        )

    missing = raw_score is None
    excluded = normalized is None
    included = False
    normalized_value = None

    if excluded:
        if missing and treat_missing_as_zero and str(getattr(activity, "grading_type", "points")).lower() != "none":
            normalized_value = 0.0
            included = True
    else:
        normalized_value = round(_clamp_0_100(normalized), 2)
        included = True

    return {
        "activity_id": int(activity.id),
        "title": activity.title,
        "category_key": _activity_category_for(activity),
        "category_label": _activity_category_label(_activity_category_for(activity)),
        "activity_type": str(getattr(activity.activity_type, "name", "") or ""),
        "assessment_type": str(getattr(activity, "assessment_type", "") or ""),
        "grading_type": str(getattr(activity, "grading_type", "") or ""),
        "score": None if raw_score is None else round(float(raw_score), 2),
        "max_score": round(float(getattr(activity, "points", 0) or 0), 2),
        "normalized_score": normalized_value,
        "missing": bool(missing),
        "excluded": bool(excluded),
        "included": bool(included),
        "dropped": False,
        "derived_from_attendance": derived_from_attendance,
    }


def _component_score_for_student(component, student_id, context):
    override_row = context["override_by_student_component"].get((int(student_id), int(component.id)))
    rule = context["component_rule_map"].get(_normalize_name(component.name), {})
    drop_lowest_count = max(int(rule.get("drop_lowest_count") or 0), 0)

    if override_row is not None:
        raw_score = round(_clamp_0_100(_safe_float(override_row.raw_score, "override score")), 2)
        return {
            "raw": raw_score,
            "has_score": True,
            "override": True,
            "drop_lowest_count": drop_lowest_count,
            "activities": [],
            "calculation": "Instructor override",
        }

    activity_ids = context["component_activity_ids"][component.name]
    activities_by_id = context["activities_by_id"]
    student_submissions = context["submissions_by_student"].get(int(student_id), {})
    attendance_percent = context["attendance_map"].get(int(student_id), 0.0)
    treat_missing_as_zero = context["treat_missing_as_zero"]
    passfail_threshold = context["passfail_threshold"]
    allow_legacy_component_mapping = context.get("allow_legacy_component_mapping", True)

    if not activity_ids and allow_legacy_component_mapping and "attendance" in _normalize_name(component.name):
        return {
            "raw": round(attendance_percent, 2),
            "has_score": True,
            "override": False,
            "drop_lowest_count": drop_lowest_count,
            "activities": [],
            "calculation": "Attendance average",
        }

    activity_rows = []
    for activity_id in activity_ids:
        activity = activities_by_id[activity_id]
        submission = student_submissions.get(activity_id)
        activity_rows.append(
            _activity_score_entry(
                activity,
                submission,
                attendance_percent,
                treat_missing_as_zero=treat_missing_as_zero,
                passfail_threshold=passfail_threshold,
            )
        )

    included_rows = [row for row in activity_rows if row["included"] and row["normalized_score"] is not None]
    if included_rows and drop_lowest_count > 0:
        for row in sorted(included_rows, key=lambda item: (float(item["normalized_score"]), item["activity_id"]))[:drop_lowest_count]:
            row["dropped"] = True

    final_rows = [row for row in included_rows if not row["dropped"]]
    if not final_rows:
        raw_value = 0.0
    else:
        raw_value = round(sum(float(row["normalized_score"]) for row in final_rows) / len(final_rows), 2)

    return {
        "raw": raw_value,
        "has_score": bool(final_rows),
        "override": False,
        "drop_lowest_count": drop_lowest_count,
        "activities": activity_rows,
        "calculation": "Average normalized activity score",
    }


def _final_grade_details(weighted_total, component_values, scheme):
    config = _config_dict(getattr(scheme, "custom_config", {}))
    weighted_total = round(_clamp_0_100(weighted_total), 2)

    if scheme.grading_type == GradingScheme.TYPE_ZERO_BASED:
        return {
            "final_grade": weighted_total,
            "formula": "Final Grade = weighted total",
            "formula_text": "Final Grade = (Score / Max Score) x 100 through each weighted category",
        }
    if scheme.grading_type == GradingScheme.TYPE_TRANSMUTED:
        return {
            "final_grade": round(_clamp_0_100(50.0 + (weighted_total * 0.5)), 2),
            "formula": "Final Grade = 50 + (weighted total x 0.5)",
            "formula_text": "Base-50: Final Grade = 50 + (Weighted Total / 100) x 50",
        }
    if scheme.grading_type == GradingScheme.TYPE_CUSTOM:
        formula_expression = str(config.get("formula_expression") or "").strip()
        if formula_expression:
            custom_variables = {"weighted_total": weighted_total}
            for component_name, details in component_values.items():
                custom_variables[_slugify_identifier(component_name, "component")] = float(details["raw"])
                custom_variables[f"{_slugify_identifier(component_name, 'component')}_weighted"] = float(details["weighted"])
            return {
                "final_grade": evaluate_custom_formula(formula_expression, custom_variables),
                "formula": f"Custom Formula = {formula_expression}",
                "formula_text": "Custom formula uses category scores and weighted_total variables",
            }
        return {
            "final_grade": apply_custom_transform(weighted_total, config),
            "formula": "Final Grade = custom transmutation(weighted total)",
            "formula_text": "Custom transmutation maps the weighted total to the final grade table",
        }
    raise ValidationError(f"Unsupported course grading type '{scheme.grading_type}'.")


def _compute_student_details(student, context):
    components = context["components"]
    weighted_total = 0.0
    active_weight_total = 0.0
    breakdown = OrderedDict()
    student_submissions = context["submissions_by_student"].get(int(student.id), {})
    attendance_percent = context["attendance_map"].get(int(student.id), 0.0)
    all_activity_map = OrderedDict()

    for component in components:
        component_score = _component_score_for_student(component, student.id, context)
        raw_score = component_score["raw"]
        weight = _safe_float(component.weight, field_name=f"weight for component '{component.name}'")
        weighted = raw_score * (weight / 100.0)
        if context["treat_missing_as_zero"] or component_score["has_score"]:
            weighted_total += weighted
            active_weight_total += weight
        breakdown[component.name] = {
            "raw": round(_clamp_0_100(raw_score), 2),
            "weight": round(weight, 2),
            "weighted": round(weighted, 2),
            "override": component_score["override"],
            "drop_lowest_count": component_score["drop_lowest_count"],
            "formula": component_score["calculation"],
            "activities": component_score["activities"],
        }
        for activity_row in component_score["activities"]:
            all_activity_map.setdefault(int(activity_row["activity_id"]), activity_row)

    if not context["treat_missing_as_zero"] and active_weight_total > 0:
        weighted_total = weighted_total / (active_weight_total / 100.0)

    for activity_id, activity in context["activities_by_id"].items():
        if int(activity_id) not in all_activity_map:
            all_activity_map[int(activity_id)] = _activity_score_entry(
                activity,
                student_submissions.get(int(activity_id)),
                attendance_percent,
                treat_missing_as_zero=context["treat_missing_as_zero"],
                passfail_threshold=context["passfail_threshold"],
            )

    final_details = _final_grade_details(weighted_total, breakdown, context["scheme"])
    mapped_activity_ids = {activity_id for activity_ids in context["component_activity_ids"].values() for activity_id in activity_ids}
    uncovered_activities = [
        activity
        for activity in context["detected_activities"]
        if int(activity["id"]) not in mapped_activity_ids and str(activity.get("grading_type") or "").lower() != "none"
    ]

    return {
        "final_grade": round(_clamp_0_100(final_details["final_grade"]), 2),
        "weighted_total": round(weighted_total, 2),
        "components": breakdown,
        "activities": list(all_activity_map.values()),
        "uncovered_activities": uncovered_activities,
        "formula": final_details["formula"],
        "formula_text": final_details["formula_text"],
    }


def compute_grade_details_for_students(course, students):
    try:
        context = _load_grading_context(course, students)
    except ValidationError as exc:
        return {int(student.id): {"error": str(exc)} for student in students}
    if context is None:
        return {
            int(student.id): {
                "final_grade": 0.0,
                "weighted_total": 0.0,
                "components": OrderedDict(),
                "activities": [],
                "uncovered_activities": [],
                "formula": "Final Grade = weighted total",
                "formula_text": "Final Grade = weighted total",
            }
            for student in students
        }

    results = {}
    for student in students:
        try:
            results[int(student.id)] = _compute_student_details(student, context)
        except ValidationError as exc:
            results[int(student.id)] = {"error": str(exc)}
    return results


def compute_component_scores(student, course):
    details = compute_final_grade_details(student, course)
    return OrderedDict((name, values["raw"]) for name, values in details.get("components", {}).items())


def compute_final_grade(student, course):
    details = compute_final_grade_details(student, course)
    return details["final_grade"]


def compute_final_grade_details(student, course):
    context = _load_grading_context(course, [student])
    if context is None:
        return {
            "final_grade": 0.0,
            "weighted_total": 0.0,
            "components": OrderedDict(),
            "activities": [],
            "uncovered_activities": [],
            "formula": "Final Grade = weighted total",
            "formula_text": "Final Grade = weighted total",
        }
    return _compute_student_details(student, context)
