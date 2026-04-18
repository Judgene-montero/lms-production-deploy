from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase

from courses.models import (
    ActivitySubmission,
    ActivityType,
    AttendanceRecord,
    AttendanceSession,
    CourseActivity,
    GradingComponent,
    GradingScheme,
)
from courses.services.grading import compute_final_grade_details, compute_grade_details_for_students, normalize_score
from users_app.models import Course


class GradingEngineTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.instructor = User.objects.create_user(username="instructor1", password="x", role="instructor")
        self.student = User.objects.create_user(username="student1", password="x", role="student")

        self.course = Course.objects.create(instructor=self.instructor, title="Math 101", description="", category="")
        self.course.students.add(self.student)

        self.assignment_type = ActivityType.objects.create(name="assignment", requires_points=True)
        self.quiz_type = ActivityType.objects.create(name="quiz", requires_points=True)
        self.attendance_type = ActivityType.objects.create(name="attendance", requires_points=False)

    def _create_activity(self, title, activity_type, grading_type, points=100, assessment_type=CourseActivity.ASSESSMENT_QUIZ):
        return CourseActivity.objects.create(
            course=self.course,
            title=title,
            description="",
            activity_type=activity_type,
            grading_type=grading_type,
            points=points,
            assessment_type=assessment_type,
        )

    def _grade(self, activity, score):
        ActivitySubmission.objects.create(
            activity=activity,
            student=self.student,
            status="graded",
            grade=score,
        )

    def test_normalize_score_points_percent_passfail_none(self):
        points_activity = self._create_activity("A1", self.assignment_type, "points", points=50)
        percent_activity = self._create_activity("A2", self.assignment_type, "percent", points=100)
        passfail_activity = self._create_activity("A3", self.assignment_type, "passfail", points=1)
        none_activity = self._create_activity("A4", self.assignment_type, "none", points=100)

        self.assertEqual(normalize_score(points_activity, 25, total_points=50), 50.0)
        self.assertEqual(normalize_score(percent_activity, 88), 88.0)
        self.assertEqual(normalize_score(passfail_activity, 1, total_points=1), 100.0)
        self.assertEqual(normalize_score(passfail_activity, 0, total_points=1), 0.0)
        self.assertIsNone(normalize_score(none_activity, 100))

    def test_compute_final_grade_zero_based_dynamic(self):
        quiz_1 = self._create_activity("Quiz 1", self.quiz_type, "points", points=100)
        quiz_2 = self._create_activity("Quiz 2", self.quiz_type, "points", points=100)
        exam = self._create_activity("Exam", self.quiz_type, "percent", points=100, assessment_type=CourseActivity.ASSESSMENT_EXAM)
        behavior = self._create_activity("Behavior", self.assignment_type, "passfail", points=1)

        self._grade(quiz_1, 80)
        self._grade(quiz_2, 60)
        self._grade(exam, 90)
        self._grade(behavior, 1)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED, passing_grade=75)
        GradingComponent.objects.create(scheme=scheme, name="Quizzes", weight=40, activity_ids=[quiz_1.id, quiz_2.id])
        GradingComponent.objects.create(scheme=scheme, name="Exam", weight=40, activity_ids=[exam.id])
        GradingComponent.objects.create(scheme=scheme, name="Behavior", weight=20, activity_ids=[behavior.id])

        details = compute_final_grade_details(self.student, self.course)

        # quizzes avg=(80+60)/2=70 => 28, exam=90 => 36, behavior pass=100 => 20
        self.assertEqual(details["final_grade"], 84.0)

    def test_transmuted_and_custom_are_different(self):
        exam = self._create_activity("Exam", self.quiz_type, "percent", points=100)
        self._grade(exam, 80)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Exam", weight=100, activity_ids=[exam.id])

        zero_based = compute_final_grade_details(self.student, self.course)["final_grade"]

        scheme.grading_type = GradingScheme.TYPE_TRANSMUTED
        scheme.save(update_fields=["grading_type"])
        transmuted = compute_final_grade_details(self.student, self.course)["final_grade"]

        scheme.grading_type = GradingScheme.TYPE_CUSTOM
        scheme.custom_config = {"transmutation_table": [{"min": 0, "max": 100, "value": 92}]}
        scheme.save(update_fields=["grading_type", "custom_config"])
        custom = compute_final_grade_details(self.student, self.course)["final_grade"]

        self.assertEqual(zero_based, 80.0)
        self.assertEqual(transmuted, 90.0)
        self.assertEqual(custom, 92.0)

    def test_division_by_zero_and_clamping(self):
        points_zero = self._create_activity("Zero Total", self.assignment_type, "points", points=0)
        over_percent = self._create_activity("Over", self.assignment_type, "percent", points=100)
        negative_percent = self._create_activity("Negative", self.assignment_type, "percent", points=100)

        self._grade(points_zero, 50)
        self._grade(over_percent, 160)
        self._grade(negative_percent, -20)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Zero", weight=34, activity_ids=[points_zero.id])
        GradingComponent.objects.create(scheme=scheme, name="Over", weight=33, activity_ids=[over_percent.id])
        GradingComponent.objects.create(scheme=scheme, name="Negative", weight=33, activity_ids=[negative_percent.id])

        details = compute_final_grade_details(self.student, self.course)
        # 0*0.34 + 100*0.33 + 0*0.33 = 33
        self.assertEqual(details["final_grade"], 33.0)

    def test_unknown_activity_mapping_raises_validation_error(self):
        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Invalid", weight=100, activity_ids=[999999])

        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.student, self.course)

    def test_legacy_component_without_activity_ids_still_computes(self):
        quiz = self._create_activity("Quiz Legacy", self.quiz_type, "points", points=100, assessment_type=CourseActivity.ASSESSMENT_QUIZ)
        self._grade(quiz, 75)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Quizzes", weight=100, activity_ids=[])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 75.0)

    def test_missing_submissions_are_zero_by_default(self):
        quiz_1 = self._create_activity("Quiz 1", self.quiz_type, "points", points=100)
        quiz_2 = self._create_activity("Quiz 2", self.quiz_type, "points", points=100)
        self._grade(quiz_1, 100)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Quizzes", weight=100, activity_ids=[quiz_1.id, quiz_2.id])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 50.0)

    def test_missing_submissions_can_be_excluded_by_config(self):
        quiz_1 = self._create_activity("Quiz 1", self.quiz_type, "points", points=100)
        quiz_2 = self._create_activity("Quiz 2", self.quiz_type, "points", points=100)
        self._grade(quiz_1, 100)

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"treat_missing_as_zero": False},
        )
        GradingComponent.objects.create(scheme=scheme, name="Quizzes", weight=100, activity_ids=[quiz_1.id, quiz_2.id])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 100.0)

    def test_passfail_threshold_is_configurable(self):
        task = self._create_activity("Task", self.assignment_type, "passfail", points=100)
        self._grade(task, 70)

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"passfail_threshold": 80},
        )
        GradingComponent.objects.create(scheme=scheme, name="Task", weight=100, activity_ids=[task.id])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 0.0)

    def test_overlapping_activity_ids_raise_by_default(self):
        quiz = self._create_activity("Quiz", self.quiz_type, "points", points=100)
        self._grade(quiz, 90)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="Comp A", weight=50, activity_ids=[quiz.id])
        GradingComponent.objects.create(scheme=scheme, name="Comp B", weight=50, activity_ids=[quiz.id])

        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.student, self.course)

    def test_overlap_can_be_allowed_by_config(self):
        quiz = self._create_activity("Quiz", self.quiz_type, "points", points=100)
        self._grade(quiz, 80)

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"allow_component_overlap": True},
        )
        GradingComponent.objects.create(scheme=scheme, name="Comp A", weight=50, activity_ids=[quiz.id])
        GradingComponent.objects.create(scheme=scheme, name="Comp B", weight=50, activity_ids=[quiz.id])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 80.0)

    def test_batch_compute_returns_per_student_error_without_crash(self):
        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"allow_legacy_component_mapping": False},
        )
        GradingComponent.objects.create(scheme=scheme, name="Broken", weight=100, activity_ids=[])

        details_map = compute_grade_details_for_students(self.course, [self.student])
        self.assertIn("error", details_map[self.student.id])

    def test_custom_transmutation_overlap_raises_validation_error(self):
        exam = self._create_activity("Exam", self.quiz_type, "percent", points=100)
        self._grade(exam, 90)

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_CUSTOM,
            custom_config={
                "transmutation_table": [
                    {"min": 0, "max": 80, "value": 75},
                    {"min": 70, "max": 100, "value": 95},
                ]
            },
        )
        GradingComponent.objects.create(scheme=scheme, name="Exam", weight=100, activity_ids=[exam.id])

        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.student, self.course)

    def test_legacy_attendance_component_without_activity_ids_uses_attendance_records(self):
        session = AttendanceSession.objects.create(
            course=self.course,
            date="2026-01-10",
            topic="Week 1",
            created_by=self.instructor,
        )
        AttendanceRecord.objects.create(
            session=session,
            student=self.student,
            status=AttendanceRecord.STATUS_PRESENT,
            marked_by=self.instructor,
        )

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"allow_legacy_component_mapping": True},
        )
        GradingComponent.objects.create(scheme=scheme, name="Attendance", weight=100, activity_ids=[])

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 100.0)

    def test_mapped_attendance_activity_with_zero_points_uses_attendance_percent(self):
        attendance_activity = self._create_activity(
            "Attendance Activity",
            self.attendance_type,
            "points",
            points=100,  # model save should coerce this to 0 for requires_points=False types
        )

        session = AttendanceSession.objects.create(
            course=self.course,
            date="2026-01-11",
            topic="Week 2",
            created_by=self.instructor,
        )
        AttendanceRecord.objects.create(
            session=session,
            student=self.student,
            status=AttendanceRecord.STATUS_PRESENT,
            marked_by=self.instructor,
        )

        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
        )
        GradingComponent.objects.create(
            scheme=scheme,
            name="Attendance",
            weight=100,
            activity_ids=[attendance_activity.id],
        )

        details = compute_final_grade_details(self.student, self.course)
        self.assertEqual(details["final_grade"], 100.0)
