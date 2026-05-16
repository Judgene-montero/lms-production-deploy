from unittest.mock import AsyncMock, patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from courses.models import ActivitySubmission, ActivityType, CourseActivity
from users_app.events.registry import dispatch_event
from users_app.models import Course, Notification, User
from users_app.services.notifications import notify_single, publish_notification
from users_app.tasks import send_notification_email


class NotificationBaseTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.instructor = User.objects.create_user(
            username="instructor1",
            password="testpass123",
            email="instructor@example.com",
            role="instructor",
            first_name="Ina",
            last_name="Structor",
        )
        self.student = User.objects.create_user(
            username="student1",
            password="testpass123",
            email="student@example.com",
            role="student",
            first_name="Stu",
            last_name="Dent",
        )
        self.student_two = User.objects.create_user(
            username="student2",
            password="testpass123",
            email="student2@example.com",
            role="student",
            first_name="Second",
            last_name="Learner",
        )
        self.other_user = User.objects.create_user(
            username="outsider",
            password="testpass123",
            email="outsider@example.com",
            role="student",
            first_name="Out",
            last_name="Sider",
        )

        self.course = Course.objects.create(
            instructor=self.instructor,
            title="Thesis LMS Course",
            description="Notification test course",
            category="Testing",
        )
        self.course.students.add(self.student, self.student_two)

        self.assignment_type = ActivityType.objects.create(name="assignment", requires_points=True, requires_due_date=True)
        self.announcement_type = ActivityType.objects.create(name="announcement", requires_points=False, requires_due_date=False)

        self.assignment = CourseActivity.objects.create(
            course=self.course,
            title="Assignment 1",
            description="Complete the assignment",
            activity_type=self.assignment_type,
            due_date=timezone.now() + timezone.timedelta(days=1),
            points=100,
        )

    def create_submission(self, *, student=None, grade=None):
        return ActivitySubmission.objects.create(
            activity=self.assignment,
            student=student or self.student,
            text_answer="My submission",
            status="submitted" if grade is None else "graded",
            grade=grade,
        )

    def create_announcement(self):
        return CourseActivity.objects.create(
            course=self.course,
            title="Announcement 1",
            description="Class update",
            activity_type=self.announcement_type,
            points=0,
        )


class NotificationEventTests(NotificationBaseTestCase):
    def test_assignment_submitted_notifies_instructor(self):
        submission = self.create_submission(student=self.student)

        with patch("users_app.services.notifications.publish_notification") as publish_mock, patch(
            "users_app.services.notifications.send_notification_email.delay"
        ) as email_delay_mock:
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_event("assignment_submitted", submission=submission, actor=self.student)

        notification = Notification.objects.get()
        self.assertEqual(notification.recipient, self.instructor)
        self.assertEqual(notification.actor, self.student)
        self.assertEqual(notification.course, self.course)
        self.assertEqual(notification.activity, self.assignment)
        self.assertEqual(notification.submission, submission)
        self.assertEqual(notification.notification_type, "assignment_submission")
        self.assertEqual(notification.event_key, f"assignment-submission:{submission.id}")
        publish_mock.assert_called_once()
        email_delay_mock.assert_called_once_with(notification.id)

    def test_assignment_graded_notifies_student(self):
        submission = self.create_submission(student=self.student, grade=95)

        with patch("users_app.services.notifications.publish_notification") as publish_mock, patch(
            "users_app.services.notifications.send_notification_email.delay"
        ) as email_delay_mock:
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_event("grade_posted", submission=submission, actor=self.instructor)

        notification = Notification.objects.get()
        self.assertEqual(notification.recipient, self.student)
        self.assertEqual(notification.notification_type, "assignment_graded")
        self.assertEqual(notification.event_key, f"assignment-graded:{submission.id}:{submission.grade}")
        publish_mock.assert_called_once()
        email_delay_mock.assert_called_once_with(notification.id)

    def test_announcement_created_notifies_multiple_students(self):
        announcement = self.create_announcement()

        with patch("users_app.services.notifications.publish_notification") as publish_mock, patch(
            "users_app.services.notifications.send_notification_email.delay"
        ) as email_delay_mock:
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_event("announcement_created", announcement=announcement, actor=self.instructor)

        notifications = list(Notification.objects.order_by("recipient_id"))
        self.assertEqual(len(notifications), 2)
        self.assertEqual({item.recipient_id for item in notifications}, {self.student.id, self.student_two.id})
        self.assertTrue(all(item.notification_type == "announcement_created" for item in notifications))
        self.assertEqual(publish_mock.call_count, 2)
        self.assertEqual(email_delay_mock.call_count, 2)

    def test_duplicate_prevention_uses_event_key(self):
        submission = self.create_submission(student=self.student)

        with patch("users_app.services.notifications.publish_notification") as publish_mock, patch(
            "users_app.services.notifications.send_notification_email.delay"
        ) as email_delay_mock:
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_event("assignment_submitted", submission=submission, actor=self.student)
            with self.captureOnCommitCallbacks(execute=True):
                dispatch_event("assignment_submitted", submission=submission, actor=self.student)

        self.assertEqual(Notification.objects.count(), 1)
        publish_mock.assert_called_once()
        email_delay_mock.assert_called_once()

    def test_multi_user_isolation(self):
        submission = self.create_submission(student=self.student)

        with self.captureOnCommitCallbacks(execute=True):
            dispatch_event("assignment_submitted", submission=submission, actor=self.student)

        self.assertEqual(Notification.objects.filter(recipient=self.student).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.student_two).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.other_user).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.instructor).count(), 1)


class NotificationApiTests(NotificationBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)

    def create_notification(self, *, recipient=None, is_read=False, event_key="event-1", notification_type="general"):
        return Notification.objects.create(
            recipient=recipient or self.student,
            actor=self.instructor,
            course=self.course,
            activity=self.assignment,
            event_key=event_key,
            notification_type=notification_type,
            title="Notification title",
            message="Notification body",
            is_read=is_read,
            read_at=timezone.now() if is_read else None,
        )

    def test_list_endpoint_returns_only_request_user_notifications(self):
        own = self.create_notification(recipient=self.student, event_key="own-1")
        self.create_notification(recipient=self.instructor, event_key="other-1")

        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()], [own.id])

    def test_unread_count_is_correct(self):
        self.create_notification(recipient=self.student, event_key="a", is_read=False)
        self.create_notification(recipient=self.student, event_key="b", is_read=False)
        self.create_notification(recipient=self.student, event_key="c", is_read=True)

        response = self.client.get("/api/notifications/unread-count/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unread_count"], 2)

    def test_mark_one_notification_as_read(self):
        notification = self.create_notification(recipient=self.student, event_key="single-read", is_read=False)

        with patch("users_app.views.publish_notification") as publish_mock:
            response = self.client.post(f"/api/notifications/{notification.id}/read/")

        notification.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)
        publish_mock.assert_called_once()

    def test_mark_all_notifications_as_read(self):
        one = self.create_notification(recipient=self.student, event_key="bulk-1", is_read=False)
        two = self.create_notification(recipient=self.student, event_key="bulk-2", is_read=False)

        with patch("users_app.views.publish_notifications") as publish_mock:
            response = self.client.post("/api/notifications/mark-all-read/")

        one.refresh_from_db()
        two.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 2)
        self.assertTrue(one.is_read)
        self.assertTrue(two.is_read)
        publish_mock.assert_called_once()


class NotificationRealtimeTests(NotificationBaseTestCase):
    def test_websocket_push_is_triggered_after_commit(self):
        with patch("users_app.services.notifications.publish_notification") as publish_mock, patch(
            "users_app.services.notifications.send_notification_email.delay"
        ) as email_delay_mock:
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                notify_single(
                    recipient=self.student,
                    actor=self.instructor,
                    notification_type="assignment_graded",
                    title="Assignment graded",
                    message="Your work was graded.",
                    event_key="commit-check-1",
                    course=self.course,
                    activity=self.assignment,
                )

            self.assertEqual(Notification.objects.count(), 1)
            self.assertEqual(len(callbacks), 1)
            publish_mock.assert_not_called()
            email_delay_mock.assert_not_called()

            callbacks[0]()

        publish_mock.assert_called_once()
        email_delay_mock.assert_called_once()

    def test_publish_notification_sends_group_payload(self):
        notification = Notification.objects.create(
            recipient=self.student,
            actor=self.instructor,
            course=self.course,
            activity=self.assignment,
            event_key="ws-publish-1",
            notification_type="assignment_graded",
            title="Assignment graded",
            message="Realtime payload",
        )
        channel_layer = type("Layer", (), {"group_send": AsyncMock()})()

        with patch("users_app.services.notifications.get_channel_layer", return_value=channel_layer):
            publish_notification(notification)

        channel_layer.group_send.assert_awaited_once()
        args = channel_layer.group_send.await_args.args
        self.assertEqual(args[0], f"notifications_user_{self.student.id}")
        self.assertEqual(args[1]["type"], "notification.message")
        self.assertEqual(args[1]["payload"]["id"], notification.id)


class NotificationEmailTaskTests(NotificationBaseTestCase):
    def test_email_task_sends_only_for_allowed_types(self):
        notification = Notification.objects.create(
            recipient=self.student,
            actor=self.instructor,
            course=self.course,
            activity=self.assignment,
            event_key="email-allowed-1",
            notification_type="assignment_graded",
            title="Assignment graded",
            message="Email me",
        )

        with patch("users_app.tasks.send_mail") as send_mail_mock:
            result = send_notification_email(notification.id)

        self.assertTrue(result)
        send_mail_mock.assert_called_once()

    def test_email_task_skips_disallowed_types(self):
        notification = Notification.objects.create(
            recipient=self.student,
            actor=self.instructor,
            course=self.course,
            activity=self.assignment,
            event_key="email-skip-1",
            notification_type="attendance_alert",
            title="Attendance",
            message="No email for this",
        )

        with patch("users_app.tasks.send_mail") as send_mail_mock:
            result = send_notification_email(notification.id)

        self.assertFalse(result)
        send_mail_mock.assert_not_called()
