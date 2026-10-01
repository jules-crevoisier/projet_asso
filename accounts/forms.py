from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from .models import User


class SignupForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "email")
        labels = {"first_name": "Prénom", "last_name": "Nom"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["first_name"].required = True
        self.fields["last_name"].required = True

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return email


class LoginForm(AuthenticationForm):
    username = forms.EmailField(label="Adresse e-mail", widget=forms.EmailInput(attrs={"autofocus": True}))

    def clean(self):
        if self.cleaned_data.get("username"):
            self.cleaned_data["username"] = self.cleaned_data["username"].lower()
        return super().clean()


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "phone", "bio")
        labels = {"first_name": "Prénom", "last_name": "Nom"}
