from django.contrib import admin

from .models import Order, Purchase


class PurchaseInline(admin.TabularInline):
    model = Purchase
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("shopify_order_id", "email", "total", "currency", "created_at")
    search_fields = ("shopify_order_id", "email")
    inlines = [PurchaseInline]


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("product_handle", "title", "quantity", "order")
    search_fields = ("product_handle", "title")
