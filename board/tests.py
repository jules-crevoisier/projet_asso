from django.test import TestCase
from django.urls import reverse

from accounts.models import User
from associations.models import Association, Membership

from .models import Post, Reply


class BoardTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice@exemple.fr", "x")
        self.bob = User.objects.create_user("bob@exemple.fr", "x")
        self.asso = Association.objects.create(name="Asso", short_description="x", is_validated=True)
        Membership.objects.create(user=self.alice, association=self.asso, status=Membership.Status.ACTIVE)

    def test_board_requires_login(self):
        response = self.client.get(reverse("board:list"))
        self.assertEqual(response.status_code, 302)

    def test_create_reply_close(self):
        self.client.force_login(self.alice)
        self.client.post(reverse("board:create"), {
            "association": self.asso.pk, "kind": "lend", "title": "Prêt de tables", "body": "10 tables",
        })
        post = Post.objects.get()
        self.client.force_login(self.bob)
        self.client.post(reverse("board:reply", args=[post.pk]), {"body": "Intéressé !"})
        self.assertEqual(Reply.objects.count(), 1)

        # Bob n'est pas membre : il ne peut pas clôturer
        self.assertEqual(self.client.post(reverse("board:toggle_close", args=[post.pk])).status_code, 403)
        self.client.force_login(self.alice)
        self.client.post(reverse("board:toggle_close", args=[post.pk]))
        post.refresh_from_db()
        self.assertTrue(post.is_closed)

    def test_list_filters(self):
        Post.objects.create(association=self.asso, author=self.alice, kind="lend", title="Prêt de barnums", body="x")
        Post.objects.create(association=self.asso, author=self.alice, kind="volunteers", title="Cherche bras", body="x")
        self.client.force_login(self.bob)
        response = self.client.get(reverse("board:list"), {"type": "lend"})
        self.assertContains(response, "Prêt de barnums")
        self.assertNotContains(response, "Cherche bras")
