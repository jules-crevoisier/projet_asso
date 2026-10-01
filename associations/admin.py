from django.contrib import admin

from .models import Association, Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Association)
class AssociationAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_validated", "created_at")
    list_filter = ("is_validated", "category")
    search_fields = ("name", "short_description")
    actions = ["validate"]
    inlines = [MembershipInline]

    @admin.action(description="Valider les associations sélectionnées")
    def validate(self, request, queryset):
        queryset.update(is_validated=True)


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "association", "role", "status", "created_at")
    list_filter = ("role", "status")
    search_fields = ("user__email", "association__name")
