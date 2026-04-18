# analytics_ai/signals.py
import logging

from django.db import transaction
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from courses.models import ActivitySubmission
from analytics_ai.services import run_full_analysis

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=ActivitySubmission)
def snapshot_submission_before_save(sender, instance, **kwargs):
    if not instance.pk:
        instance._analytics_old_state = None
        return

    old = sender.objects.filter(pk=instance.pk).values(
        "status", "grade", "is_late", "student_id", "activity_id"
    ).first()
    instance._analytics_old_state = old


@receiver(post_save, sender=ActivitySubmission)
def analyze_student_after_submission(sender, instance, created, **kwargs):

    old = getattr(instance, "_analytics_old_state", None)
    status_now = instance.status in ("submitted", "graded")
    status_was = bool(old and old.get("status") in ("submitted", "graded"))

    # Run for new submitted/graded records, or when tracked analytics fields changed.
    if not created:
        if not status_now and not status_was:
            return

        if old:
            changed = (
                old.get("status") != instance.status or
                old.get("grade") != instance.grade or
                old.get("is_late") != instance.is_late or
                old.get("student_id") != instance.student_id or
                old.get("activity_id") != instance.activity_id
            )
            if not changed:
                return
    elif not status_now:
        return

    student = instance.student
    course = instance.activity.course

    def _run_analysis_safe():
        try:
            run_full_analysis(student, course)
        except Exception:
            # Analytics should never block submission save/grade actions.
            logger.exception(
                "Post-submission analytics failed for student_id=%s course_id=%s submission_id=%s",
                getattr(student, "id", None),
                getattr(course, "id", None),
                getattr(instance, "id", None),
            )

    transaction.on_commit(_run_analysis_safe, robust=True)
