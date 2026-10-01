"""Remplit la base avec des données de démonstration (associations fictives)."""

from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from associations.models import Association, Category, Membership
from board.models import Post, Reply
from events.models import Comment, Event, Participation, Volunteer

PASSWORD = "demo-troyes-2026"


class Command(BaseCommand):
    help = "Crée des comptes, associations, événements et annonces de démonstration."

    def handle(self, *args, **options):
        if Association.objects.exists():
            self.stdout.write(self.style.WARNING("La base contient déjà des associations : rien n'a été créé."))
            return

        User.objects.create_superuser("admin@exemple.fr", PASSWORD, first_name="Admin", last_name="Plateforme")
        people = {
            key: User.objects.create_user(f"{key}@exemple.fr", PASSWORD, first_name=first, last_name=last)
            for key, first, last in [
                ("camille", "Camille", "Martin"), ("yanis", "Yanis", "Bernard"), ("lea", "Léa", "Petit"),
                ("hugo", "Hugo", "Robert"), ("ines", "Inès", "Richard"), ("tom", "Tom", "Durand"),
            ]
        }

        def asso(name, category, short, owner, **extra):
            a = Association.objects.create(name=name, category=category, short_description=short,
                                           is_validated=True, created_by=owner, **extra)
            Membership.objects.create(user=owner, association=a, role=Membership.Role.ADMIN,
                                      status=Membership.Status.ACTIVE)
            return a

        velo = asso("Troyes à Vélo", Category.ENVIRONNEMENT, "Promouvoir le vélo au quotidien dans l'agglomération.",
                    people["camille"], email="contact@velo.exemple.fr", address="Quai des Comtes de Champagne")
        theatre = asso("Compagnie des Remparts", Category.CULTURE, "Troupe de théâtre amateur et ateliers pour tous.",
                       people["yanis"], email="bonjour@remparts.exemple.fr")
        resto = asso("Solidarité Seine", Category.SOCIAL, "Aide alimentaire et accompagnement des familles.",
                     people["lea"], phone="03 25 00 00 00")
        foot = asso("Étoile Sportive Saint-Julien", Category.SPORT, "Club de football pour les 6–17 ans.",
                    people["hugo"])
        jardin = asso("Jardins Partagés du Vouldy", Category.QUARTIER, "Potagers collectifs et ateliers compost.",
                      people["ines"])
        Association.objects.create(name="Les Amis de la Médiathèque", category=Category.CULTURE,
                                   short_description="Club de lecture et rencontres d'auteurs.",
                                   created_by=people["tom"])
        Membership.objects.create(user=people["tom"], association=Association.objects.get(slug="les-amis-de-la-mediatheque"),
                                  role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE)

        Membership.objects.create(user=people["tom"], association=velo, status=Membership.Status.ACTIVE)
        Membership.objects.create(user=people["ines"], association=resto, status=Membership.Status.ACTIVE)
        Membership.objects.create(user=people["yanis"], association=jardin, status=Membership.Status.PENDING,
                                  message="J'habite le quartier et j'aimerais aider au jardin.")

        tz = timezone.get_current_timezone()
        today = timezone.localdate()

        def at(days, hour, minute=0):
            return timezone.make_aware(datetime.combine(today + timedelta(days=days), time(hour, minute)), tz)

        def event(a, title, days, h1, h2, location, category, **extra):
            return Event.objects.create(association=a, title=title, start=at(days, h1), end=at(days, h2),
                                        location=location, category=category, created_by=a.created_by,
                                        description=extra.pop("description", f"{title} organisé par {a}."), **extra)

        fete = event(velo, "Fête du vélo", 9, 10, 18, "Place de la Libération", Category.ENVIRONNEMENT,
                     description="Balade familiale, atelier réparation, bourse aux vélos.",
                     volunteers_needed=8, material_needs="2 barnums, 4 tables, une sono.")
        event(theatre, "Représentation : Le Malade imaginaire", 9, 15, 17, "Théâtre de la Madeleine", Category.CULTURE)
        collecte = event(resto, "Collecte alimentaire", 16, 9, 19, "Galerie marchande, centre-ville", Category.SOCIAL,
                         volunteers_needed=12)
        event(foot, "Tournoi inter-quartiers U12", 23, 9, 17, "Stade de l'Aube", Category.SPORT)
        event(jardin, "Atelier compost", 4, 14, 16, "Jardin du Vouldy", Category.QUARTIER)
        event(velo, "Réunion inter-associations : forum de rentrée", 30, 18, 20, "Maison des associations",
              Category.AUTRE, visibility=Event.Visibility.NETWORK,
              description="Préparation commune du forum des associations : stands, planning, communication.")

        Participation.objects.create(event=fete, association=jardin, kind=Participation.Kind.PARTICIPANT,
                                     message="On tient un stand semis et compost.", created_by=people["ines"])
        Participation.objects.create(event=collecte, association=foot, kind=Participation.Kind.SUPPORT,
                                     message="Les parents du club viennent en renfort.", created_by=people["hugo"])
        Volunteer.objects.create(event=fete, user=people["tom"])
        Comment.objects.create(event=fete, author=people["yanis"],
                               body="On joue l'après-midi à la Madeleine, on peut faire une annonce croisée ?")

        p = Post.objects.create(association=theatre, author=people["yanis"], kind=Post.Kind.LEND,
                                title="Prêt de projecteurs de scène",
                                body="Nous avons 6 projecteurs LED disponibles en prêt les week-ends.")
        Reply.objects.create(post=p, author=people["camille"], association=velo,
                             body="Super, on serait intéressés pour la fête du vélo !")
        Post.objects.create(association=resto, author=people["lea"], kind=Post.Kind.VOLUNTEERS,
                            title="Bénévoles pour la collecte de novembre",
                            body="Nous cherchons des créneaux de 2h, même ponctuellement.")
        Post.objects.create(association=jardin, author=people["ines"], kind=Post.Kind.BORROW,
                            title="Recherche broyeur de végétaux",
                            body="Pour un atelier compost, une demi-journée.")

        self.stdout.write(self.style.SUCCESS(
            f"Données de démo créées. Comptes : admin@exemple.fr, camille@exemple.fr, yanis@exemple.fr… "
            f"(mot de passe : {PASSWORD})"
        ))
