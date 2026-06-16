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
    list_display = (
        "product_handle",
        "author_name",
        "rating",
        "status",
        "helpful_count",
        "report_count",
        "created_at",
    )
    list_filter = ("status", "rating", "verified", "created_at")
    # title/body are encrypted at rest, so they can't be searched at the DB
    # level (ciphertext). Admins still SEE them decrypted on the detail page.
    search_fields = ("product_handle", "author_name", "user__email")
    readonly_fields = ("user", "helpful_count", "report_count", "created_at", "updated_at")
    actions = ["hide_reviews", "publish_reviews"]

    @admin.action(description="Hide selected reviews")
    def hide_reviews(self, request, queryset):
        n = queryset.update(status=Review.HIDDEN)
        self.message_user(request, f"Hid {n} review(s).")

    @admin.action(description="Publish selected reviews")
    def publish_reviews(self, request, queryset):
        n = queryset.update(status=Review.PUBLISHED)
        self.message_user(request, f"Published {n} review(s).")
