import uuid

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from associations.models import Membership

from .forms import ProfileForm, SignupForm


def signup(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    form = SignupForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, "Bienvenue ! Rejoignez votre association ou créez-la pour commencer.")
        return redirect("associations:list")
    return render(request, "accounts/signup.html", {"form": form})


@login_required
def profile(request):
    form = ProfileForm(request.POST or None, instance=request.user)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Profil mis à jour.")
        return redirect("accounts:profile")
    memberships = request.user.memberships.select_related("association")
    feed_url = request.build_absolute_uri(f"/evenements/ical/{request.user.calendar_token}.ics")
    return render(
        request,
        "accounts/profile.html",
        {"form": form, "memberships": memberships, "feed_url": feed_url, "Status": Membership.Status},
    )


@login_required
@require_POST
def regenerate_calendar_token(request):
    request.user.calendar_token = uuid.uuid4()
    request.user.save(update_fields=["calendar_token"])
    messages.success(request, "Nouveau lien d'abonnement généré. L'ancien ne fonctionne plus.")
    return redirect("accounts:profile")
