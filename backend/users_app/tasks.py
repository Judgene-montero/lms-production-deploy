from django.conf import settings
from django.core.mail import send_mail

from celery import shared_task

from users_app.models import Notification


EMAIL_NOTIFICATION_TYPES = {
    "assignment_submission",
    "assignment_graded",
    "assignment_submitted",
    "announcement_created",
}


@shared_task
def send_notification_email(notification_id):
    try:
        notification = Notification.objects.select_related("recipient").get(id=notification_id)
    except Notification.DoesNotExist:
        return False

    recipient = notification.recipient
    email = getattr(recipient, "email", "") or ""
    if not email or notification.notification_type not in EMAIL_NOTIFICATION_TYPES:
        return False

    send_mail(
        subject=notification.title or "LMS notification",
        message=notification.message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )
    return True
