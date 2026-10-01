from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils.text import slugify


class Category(models.TextChoices):
    SPORT = "sport", "Sport"
    CULTURE = "culture", "Culture & arts"
    SOCIAL = "social", "Social & solidarité"
    ENVIRONNEMENT = "environnement", "Environnement"
    EDUCATION = "education", "Éducation & jeunesse"
    SANTE = "sante", "Santé"
    LOISIRS = "loisirs", "Loisirs"
    QUARTIER = "quartier", "Vie de quartier"
    AUTRE = "autre", "Autre"


class Association(models.Model):
    name = models.CharField("nom", max_length=150, unique=True)
    slug = models.SlugField(max_length=170, unique=True, editable=False)
    category = models.CharField("domaine", max_length=20, choices=Category.choices, default=Category.AUTRE)
    short_description = models.CharField("description courte", max_length=200)
    description = models.TextField("présentation", blank=True)
    email = models.EmailField("e-mail de contact", blank=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    website = models.URLField("site web", blank=True)
    address = models.CharField("adresse", max_length=255, blank=True)
    is_validated = models.BooleanField("validée", default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+", verbose_name="créée par"
    )
    created_at = models.DateTimeField("créée le", auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:160] or "association"
            slug, i = base, 2
            while Association.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{i}"
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("associations:detail", args=[self.slug])

    @property
    def can_publish(self):
        return self.is_validated or not settings.ASSOCIATIONS_REQUIRE_VALIDATION

    def active_memberships(self):
        return self.memberships.filter(status=Membership.Status.ACTIVE).select_related("user")

    def admins(self):
        return [m.user for m in self.active_memberships() if m.role == Membership.Role.ADMIN]


class Membership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        MEMBER = "member", "Membre"

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        ACTIVE = "active", "Actif"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    association = models.ForeignKey(Association, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField("rôle", max_length=10, choices=Role.choices, default=Role.MEMBER)
    status = models.CharField("statut", max_length=10, choices=Status.choices, default=Status.PENDING)
    message = models.CharField("message", max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "adhésion"
        constraints = [models.UniqueConstraint(fields=["user", "association"], name="unique_membership")]
        ordering = ["association__name"]

    def __str__(self):
        return f"{self.user} – {self.association} ({self.get_role_display()})"

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    @property
    def is_admin(self):
        return self.is_active and self.role == self.Role.ADMIN
