"""Admin for download grants — look up, revoke, or restore a buyer's access."""
from django.contrib import admin
from django.utils import timezone

from .models import DownloadGrant


@admin.register(DownloadGrant)
class DownloadGrantAdmin(admin.ModelAdmin):
    list_display = ("product_handle", "email", "order", "user", "created_at", "active")
    list_filter = ("created_at", "revoked_at")
    search_fields = ("product_handle", "email", "order__shopify_order_id")
    autocomplete_fields = ("order",)
    readonly_fields = ("created_at",)
    actions = ["revoke", "restore"]

    @admin.display(boolean=True, description="active")
    def active(self, obj) -> bool:
        return obj.revoked_at is None

    @admin.action(description="Revoke selected grants (blocks downloads)")
    def revoke(self, request, queryset):
        n = queryset.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())
        self.message_user(request, f"Revoked {n} grant(s).")

    @admin.action(description="Restore selected grants")
    def restore(self, request, queryset):
        n = queryset.filter(revoked_at__isnull=False).update(revoked_at=None)
        self.message_user(request, f"Restored {n} grant(s).")
