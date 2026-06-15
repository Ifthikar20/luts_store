from django.urls import path

from . import views

urlpatterns = [
    path("blog/posts", views.list_posts, name="blog-posts"),
    path("blog/posts/<slug:slug>", views.post_detail, name="blog-post-detail"),
]
