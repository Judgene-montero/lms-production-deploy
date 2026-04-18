from django.db import migrations


def _column_names(schema_editor, table_name):
    with schema_editor.connection.cursor() as cursor:
        description = schema_editor.connection.introspection.get_table_description(cursor, table_name)
    return {col.name for col in description}


def repair_attendance_schema(apps, schema_editor):
    AttendanceSession = apps.get_model("courses", "AttendanceSession")
    AttendanceRecord = apps.get_model("courses", "AttendanceRecord")

    existing_tables = set(schema_editor.connection.introspection.table_names())

    session_table = AttendanceSession._meta.db_table
    record_table = AttendanceRecord._meta.db_table

    if session_table not in existing_tables:
        schema_editor.create_model(AttendanceSession)
    if record_table not in existing_tables:
        schema_editor.create_model(AttendanceRecord)

    # Re-read in case we created tables.
    existing_tables = set(schema_editor.connection.introspection.table_names())

    if session_table in existing_tables:
        session_columns = _column_names(schema_editor, session_table)
        for field_name in ("course", "date", "topic", "created_by", "created_at"):
            field = AttendanceSession._meta.get_field(field_name)
            if field.column not in session_columns:
                schema_editor.add_field(AttendanceSession, field)
                session_columns.add(field.column)

    if record_table in existing_tables:
        record_columns = _column_names(schema_editor, record_table)
        for field_name in ("session", "student", "status", "marked_by", "marked_at", "points_earned"):
            field = AttendanceRecord._meta.get_field(field_name)
            if field.column not in record_columns:
                schema_editor.add_field(AttendanceRecord, field)
                record_columns.add(field.column)


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0010_attendancesession_attendancerecord"),
    ]

    operations = [
        migrations.RunPython(repair_attendance_schema, migrations.RunPython.noop),
    ]
