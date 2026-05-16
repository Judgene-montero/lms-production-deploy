from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from dashboards_app.serializers import NotificationSerializer
from users_app.models import Notification
from users_app.tasks import EMAIL_NOTIFICATION_TYPES, send_notification_email


def _display_name(user):
    if not user:
        return "Someone"

    full_name_fn = getattr(user, "full_name", None)
    if callable(full_name_fn):
        value = str(full_name_fn() or "").strip()
        if value:
            return value

    get_full_name_fn = getattr(user, "get_full_name", None)
    if callable(get_full_name_fn):
        value = str(get_full_name_fn() or "").strip()
        if value:
            return value

    value = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    return value or getattr(user, "username", "Someone")


def _notification_group_name(recipient_id):
    return f"notifications_user_{recipient_id}"


def serialize_notification(notification):
    return NotificationSerializer(notification).data


def publish_notification(notification):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        _notification_group_name(notification.recipient_id),
        {
            "type": "notification.message",
            "payload": serialize_notification(notification),
        },
    )


def publish_notifications(notifications):
    for notification in notifications:
        publish_notification(notification)


def _queue_notification_email(notification):
    if notification.notification_type not in EMAIL_NOTIFICATION_TYPES:
        return
    send_notification_email.delay(notification.id)


def _after_notifications_created(notifications):
    for notification in notifications:
        publish_notification(notification)
        _queue_notification_email(notification)


def _build_payload(
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
    if not recipient or not getattr(recipient, "id", None):
        return None

    clean_title = str(title or "").strip()[:160]
    clean_message = str(message or "").strip()[:300]
    clean_type = str(notification_type or "general").strip() or "general"
    clean_event_key = str(event_key or "").strip()
    if not clean_message or not clean_event_key:
        return None

    return {
        "recipient": recipient,
        "actor": actor,
        "notification_type": clean_type,
        "title": clean_title,
        "message": clean_message,
        "event_key": clean_event_key,
        "course": course,
        "activity": activity,
        "submission": submission,
    }


def notify_single(
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
    payload = _build_payload(
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
    if not payload:
        return None

    existing = Notification.objects.filter(
        recipient=recipient,
        event_key=payload["event_key"],
    ).first()
    if existing:
        return existing

    notification = Notification.objects.create(**payload)
    transaction.on_commit(lambda: _after_notifications_created([notification]))
    return notification


def notify_bulk(notification_rows):
    prepared_rows = []
    for row in notification_rows or []:
        payload = _build_payload(
            recipient=row.get("recipient"),
            actor=row.get("actor"),
            notification_type=row.get("notification_type"),
            title=row.get("title"),
            message=row.get("message"),
            event_key=row.get("event_key"),
            course=row.get("course"),
            activity=row.get("activity"),
            submission=row.get("submission"),
        )
        if payload:
            prepared_rows.append(payload)

    if not prepared_rows:
        return 0

    existing_pairs = {
        (item.recipient_id, item.event_key)
        for item in Notification.objects.filter(
            recipient_id__in={row["recipient"].id for row in prepared_rows},
            event_key__in={row["event_key"] for row in prepared_rows},
        ).only("recipient_id", "event_key")
    }

    to_create = []
    seen_pairs = set(existing_pairs)
    for row in prepared_rows:
        pair = (row["recipient"].id, row["event_key"])
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        to_create.append(Notification(**row))

    if not to_create:
        return 0

    with transaction.atomic():
        created = Notification.objects.bulk_create(to_create)

    transaction.on_commit(lambda: _after_notifications_created(created))
    return len(created)


__all__ = [
    "_display_name",
    "notify_bulk",
    "notify_single",
    "publish_notification",
    "publish_notifications",
    "serialize_notification",
]
