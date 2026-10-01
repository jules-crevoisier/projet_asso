from django.urls import path

from . import views

app_name = "associations"

urlpatterns = [
    path("", views.association_list, name="list"),
    path("nouvelle/", views.association_create, name="create"),
    path("moderation/", views.moderation, name="moderation"),
    path("<slug:slug>/", views.association_detail, name="detail"),
    path("<slug:slug>/modifier/", views.association_edit, name="edit"),
    path("<slug:slug>/rejoindre/", views.association_join, name="join"),
    path("<slug:slug>/quitter/", views.association_leave, name="leave"),
    path("<slug:slug>/membres/", views.association_members, name="members"),
    path(
        "<slug:slug>/membres/<int:pk>/<str:action>/",
        views.membership_action,
        name="membership_action",
    ),
    path("<slug:slug>/valider/", views.validate_association, name="validate"),
]
