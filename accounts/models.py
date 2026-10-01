import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Gestionnaire d'utilisateurs : la connexion se fait par e-mail."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("Un super-utilisateur doit avoir is_staff=True et is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField("adresse e-mail", unique=True)
    phone = models.CharField("téléphone", max_length=30, blank=True)
    bio = models.TextField("présentation", blank=True)
    # Jeton secret permettant d'abonner son agenda (Google, Outlook…) au calendrier partagé
    calendar_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return self.get_full_name() or self.email

    @property
    def display_name(self):
        return self.get_full_name() or self.email.split("@")[0]
