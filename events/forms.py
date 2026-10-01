from django import forms

from associations.models import Association
from associations.permissions import publishing_associations

from .models import Comment, Event, Participation

DATETIME_FORMAT = "%Y-%m-%dT%H:%M"


class DateTimeLocalInput(forms.DateTimeInput):
    input_type = "datetime-local"

    def __init__(self, **kwargs):
        super().__init__(format=DATETIME_FORMAT, **kwargs)


class EventForm(forms.ModelForm):
    confirm_conflicts = forms.BooleanField(
        required=False, widget=forms.HiddenInput, label="J'ai vu les événements sur le même créneau"
    )

    class Meta:
        model = Event
        fields = (
            "association", "title", "category", "start", "end", "location", "description",
            "visibility", "volunteers_needed", "material_needs",
        )
        widgets = {
            "start": DateTimeLocalInput(),
            "end": DateTimeLocalInput(),
            "description": forms.Textarea(attrs={"rows": 6}),
            "material_needs": forms.Textarea(attrs={"rows": 3}),
        }

    def __init__(self, *args, user, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            # L'organisateur ne change pas une fois l'événement créé
            self.fields["association"].disabled = True
            self.fields["association"].queryset = Association.objects.filter(pk=self.instance.association_id)
        else:
            allowed = publishing_associations(user)
            self.fields["association"].queryset = Association.objects.filter(pk__in=[a.pk for a in allowed])
            if len(allowed) == 1:
                self.fields["association"].initial = allowed[0]
        for name in ("start", "end"):
            self.fields[name].input_formats = [DATETIME_FORMAT]

    def clean(self):
        cleaned = super().clean()
        start, end = cleaned.get("start"), cleaned.get("end")
        if start and end and end <= start:
            self.add_error("end", "La fin doit être postérieure au début.")
        return cleaned


class ParticipationForm(forms.ModelForm):
    class Meta:
        model = Participation
        fields = ("association", "kind", "message")
        labels = {"association": "Au nom de", "message": "Message (facultatif)"}

    def __init__(self, *args, user, event, **kwargs):
        super().__init__(*args, **kwargs)
        already = event.participations.values_list("association_id", flat=True)
        ids = [a.pk for a in publishing_associations(user) if a.pk != event.association_id and a.pk not in already]
        self.fields["association"].queryset = self.fields["association"].queryset.filter(pk__in=ids)


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ("body",)
        labels = {"body": ""}
        widgets = {"body": forms.Textarea(attrs={"rows": 3, "placeholder": "Une question, une proposition…"})}
