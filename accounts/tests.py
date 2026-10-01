from django.test import TestCase
from django.urls import reverse

from .models import User


class AccountTests(TestCase):
    def test_signup_logs_user_in(self):
        response = self.client.post(reverse("accounts:signup"), {
            "first_name": "Alice", "last_name": "Dupont", "email": "Alice@Exemple.fr",
            "password1": "un-mot-de-passe-solide", "password2": "un-mot-de-passe-solide",
        })
        self.assertRedirects(response, reverse("associations:list"))
        user = User.objects.get()
        self.assertEqual(user.email, "alice@exemple.fr")
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.pk)

    def test_signup_rejects_duplicate_email(self):
        User.objects.create_user("alice@exemple.fr", "x")
        response = self.client.post(reverse("accounts:signup"), {
            "first_name": "A", "last_name": "B", "email": "ALICE@exemple.fr",
            "password1": "un-mot-de-passe-solide", "password2": "un-mot-de-passe-solide",
        })
        self.assertContains(response, "existe déjà")

    def test_login_with_email_case_insensitive(self):
        User.objects.create_user("bob@exemple.fr", "un-mot-de-passe-solide")
        response = self.client.post(reverse("accounts:login"), {
            "username": "BOB@exemple.fr", "password": "un-mot-de-passe-solide",
        })
        self.assertRedirects(response, reverse("dashboard"))

    def test_regenerate_calendar_token(self):
        user = User.objects.create_user("bob@exemple.fr", "x")
        old = user.calendar_token
        self.client.force_login(user)
        self.client.post(reverse("accounts:regenerate_token"))
        user.refresh_from_db()
        self.assertNotEqual(old, user.calendar_token)
