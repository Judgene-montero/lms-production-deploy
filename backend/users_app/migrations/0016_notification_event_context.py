from django.db import migrations, models


def backfill_notification_event_keys(apps, schema_editor):
    Notification = apps.get_model("users_app", "Notification")
    for notification in Notification.objects.filter(event_key="").iterator():
        notification.event_key = f"legacy:{notification.id}"
        notification.save(update_fields=["event_key"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0035_lessoncompletion"),
        ("users_app", "0015_notification_recipient_and_status_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="triggered_notifications",
                to="users_app.user",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="activity",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="notifications",
                to="courses.courseactivity",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="course",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="notifications",
                to="users_app.course",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="event_key",
            field=models.CharField(db_index=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="notification",
            name="submission",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="notifications",
                to="courses.activitysubmission",
            ),
        ),
        migrations.RunPython(backfill_notification_event_keys, noop_reverse),
        migrations.AlterField(
            model_name="notification",
            name="event_key",
            field=models.CharField(db_index=True, max_length=255),
        ),
        migrations.AddConstraint(
            model_name="notification",
            constraint=models.UniqueConstraint(fields=("recipient", "event_key"), name="unique_recipient_event_key"),
        ),
        migrations.AlterModelOptions(
            name="notification",
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
