from django.urls import path

from . import views

app_name = "events"

urlpatterns = [
    path("", views.calendar_view, name="calendar"),
    path("liste/", views.event_list, name="list"),
    path("nouveau/", views.event_create, name="create"),
    path("ical/public.ics", views.ical_public, name="ical_public"),
    path("ical/<uuid:token>.ics", views.ical_private, name="ical_private"),
    path("<int:pk>/", views.event_detail, name="detail"),
    path("<int:pk>/evenement.ics", views.ical_event, name="ical_event"),
    path("<int:pk>/modifier/", views.event_edit, name="edit"),
    path("<int:pk>/supprimer/", views.event_delete, name="delete"),
    path("<int:pk>/participer/", views.event_participate, name="participate"),
    path("<int:pk>/benevole/", views.event_volunteer, name="volunteer"),
    path("<int:pk>/commenter/", views.event_comment, name="comment"),
    path("participation/<int:pk>/retirer/", views.participation_delete, name="participation_delete"),
    path("commentaire/<int:pk>/supprimer/", views.comment_delete, name="comment_delete"),
]
