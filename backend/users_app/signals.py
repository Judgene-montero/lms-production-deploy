from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from users_app.models import Submission
from analytics_ai.services import run_full_analysis

User = get_user_model()


@receiver(post_save, sender=Submission)
def analyze_student_after_submission(sender, instance, created, **kwargs):

    if created:
        student = User.objects.filter(username=instance.student_name).first()

        if not student:
            return

        run_full_analysis(student, instance.course)