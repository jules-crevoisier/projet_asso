from django.contrib import admin
from django.urls import include, path

from . import views

admin.site.site_header = "Administration – Assos Troyes"
admin.site.site_title = "Assos Troyes"

urlpatterns = [
    path("", views.home, name="home"),
    path("tableau-de-bord/", views.dashboard, name="dashboard"),
    path("compte/", include("accounts.urls")),
    path("associations/", include("associations.urls")),
    path("evenements/", include("events.urls")),
    path("annonces/", include("board.urls")),
    path("admin/", admin.site.urls),
]
