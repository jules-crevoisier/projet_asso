from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import redirect, render
from django.utils import timezone

from associations.models import Association, Membership
from associations.permissions import member_associations
from board.models import Post
from events.models import Event


def home(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    now = timezone.now()
    return render(
        request,
        "home.html",
        {
            "events": Event.objects.visible_to(request.user).filter(end__gte=now).select_related("association")[:6],
            "nb_associations": Association.objects.filter(is_validated=True).count(),
            "nb_events": Event.objects.filter(end__gte=now).count(),
        },
    )


@login_required
def dashboard(request):
    now = timezone.now()
    my_assos = member_associations(request.user)
    my_ids = list(my_assos.values_list("pk", flat=True))
    pending = Membership.objects.filter(
        status=Membership.Status.PENDING,
        association__in=member_associations(request.user, admin_only=True),
    ).select_related("user", "association")
    return render(
        request,
        "dashboard.html",
        {
            "my_associations": my_assos,
            "my_events": Event.objects.filter(
                Q(association__in=my_ids) | Q(participations__association__in=my_ids), end__gte=now
            ).distinct().select_related("association")[:8],
            "upcoming": Event.objects.filter(end__gte=now).select_related("association")[:8],
            "posts": Post.objects.filter(is_closed=False).select_related("association")[:6],
            "pending": pending,
            "my_pending": request.user.memberships.filter(status=Membership.Status.PENDING).select_related("association"),
            "volunteering": request.user.volunteering.filter(event__end__gte=now).select_related("event"),
        },
    )
