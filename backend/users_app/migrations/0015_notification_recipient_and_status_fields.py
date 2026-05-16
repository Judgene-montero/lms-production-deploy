from django.db import migrations, models


def backfill_notification_fields(apps, schema_editor):
    Notification = apps.get_model("users_app", "Notification")
    for notification in Notification.objects.all().iterator():
        updated_fields = []

        if not notification.notification_type:
            notification.notification_type = "general"
            updated_fields.append("notification_type")

        if not notification.title:
            notification.title = (notification.message or "")[:160]
            updated_fields.append("title")

        if updated_fields:
            notification.save(update_fields=updated_fields)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0014_sitesettings_analytics_thresholds"),
    ]

    operations = [
        migrations.RenameField(
            model_name="notification",
            old_name="instructor",
            new_name="recipient",
        ),
        migrations.AddField(
            model_name="notification",
            name="is_read",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(default="general", max_length=50),
        ),
        migrations.AddField(
            model_name="notification",
            name="read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="title",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.RunPython(backfill_notification_fields, noop_reverse),
    ]
