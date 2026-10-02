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

## Déploiement sur Dokploy

L'application est livrée avec un `Dockerfile` optimisé et un `docker-compose.yml`.
L'image fait environ **57 Mo compressés** : Alpine nue avec le binaire Node, sans npm ni outils
de compilation, utilisateur non-root, système de fichiers compatible lecture seule. La base
SQLite est le seul état : elle vit dans le volume `/data`.

### Option 1 : Application (recommandée)

1. Dans Dokploy : **Create Service → Application**, source GitHub
   `jules-crevoisier/projet_asso`, branche à déployer.
2. **Build Type : Dockerfile** (chemin `Dockerfile`, contexte `.`).
3. **Environment** : au minimum
   ```
   SESSION_SECRET=<openssl rand -hex 32>
   BASE_URL=https://votre-domaine.fr
   ADMIN_EMAIL=vous@exemple.fr
   ADMIN_PASSWORD=un-mot-de-passe-solide
   ```
   Ajoutez le SMTP pour les e-mails de mot de passe oublié (voir `.env.example`).
4. **Advanced → Volumes** : un volume (ou un dossier de l'hôte) monté sur **`/data`**.
   Sans lui, la base est perdue à chaque redéploiement.
5. **Domains** : votre domaine, **port 3000**, HTTPS activé (Let's Encrypt).
6. **Deploy**. Le compte modérateur `ADMIN_EMAIL` est créé au premier démarrage.

### Option 2 : Docker Compose

Créez un service **Compose** pointant sur le dépôt (fichier `docker-compose.yml`), renseignez les
mêmes variables dans **Environment**, puis ajoutez le domaine dans **Domains** (service `app`,
port 3000). Le volume `assos-data` est déclaré dans le fichier.

### Bon à savoir

- **Santé** : `GET /healthz` répond `{"status":"ok"}`. L'image déclare un `HEALTHCHECK`, et Dokploy
  l'utilise pour les déploiements sans coupure.
- **Arrêt propre** : à chaque redéploiement, le serveur termine les requêtes en cours et ferme la base.
- **Tester sans domaine** (http://IP:port) : ajoutez `COOKIE_SECURE=false`, sinon la connexion
  échoue (les cookies sécurisés exigent HTTPS). Retirez cette variable une fois le domaine en place.
- **Sauvegardes** : `docker exec <conteneur> node scripts/backup.js` écrit une copie à chaud dans
  `/data/backups` et garde les 14 dernières. À planifier dans Dokploy (**Schedules**) ou via cron.
- **Créer un autre modérateur** : `docker exec -it <conteneur> node scripts/create-admin.js email@exemple.fr`.
- **En local** : `SESSION_SECRET=test docker compose up --build`, puis ouvrez le port publié par un
  fichier `docker-compose.override.yml` (par exemple `ports: ["3000:3000"]`).

### Sans Docker

```bash
npm ci
npm run build:css
npm prune --omit=dev
node --env-file=.env server.js
```

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
| `scripts/` | Données de démo, création d'un modérateur, sauvegarde |
| `Dockerfile`, `docker-compose.yml` | Image de production et déploiement Dokploy |
| `test/` | Tests (`node:test` + supertest) |
