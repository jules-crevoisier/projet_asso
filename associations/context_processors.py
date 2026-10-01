from django.conf import settings

from .models import Association, Membership


def platform(request):
    ctx = {"PLATFORM_NAME": settings.PLATFORM_NAME, "PLATFORM_CITY": settings.PLATFORM_CITY}
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        # Demandes d'adhésion en attente dans les associations que l'utilisateur administre
        ctx["pending_requests_count"] = Membership.objects.filter(
            status=Membership.Status.PENDING,
            association__memberships__user=user,
            association__memberships__role=Membership.Role.ADMIN,
            association__memberships__status=Membership.Status.ACTIVE,
        ).count()
        if user.is_staff:
            ctx["pending_validation_count"] = Association.objects.filter(is_validated=False).count()
    return ctx
