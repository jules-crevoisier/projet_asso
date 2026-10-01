from django.conf import settings
from django.db import models
from django.urls import reverse

from associations.models import Association


class Post(models.Model):
    """Annonce partagée entre associations (besoins, offres, infos)."""

    class Kind(models.TextChoices):
        INFO = "info", "Information"
        VOLUNTEERS = "volunteers", "Recherche de bénévoles"
        LEND = "lend", "Prêt / don de matériel"
        BORROW = "borrow", "Recherche de matériel"
        PARTNERSHIP = "partnership", "Appel à partenariat"
        SPACE = "space", "Salle / local"
        OTHER = "other", "Autre"

    association = models.ForeignKey(Association, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="posts")
    kind = models.CharField("type d'annonce", max_length=12, choices=Kind.choices, default=Kind.INFO)
    title = models.CharField("titre", max_length=200)
    body = models.TextField("contenu")
    is_closed = models.BooleanField("clôturée", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "annonce"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse("board:detail", args=[self.pk])


class Reply(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_replies")
    association = models.ForeignKey(
        Association, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
        verbose_name="au nom de",
    )
    body = models.TextField("réponse")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "réponse"
        ordering = ["created_at"]

    def __str__(self):
        return f"Réponse de {self.author} à {self.post}"
