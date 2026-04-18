from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0011_user_instructor_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="course",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
    ]
