from django.contrib import admin

from delivery.models import DownloadGrant

from .models import Order, Purchase
from .services import send_confirmation_email


class PurchaseInline(admin.TabularInline):
    model = Purchase
    extra = 0


class DownloadGrantInline(admin.TabularInline):
    model = DownloadGrant
    extra = 0
    fields = ("product_handle", "email", "created_at", "revoked_at")
    readonly_fields = ("created_at",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "shopify_order_id",
        "email",
        "total",
        "currency",
        "email_sent",
        "refunded",
        "created_at",
    )
    list_filter = ("created_at", "confirmation_email_sent_at", "refunded_at")
    search_fields = ("shopify_order_id", "email")
    inlines = [PurchaseInline, DownloadGrantInline]
    readonly_fields = ("confirmation_email_sent_at", "refunded_at", "created_at")
    actions = ["resend_confirmation"]

    @admin.display(boolean=True, description="email sent")
    def email_sent(self, obj) -> bool:
        return obj.confirmation_email_sent_at is not None

    @admin.display(boolean=True, description="refunded")
    def refunded(self, obj) -> bool:
        return obj.refunded_at is not None

    @admin.action(description="Resend confirmation + download email")
    def resend_confirmation(self, request, queryset):
        sent = 0
        for order in queryset:
            if send_confirmation_email(order.id, force=True):
                sent += 1
        self.message_user(
            request,
            f"Sent {sent} of {queryset.count()} email(s). "
            "(Orders with no email address are skipped.)",
        )


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("product_handle", "title", "quantity", "order")
    search_fields = ("product_handle", "title")
