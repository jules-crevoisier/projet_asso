from django import forms

from .models import Association, Membership


class AssociationForm(forms.ModelForm):
    class Meta:
        model = Association
        fields = ("name", "category", "short_description", "description", "email", "phone", "website", "address")
        widgets = {"description": forms.Textarea(attrs={"rows": 6})}


class JoinForm(forms.ModelForm):
    class Meta:
        model = Membership
        fields = ("message",)
        labels = {"message": "Message pour les responsables (facultatif)"}
