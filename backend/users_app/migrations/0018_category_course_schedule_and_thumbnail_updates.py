from django.db import migrations, models
import users_app.models


def migrate_course_categories(apps, schema_editor):
    Course = apps.get_model("users_app", "Course")
    Category = apps.get_model("users_app", "Category")

    for course in Course.objects.exclude(category__isnull=True).exclude(category=""):
        category_name = str(course.category).strip()
        if not category_name:
            continue
        category, _ = Category.objects.get_or_create(name=category_name)
        course.category_ref = category
        course.save(update_fields=["category_ref"])


class Migration(migrations.Migration):

    dependencies = [
        ("users_app", "0017_alter_user_managers"),
    ]

    operations = [
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="course",
            name="category_ref",
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.PROTECT, related_name="courses", to="users_app.category"),
        ),
        migrations.AddField(
            model_name="course",
            name="join_code_expiration",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="course",
            name="start_date",
            field=models.DateField(default=users_app.models.current_local_date),
        ),
        migrations.AddField(
            model_name="course",
            name="start_time",
            field=models.TimeField(default=users_app.models.current_local_time),
        ),
        migrations.RunPython(migrate_course_categories, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="course",
            name="category",
        ),
        migrations.RenameField(
            model_name="course",
            old_name="category_ref",
            new_name="category",
        ),
    ]
