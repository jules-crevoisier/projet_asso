from django.contrib import admin

from .models import Post, Reply


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "association", "kind", "is_closed", "created_at")
    list_filter = ("kind", "is_closed")
    search_fields = ("title", "body")


admin.site.register(Reply)
