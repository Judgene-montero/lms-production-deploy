from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users_app", "0019_user_approval_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sitesettings",
            name="require_email_verification",
            field=models.BooleanField(default=False),
        ),
    ]
