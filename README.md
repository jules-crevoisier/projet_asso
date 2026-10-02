# Assos Troyes

Plateforme de coordination pour les associations de Troyes : comptes personnels,
annuaire, **calendrier partagé**, co-organisation d'événements et annonces d'entraide.

**Stack** : Node.js (Express 5) · EJS · Tailwind CSS 4 · SQLite (better-sqlite3) · FullCalendar

Les règles de design (le planning, la typographie, les couleurs, le mode sombre) sont dans [`docs/design.md`](docs/design.md).

## Démarrer

Prérequis : **Node.js 20 ou plus récent**.

```bash
npm install        # installe les dépendances et compile le CSS
npm run seed       # facultatif : données de démonstration
npm run dev        # http://localhost:3000 (redémarre à chaque modification)
```

Comptes de démo (mot de passe `demo-troyes-2026`) :

| Compte | Rôle |
|---|---|
| `admin@exemple.fr` | Modérateur de la plateforme |
| `camille@exemple.fr` | Responsable de « Troyes à Vélo » |
| `yanis@exemple.fr`, `lea@exemple.fr`, `hugo@exemple.fr`… | Responsables d'autres associations |

Sans les données de démo, créez un modérateur avec
`npm run create-admin -- vous@exemple.fr "Prénom" "Nom"`.

Si vous modifiez les gabarits, lancez `npm run watch:css` dans un second terminal pour
recompiler le CSS à la volée.

## Fonctionnalités

### Comptes et associations
- Inscription et connexion par e-mail et mot de passe, mot de passe oublié par e-mail, profil.
- **Annuaire** avec recherche et filtre par domaine. Chaque association a sa page et sa couleur.
- Chaque bénévole **demande à rejoindre** son association ; les responsables acceptent,
  nomment d'autres responsables et retirent des membres.
- Une nouvelle association est **validée par un modérateur** avant de pouvoir publier
  (désactivable avec `ASSOCIATIONS_REQUIRE_VALIDATION=false`).

### Calendrier partagé
- Vues **mois, semaine et liste**. Chaque événement a la couleur de son association ; un aperçu
  apparaît au survol.
- Filtres par association, par thème et « mes associations ».
- **Conflits de créneau** : dès la saisie de la date, la plateforme prévient qu'un autre
  événement a lieu au même moment. Les jours chargés sont marqués d'un point orange.
- Cliquer sur un jour du calendrier ouvre la création d'un événement à cette date.
- Visibilité **publique** (tout le monde) ou **réseau** (associations connectées seulement).
- **Abonnement iCal** : chaque utilisateur a un lien personnel pour Google Agenda, Outlook ou son
  téléphone, avec tous les événements ou seulement ceux de ses associations. Il existe aussi un
  flux public (`/evenements/ical/public.ics`) et un fichier `.ics` par événement.

### Coordination
- Les autres associations rejoignent un événement : co-organisation, stand, soutien, intérêt.
- Bénévoles recherchés, avec une jauge et une inscription en un clic ; les organisateurs voient
  les contacts. Les besoins en matériel sont affichés.
- Discussion entre associations sur chaque événement.

### Annonces
Recherche de bénévoles, prêt ou recherche de matériel, salles, partenariats, infos. On répond
au nom de son association et on marque une annonce comme résolue.

### Sécurité
Mots de passe hachés (scrypt), sessions stockées en base avec cookies `httpOnly`, protection
CSRF sur tous les formulaires, en-têtes de sécurité (Helmet, CSP), limitation des tentatives de
connexion, requêtes SQL paramétrées.

## Tests

```bash
npm test
```

## Mise en production

1. Copier `.env.example` en `.env` et le remplir, au minimum `SESSION_SECRET`, `BASE_URL` et le SMTP.
2. Lancer :
   ```bash
   npm install
   npm run create-admin -- vous@exemple.fr "Prénom" "Nom"
   node --env-file=.env server.js
   ```
3. Placer l'application derrière HTTPS (Nginx, Caddy, ou un hébergeur comme Render, Railway,
   Fly.io ou Alwaysdata) et garder le dossier `data/` sur un disque persistant. C'est la base
   SQLite : pensez à la sauvegarder.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `server.js` | Point d'entrée |
| `src/app.js` | Configuration d'Express (sécurité, sessions, rendu) |
| `src/routes/` | Pages : accueil, comptes, associations, événements, annonces, API JSON |
| `src/models/` | Toutes les requêtes SQL |
| `src/schema.sql` | Schéma de la base |
| `src/lib/` | Dates (fuseau de Paris), iCal, sécurité, permissions, e-mails |
| `views/` | Gabarits EJS (mise en page, composants, pages) |
| `styles/app.css` | Jetons de design et composants Tailwind (voir `docs/design.md`) |
| `docs/design.md` | Charte de design |
| `public/js/` | JavaScript navigateur : calendrier, alerte de conflit, menus |
| `scripts/` | Données de démo, création d'un modérateur |
| `test/` | Tests (`node:test` + supertest) |
