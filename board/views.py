from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from associations.permissions import is_member, publishing_associations

from .forms import PostForm, ReplyForm
from .models import Post, Reply


def can_edit(user, post):
    return user.is_staff or post.author_id == user.pk or is_member(user, post.association)


@login_required
def post_list(request):
    posts = Post.objects.select_related("association", "author").annotate(nb_replies=Count("replies"))
    kind = request.GET.get("type", "")
    q = request.GET.get("q", "").strip()
    show_closed = request.GET.get("cloturees") == "1"
    if kind in Post.Kind.values:
        posts = posts.filter(kind=kind)
    if q:
        posts = posts.filter(Q(title__icontains=q) | Q(body__icontains=q) | Q(association__name__icontains=q))
    if not show_closed:
        posts = posts.filter(is_closed=False)
    return render(
        request,
        "board/list.html",
        {"posts": posts[:200], "kinds": Post.Kind.choices, "kind": kind, "q": q, "show_closed": show_closed},
    )


@login_required
def post_detail(request, pk):
    post = get_object_or_404(Post.objects.select_related("association", "author"), pk=pk)
    return render(
        request,
        "board/detail.html",
        {
            "post": post,
            "replies": post.replies.select_related("author", "association"),
            "reply_form": ReplyForm(user=request.user),
            "can_edit": can_edit(request.user, post),
        },
    )


@login_required
def post_create(request):
    if not publishing_associations(request.user):
        messages.info(request, "Pour publier une annonce, vous devez être membre d'une association validée.")
        return redirect("associations:list")
    form = PostForm(request.POST or None, user=request.user, initial={"kind": request.GET.get("type", "info")})
    if request.method == "POST" and form.is_valid():
        post = form.save(commit=False)
        post.author = request.user
        post.save()
        messages.success(request, "Annonce publiée.")
        return redirect(post)
    return render(request, "board/form.html", {"form": form, "title": "Nouvelle annonce"})


@login_required
def post_edit(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not can_edit(request.user, post):
        raise PermissionDenied
    form = PostForm(request.POST or None, instance=post, user=request.user)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Annonce mise à jour.")
        return redirect(post)
    return render(request, "board/form.html", {"form": form, "title": f"Modifier « {post} »", "post": post})


@login_required
@require_POST
def post_toggle_close(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not can_edit(request.user, post):
        raise PermissionDenied
    post.is_closed = not post.is_closed
    post.save(update_fields=["is_closed"])
    messages.success(request, "Annonce clôturée." if post.is_closed else "Annonce rouverte.")
    return redirect(post)


@login_required
def post_delete(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not can_edit(request.user, post):
        raise PermissionDenied
    if request.method == "POST":
        post.delete()
        messages.success(request, "Annonce supprimée.")
        return redirect("board:list")
    return render(request, "board/confirm_delete.html", {"post": post})


@login_required
@require_POST
def post_reply(request, pk):
    post = get_object_or_404(Post, pk=pk)
    form = ReplyForm(request.POST, user=request.user)
    if form.is_valid():
        reply = form.save(commit=False)
        reply.post = post
        reply.author = request.user
        reply.save()
    return redirect(f"{post.get_absolute_url()}#reponses")


@login_required
@require_POST
def reply_delete(request, pk):
    reply = get_object_or_404(Reply, pk=pk)
    if reply.author != request.user and not can_edit(request.user, reply.post):
        raise PermissionDenied
    reply.delete()
    return redirect(f"{reply.post.get_absolute_url()}#reponses")
