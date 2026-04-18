from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from courses.models import QuizAttempt


class Command(BaseCommand):
    help = (
        "Fix inconsistent quiz attempts where is_locked=True but submitted_at is NULL. "
        "Sets submitted_at to force_submitted_at when available, otherwise timezone.now()."
    )

    def handle(self, *args, **options):
        fixed = 0
        with transaction.atomic():
            rows = (
                QuizAttempt.objects.select_for_update()
                .filter(is_locked=True, submitted_at__isnull=True)
                .order_by("id")
            )
            for attempt in rows:
                attempt.submitted_at = attempt.force_submitted_at or timezone.now()
                attempt.save(update_fields=["submitted_at"])
                fixed += 1

        self.stdout.write(self.style.SUCCESS(f"Fixed {fixed} inconsistent locked attempts."))
