from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import User

from .models import Association, Membership


def make_asso(owner, name="Asso Test", validated=True):
    a = Association.objects.create(name=name, short_description="Test", is_validated=validated, created_by=owner)
    Membership.objects.create(user=owner, association=a, role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE)
    return a


class AssociationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@exemple.fr", "x", first_name="Owner")
        self.other = User.objects.create_user("other@exemple.fr", "x", first_name="Other")

    def test_slug_is_unique(self):
        a = Association.objects.create(name="Été Sport", short_description="x")
        self.assertEqual(a.slug, "ete-sport")

    def test_create_makes_creator_admin_and_pending_validation(self):
        self.client.force_login(self.owner)
        self.client.post(reverse("associations:create"), {
            "name": "Nouvelle Asso", "category": "sport", "short_description": "Une asso",
        })
        a = Association.objects.get(name="Nouvelle Asso")
        self.assertFalse(a.is_validated)
        self.assertFalse(a.can_publish)
        self.assertTrue(Membership.objects.get(association=a, user=self.owner).is_admin)

    @override_settings(ASSOCIATIONS_REQUIRE_VALIDATION=False)
    def test_can_publish_without_validation_when_disabled(self):
        self.assertTrue(make_asso(self.owner, validated=False).can_publish)

    def test_join_request_and_approval(self):
        a = make_asso(self.owner)
        self.client.force_login(self.other)
        self.client.post(reverse("associations:join", args=[a.slug]), {"message": "Bonjour"})
        m = Membership.objects.get(user=self.other, association=a)
        self.assertEqual(m.status, Membership.Status.PENDING)

        # Un non-administrateur ne peut pas valider
        response = self.client.post(reverse("associations:membership_action", args=[a.slug, m.pk, "approve"]))
        self.assertEqual(response.status_code, 403)

        self.client.force_login(self.owner)
        self.client.post(reverse("associations:membership_action", args=[a.slug, m.pk, "approve"]))
        m.refresh_from_db()
        self.assertTrue(m.is_active)

    def test_cannot_remove_last_admin(self):
        a = make_asso(self.owner)
        m = Membership.objects.get(user=self.owner)
        self.client.force_login(self.owner)
        self.client.post(reverse("associations:membership_action", args=[a.slug, m.pk, "demote"]))
        m.refresh_from_db()
        self.assertTrue(m.is_admin)

    def test_members_page_requires_admin(self):
        a = make_asso(self.owner)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(reverse("associations:members", args=[a.slug])).status_code, 403)

    def test_moderation_validates(self):
        a = make_asso(self.owner, validated=False)
        staff = User.objects.create_user("staff@exemple.fr", "x", is_staff=True)
        self.client.force_login(staff)
        self.client.post(reverse("associations:validate", args=[a.slug]))
        a.refresh_from_db()
        self.assertTrue(a.is_validated)

    def test_moderation_forbidden_for_regular_user(self):
        a = make_asso(self.owner, validated=False)
        self.client.force_login(self.owner)
        self.client.post(reverse("associations:validate", args=[a.slug]))
        a.refresh_from_db()
        self.assertFalse(a.is_validated)

    def test_directory_search(self):
        make_asso(self.owner, name="Club de Volley")
        make_asso(self.other, name="Chorale")
        response = self.client.get(reverse("associations:list"), {"q": "volley"})
        self.assertContains(response, "Club de Volley")
        self.assertNotContains(response, "Chorale")
