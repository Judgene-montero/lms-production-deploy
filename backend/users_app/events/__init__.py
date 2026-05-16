from .handlers import (
    on_announcement_created,
    on_assignment_submitted,
    on_attendance_marked,
    on_grade_posted,
    on_quiz_completed,
    on_student_added_to_course,
    on_student_joined_course,
)
from .registry import EVENT_MAP, dispatch_event

__all__ = [
    "dispatch_event",
    "EVENT_MAP",
    "on_announcement_created",
    "on_assignment_submitted",
    "on_attendance_marked",
    "on_grade_posted",
    "on_quiz_completed",
    "on_student_added_to_course",
    "on_student_joined_course",
]
