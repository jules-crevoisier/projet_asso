"""Fonctions utilitaires de contrôle d'accès liées aux associations."""

from .models import Association, Membership


def member_associations(user, admin_only=False):
    """Associations dont l'utilisateur est membre actif (ou administrateur)."""
    if not user.is_authenticated:
        return Association.objects.none()
    filters = {"memberships__user": user, "memberships__status": Membership.Status.ACTIVE}
    if admin_only:
        filters["memberships__role"] = Membership.Role.ADMIN
    return Association.objects.filter(**filters).distinct()


def publishing_associations(user):
    """Associations au nom desquelles l'utilisateur peut publier."""
    return [a for a in member_associations(user) if a.can_publish]


def get_membership(user, association):
    if not user.is_authenticated:
        return None
    return Membership.objects.filter(user=user, association=association).first()


def is_member(user, association):
    m = get_membership(user, association)
    return bool(m and m.is_active)


def is_admin(user, association):
    if user.is_authenticated and user.is_staff:
        return True
    m = get_membership(user, association)
    return bool(m and m.is_admin)
