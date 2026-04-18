from django.urls import path
from . import views

urlpatterns = [
    path("classwork/<int:activity_id>/", views.classwork_analytics, name="classwork-analytics"),
]
