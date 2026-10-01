import calendar
from datetime import date, datetime, time, timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render, resolve_url
from django.utils import timezone
from django.views.decorators.http import require_POST

from associations.models import Association, Category
from associations.permissions import is_admin, is_member, member_associations, publishing_associations

from .forms import CommentForm, EventForm, ParticipationForm
from .ical import build_calendar
from .models import Comment, Event, Participation, Volunteer

MONTHS = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
          "septembre", "octobre", "novembre", "décembre"]
WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]


def can_edit(user, event):
    return user.is_authenticated and (user.is_staff or is_member(user, event.association))


def filtered_events(request):
    """Applique les filtres communs (association, thème, « mes associations »)."""
    qs = Event.objects.visible_to(request.user).select_related("association")
    asso = request.GET.get("association", "")
    category = request.GET.get("theme", "")
    mine = request.GET.get("mes") == "1"
    if asso:
        qs = qs.filter(Q(association__slug=asso) | Q(participations__association__slug=asso)).distinct()
    if category in Category.values:
        qs = qs.filter(category=category)
    if mine and request.user.is_authenticated:
        ids = list(member_associations(request.user).values_list("pk", flat=True))
        qs = qs.filter(Q(association__in=ids) | Q(participations__association__in=ids)).distinct()
    filters = {
        "association": asso,
        "theme": category,
        "mes": mine,
        "associations": Association.objects.only("name", "slug"),
        "categories": Category.choices,
    }
    return qs, filters


def query_without(request, *keys):
    params = request.GET.copy()
    for key in keys:
        params.pop(key, None)
    return params.urlencode()


def calendar_view(request):
    today = timezone.localdate()
    try:
        year = int(request.GET.get("annee", today.year))
        month = int(request.GET.get("mois", today.month))
        first = date(year, month, 1)
    except ValueError:
        raise Http404
    weeks = calendar.Calendar(firstweekday=0).monthdatescalendar(year, month)
    tz = timezone.get_current_timezone()
    range_start = timezone.make_aware(datetime.combine(weeks[0][0], time.min), tz)
    range_end = timezone.make_aware(datetime.combine(weeks[-1][-1] + timedelta(days=1), time.min), tz)

    qs, filters = filtered_events(request)
    events = list(qs.overlapping(range_start, range_end))

    by_day = {}
    for event in events:
        day = max(timezone.localtime(event.start).date(), weeks[0][0])
        last = min(timezone.localtime(event.end - timedelta(seconds=1)).date(), weeks[-1][-1])
        while day <= last:
            by_day.setdefault(day, []).append(event)
            day += timedelta(days=1)

    grid = [
        [{"date": d, "events": by_day.get(d, []), "in_month": d.month == month, "today": d == today} for d in week]
        for week in weeks
    ]
    prev_month = (first - timedelta(days=1)).replace(day=1)
    next_month = (first + timedelta(days=32)).replace(day=1)
    return render(
        request,
        "events/calendar.html",
        {
            "grid": grid,
            "weekdays": WEEKDAYS,
            "month_label": f"{MONTHS[month]} {year}",
            "prev": prev_month,
            "next": next_month,
            "today": today,
            "filters": filters,
            "filter_query": query_without(request, "annee", "mois"),
            "extra_hidden": [("annee", year), ("mois", month)],
            "month_events": sorted({e for e in events if timezone.localtime(e.start).month == month
                                    or timezone.localtime(e.end).month == month}, key=lambda e: e.start),
        },
    )


def event_list(request):
    qs, filters = filtered_events(request)
    past = request.GET.get("passes") == "1"
    now = timezone.now()
    qs = qs.filter(end__lt=now).order_by("-start") if past else qs.filter(end__gte=now)
    return render(request, "events/list.html", {"events": qs[:200], "filters": filters, "past": past,
                                                "filter_query": query_without(request, "passes"),
                                                "extra_hidden": [("passes", "1")] if past else []})


def event_detail(request, pk):
    event = get_object_or_404(Event.objects.select_related("association", "created_by"), pk=pk)
    if event.visibility == Event.Visibility.NETWORK and not request.user.is_authenticated:
        return redirect(f"{resolve_url(settings.LOGIN_URL)}?next={request.path}")
    context = {
        "event": event,
        "participations": event.participations.select_related("association"),
        "can_edit": can_edit(request.user, event),
    }
    if request.user.is_authenticated:
        context.update(
            {
                "comments": event.comments.select_related("author"),
                "comment_form": CommentForm(),
                "participation_form": ParticipationForm(user=request.user, event=event),
                "is_volunteer": event.volunteers.filter(user=request.user).exists(),
                "volunteers": event.volunteers.select_related("user") if context["can_edit"] else None,
                "conflicts": event.conflicts(),
                "my_participations": event.participations.filter(
                    association__in=member_associations(request.user)
                ),
            }
        )
    return render(request, "events/detail.html", context)


def _save_event_form(request, form, title, event=None):
    """Valide le formulaire et avertit si d'autres événements ont lieu sur le même créneau."""
    conflicts = []
    if request.method == "POST" and form.is_valid():
        candidate = form.instance
        slot_changed = candidate.pk is None or {"start", "end"} & set(form.changed_data)
        conflicts = list(candidate.conflicts()) if slot_changed else []
        if conflicts and not form.cleaned_data.get("confirm_conflicts"):
            data = request.POST.copy()
            data["confirm_conflicts"] = "on"
            form = EventForm(data, instance=event, user=request.user)
            form.is_valid()
        else:
            is_new = candidate.pk is None
            if is_new:
                candidate.created_by = request.user
            candidate.save()
            messages.success(request, "Événement publié dans le calendrier partagé." if is_new
                             else "Événement mis à jour.")
            return redirect(candidate)
    return render(request, "events/form.html", {"form": form, "title": title, "conflicts": conflicts, "event": event})


@login_required
def event_create(request):
    if not publishing_associations(request.user):
        messages.info(
            request,
            "Pour publier un événement, vous devez être membre d'une association validée.",
        )
        return redirect("associations:list")
    initial = {}
    if request.GET.get("date"):
        try:
            day = date.fromisoformat(request.GET["date"])
            initial = {"start": datetime.combine(day, time(14)), "end": datetime.combine(day, time(18))}
        except ValueError:
            pass
    form = EventForm(request.POST or None, user=request.user, initial=initial)
    return _save_event_form(request, form, "Nouvel événement")


@login_required
def event_edit(request, pk):
    event = get_object_or_404(Event, pk=pk)
    if not can_edit(request.user, event):
        raise PermissionDenied
    form = EventForm(request.POST or None, instance=event, user=request.user)
    return _save_event_form(request, form, f"Modifier « {event} »", event=event)


@login_required
def event_delete(request, pk):
    event = get_object_or_404(Event, pk=pk)
    if not can_edit(request.user, event):
        raise PermissionDenied
    if request.method == "POST":
        event.delete()
        messages.success(request, "Événement supprimé.")
        return redirect("events:calendar")
    return render(request, "events/confirm_delete.html", {"event": event})


@login_required
@require_POST
def event_participate(request, pk):
    event = get_object_or_404(Event, pk=pk)
    form = ParticipationForm(request.POST, user=request.user, event=event)
    if form.is_valid():
        participation = form.save(commit=False)
        participation.event = event
        participation.created_by = request.user
        participation.save()
        messages.success(request, f"{participation.association} est associée à cet événement.")
    else:
        messages.error(request, "Impossible d'enregistrer la participation.")
    return redirect(event)


@login_required
@require_POST
def participation_delete(request, pk):
    participation = get_object_or_404(Participation, pk=pk)
    if not (is_member(request.user, participation.association) or can_edit(request.user, participation.event)
            or is_admin(request.user, participation.association)):
        raise PermissionDenied
    participation.delete()
    messages.success(request, "Participation retirée.")
    return redirect(participation.event)


@login_required
@require_POST
def event_volunteer(request, pk):
    event = get_object_or_404(Event, pk=pk)
    volunteer, created = Volunteer.objects.get_or_create(event=event, user=request.user)
    if created:
        messages.success(request, "Merci ! Les organisateurs voient maintenant que vous êtes disponible.")
    else:
        volunteer.delete()
        messages.info(request, "Vous n'êtes plus inscrit(e) comme bénévole.")
    return redirect(event)


@login_required
@require_POST
def event_comment(request, pk):
    event = get_object_or_404(Event, pk=pk)
    form = CommentForm(request.POST)
    if form.is_valid():
        Comment.objects.create(event=event, author=request.user, body=form.cleaned_data["body"])
    return redirect(f"{event.get_absolute_url()}#discussion")


@login_required
@require_POST
def comment_delete(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    if comment.author != request.user and not can_edit(request.user, comment.event):
        raise PermissionDenied
    comment.delete()
    return redirect(f"{comment.event.get_absolute_url()}#discussion")


def _ics_response(content, filename):
    response = HttpResponse(content, content_type="text/calendar; charset=utf-8")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


def _feed_events():
    return Event.objects.filter(end__gte=timezone.now() - timedelta(days=90)).select_related("association")


def ical_public(request):
    events = _feed_events().filter(visibility=Event.Visibility.PUBLIC)
    return _ics_response(build_calendar(events, request, f"{settings.PLATFORM_NAME} – événements publics"),
                         "evenements-publics.ics")


def ical_private(request, token):
    user = get_object_or_404(get_user_model(), calendar_token=token, is_active=True)
    events = _feed_events()
    if request.GET.get("mes") == "1":
        ids = list(member_associations(user).values_list("pk", flat=True))
        events = events.filter(Q(association__in=ids) | Q(participations__association__in=ids)).distinct()
    return _ics_response(build_calendar(events, request, f"{settings.PLATFORM_NAME} – calendrier partagé"),
                         "calendrier-associations.ics")


def ical_event(request, pk):
    event = get_object_or_404(Event.objects.visible_to(request.user).select_related("association"), pk=pk)
    return _ics_response(build_calendar([event], request, event.title), f"evenement-{event.pk}.ics")
