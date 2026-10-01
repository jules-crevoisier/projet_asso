from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from events.models import Event

from .forms import AssociationForm, JoinForm
from .models import Association, Category, Membership
from .permissions import get_membership, is_admin


def association_list(request):
    qs = Association.objects.annotate(
        nb_members=Count("memberships", filter=Q(memberships__status=Membership.Status.ACTIVE))
    )
    q = request.GET.get("q", "").strip()
    category = request.GET.get("categorie", "")
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(short_description__icontains=q) | Q(description__icontains=q))
    if category in Category.values:
        qs = qs.filter(category=category)
    return render(
        request,
        "associations/list.html",
        {"associations": qs, "q": q, "category": category, "categories": Category.choices},
    )


def association_detail(request, slug):
    association = get_object_or_404(Association, slug=slug)
    membership = get_membership(request.user, association)
    events = (
        Event.objects.visible_to(request.user)
        .filter(Q(association=association) | Q(participations__association=association), end__gte=timezone.now())
        .distinct()
        .select_related("association")[:10]
    )
    context = {
        "association": association,
        "membership": membership,
        "is_admin": is_admin(request.user, association),
        "events": events,
        "join_form": JoinForm(),
    }
    if request.user.is_authenticated:
        context["members"] = association.active_memberships()
        context["posts"] = association.posts.filter(is_closed=False)[:5]
    return render(request, "associations/detail.html", context)


@login_required
def association_create(request):
    form = AssociationForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        association = form.save(commit=False)
        association.created_by = request.user
        association.is_validated = request.user.is_staff
        association.save()
        Membership.objects.create(
            user=request.user, association=association, role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE
        )
        if association.can_publish:
            messages.success(request, f"L'association « {association} » a été créée.")
        else:
            messages.info(
                request,
                f"L'association « {association} » a été créée. Elle sera visible comme validée après vérification "
                "par un modérateur ; vous pourrez alors publier des événements et des annonces.",
            )
        return redirect(association)
    return render(request, "associations/form.html", {"form": form, "title": "Créer une association"})


@login_required
def association_edit(request, slug):
    association = get_object_or_404(Association, slug=slug)
    if not is_admin(request.user, association):
        raise PermissionDenied
    form = AssociationForm(request.POST or None, instance=association)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Fiche mise à jour.")
        return redirect(association)
    return render(
        request, "associations/form.html", {"form": form, "title": f"Modifier « {association} »", "association": association}
    )


@login_required
@require_POST
def association_join(request, slug):
    association = get_object_or_404(Association, slug=slug)
    form = JoinForm(request.POST)
    if get_membership(request.user, association):
        messages.info(request, "Vous avez déjà une demande ou une adhésion pour cette association.")
    elif form.is_valid():
        Membership.objects.create(user=request.user, association=association, message=form.cleaned_data["message"])
        messages.success(request, "Demande envoyée. Un responsable de l'association va la valider.")
    return redirect(association)


@login_required
@require_POST
def association_leave(request, slug):
    association = get_object_or_404(Association, slug=slug)
    membership = get_membership(request.user, association)
    if membership:
        if membership.is_admin and len(association.admins()) == 1 and association.active_memberships().count() > 1:
            messages.error(request, "Vous êtes le seul administrateur : nommez un autre administrateur avant de partir.")
            return redirect(association)
        membership.delete()
        messages.success(request, f"Vous avez quitté « {association} ».")
    return redirect(association)


@login_required
def association_members(request, slug):
    association = get_object_or_404(Association, slug=slug)
    if not is_admin(request.user, association):
        raise PermissionDenied
    memberships = association.memberships.select_related("user").order_by("status", "role", "user__first_name")
    return render(request, "associations/members.html", {"association": association, "memberships": memberships})


@login_required
@require_POST
def membership_action(request, slug, pk, action):
    association = get_object_or_404(Association, slug=slug)
    if not is_admin(request.user, association):
        raise PermissionDenied
    membership = get_object_or_404(Membership, pk=pk, association=association)
    is_last_admin = membership.is_admin and len(association.admins()) == 1

    if action == "approve":
        membership.status = Membership.Status.ACTIVE
        membership.save()
        messages.success(request, f"{membership.user} fait maintenant partie de l'association.")
    elif action == "promote":
        membership.role = Membership.Role.ADMIN
        membership.save()
        messages.success(request, f"{membership.user} est maintenant administrateur.")
    elif action == "demote":
        if is_last_admin:
            messages.error(request, "L'association doit garder au moins un administrateur.")
        else:
            membership.role = Membership.Role.MEMBER
            membership.save()
            messages.success(request, f"{membership.user} est maintenant simple membre.")
    elif action == "remove":
        if is_last_admin:
            messages.error(request, "Impossible de retirer le dernier administrateur.")
        else:
            membership.delete()
            messages.success(request, f"{membership.user} a été retiré(e).")
    return redirect("associations:members", slug=association.slug)


@staff_member_required
def moderation(request):
    pending = Association.objects.filter(is_validated=False).select_related("created_by")
    return render(request, "associations/moderation.html", {"pending": pending})


@staff_member_required
@require_POST
def validate_association(request, slug):
    association = get_object_or_404(Association, slug=slug)
    association.is_validated = True
    association.save(update_fields=["is_validated"])
    messages.success(request, f"« {association} » est validée.")
    return redirect("associations:moderation")
