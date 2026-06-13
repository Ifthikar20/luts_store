from django.urls import path

from . import views

urlpatterns = [
    path("newsletter", views.newsletter_subscribe, name="newsletter-subscribe"),
    path("contact", views.contact_submit, name="contact-submit"),
    # Product reviews: GET the public list + aggregate; POST (gated on a verified
    # purchase) to /create. Sits under /api/, after catalog's products/<handle>.
    path("products/<str:handle>/reviews", views.list_reviews, name="reviews-list"),
    path(
        "products/<str:handle>/reviews/create",
        views.create_review,
        name="reviews-create",
    ),
]
