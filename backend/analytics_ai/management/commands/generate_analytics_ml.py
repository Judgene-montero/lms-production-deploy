from django.core.management.base import BaseCommand

from analytics_ai.ml.train_model import train_model
from analytics_ai.models import CourseAnalytics, StudentAnalytics
from analytics_ai.services.analytics_service import run_full_analysis
from courses.models import Course
from users_app.models import User


class Command(BaseCommand):
    help = "Generate analytics for enrolled students and retrain the ML model."

    def add_arguments(self, parser):
        parser.add_argument(
            "--course",
            type=int,
            dest="course_id",
            help="Process only one course by COURSE_ID.",
        )
        parser.add_argument(
            "--clear-old",
            action="store_true",
            dest="clear_old",
            help="Clear old StudentAnalytics and CourseAnalytics entries before generation.",
        )

    def handle(self, *args, **options):
        course_id = options.get("course_id")
        clear_old = bool(options.get("clear_old"))

        courses = Course.objects.all().prefetch_related("students")
        if course_id:
            courses = courses.filter(id=course_id)
            if not courses.exists():
                self.stdout.write(self.style.WARNING(f"Course with id={course_id} was not found."))
                return

        if clear_old:
            if course_id:
                StudentAnalytics.objects.filter(course_id=course_id).delete()
                CourseAnalytics.objects.filter(course_id=course_id).delete()
                self.stdout.write(self.style.WARNING(f"Cleared old analytics for course id={course_id}."))
            else:
                StudentAnalytics.objects.all().delete()
                CourseAnalytics.objects.all().delete()
                self.stdout.write(self.style.WARNING("Cleared old analytics for all courses."))

        total_courses = courses.count()
        self.stdout.write(self.style.NOTICE(f"Starting analytics generation for {total_courses} course(s)..."))

        for index, course in enumerate(courses, start=1):
            enrolled_students = User.objects.filter(
                id__in=course.students.values_list("id", flat=True),
                role="student",
            )
            student_count = enrolled_students.count()
            self.stdout.write(
                self.style.NOTICE(
                    f"[{index}/{total_courses}] Course {course.id} - {course.title}: {student_count} student(s)"
                )
            )

            for student in enrolled_students:
                student_name = (f"{student.first_name} {student.last_name}").strip() or student.username
                try:
                    run_full_analysis(student, course)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  Processed student {student.id} - {student_name}"
                        )
                    )
                except Exception as exc:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Warning: failed student {student.id} - {student_name}: {exc}"
                        )
                    )
                    continue

        self.stdout.write(self.style.NOTICE("Analytics generation complete. Retraining ML model..."))
        try:
            result = train_model()
            accuracy = result.get("accuracy")
            status = result.get("status", "model trained")
            self.stdout.write(
                self.style.SUCCESS(
                    f"ML training status: {status} | accuracy={accuracy}"
                )
            )
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"ML training warning: {exc}"))

        self.stdout.write(self.style.SUCCESS("Analytics + ML retraining completed successfully"))
