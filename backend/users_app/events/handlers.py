from users_app.services.notifications import _display_name, notify_bulk, notify_single


def _notify_course_single(
    *,
    recipient,
    actor,
    notification_type,
    title,
    message,
    event_key,
    course=None,
    activity=None,
    submission=None,
):
    return notify_single(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        title=title,
        message=message,
        event_key=event_key,
        course=course,
        activity=activity,
        submission=submission,
    )


def _attendance_rows(*, course, session, actor, records):
    actor_name = _display_name(actor)
    rows = []
    for record in records or []:
        if record.status not in {"absent", "late"}:
            continue
        rows.append(
            {
                "recipient": record.student,
                "actor": actor,
                "notification_type": "attendance_alert",
                "title": "Attendance alert",
                "message": (
                    f"You were marked {record.status} for {session.topic} in {course.title} by "
                    f"{actor_name}."
                ),
                "event_key": f"attendance:{session.id}:{record.student_id}:{record.status}",
                "course": course,
            }
        )
    return rows


def _announcement_rows(*, announcement, actor):
    course = announcement.course
    actor_name = _display_name(actor)
    rows = []
    students = list(course.students.all().only("id", "first_name", "last_name", "username"))
    for student in students:
        if not getattr(student, "notify_instructor_announcement", True):
            continue
        rows.append(
            {
                "recipient": student,
                "actor": actor,
                "notification_type": "announcement_created",
                "title": "New announcement",
                "message": f"{actor_name} posted a new announcement in {course.title}.",
                "event_key": f"announcement:{announcement.id}:{student.id}",
                "course": course,
                "activity": announcement,
            }
        )
    return rows


def _meeting_rows(*, meeting, actor):
    course = meeting.course
    actor_name = _display_name(actor)
    rows = []
    students = list(course.students.all().only("id", "first_name", "last_name", "username"))
    for student in students:
        rows.append(
            {
                "recipient": student,
                "actor": actor,
                "notification_type": "meeting_scheduled",
                "title": "New meeting scheduled",
                "message": f"{actor_name} scheduled {meeting.title} in {course.title}.",
                "event_key": f"meeting:{meeting.id}:{student.id}",
                "course": course,
            }
        )
    return rows


def on_student_added_to_course(*, course, student, actor):
    return notify_bulk(
        [
            {
                "recipient": student,
                "actor": actor,
                "notification_type": "course_enrollment",
                "title": "Added to course",
                "message": f"You were added to {course.title} by {_display_name(actor)}.",
                "event_key": f"course-enrollment:add-student:{course.id}:{student.id}",
                "course": course,
            }
        ]
    )


def on_student_joined_course(*, course, student, actor):
    if not getattr(course.instructor, "notify_student_join_course", True):
        return None

    return _notify_course_single(
        recipient=course.instructor,
        actor=actor,
        notification_type="course_enrollment",
        title="Student enrolled",
        message=f"{_display_name(student)} joined {course.title}.",
        event_key=f"course-enrollment:join:{course.id}:{student.id}",
        course=course,
    )


def on_enrollment_request_created(*, enrollment_request, actor):
    course = enrollment_request.course
    instructor = course.instructor
    if not getattr(instructor, "notify_student_join_course", True):
        return None

    return _notify_course_single(
        recipient=instructor,
        actor=actor,
        notification_type="course_enrollment_request",
        title="Enrollment request received",
        message=f"{_display_name(enrollment_request.student)} requested to join {course.title}.",
        event_key=f"course-enrollment-request:{enrollment_request.id}",
        course=course,
    )


def on_assignment_submitted(*, submission, actor):
    activity = submission.activity
    course = activity.course
    instructor = course.instructor
    if not getattr(instructor, "notify_assignment_submission", True):
        return None

    return _notify_course_single(
        recipient=instructor,
        actor=actor,
        notification_type="assignment_submission",
        title="Assignment submitted",
        message=f"{_display_name(actor)} submitted {activity.title} in {course.title}.",
        event_key=f"assignment-submission:{submission.id}",
        course=course,
        activity=activity,
        submission=submission,
    )


def on_grade_posted(*, submission, actor):
    if submission.grade is None or not getattr(submission.student, "notify_assignment_graded", True):
        return None

    activity = submission.activity
    course = activity.course
    return _notify_course_single(
        recipient=submission.student,
        actor=actor,
        notification_type="assignment_graded",
        title="Assignment graded",
        message=f"{activity.title} in {course.title} was graded by {_display_name(actor)}.",
        event_key=f"assignment-graded:{submission.id}:{submission.grade}",
        course=course,
        activity=activity,
        submission=submission,
    )


def on_quiz_completed(*, attempt, actor):
    activity = attempt.activity
    course = activity.course
    instructor = course.instructor
    if not getattr(instructor, "notify_quiz_completed", True):
        return None

    return _notify_course_single(
        recipient=instructor,
        actor=actor,
        notification_type="quiz_completed",
        title="Quiz completed",
        message=f"{_display_name(actor)} completed {activity.title} in {course.title}.",
        event_key=f"quiz-completed:{attempt.id}",
        course=course,
        activity=activity,
    )


def on_attendance_marked(*, course, session, actor, records):
    return notify_bulk(_attendance_rows(course=course, session=session, actor=actor, records=records))


def on_announcement_created(*, announcement, actor):
    return notify_bulk(_announcement_rows(announcement=announcement, actor=actor))


def on_meeting_scheduled(*, meeting, actor):
    return notify_bulk(_meeting_rows(meeting=meeting, actor=actor))
