from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "published", "published_at", "updated_at")
    list_filter = ("published", "published_at")
    list_editable = ("published",)
    search_fields = ("title", "slug", "excerpt", "body")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at", "published_at")
    fieldsets = (
        (None, {"fields": ("title", "slug", "excerpt", "author_name")}),
        ("Content", {"fields": ("body", "cover_image_url"),
                     "description": "Body is Markdown. It renders to HTML on the site."}),
        ("Publishing", {"fields": ("published", "published_at", "created_at", "updated_at"),
                        "description": "Tick Published to make it live at /blog."}),
    )
