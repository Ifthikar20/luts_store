from django.urls import path

from . import views

urlpatterns = [
    path("events", views.ingest, name="analytics-ingest"),
    path("analytics/summary", views.summary, name="analytics-summary"),
]
