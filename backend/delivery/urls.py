from django.urls import path

from . import views

urlpatterns = [
    path("download/<str:token>", views.download, name="download"),
]
