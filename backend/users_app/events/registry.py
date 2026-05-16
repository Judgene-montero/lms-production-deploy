from .handlers import (
    on_announcement_created,
    on_assignment_submitted,
    on_enrollment_request_created,
    on_attendance_marked,
    on_grade_posted,
    on_meeting_scheduled,
    on_quiz_completed,
    on_student_added_to_course,
    on_student_joined_course,
)


EVENT_MAP = {
    "announcement_created": on_announcement_created,
    "assignment_submitted": on_assignment_submitted,
    "enrollment_request_created": on_enrollment_request_created,
    "attendance_marked": on_attendance_marked,
    "grade_posted": on_grade_posted,
    "meeting_scheduled": on_meeting_scheduled,
    "quiz_completed": on_quiz_completed,
    "student_added_to_course": on_student_added_to_course,
    "student_joined_course": on_student_joined_course,
}


def dispatch_event(event_name, **kwargs):
    handler = EVENT_MAP.get(event_name)
    if handler is None:
        raise ValueError(f"Unknown event: {event_name}")
    return handler(**kwargs)


__all__ = ["EVENT_MAP", "dispatch_event"]
