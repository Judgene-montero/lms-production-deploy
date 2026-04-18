from django.db import migrations


def _drop_legacy_status_column(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE courses_quizattempt
            DROP COLUMN IF EXISTS status
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0015_fix_quizattempt_answer_count_types"),
    ]

    operations = [
        migrations.RunPython(_drop_legacy_status_column, migrations.RunPython.noop),
    ]

