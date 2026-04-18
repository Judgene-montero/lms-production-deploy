from django.apps import AppConfig


class AnalyticsAiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'analytics_ai'

    def ready(self):
        import analytics_ai.signals