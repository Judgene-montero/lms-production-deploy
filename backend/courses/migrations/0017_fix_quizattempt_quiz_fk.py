from django.db import migrations


def _repair_quiz_fk(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'courses_quizattempt'
              AND kcu.column_name = 'quiz_id'
            """
        )
        existing_constraints = [row[0] for row in cursor.fetchall()]
        for constraint_name in existing_constraints:
            cursor.execute(f'ALTER TABLE courses_quizattempt DROP CONSTRAINT IF EXISTS "{constraint_name}"')

        cursor.execute(
            """
            ALTER TABLE courses_quizattempt
            ADD CONSTRAINT courses_quizattempt_quiz_id_fk_courseactivity
            FOREIGN KEY (quiz_id)
            REFERENCES courses_courseactivity(id)
            DEFERRABLE INITIALLY DEFERRED
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0016_drop_legacy_quizattempt_status"),
    ]

    operations = [
        migrations.RunPython(_repair_quiz_fk, migrations.RunPython.noop),
    ]

