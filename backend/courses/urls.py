from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter
from .views import ActivitySubmissionViewSet, join_course, regenerate_join_code, toggle_archive, toggle_join_code

urlpatterns = [
    # -----------------------------
    # STUDENT ROUTES
    # -----------------------------
    path("student/courses/", views.student_enrolled_courses),
    path("join/", join_course, name="join-course-global"),
    path("student/courses/<int:course_id>/join/", views.join_course, name="join-course"),
    path(
    "<int:course_id>/activities/<int:activity_id>/submissions/<int:submission_id>/",
    views.grade_submission,
    name="grade-submission"),
    path("student/courses/<int:course_id>/", views.student_course_detail),
    path("student/courses/<int:course_id>/lessons/", views.student_course_lessons),
    path("student/courses/<int:course_id>/activities/", views.student_course_activities),
    path("<int:course_id>/progress/", views.course_progress, name="course-progress"),
    path("<int:course_id>/lessons/<int:lesson_id>/complete/", views.complete_lesson, name="lesson-complete"),
    path("student/activities/<int:activity_id>/comments/", views.activity_comments),

    # -----------------------------
    # Instructor Courses
    # -----------------------------
    path("", views.instructor_courses_list, name="instructor-courses-list"),
    path('courses/<int:course_id>/toggle-join-code/', toggle_join_code),
    path('courses/<int:course_id>/toggle-archive/', toggle_archive),
    path('courses/<int:course_id>/regenerate-join-code/', regenerate_join_code),

    # -----------------------------
    # Course-specific routes (all subpaths first!)
    # -----------------------------
    path("<int:course_id>/announcements/", views.course_announcements, name="course-announcements"),
    path("<int:course_id>/modules/", views.course_modules, name="course-modules"),
    path("<int:course_id>/modules/import/", views.import_module_from_file, name="module-import"),
    path("<int:course_id>/modules/<int:module_id>/", views.module_detail, name="module-detail-by-course"),
    path("modules/<int:module_id>/lessons/", views.module_lessons, name="module-lessons"),
    path("modules/<int:module_id>/", views.module_detail, name="module-detail"),
    path("<int:course_id>/lessons/", views.lessons_list, name="lessons-list"),
    path("<int:course_id>/lessons/add/", views.add_lesson, name="add-lesson"),
    path("<int:course_id>/lessons/extract/", views.extract_lesson_file_preview, name="lesson-file-extract"),
    path("<int:course_id>/lessons/<int:lesson_id>/", views.lesson_detail, name="lesson-detail-by-course"),
    path("lessons/<int:lesson_id>/", views.lesson_detail, name="lesson-detail"),
    path("<int:course_id>/activities/", views.activities_list, name="activities-list"),
    path("<int:course_id>/activities/add/", views.add_activity, name="add-activity"),
    path("<int:course_id>/activities/<int:activity_id>/", views.activity_detail, name="activity-detail"),
    path("<int:course_id>/exam-quizzes/", views.exam_quizzes_list, name="exam-quizzes-list"),
    path("<int:course_id>/exam-quizzes/<int:activity_id>/", views.exam_quiz_detail, name="exam-quiz-detail"),
    path("<int:course_id>/exam-quizzes/<int:activity_id>/settings/", views.exam_quiz_settings, name="exam-quiz-settings"),
    path("<int:course_id>/exam-quizzes/<int:activity_id>/submissions/", views.exam_quiz_submission_reviews, name="exam-quiz-submissions"),
    path("<int:course_id>/exam-quizzes/<int:activity_id>/submissions/<int:attempt_id>/", views.exam_quiz_submission_review_detail, name="exam-quiz-submission-detail"),
    path("<int:course_id>/exam-quizzes/draft/", views.classwork_draft, name="exam-quiz-draft"),
    path("<int:course_id>/exam-quizzes/import/", views.classwork_import_questions, name="exam-quiz-import"),
    path("<int:course_id>/question-bank/", views.question_bank_items, name="question-bank-items"),
    path("<int:course_id>/question-bank/<int:item_id>/", views.question_bank_item_detail, name="question-bank-item-detail"),
    path("<int:course_id>/exam-quizzes/<int:activity_id>/security-events/", views.quiz_security_events, name="exam-quiz-security-events"),
    path("<int:course_id>/activities/<int:activity_id>/quiz/", views.quiz_detail, name="quiz-detail"),
    path("<int:course_id>/activities/<int:activity_id>/quiz/start/", views.quiz_start, name="quiz-start"),
    path("<int:course_id>/activities/<int:activity_id>/quiz/submit/", views.quiz_submit, name="quiz-submit"),
    path("<int:course_id>/activities/<int:activity_id>/quiz/review/", views.quiz_review, name="quiz-review"),
    path("<int:course_id>/grading-scheme/", views.grading_scheme_detail, name="grading-scheme"),
    path("<int:course_id>/gradesheet/", views.grade_sheet, name="grade-sheet"),
    path("<int:course_id>/gradesheet/export/", views.grade_sheet_export, name="grade-sheet-export"),
    path("<int:course_id>/upload-grades/", views.upload_grades, name="upload-grades"),
    path("<int:course_id>/activities/<int:activity_id>/submissions/", views.submissions_list, name="submissions-list"),
    path("<int:course_id>/activities/<int:activity_id>/submit/", views.submit_task, name="submit-task"),
    path("<int:course_id>/activities/<int:activity_id>/attendance/", views.activity_attendance, name="activity-attendance"),
    path("submissions/<int:submission_id>/delete/", views.unsubmit_task, name="unsubmit-task"),
    path("<int:course_id>/attendance/sessions/", views.attendance_sessions, name="attendance-sessions"),
    path("<int:course_id>/attendance/sessions/<int:session_id>/", views.attendance_session_detail, name="attendance-session-detail"),
    path("<int:course_id>/attendance/sessions/<int:session_id>/records/", views.attendance_records, name="attendance-records"),
    path("attendance/session/", views.attendance_create_session, name="attendance-create-session"),
    path("attendance/<int:course_id>/", views.attendance_by_course, name="attendance-by-course"),
    path("attendance/<int:session_id>/record/", views.attendance_record_by_session, name="attendance-record-by-session"),
    path("<int:course_id>/comments/", views.comments_list, name="comments-list"),
    path("<int:course_id>/comments/add/", views.add_comment, name="add-comment"),
    path("<int:course_id>/feedback/", views.feedback_list, name="feedback-list"),
    path("<int:course_id>/feedback/add/", views.leave_feedback, name="leave-feedback"),
    path("<int:course_id>/add-student/", views.add_student, name="add-student"),
    path("<int:course_id>/students/", views.students_list, name="students-list"),

    # -----------------------------
    # Activity types
    # -----------------------------
    path("activity-types/", views.activity_types, name="activity-types"),

    # -----------------------------
    # Main course detail LAST
    # -----------------------------
    path("<int:course_id>/", views.course_detail, name="course-detail"),
]

# -----------------------------
# ViewSets via router
# -----------------------------
router = DefaultRouter()
router.register(r'submissions', ActivitySubmissionViewSet, basename='submissions')
urlpatterns += router.urls
