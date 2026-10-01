from django.urls import path

from . import views

app_name = "board"

urlpatterns = [
    path("", views.post_list, name="list"),
    path("nouvelle/", views.post_create, name="create"),
    path("<int:pk>/", views.post_detail, name="detail"),
    path("<int:pk>/modifier/", views.post_edit, name="edit"),
    path("<int:pk>/cloturer/", views.post_toggle_close, name="toggle_close"),
    path("<int:pk>/supprimer/", views.post_delete, name="delete"),
    path("<int:pk>/repondre/", views.post_reply, name="reply"),
    path("reponse/<int:pk>/supprimer/", views.reply_delete, name="reply_delete"),
]
