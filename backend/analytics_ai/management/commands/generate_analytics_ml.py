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
            action="append",
            dest="course_ids",
            help="Process only the specified COURSE_ID. Repeat the flag to include multiple courses.",
        )
        parser.add_argument(
            "--clear-old",
            action="store_true",
            dest="clear_old",
            help="Clear old StudentAnalytics and CourseAnalytics entries before generation.",
        )

    def handle(self, *args, **options):
        raw_course_ids = options.get("course_ids") or []
        course_ids = list(dict.fromkeys(raw_course_ids))
        clear_old = bool(options.get("clear_old"))

        courses = Course.objects.all().prefetch_related("students")
        if course_ids:
            courses = courses.filter(id__in=course_ids)
            if not courses.exists():
                self.stdout.write(self.style.WARNING(f"No matching courses were found for ids={course_ids}."))
                return
            found_course_ids = set(courses.values_list("id", flat=True))
            missing_course_ids = [course_id for course_id in course_ids if course_id not in found_course_ids]
            if missing_course_ids:
                self.stdout.write(
                    self.style.WARNING(
                        f"Some requested courses were not found and will be skipped: {missing_course_ids}"
                    )
                )

        if clear_old:
            if course_ids:
                StudentAnalytics.objects.filter(course_id__in=course_ids).delete()
                CourseAnalytics.objects.filter(course_id__in=course_ids).delete()
                self.stdout.write(self.style.WARNING(f"Cleared old analytics for course ids={course_ids}."))
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
            result = train_model(courses=courses)
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
