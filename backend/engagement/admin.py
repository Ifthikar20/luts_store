from django.contrib import admin

from .models import ContactMessage, NewsletterSubscriber, Review


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "created_at")
    search_fields = ("email",)
    readonly_fields = ("created_at",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "created_at")
    search_fields = ("name", "email", "message")
    readonly_fields = ("name", "email", "message", "created_at")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("product_handle", "author_name", "rating", "verified", "created_at")
    list_filter = ("rating", "verified", "created_at")
    search_fields = ("product_handle", "author_name", "title", "body", "user__email")
    readonly_fields = ("user", "created_at", "updated_at")
