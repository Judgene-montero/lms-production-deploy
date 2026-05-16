import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from analytics_ai.services.analytics_service import refresh_course_analytics
from analytics_ai.services.model_metrics import get_at_risk_model_metrics
from analytics_ai.services.risk_engine import calculate_risk_score, get_risk_settings
from courses.models import (
    ActivitySubmission,
    ActivityType,
    AttendanceRecord,
    AttendanceSession,
    CourseActivity,
    GradingComponent,
    GradingScheme,
)
from users_app.models import Course, SiteSettings


User = get_user_model()


ACTIVITY_PLAN = [
    ("early", "Assignment 1", 100),
    ("early", "Assignment 2", 100),
    ("early", "Assignment 3", 100),
    ("early", "Quiz 1", 100),
    ("mid", "Assignment 4", 100),
    ("mid", "Quiz 2", 100),
    ("mid", "Project Checkpoint", 100),
    ("mid", "Midterm Exam", 100),
    ("final", "Assignment 5", 100),
    ("final", "Quiz 3", 100),
    ("final", "Final Project", 100),
    ("final", "Final Exam", 100),
]

PROFILE_COUNTS = {
    "low": 72,
    "medium": 38,
    "borderline": 20,
    "high": 20,
}

PROFILE_CONFIG = {
    "low": {
        "target_grade": (84, 96),
        "trend": (-3, 6),
        "missing": (0, 1),
        "late": (0, 2),
        "attendance_absent": (0, 1),
        "attendance_late": (0, 1),
    },
    "medium": {
        "target_grade": (86, 94),
        "trend": (-6, 3),
        "missing": (1, 2),
        "late": (2, 4),
        "attendance_absent": (1, 3),
        "attendance_late": (1, 3),
    },
    "borderline": {
        "target_grade": (71, 82),
        "trend": (-10, 4),
        "missing": (1, 4),
        "late": (1, 5),
        "attendance_absent": (1, 4),
        "attendance_late": (0, 3),
    },
    "high": {
        "target_grade": (48, 72),
        "trend": (-16, -3),
        "missing": (3, 7),
        "late": (3, 7),
        "attendance_absent": (3, 6),
        "attendance_late": (1, 3),
    },
}


class Command(BaseCommand):
    help = "Seed a realistic thesis analytics dataset and refresh analytics metrics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--course-title",
            default="THESIS Analytics Evaluation Dataset",
            help="Course title for the synthetic evaluation cohort.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the synthetic course and users before recreating them.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=20260419,
            help="Random seed for reproducible synthetic student variation.",
        )
        parser.add_argument(
            "--instructor",
            default="",
            help="Attach the seeded thesis course to a specific instructor username.",
        )

    def handle(self, *args, **options):
        course_title = options["course_title"]
        reset = bool(options["reset"])
        self.random = random.Random(int(options["seed"]))

        self._ensure_threshold_defaults()
        if reset:
            self._reset_seed_data(course_title)

        instructor = self._get_or_create_instructor(options.get("instructor") or "")
        course, _ = Course.objects.get_or_create(
            title=course_title,
            instructor=instructor,
            defaults={
                "description": "Synthetic dataset for thesis analytics evaluation.",
                "category": "Thesis Evaluation",
            },
        )

        flat_activities = self._create_course_structure(course)
        students = self._create_students(course, flat_activities)
        refresh_course_analytics(course)
        metrics = get_at_risk_model_metrics(course_id=course.id)
        settings = get_risk_settings()
        rule_counts = self._rule_risk_counts(course)

        self.stdout.write(self.style.SUCCESS(f"Seeded course id={course.id}: {course.title}"))
        self.stdout.write(self.style.SUCCESS(f"Students created/enrolled: {len(students)}"))
        self.stdout.write(self.style.SUCCESS(f"Profile counts: {PROFILE_COUNTS}"))
        self.stdout.write(self.style.SUCCESS(f"Rule risk counts: {rule_counts}"))
        self.stdout.write(
            self.style.NOTICE(
                "Thresholds: "
                f"low <= {settings['low_risk_max']}, "
                f"medium > {settings['low_risk_max']} and < {settings['high_risk_min']}, "
                f"high >= {settings['high_risk_min']}; "
                f"passing_grade={settings['passing_grade']}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Current metrics before retraining: "
                f"samples={metrics['samples']} TP={metrics['TP']} TN={metrics['TN']} "
                f"FP={metrics['FP']} FN={metrics['FN']} accuracy={metrics['accuracy']} "
                f"precision={metrics['precision']} recall={metrics['recall']} f1_score={metrics['f1_score']}"
            )
        )

    def _ensure_threshold_defaults(self):
        SiteSettings.objects.get_or_create(
            id=1,
            defaults={
                "analytics_low_risk_max": 0.30,
                "analytics_medium_risk_max": 0.60,
                "analytics_high_risk_min": 0.60,
                "analytics_passing_grade": 75.0,
            },
        )

    def _reset_seed_data(self, course_title):
        Course.objects.filter(title=course_title).delete()
        User.objects.filter(username__startswith="thesis_eval_").delete()

    def _get_or_create_instructor(self, requested_username=""):
        if requested_username:
            instructor = User.objects.filter(username=requested_username, role="instructor").first()
            if instructor:
                return instructor

        existing_instructor = (
            User.objects.filter(role="instructor")
            .exclude(username="thesis_eval_instructor")
            .order_by("id")
            .first()
        )
        if existing_instructor:
            return existing_instructor

        instructor, _ = User.objects.get_or_create(
            username="thesis_eval_instructor",
            defaults={
                "first_name": "Thesis",
                "last_name": "Instructor",
                "email": "thesis_eval_instructor@example.com",
                "role": "instructor",
                "is_active": True,
                "is_email_verified": True,
            },
        )
        if not instructor.check_password("ThesisEval123!"):
            instructor.set_password("ThesisEval123!")
            instructor.save(update_fields=["password"])
        return instructor

    def _create_course_structure(self, course):
        activity_types = {
            "assignment": ActivityType.objects.get_or_create(
                name="assignment",
                defaults={"weight": 0, "requires_points": True, "requires_due_date": True},
            )[0],
            "quiz": ActivityType.objects.get_or_create(
                name="quiz",
                defaults={"weight": 0, "requires_points": True, "requires_due_date": True},
            )[0],
            "project": ActivityType.objects.get_or_create(
                name="project",
                defaults={"weight": 0, "requires_points": True, "requires_due_date": True},
            )[0],
        }
        now = timezone.now()
        bucketed = {"early": [], "mid": [], "final": []}

        for index, (bucket, title, points) in enumerate(ACTIVITY_PLAN, start=1):
            type_key = "quiz" if "Quiz" in title or "Exam" in title else "project" if "Project" in title else "assignment"
            activity, _ = CourseActivity.objects.update_or_create(
                course=course,
                title=f"Thesis Eval {title}",
                defaults={
                    "description": "Synthetic graded activity for analytics evaluation.",
                    "activity_type": activity_types[type_key],
                    "due_date": now - timezone.timedelta(days=45 - (index * 3)),
                    "points": points,
                    "grading_type": "points",
                    "publish_state": CourseActivity.PUBLISH_STATE_PUBLISHED,
                    "assessment_type": CourseActivity.ASSESSMENT_EXAM if "Exam" in title else CourseActivity.ASSESSMENT_QUIZ,
                },
            )
            bucketed[bucket].append(activity)

        scheme, _ = GradingScheme.objects.update_or_create(
            course=course,
            defaults={
                "grading_type": GradingScheme.TYPE_ZERO_BASED,
                "passing_grade": 75,
                "custom_config": {"treat_missing_as_zero": True, "auto_detect_activities": False},
            },
        )
        GradingComponent.objects.filter(scheme=scheme).delete()
        GradingComponent.objects.create(
            scheme=scheme,
            name="Early Work",
            weight=30,
            activity_ids=[activity.id for activity in bucketed["early"]],
        )
        GradingComponent.objects.create(
            scheme=scheme,
            name="Mid Course Work",
            weight=35,
            activity_ids=[activity.id for activity in bucketed["mid"]],
        )
        GradingComponent.objects.create(
            scheme=scheme,
            name="Final Work",
            weight=35,
            activity_ids=[activity.id for activity in bucketed["final"]],
        )

        AttendanceSession.objects.filter(course=course).delete()
        for index in range(8):
            AttendanceSession.objects.create(
                course=course,
                date=(now - timezone.timedelta(days=42 - (index * 5))).date(),
                topic=f"Thesis Eval Attendance {index + 1}",
                created_by=course.instructor,
            )

        flat_activities = []
        for bucket, _, _ in ACTIVITY_PLAN:
            flat_activities.append((bucket, bucketed[bucket].pop(0)))
        return flat_activities

    def _create_students(self, course, flat_activities):
        students = []
        for profile_name, count in PROFILE_COUNTS.items():
            for number in range(1, count + 1):
                student = self._get_or_create_student(profile_name, number)
                course.students.add(student)
                students.append(student)
                plan = self._build_student_plan(profile_name)
                self._seed_student_records(course, student, flat_activities, plan)
        return students

    def _get_or_create_student(self, profile_name, number):
        username = f"thesis_eval_{profile_name}_{number:03d}"
        student, _ = User.objects.get_or_create(
            username=username,
            defaults={
                "first_name": profile_name.title(),
                "last_name": f"Student {number:03d}",
                "email": f"{username}@example.com",
                "role": "student",
                "school_id": f"TE{profile_name[:1].upper()}{number:04d}",
                "is_active": True,
                "is_email_verified": True,
                "is_verified_school_user": True,
                "profile_complete": True,
            },
        )
        if not student.check_password("ThesisEval123!"):
            student.set_password("ThesisEval123!")
            student.save(update_fields=["password"])
        return student

    def _build_student_plan(self, profile_name):
        config = PROFILE_CONFIG[profile_name]
        target_grade = self.random.uniform(*config["target_grade"])
        trend = self.random.uniform(*config["trend"])
        missing_count = self.random.randint(*config["missing"])
        late_count = self.random.randint(*config["late"])
        absent_count = self.random.randint(*config["attendance_absent"])
        attendance_late_count = self.random.randint(*config["attendance_late"])

        missing_indexes = set(self.random.sample(range(len(ACTIVITY_PLAN)), missing_count))
        submitted_indexes = [index for index in range(len(ACTIVITY_PLAN)) if index not in missing_indexes]
        late_count = min(late_count, len(submitted_indexes))
        late_indexes = set(self.random.sample(submitted_indexes, late_count))

        score_by_bucket = self._bucket_scores_for_target(target_grade, trend, missing_indexes)
        attendance_statuses = self._attendance_statuses(absent_count, attendance_late_count)
        return {
            "score_by_bucket": score_by_bucket,
            "missing_indexes": missing_indexes,
            "late_indexes": late_indexes,
            "attendance": attendance_statuses,
        }

    def _bucket_scores_for_target(self, target_grade, trend, missing_indexes):
        early_score = max(45.0, min(100.0, target_grade - (0.7 * trend) + self.random.uniform(-3, 3)))
        later_average = max(35.0, min(100.0, early_score + trend))
        mid_score = max(35.0, min(100.0, later_average + self.random.uniform(-4, 4)))
        final_score = max(35.0, min(100.0, (2 * later_average) - mid_score))

        bucket_base = {
            "early": early_score,
            "mid": mid_score,
            "final": final_score,
        }
        score_by_bucket = {}
        for bucket in ("early", "mid", "final"):
            values = []
            for _ in range(4):
                values.append(max(35.0, min(100.0, bucket_base[bucket] + self.random.uniform(-5, 5))))
            score_by_bucket[bucket] = values

        self._raise_scores_for_missing_work(score_by_bucket, missing_indexes, target_grade)
        return score_by_bucket

    def _raise_scores_for_missing_work(self, score_by_bucket, missing_indexes, target_grade):
        if not missing_indexes:
            return
        submitted_by_bucket = {"early": 4, "mid": 4, "final": 4}
        for index in missing_indexes:
            bucket = ACTIVITY_PLAN[index][0]
            submitted_by_bucket[bucket] -= 1
        if target_grade < 75:
            return
        for bucket, submitted_count in submitted_by_bucket.items():
            if submitted_count <= 0:
                continue
            missing_ratio = (4 - submitted_count) / 4
            boost = min(18.0, missing_ratio * 24.0)
            score_by_bucket[bucket] = [max(35.0, min(100.0, value + boost)) for value in score_by_bucket[bucket]]

    def _attendance_statuses(self, absent_count, late_count):
        statuses = [AttendanceRecord.STATUS_PRESENT for _ in range(8)]
        indexes = list(range(8))
        absent_indexes = set(self.random.sample(indexes, min(absent_count, len(indexes))))
        remaining = [index for index in indexes if index not in absent_indexes]
        late_indexes = set(self.random.sample(remaining, min(late_count, len(remaining))))
        for index in absent_indexes:
            statuses[index] = AttendanceRecord.STATUS_ABSENT
        for index in late_indexes:
            statuses[index] = AttendanceRecord.STATUS_LATE
        return statuses

    def _seed_student_records(self, course, student, flat_activities, plan):
        ActivitySubmission.objects.filter(activity__course=course, student=student).delete()
        bucket_position = {"early": 0, "mid": 0, "final": 0}

        for index, (bucket, activity) in enumerate(flat_activities):
            score_index = bucket_position[bucket]
            bucket_position[bucket] += 1
            if index in plan["missing_indexes"]:
                continue
            grade = round(plan["score_by_bucket"][bucket][score_index], 2)
            is_late = index in plan["late_indexes"]
            submitted_at = activity.due_date + timezone.timedelta(days=self.random.randint(1, 4)) if is_late else activity.due_date - timezone.timedelta(days=self.random.randint(1, 5))
            submission = ActivitySubmission.objects.create(
                activity=activity,
                student=student,
                text_answer=f"Synthetic {bucket} response for {student.username}",
                status="graded",
                grade=grade,
                feedback="Synthetic grade for thesis analytics evaluation.",
                is_late=is_late,
            )
            ActivitySubmission.objects.filter(id=submission.id).update(submitted_at=submitted_at, is_late=is_late)

        sessions = list(AttendanceSession.objects.filter(course=course).order_by("date", "id"))
        AttendanceRecord.objects.filter(session__in=sessions, student=student).delete()
        for session, status in zip(sessions, plan["attendance"]):
            AttendanceRecord.objects.create(
                session=session,
                student=student,
                status=status,
                marked_by=course.instructor,
                points_earned=100 if status in {AttendanceRecord.STATUS_PRESENT, AttendanceRecord.STATUS_EXCUSED} else 75 if status == AttendanceRecord.STATUS_LATE else 0,
            )

    def _rule_risk_counts(self, course):
        settings = get_risk_settings()
        counts = {"low": 0, "medium": 0, "high": 0}
        for analytics in course.student_analytics.all():
            _, risk_level = calculate_risk_score(
                analytics.average_grade,
                analytics.late_rate,
                analytics.missing_rate,
                settings,
            )
            counts[risk_level] += 1
        return counts
