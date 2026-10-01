from datetime import datetime, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import User
from associations.models import Association, Membership

from .models import Event, Participation, Volunteer


def aware(days, hour):
    base = timezone.localdate() + timedelta(days=days)
    return timezone.make_aware(datetime(base.year, base.month, base.day, hour))


def make_asso(owner, name, validated=True):
    a = Association.objects.create(name=name, short_description="x", is_validated=validated, created_by=owner)
    Membership.objects.create(user=owner, association=a, role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE)
    return a


class EventTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice@exemple.fr", "x", first_name="Alice")
        self.bob = User.objects.create_user("bob@exemple.fr", "x", first_name="Bob")
        self.velo = make_asso(self.alice, "Vélo")
        self.theatre = make_asso(self.bob, "Théâtre")
        self.event = Event.objects.create(
            association=self.velo, title="Fête du vélo", description="d", location="Place",
            start=aware(5, 10), end=aware(5, 18), created_by=self.alice,
        )

    def form_data(self, **overrides):
        data = {
            "association": self.theatre.pk, "title": "Spectacle", "category": "culture",
            "start": aware(5, 15).astimezone(timezone.get_current_timezone()).strftime("%Y-%m-%dT%H:%M"),
            "end": aware(5, 17).astimezone(timezone.get_current_timezone()).strftime("%Y-%m-%dT%H:%M"),
            "location": "Théâtre", "description": "Pièce", "visibility": "public", "volunteers_needed": 0,
        }
        data.update(overrides)
        return data

    def test_conflict_warning_then_confirm(self):
        self.client.force_login(self.bob)
        response = self.client.post(reverse("events:create"), self.form_data())
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Fête du vélo")
        self.assertContains(response, "Publier quand même")
        self.assertEqual(Event.objects.count(), 1)

        response = self.client.post(reverse("events:create"), self.form_data(confirm_conflicts="on"))
        self.assertEqual(Event.objects.count(), 2)
        self.assertRedirects(response, Event.objects.get(title="Spectacle").get_absolute_url())

    def test_no_conflict_publishes_directly(self):
        self.client.force_login(self.bob)
        start = aware(12, 15).astimezone(timezone.get_current_timezone())
        self.client.post(reverse("events:create"), self.form_data(
            start=start.strftime("%Y-%m-%dT%H:%M"), end=(start + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M"),
        ))
        self.assertTrue(Event.objects.filter(title="Spectacle").exists())

    def test_end_must_be_after_start(self):
        self.client.force_login(self.bob)
        data = self.form_data(confirm_conflicts="on")
        data["end"], data["start"] = data["start"], data["end"]
        response = self.client.post(reverse("events:create"), data)
        self.assertContains(response, "postérieure")

    def test_cannot_publish_for_foreign_association(self):
        self.client.force_login(self.bob)
        self.client.post(reverse("events:create"), self.form_data(association=self.velo.pk, confirm_conflicts="on"))
        self.assertFalse(Event.objects.filter(title="Spectacle").exists())

    def test_unvalidated_association_cannot_publish(self):
        carol = User.objects.create_user("carol@exemple.fr", "x")
        make_asso(carol, "Pas validée", validated=False)
        self.client.force_login(carol)
        self.assertRedirects(self.client.get(reverse("events:create")), reverse("associations:list"))

    def test_only_members_can_edit(self):
        self.client.force_login(self.bob)
        self.assertEqual(self.client.get(reverse("events:edit", args=[self.event.pk])).status_code, 403)
        self.client.force_login(self.alice)
        self.assertEqual(self.client.get(reverse("events:edit", args=[self.event.pk])).status_code, 200)

    def test_participation_and_volunteer(self):
        self.client.force_login(self.bob)
        self.client.post(reverse("events:participate", args=[self.event.pk]),
                         {"association": self.theatre.pk, "kind": "coorg", "message": "On aide"})
        self.assertTrue(Participation.objects.filter(event=self.event, association=self.theatre).exists())
        self.client.post(reverse("events:volunteer", args=[self.event.pk]))
        self.assertTrue(Volunteer.objects.filter(event=self.event, user=self.bob).exists())
        self.client.post(reverse("events:volunteer", args=[self.event.pk]))
        self.assertFalse(Volunteer.objects.filter(event=self.event, user=self.bob).exists())

    def test_cannot_participate_in_name_of_foreign_association(self):
        self.client.force_login(self.bob)
        other = make_asso(self.alice, "Autre")
        self.client.post(reverse("events:participate", args=[self.event.pk]), {"association": other.pk, "kind": "coorg"})
        self.assertFalse(Participation.objects.exists())

    def test_network_events_hidden_from_visitors(self):
        Event.objects.create(association=self.velo, title="Réunion interne réseau", description="d", location="x",
                             start=aware(6, 18), end=aware(6, 20), visibility=Event.Visibility.NETWORK)
        response = self.client.get(reverse("events:list"))
        self.assertContains(response, "Fête du vélo")
        self.assertNotContains(response, "Réunion interne réseau")
        self.client.force_login(self.bob)
        self.assertContains(self.client.get(reverse("events:list")), "Réunion interne réseau")

    def test_calendar_month_view(self):
        day = aware(5, 10)
        response = self.client.get(reverse("events:calendar"), {"annee": day.year, "mois": day.month})
        self.assertContains(response, "Fête du vélo")

    def test_calendar_invalid_month(self):
        self.assertEqual(self.client.get(reverse("events:calendar"), {"annee": 2026, "mois": 13}).status_code, 404)

    def test_calendar_filter_my_associations(self):
        Event.objects.create(association=self.theatre, title="Pièce de Bob", description="d", location="x",
                             start=aware(3, 18), end=aware(3, 20))
        self.client.force_login(self.alice)
        response = self.client.get(reverse("events:list"), {"mes": "1"})
        self.assertContains(response, "Fête du vélo")
        self.assertNotContains(response, "Pièce de Bob")

    def test_ical_feeds(self):
        Event.objects.create(association=self.velo, title="Réunion réseau", description="d", location="x",
                             start=aware(6, 18), end=aware(6, 20), visibility=Event.Visibility.NETWORK)
        public = self.client.get(reverse("events:ical_public")).content.decode()
        self.assertIn("BEGIN:VCALENDAR", public)
        self.assertIn("SUMMARY:Fête du vélo", public)
        self.assertNotIn("Réunion réseau", public)

        private = self.client.get(reverse("events:ical_private", args=[self.alice.calendar_token])).content.decode()
        self.assertIn("SUMMARY:Réunion réseau", private)

    def test_ical_line_folding(self):
        from .ical import _fold

        line = "DESCRIPTION:" + "é" * 100
        for part in _fold(line).split("\r\n"):
            self.assertLessEqual(len(part.encode("utf-8")), 75)
