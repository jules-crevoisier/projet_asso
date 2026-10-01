from django.contrib import admin

from .models import Comment, Event, Participation, Volunteer


class ParticipationInline(admin.TabularInline):
    model = Participation
    extra = 0


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "association", "start", "end", "location", "visibility")
    list_filter = ("visibility", "category", "association")
    search_fields = ("title", "description", "location")
    date_hierarchy = "start"
    inlines = [ParticipationInline]


admin.site.register(Comment)
admin.site.register(Volunteer)
