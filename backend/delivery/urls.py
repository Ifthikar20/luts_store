from django.urls import path

from . import views

urlpatterns = [
    path("download/<str:token>", views.download, name="download"),
    path("me/downloads", views.my_downloads, name="my-downloads"),
]
