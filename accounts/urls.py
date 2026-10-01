from django.contrib.auth import views as auth_views
from django.urls import path, reverse_lazy

from . import views
from .forms import LoginForm

app_name = "accounts"

urlpatterns = [
    path("inscription/", views.signup, name="signup"),
    path(
        "connexion/",
        auth_views.LoginView.as_view(template_name="accounts/login.html", authentication_form=LoginForm,
                                     redirect_authenticated_user=True),
        name="login",
    ),
    path("deconnexion/", auth_views.LogoutView.as_view(), name="logout"),
    path("profil/", views.profile, name="profile"),
    path("profil/calendrier/regenerer/", views.regenerate_calendar_token, name="regenerate_token"),
    path(
        "mot-de-passe/changer/",
        auth_views.PasswordChangeView.as_view(template_name="accounts/form_page.html",
                                              success_url=reverse_lazy("accounts:profile"),
                                              extra_context={"title": "Changer de mot de passe"}),
        name="password_change",
    ),
    path(
        "mot-de-passe/oublie/",
        auth_views.PasswordResetView.as_view(template_name="accounts/form_page.html",
                                             email_template_name="accounts/password_reset_email.txt",
                                             subject_template_name="accounts/password_reset_subject.txt",
                                             success_url=reverse_lazy("accounts:password_reset_done"),
                                             extra_context={"title": "Mot de passe oublié"}),
        name="password_reset",
    ),
    path(
        "mot-de-passe/oublie/envoye/",
        auth_views.PasswordResetDoneView.as_view(template_name="accounts/message_page.html",
                                                 extra_context={"title": "E-mail envoyé",
                                                                "text": "Si un compte correspond à cette adresse, "
                                                                        "vous allez recevoir un lien de réinitialisation."}),
        name="password_reset_done",
    ),
    path(
        "mot-de-passe/reinitialiser/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(template_name="accounts/form_page.html",
                                                    success_url=reverse_lazy("accounts:login"),
                                                    extra_context={"title": "Nouveau mot de passe"}),
        name="password_reset_confirm",
    ),
]
