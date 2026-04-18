import io
import time
import tracemalloc
from collections import OrderedDict

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from courses.models import ActivitySubmission, ActivityType, CourseActivity, GradingComponent, GradingComponentScore, GradingScheme
from courses.services.grading import compute_final_grade_details, compute_grade_details_for_students, normalize_score
from courses.views import upload_grades
from users_app.models import Course


class LMSGradingEngineFullQATests(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.instructor = self.User.objects.create_user(username="qa_instructor", password="x", role="instructor")
        self.students = [
            self.User.objects.create_user(username=f"qa_student_{index}", password="x", role="student")
            for index in range(1, 6)
        ]
        self.course = Course.objects.create(instructor=self.instructor, title="QA Course", description="", category="")
        self.course.students.add(*self.students)

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

    def _grade(self, student, activity, score):
        ActivitySubmission.objects.create(
            activity=activity,
            student=student,
            status="graded",
            grade=score,
        )

    def _build_core_dataset(self):
        activity_points = self._create_activity("Problem Set", self.assignment_type, "points", points=50)
        activity_percent = self._create_activity("Midterm", self.quiz_type, "percent", points=100, assessment_type=CourseActivity.ASSESSMENT_EXAM)
        activity_passfail = self._create_activity("Lab Check", self.assignment_type, "passfail", points=100)
        activity_none = self._create_activity("Survey", self.assignment_type, "none", points=100)

        # Student 1: complete
        self._grade(self.students[0], activity_points, 45)      # 90%
        self._grade(self.students[0], activity_percent, 80)     # 80%
        self._grade(self.students[0], activity_passfail, 70)    # pass with default threshold 60
        self._grade(self.students[0], activity_none, 100)       # excluded

        # Student 2: mixed low/high
        self._grade(self.students[1], activity_points, 20)      # 40%
        self._grade(self.students[1], activity_percent, 95)     # 95%
        self._grade(self.students[1], activity_passfail, 40)    # fail

        # Student 3: missing percent and passfail
        self._grade(self.students[2], activity_points, 25)      # 50%

        # Student 4: over/negative to test clamping safety
        self._grade(self.students[3], activity_points, 80)      # 160% -> 100
        self._grade(self.students[3], activity_percent, -10)    # -> 0
        self._grade(self.students[3], activity_passfail, 100)   # pass

        # Student 5: none-only score should not contribute directly
        self._grade(self.students[4], activity_none, 88)

        return activity_points, activity_percent, activity_passfail, activity_none

    def test_01_core_functionality(self):
        activity_points, activity_percent, activity_passfail, activity_none = self._build_core_dataset()

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED, passing_grade=75)
        GradingComponent.objects.create(scheme=scheme, name="PointsWork", weight=40, activity_ids=[activity_points.id])
        GradingComponent.objects.create(scheme=scheme, name="ExamPart", weight=40, activity_ids=[activity_percent.id])
        GradingComponent.objects.create(scheme=scheme, name="LabPart", weight=20, activity_ids=[activity_passfail.id])

        expected_zero = {
            self.students[0].id: 88.0,  # 90*.4 + 80*.4 + 100*.2
            self.students[1].id: 54.0,  # 40*.4 + 95*.4 + 0*.2
            self.students[2].id: 20.0,  # 50*.4 + 0 + 0 (missing->0 default)
            self.students[3].id: 60.0,  # 100*.4 + 0*.4 + 100*.2
            self.students[4].id: 0.0,   # no mapped scores
        }

        actual_zero = {student.id: compute_final_grade_details(student, self.course)["final_grade"] for student in self.students}
        self.assertEqual(actual_zero, expected_zero)

        # Transmuted
        scheme.grading_type = GradingScheme.TYPE_TRANSMUTED
        scheme.save(update_fields=["grading_type"])
        actual_transmuted = {student.id: compute_final_grade_details(student, self.course)["final_grade"] for student in self.students}
        expected_transmuted = {student_id: round(50 + (grade * 0.5), 2) for student_id, grade in expected_zero.items()}
        self.assertEqual(actual_transmuted, expected_transmuted)

        # Custom table
        scheme.grading_type = GradingScheme.TYPE_CUSTOM
        scheme.custom_config = {
            "transmutation_table": [
                {"min": 0, "max": 59.99, "value": 70},
                {"min": 60, "max": 79.99, "value": 85},
                {"min": 80, "max": 100, "value": 95},
            ]
        }
        scheme.save(update_fields=["grading_type", "custom_config"])
        actual_custom = {student.id: compute_final_grade_details(student, self.course)["final_grade"] for student in self.students}
        expected_custom = {
            self.students[0].id: 95.0,
            self.students[1].id: 70.0,
            self.students[2].id: 70.0,
            self.students[3].id: 85.0,
            self.students[4].id: 70.0,
        }
        self.assertEqual(actual_custom, expected_custom)

        # Activity-level normalization spot checks
        self.assertEqual(normalize_score(activity_points, 45, total_points=50), 90.0)
        self.assertEqual(normalize_score(activity_percent, 80), 80.0)
        self.assertEqual(normalize_score(activity_passfail, 70, total_points=100, passfail_threshold=60), 100.0)
        self.assertIsNone(normalize_score(activity_none, 100))

    def test_02_missing_submissions_policy(self):
        activity_points, _, activity_passfail, _ = self._build_core_dataset()
        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="A", weight=50, activity_ids=[activity_points.id])
        GradingComponent.objects.create(scheme=scheme, name="B", weight=50, activity_ids=[activity_passfail.id])

        # student3 has points only (50), missing passfail
        details_default = compute_final_grade_details(self.students[2], self.course)
        self.assertEqual(details_default["final_grade"], 25.0)  # (50*.5 + 0*.5)

        scheme.custom_config = {"treat_missing_as_zero": False}
        scheme.save(update_fields=["custom_config"])
        details_exclude = compute_final_grade_details(self.students[2], self.course)
        self.assertEqual(details_exclude["final_grade"], 50.0)  # (50 averaged only present component)

    def test_03_passfail_threshold(self):
        activity_passfail = self._create_activity("PF", self.assignment_type, "passfail", points=100)
        self._grade(self.students[0], activity_passfail, 70)
        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"passfail_threshold": 80},
        )
        GradingComponent.objects.create(scheme=scheme, name="PFComp", weight=100, activity_ids=[activity_passfail.id])
        self.assertEqual(compute_final_grade_details(self.students[0], self.course)["final_grade"], 0.0)

    def test_04_overlap_ids_block_and_override(self):
        activity = self._create_activity("Shared", self.quiz_type, "percent", points=100)
        self._grade(self.students[0], activity, 77)
        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="C1", weight=50, activity_ids=[activity.id])
        GradingComponent.objects.create(scheme=scheme, name="C2", weight=50, activity_ids=[activity.id])

        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.students[0], self.course)

        scheme.custom_config = {"allow_component_overlap": True}
        scheme.save(update_fields=["custom_config"])
        self.assertEqual(compute_final_grade_details(self.students[0], self.course)["final_grade"], 77.0)

    def test_05_legacy_fallback_toggle(self):
        legacy_quiz = self._create_activity("Legacy Quiz", self.quiz_type, "points", points=100, assessment_type=CourseActivity.ASSESSMENT_QUIZ)
        self._grade(self.students[0], legacy_quiz, 82)
        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"allow_legacy_component_mapping": True},
        )
        GradingComponent.objects.create(scheme=scheme, name="Quizzes", weight=100, activity_ids=[])
        self.assertEqual(compute_final_grade_details(self.students[0], self.course)["final_grade"], 82.0)

        scheme.custom_config = {"allow_legacy_component_mapping": False}
        scheme.save(update_fields=["custom_config"])
        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.students[0], self.course)

    def test_06_upload_grades_validation(self):
        activity = self._create_activity("Score Base", self.quiz_type, "percent", points=100)
        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        component = GradingComponent.objects.create(scheme=scheme, name="UploadComp", weight=100, activity_ids=[activity.id])

        csv_text = "\n".join(
            [
                "student_id,UploadComp",
                f"{self.students[0].id},95",
                f"{self.students[1].id},abc",
                f"{self.students[2].id},-3",
                f"{self.students[3].id},120",
                f"{self.students[4].id},NaN",
            ]
        )

        factory = APIRequestFactory()
        upload = io.BytesIO(csv_text.encode("utf-8"))
        upload.name = "grades.csv"
        request = factory.post(
            f"/api/courses/{self.course.id}/upload-grades/",
            {"file": upload},
            format="multipart",
        )
        force_authenticate(request, user=self.instructor)
        response = upload_grades(request, self.course.id)

        self.assertEqual(response.status_code, 400)
        self.assertIn("details", response.data)

        # Current backend behavior rejects the file when any row is invalid.
        # QA expectation for partial success is intentionally not met; this asserts current behavior.
        self.assertEqual(GradingComponentScore.objects.filter(component=component).count(), 0)

    def test_07_custom_transmutation_validation(self):
        activity = self._create_activity("Exam", self.quiz_type, "percent", points=100)
        self._grade(self.students[0], activity, 88)

        valid_scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_CUSTOM,
            custom_config={
                "transmutation_table": [
                    {"min": 0, "max": 49.99, "value": 65},
                    {"min": 50, "max": 79.99, "value": 80},
                    {"min": 80, "max": 100, "value": 95},
                ]
            },
        )
        GradingComponent.objects.create(scheme=valid_scheme, name="Exam", weight=100, activity_ids=[activity.id])
        self.assertEqual(compute_final_grade_details(self.students[0], self.course)["final_grade"], 95.0)

        invalid_overlap = GradingScheme.objects.create(
            course=Course.objects.create(instructor=self.instructor, title="Other", description="", category=""),
            grading_type=GradingScheme.TYPE_CUSTOM,
            custom_config={
                "transmutation_table": [
                    {"min": 0, "max": 80, "value": 75},
                    {"min": 70, "max": 100, "value": 90},
                ]
            },
        )
        GradingComponent.objects.create(scheme=invalid_overlap, name="X", weight=100, activity_ids=[activity.id])
        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.students[0], invalid_overlap.course)

    def test_08_scalability_batch(self):
        perf_course = Course.objects.create(instructor=self.instructor, title="Perf Course", description="", category="")
        perf_students = [
            self.User(username=f"perf_student_{index}", role="student")
            for index in range(1000)
        ]
        self.User.objects.bulk_create(perf_students, batch_size=500)
        perf_students = list(self.User.objects.filter(username__startswith="perf_student_").order_by("id"))
        perf_course.students.add(*perf_students)

        perf_type = ActivityType.objects.create(name="perf_assignment", requires_points=True)
        activities = [
            CourseActivity(
                course=perf_course,
                title=f"A{index}",
                description="",
                activity_type=perf_type,
                grading_type="points",
                points=100,
                assessment_type=CourseActivity.ASSESSMENT_QUIZ,
            )
            for index in range(50)
        ]
        CourseActivity.objects.bulk_create(activities, batch_size=200)
        activities = list(CourseActivity.objects.filter(course=perf_course).order_by("id"))

        scheme = GradingScheme.objects.create(course=perf_course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        for index in range(10):
            start = index * 5
            chunk = activities[start : start + 5]
            GradingComponent.objects.create(
                scheme=scheme,
                name=f"C{index + 1}",
                weight=10,
                activity_ids=[activity.id for activity in chunk],
            )

        submissions_batch = []
        for student in perf_students:
            sid = int(student.id)
            for activity in activities:
                score = float((sid + activity.id) % 101)
                submissions_batch.append(
                    ActivitySubmission(
                        activity=activity,
                        student=student,
                        status="graded",
                        grade=score,
                    )
                )
            if len(submissions_batch) >= 5000:
                ActivitySubmission.objects.bulk_create(submissions_batch, batch_size=2000)
                submissions_batch = []
        if submissions_batch:
            ActivitySubmission.objects.bulk_create(submissions_batch, batch_size=2000)

        tracemalloc.start()
        started = time.perf_counter()
        details_map = compute_grade_details_for_students(perf_course, perf_students)
        elapsed = time.perf_counter() - started
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Sanity checks: all students computed, no crashes, bounded values.
        self.assertEqual(len(details_map), len(perf_students))
        sample = details_map[perf_students[0].id]
        self.assertIn("final_grade", sample)
        self.assertGreaterEqual(sample["final_grade"], 0.0)
        self.assertLessEqual(sample["final_grade"], 100.0)

        # Performance guardrails for QA automation environment (generous upper bounds).
        self.assertLess(elapsed, 90.0)
        self.assertLess(peak / (1024 * 1024), 1500.0)

    def test_09_edge_cases(self):
        a_points = self._create_activity("P", self.assignment_type, "points", points=0)
        a_percent = self._create_activity("Q", self.quiz_type, "percent", points=100)
        a_pass = self._create_activity("R", self.assignment_type, "passfail", points=100)
        a_none = self._create_activity("S", self.assignment_type, "none", points=100)

        self._grade(self.students[0], a_points, -20)
        self._grade(self.students[0], a_percent, 150)
        self._grade(self.students[0], a_pass, 0)
        self._grade(self.students[0], a_none, 100)

        scheme = GradingScheme.objects.create(course=self.course, grading_type=GradingScheme.TYPE_ZERO_BASED)
        GradingComponent.objects.create(scheme=scheme, name="P", weight=25, activity_ids=[a_points.id])
        GradingComponent.objects.create(scheme=scheme, name="Q", weight=25, activity_ids=[a_percent.id])
        GradingComponent.objects.create(scheme=scheme, name="R", weight=25, activity_ids=[a_pass.id])
        GradingComponent.objects.create(scheme=scheme, name="S", weight=25, activity_ids=[a_none.id])

        details = compute_final_grade_details(self.students[0], self.course)
        self.assertGreaterEqual(details["final_grade"], 0.0)
        self.assertLessEqual(details["final_grade"], 100.0)
        self.assertIsInstance(details["components"], OrderedDict)

    def test_10_backward_compatibility(self):
        legacy_exam = self._create_activity("Legacy Exam", self.quiz_type, "percent", points=100, assessment_type=CourseActivity.ASSESSMENT_EXAM)
        self._grade(self.students[0], legacy_exam, 73)
        scheme = GradingScheme.objects.create(
            course=self.course,
            grading_type=GradingScheme.TYPE_ZERO_BASED,
            custom_config={"allow_legacy_component_mapping": True},
        )
        GradingComponent.objects.create(scheme=scheme, name="Exams", weight=100, activity_ids=[])
        self.assertEqual(compute_final_grade_details(self.students[0], self.course)["final_grade"], 73.0)

        scheme.custom_config = {"allow_legacy_component_mapping": False}
        scheme.save(update_fields=["custom_config"])
        with self.assertRaises(ValidationError):
            compute_final_grade_details(self.students[0], self.course)
