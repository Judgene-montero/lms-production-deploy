from django.shortcuts import get_object_or_404

from courses.models import Meeting, MeetingAttendance
from users_app.events.registry import dispatch_event
from users_app.models import Course


def _get_course_with_role_access(*, course_id, user):
    course = get_object_or_404(Course.objects.select_related("instructor"), id=course_id)
    if getattr(user, "role", "") == "instructor" and course.instructor_id == user.id:
        return course
    if getattr(user, "role", "") == "student" and course.students.filter(id=user.id).exists():
        return course
    return None


def create_meeting(*, course_id, title, scheduled_time, meeting_link, created_by):
    course = _get_course_with_role_access(course_id=course_id, user=created_by)
    if not course or course.instructor_id != created_by.id:
        raise PermissionError("Only the course instructor can create meetings.")

    meeting = Meeting.objects.create(
        course=course,
        title=title,
        scheduled_time=scheduled_time,
        meeting_link=meeting_link,
        created_by=created_by,
    )
    dispatch_event("meeting_scheduled", meeting=meeting, actor=created_by)
    return meeting


def list_course_meetings(*, course_id, user):
    course = _get_course_with_role_access(course_id=course_id, user=user)
    if not course:
        raise PermissionError("Course not found or access denied.")

    return (
        Meeting.objects.filter(course=course)
        .select_related("course", "created_by")
        .order_by("scheduled_time", "id")
    )


def mark_meeting_attendance(*, meeting, student):
    attendance, _ = MeetingAttendance.objects.get_or_create(
        meeting=meeting,
        student=student,
    )
    return attendance


def join_meeting(*, meeting_id, student):
    meeting = get_object_or_404(
        Meeting.objects.select_related("course", "created_by", "course__instructor"),
        id=meeting_id,
    )
    course = _get_course_with_role_access(course_id=meeting.course_id, user=student)
    if not course or getattr(student, "role", "") != "student":
        raise PermissionError("Only enrolled students can join meetings.")

    attendance = mark_meeting_attendance(meeting=meeting, student=student)
    return meeting, attendance
