from django import forms

from associations.models import Association
from associations.permissions import member_associations, publishing_associations

from .models import Post, Reply


class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ("association", "kind", "title", "body")
        widgets = {"body": forms.Textarea(attrs={"rows": 8})}

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["association"].disabled = True
            self.fields["association"].queryset = Association.objects.filter(pk=self.instance.association_id)
        else:
            allowed = publishing_associations(user)
            self.fields["association"].queryset = Association.objects.filter(pk__in=[a.pk for a in allowed])
            if len(allowed) == 1:
                self.fields["association"].initial = allowed[0]


class ReplyForm(forms.ModelForm):
    class Meta:
        model = Reply
        fields = ("association", "body")
        widgets = {"body": forms.Textarea(attrs={"rows": 3})}

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["association"].queryset = member_associations(user)
        self.fields["association"].empty_label = "À titre personnel"
