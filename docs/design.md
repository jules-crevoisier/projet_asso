# Charte de design

Ce document fixe les règles visuelles de la plateforme. Chaque choix a une raison ;
si une modification va contre une règle, changez d'abord la règle ici.

## Intention

La plateforme est **l'agenda commun des associations de Troyes**. Le modèle n'est pas une
startup SaaS mais le programme imprimé qu'on trouve dans une mairie ou une maison des
associations : du papier, de l'encre, une typographie soignée, une information dense et
facile à parcourir. Le contenu (les dates, les associations) est la vedette, pas la décoration.

Les utilisateurs sont des bénévoles de tous âges, souvent sur téléphone, souvent pressés.
La lisibilité passe avant l'effet.

## Ce qu'on s'interdit

Ces motifs signalent une interface générée sans décision humaine ([1], [2]) :

- dégradés violet/bleu, texte en dégradé, halos flous en arrière-plan ;
- emoji utilisés comme icônes ou ponctuation ;
- icônes posées dans des pastilles colorées au-dessus de chaque carte ;
- rangées de 3 ou 4 cartes identiques, sections toutes de la même hauteur, tout centré ;
- grands arrondis partout, ombre + bordure + fond teinté sur la même carte ;
- couleur de marque répétée sur de nombreuses surfaces ;
- accroches creuses (« enfin », « boostez », « tout-en-un ») et chiffres inventés ;
- actions importantes visibles seulement au survol.

## Typographie

| Usage | Police | Pourquoi |
|---|---|---|
| Titres | **Newsreader** (serif éditoriale, axe optique) | Ton « journal local », hiérarchie par la taille plutôt que par la graisse |
| Texte et interface | **Atkinson Hyperlegible Next** | Dessinée par le Braille Institute pour distinguer chaque caractère : adaptée aux publics âgés ou malvoyants |

- Texte courant en **16 px**, interligne 1,5 ; jamais moins de 13 px. 15–25 px est la plage
  recommandée à l'écran, avec un interligne de 120–145 % [3].
- Longueur de ligne des textes longs limitée à **65 caractères** (`max-w-prose`) ; la plage
  lisible est de 45–90 caractères [3].
- Échelle modulaire de ratio 1,25 : 13 · 14 · 16 · 20 · 25 · 32 · 40 px.
- Titres serif en graisse 500–600 avec un approche légèrement négatif ; le texte courant reste
  en 400, le gras est réservé à l'emphase.
- Chiffres tabulaires pour les heures et les dates (alignement dans l'agenda).

## Couleur

Le gris est construit en premier ; la couleur arrive en dernier et porte un sens [4].

| Jeton | Valeur | Usage |
|---|---|---|
| `paper` | `#F5F2EA` | Fond de page (papier chaud) |
| `surface` | `#FFFDF8` | Panneaux, champs |
| `ink` | `#1F1D1A` | Texte principal, bouton principal (15:1 sur papier) |
| `ink-2` | `#5C574E` | Texte secondaire (6,4:1) |
| `ink-3` | `#736D62` | Métadonnées (4,6:1) |
| `line` / `line-strong` | `#E2DCCF` / `#CFC6B5` | Filets et bordures |
| `accent` | `#A13D1B` | Rouge brique (pans de bois troyens) : liens, aujourd'hui, alertes de conflit. Rien d'autre (5,9:1) |

- Tous les textes respectent au minimum le ratio **4,5:1** du WCAG 2.2 AA [5].
- Chaque association a une couleur tirée d'une palette de 12 teintes terreuses, toutes au
  moins à 4,5:1 avec du texte blanc. Dans le calendrier, l'événement est affiché en **teinte
  claire + filet de couleur + texte encre** (13:1), plus lisible qu'un bloc saturé.
- Le bouton principal est **encre**, pas coloré : la couleur reste disponible pour
  l'information.

## Formes et profondeur

- Une seule stratégie de profondeur : les **filets**. Pas d'ombre sur les panneaux ; une ombre
  légère uniquement sur ce qui flotte (menus, info-bulles).
- Arrondis sémantiques : 4 px (étiquettes), 6 px (boutons, champs), 8 px (panneaux).
- Espacements sur une échelle de 4 : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. Les éléments liés
  sont proches, les groupes sont séparés par plus d'air que leurs éléments [4].

## Mise en page

- En-tête unique et horizontal pour tout le monde (connecté ou non) : les gens retrouvent la
  convention qu'ils connaissent ailleurs (loi de Jakob) [6].
- Alignement à gauche, colonnes asymétriques (contenu 2/3, contexte 1/3).
- Les listes d'événements sont présentées **comme un agenda imprimé** : groupées par jour,
  heure dans une colonne fixe. Les journées chargées se voient d'un coup d'œil, ce qui est
  le cœur du service (éviter les conflits).
- L'annuaire est une liste alphabétique, pas une grille de cartes.

## Interaction et accessibilité

- Cibles tactiles de **44 px** minimum (boutons, champs, liens de navigation) ; plus une cible
  est grande et proche, plus elle est rapide à atteindre (loi de Fitts) [6].
- Focus clavier toujours visible : contour de 2 px, décalé de 2 px, contraste ≥ 3:1 [5].
- Peu de choix à la fois (loi de Hick) : une action principale par écran, le reste en
  secondaire ou dans le menu « Publier » [6].
- Formulaires sur une colonne, libellé au-dessus du champ, aide sous le libellé, erreur
  explicite sous le champ, bouton d'envoi aligné à gauche avec les champs [7].
- Champs en 16 px (évite le zoom automatique sur iPhone).
- Animations limitées aux changements d'état, coupées si `prefers-reduced-motion`.
- Chaque liste a un état vide rédigé, qui dit quoi faire ensuite.

## Rédaction

- Phrases concrètes qui décrivent ce que fait la plateforme : « Publiez vos dates, voyez si
  le créneau est pris ».
- Vouvoiement, verbes d'action sur les boutons (« Publier l'événement », pas « Valider »).
- Pas d'emoji dans l'interface.

## Sources

1. [How to detect AI slop in your design](https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design)
2. [The visible tells of AI design — Impeccable](https://www.impeccable.style/slop)
3. [Butterick's Practical Typography — Summary of key rules](https://practicaltypography.com/summary-of-key-rules.html)
4. Adam Wathan & Steve Schoger, *Refactoring UI* (hiérarchie par la taille, la graisse et la couleur ; gris d'abord ; échelles contraintes)
5. [W3C — What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
6. [Laws of UX : Jakob, Fitts, Hick](https://uxplanet.org/the-7-most-important-laws-of-ux-design-in-2024-9b665845de4a)
7. [GOV.UK — Government Design Principles](https://www.gov.uk/guidance/government-design-principles) et guide de conception des formulaires
