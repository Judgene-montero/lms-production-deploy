from django.db import migrations


def _drop_quiz_student_unique_constraint(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute a1 ON a1.attrelid = rel.oid AND a1.attname = 'quiz_id'
            JOIN pg_attribute a2 ON a2.attrelid = rel.oid AND a2.attname = 'student_id'
            WHERE rel.relname = 'courses_quizattempt'
              AND con.contype = 'u'
              AND con.conkey @> ARRAY[a1.attnum, a2.attnum]::smallint[]
              AND con.conkey <@ ARRAY[a1.attnum, a2.attnum]::smallint[]
            """
        )
        constraints = [row[0] for row in cursor.fetchall()]

        # Backward-compatible explicit names from legacy DB states.
        for legacy_name in (
            "courses_quizattempt_quiz_id_student_id_f0433833_uniq",
            "courses_quizattempt_quiz_id_student_id_uniq",
        ):
            if legacy_name not in constraints:
                constraints.append(legacy_name)

        for name in constraints:
            cursor.execute(f'ALTER TABLE courses_quizattempt DROP CONSTRAINT IF EXISTS "{name}"')


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0017_fix_quizattempt_quiz_fk"),
    ]

    operations = [
        migrations.RunPython(_drop_quiz_student_unique_constraint, migrations.RunPython.noop),
    ]

