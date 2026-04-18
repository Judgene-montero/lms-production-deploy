from django.db import migrations


def _fix_quizattempt_count_columns(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    table_name = "courses_quizattempt"
    target_columns = ("correct_answers", "incorrect_answers")

    with schema_editor.connection.cursor() as cursor:
        for column in target_columns:
            cursor.execute(
                """
                SELECT data_type
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
                """,
                [table_name, column],
            )
            row = cursor.fetchone()
            if not row:
                continue
            if row[0] != "jsonb":
                continue

            cursor.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column} DROP DEFAULT")
            cursor.execute(
                f"""
                ALTER TABLE {table_name}
                ALTER COLUMN {column} TYPE integer
                USING (
                    CASE
                        WHEN {column} IS NULL THEN 0
                        WHEN jsonb_typeof({column}) = 'number' THEN ({column}::text)::integer
                        WHEN jsonb_typeof({column}) = 'string' THEN
                            COALESCE(NULLIF(regexp_replace({column}::text, '[^0-9-]', '', 'g'), ''), '0')::integer
                        ELSE 0
                    END
                )
                """
            )
            cursor.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column} SET DEFAULT 0")
            cursor.execute(f"UPDATE {table_name} SET {column} = 0 WHERE {column} IS NULL")
            cursor.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column} SET NOT NULL")


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0014_courseactivity_max_attempts"),
    ]

    operations = [
        migrations.RunPython(_fix_quizattempt_count_columns, migrations.RunPython.noop),
    ]
