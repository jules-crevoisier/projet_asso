from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.urls import reverse

from associations.models import Association, Category


class EventQuerySet(models.QuerySet):
    def visible_to(self, user):
        if user.is_authenticated:
            return self
        return self.filter(visibility=Event.Visibility.PUBLIC)

    def overlapping(self, start, end):
        return self.filter(start__lt=end, end__gt=start)


class Event(models.Model):
    class Visibility(models.TextChoices):
        PUBLIC = "public", "Public (visible par tous)"
        NETWORK = "network", "Réseau (associations connectées uniquement)"

    association = models.ForeignKey(
        Association, on_delete=models.CASCADE, related_name="events", verbose_name="association organisatrice"
    )
    title = models.CharField("titre", max_length=200)
    description = models.TextField("description")
    category = models.CharField("thème", max_length=20, choices=Category.choices, default=Category.AUTRE)
    start = models.DateTimeField("début")
    end = models.DateTimeField("fin")
    location = models.CharField("lieu", max_length=255)
    visibility = models.CharField(
        "visibilité", max_length=10, choices=Visibility.choices, default=Visibility.PUBLIC
    )
    volunteers_needed = models.PositiveIntegerField(
        "bénévoles recherchés", default=0, help_text="0 si vous ne cherchez pas de renfort."
    )
    material_needs = models.TextField(
        "besoins matériels", blank=True, help_text="Tables, barnums, sono… ce que vous aimeriez emprunter."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+", verbose_name="créé par"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = EventQuerySet.as_manager()

    class Meta:
        verbose_name = "événement"
        ordering = ["start"]

    def __str__(self):
        return self.title

    def clean(self):
        if self.start and self.end and self.end <= self.start:
            raise ValidationError({"end": "La fin doit être postérieure au début."})

    def get_absolute_url(self):
        return reverse("events:detail", args=[self.pk])

    def conflicts(self):
        """Autres événements qui se déroulent sur le même créneau."""
        qs = Event.objects.overlapping(self.start, self.end).select_related("association")
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        return qs

    def volunteers_count(self):
        return self.volunteers.count()


class Participation(models.Model):
    """Une autre association s'associe à l'événement."""

    class Kind(models.TextChoices):
        COORGANIZER = "coorg", "Co-organise"
        PARTICIPANT = "participant", "Participe / tient un stand"
        SUPPORT = "support", "Apporte du soutien (matériel, bénévoles…)"
        INTERESTED = "interested", "Intéressée"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participations")
    association = models.ForeignKey(Association, on_delete=models.CASCADE, related_name="participations")
    kind = models.CharField("type", max_length=12, choices=Kind.choices, default=Kind.PARTICIPANT)
    message = models.CharField("message", max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "association"], name="unique_participation")]
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.association} → {self.event} ({self.get_kind_display()})"


class Volunteer(models.Model):
    """Un utilisateur se propose comme bénévole sur un événement."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="volunteers")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="volunteering")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "bénévole"
        constraints = [models.UniqueConstraint(fields=["event", "user"], name="unique_volunteer")]

    def __str__(self):
        return f"{self.user} → {self.event}"


class Comment(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="event_comments")
    body = models.TextField("message")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "commentaire"
        ordering = ["created_at"]

    def __str__(self):
        return f"Commentaire de {self.author} sur {self.event}"
