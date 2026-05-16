from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0013_studentnotificationread"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="analytics_low_risk_max",
            field=models.FloatField(default=0.30),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="analytics_medium_risk_max",
            field=models.FloatField(default=0.60),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="analytics_high_risk_min",
            field=models.FloatField(default=0.60),
        ),
        migrations.AddField(
            model_name="sitesettings",
            name="analytics_passing_grade",
            field=models.FloatField(default=75.0),
        ),
    ]
