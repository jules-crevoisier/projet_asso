# Charte de design

Direction retenue après trois essais (voir l'historique) : **le planning de festival**.
La maquette de référence est l'artboard « B2 — Planning, clair » du canevas Design du projet.
Si une modification va contre une règle, changez d'abord la règle ici.

## Intention

La plateforme sert à voir qui fait quoi, quand, à Troyes. La vue centrale est donc un
**planning** : une ligne par jour, les heures en colonnes, un bloc de couleur par événement.
Comme sur le programme d'un festival, on voit d'un coup d'œil les créneaux libres et les
chevauchements. Le reste de l'interface s'efface : texte noir, filets, une seule couleur de
signal.

## Ce qu'on s'interdit

- Dégradés, halos, texte en dégradé, néon sur fond noir.
- Emoji, icônes dans des pastilles, grilles de tuiles avec une tuile « + » en pointillés.
- Petites étiquettes en capitales espacées ou en police machine au-dessus des titres.
- Une partie du titre en couleur.
- Menus en pilule, grands arrondis, ombres sur les cartes, bordure colorée à gauche des encadrés.
- Chiffres décoratifs (« 3 associations, 12 événements ») qui n'aident à rien faire.
- Polices vues partout dans les interfaces générées : Inter, Geist, Roboto, Space Grotesk, Fraunces.

## Typographie

- Une seule famille : **Schibsted Grotesk**, une grotesque dessinée pour la presse. La hiérarchie vient
  de la taille et de la graisse, jamais de la couleur.
- Titres en gras avec un approche serré (−0,04 em) : 92 px pour l'accueil, 52 px pour les pages,
  22 px pour les sections.
- Texte courant en 16–17 px, interligne 1,5–1,6, lignes de 65 caractères maximum.
- Heures à la française, avec des espaces insécables : « 15 h », « 10 h – 18 h ».
- Chiffres tabulaires uniquement là où ils doivent s'aligner (classe `tnum`). Appliqués à tout le
  texte, ils élargissent aussi les points et les virgules.

## Couleur

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `paper` | `#FFFFFF` | `#151513` | Fond |
| `ink` | `#111111` | `#F3F2EE` | Texte, bouton principal, filets de section |
| `ink-2` | `#5F5E5A` | `#A7A49C` | Texte secondaire (6,5:1 / 7,3:1) |
| `line` | `#E3E2DE` | `#33322E` | Filets fins |
| `signal` | `#FF5A1F` | `#FF6A32` | **Uniquement les conflits** : étiquette « Conflit », zone surlignée du planning |
| `accent` | `#B83C0A` | `#FF8A5B` | Version texte du signal (5,7:1 / 7,9:1) |

- Le mode sombre suit automatiquement le réglage de l'appareil (`prefers-color-scheme`).
- Les associations ont 12 teintes claires de même intensité. Le texte posé dessus est toujours
  noir, avec un contraste d'au moins 10:1, en mode clair comme en sombre.
- Le signal orange n'est jamais posé sous du texte blanc : sur l'orange, le texte est noir (6:1).

## Formes

- Coins presque droits : 3 px pour les blocs et les étiquettes, 4 px pour les boutons et les champs.
- Les sections commencent par un **filet noir de 2 px** au-dessus du titre. Ce filet structure
  la page à la place des cartes.
- Pas d'ombre, sauf sur ce qui flotte (menus, info-bulles).

## Le planning

- Une ligne par jour : numéro en gras (inversé pour aujourd'hui), nom du jour, et le cas échéant
  l'étiquette « Conflit » avec la plage horaire.
- Les heures de 8 h à 22 h ; la plage s'élargit si un événement commence plus tôt ou finit plus tard.
- Deux événements qui se chevauchent passent sur deux voies. La plage commune est surlignée en
  orange et bordée de deux traits.
- Un événement réservé aux associations est hachuré.
- Sur téléphone, le planning devient une liste par jour, plus lisible qu'une frise trop étroite.

## Interaction et accessibilité

- Cibles de 44 px minimum. Focus clavier visible (contour orange de 2 px).
- Formulaires sur une colonne, libellé au-dessus du champ, erreur explicite, bouton d'envoi à gauche.
- Messages fermés par la personne, jamais automatiquement.
- Animations coupées si `prefers-reduced-motion`.

## Rédaction

- Phrases concrètes qui disent ce que fait la plateforme. Verbes d'action sur les boutons
  (« Publier une date »). Vouvoiement. Pas d'emoji.
