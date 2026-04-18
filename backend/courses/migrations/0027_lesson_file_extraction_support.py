from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0026_courseactivity_allow_late_submissions_and_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="lesson",
            name="extracted_text",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="lesson",
            name="file",
            field=models.FileField(blank=True, null=True, upload_to="lessons/"),
        ),
        migrations.AddField(
            model_name="lesson",
            name="uploaded_at",
            field=models.DateTimeField(auto_now_add=True, blank=True, null=True),
        ),
        migrations.CreateModel(
            name="LessonImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="lesson_images/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "lesson",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="courses.lesson",
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
    ]
