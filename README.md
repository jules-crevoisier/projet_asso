# Assos Troyes

Plateforme de coordination pour les associations de Troyes : comptes personnels, fiches
d'associations, **calendrier partagé**, co-organisation d'événements et annonces pour
partager des infos (bénévoles, prêt de matériel, salles…).

## Fonctionnalités

### Comptes et associations
- Inscription et connexion par **e-mail + mot de passe**, mot de passe oublié par e-mail, profil.
- **Annuaire** des associations, avec recherche et filtre par domaine.
- Chaque bénévole a son compte et **demande à rejoindre** son association ; les responsables
  acceptent ou refusent, nomment d'autres responsables et retirent des membres.
- Une association créée doit être **validée par un modérateur** (compte staff) avant de
  pouvoir publier, pour éviter les faux comptes. Réglable avec `ASSOCIATIONS_REQUIRE_VALIDATION`.

### Calendrier partagé
- **Vue mensuelle** commune à toutes les associations, plus une vue liste. Filtres par
  association, par thème ou « mes associations uniquement ».
- **Détection des conflits** : quand on crée ou déplace un événement, la plateforme liste
  les événements déjà prévus sur le même créneau. On peut alors changer la date ou publier
  quand même. Les jours chargés sont signalés par ⚠ dans le calendrier.
- **Visibilité** : un événement est soit *public* (visible par tous, même sans compte), soit
  *réseau* (visible uniquement par les associations connectées, pour les réunions de préparation).
- **Abonnement iCal** : chaque utilisateur a un lien personnel à ajouter dans Google Agenda,
  Outlook ou son téléphone, avec tous les événements ou seulement ceux de ses associations.
  Les événements publics ont aussi un flux ouvert (`/evenements/ical/public.ics`), et chaque
  événement peut s'ajouter à un agenda.

### Coordination autour d'un événement
- Les autres associations peuvent s'y associer : co-organisation, stand, soutien, intérêt.
- Besoins en **bénévoles** (inscription en un clic, les organisateurs voient les contacts)
  et en **matériel**.
- **Discussion** entre associations sur la page de l'événement.

### Annonces
- Types : information, recherche de bénévoles, prêt/don ou recherche de matériel, appel à
  partenariat, salle/local.
- Réponses au nom d'une association ou à titre personnel ; une annonce peut être marquée résolue.

### Tableau de bord
Les événements de mes associations, les prochains événements en ville, les dernières annonces
et les demandes d'adhésion en attente.

## Démarrer en local

Prérequis : Python 3.10 ou plus récent.

```bash
python -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo         # facultatif : données de démonstration
python manage.py runserver
```

Ouvrir ensuite http://127.0.0.1:8000.

Comptes de démo (mot de passe `demo-troyes-2026`) :
- `admin@exemple.fr` : super-administrateur et modérateur (accès à `/admin/`)
- `camille@exemple.fr`, `yanis@exemple.fr`, `lea@exemple.fr`… : responsables d'associations

Sans les données de démo, créez un administrateur avec `python manage.py createsuperuser`.

## Tests

```bash
python manage.py test
```

## Mise en production

1. Définir les variables d'environnement listées dans `.env.example`, au minimum
   `DJANGO_DEBUG=False`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` et
   `DJANGO_CSRF_TRUSTED_ORIGINS`. Configurer aussi le SMTP pour les e-mails de mot de passe oublié.
2. Lancer :
   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py collectstatic --noinput
   python manage.py createsuperuser
   gunicorn config.wsgi --bind 0.0.0.0:8000
   ```
3. Placer le service derrière HTTPS (Nginx, Caddy, ou un hébergeur comme Render, Railway,
   Fly.io ou Alwaysdata). Les fichiers statiques sont servis par WhiteNoise.

La base par défaut est SQLite, ce qui suffit largement pour quelques centaines d'associations.
Son chemin se règle avec `DJANGO_DB_PATH` ; placez-la sur un disque persistant et sauvegardez-la.

## Structure

| Dossier        | Rôle                                                         |
|----------------|--------------------------------------------------------------|
| `accounts/`    | Utilisateurs (connexion par e-mail), profil, jeton d'agenda  |
| `associations/`| Associations, adhésions, rôles, modération                   |
| `events/`      | Événements, calendrier, conflits, participations, bénévoles, iCal |
| `board/`       | Annonces et réponses                                         |
| `config/`      | Réglages, URLs, accueil et tableau de bord                   |
| `templates/`, `static/` | Gabarits HTML et feuille de style                   |
