const CATEGORIES = {
  sport: 'Sport',
  culture: 'Culture & arts',
  social: 'Social & solidarité',
  environnement: 'Environnement',
  education: 'Éducation & jeunesse',
  sante: 'Santé',
  loisirs: 'Loisirs',
  quartier: 'Vie de quartier',
  autre: 'Autre',
};

const PARTICIPATION_KINDS = {
  coorg: 'Co-organise',
  participant: 'Participe / tient un stand',
  support: 'Apporte du soutien',
  interested: 'Intéressée',
};

const POST_KINDS = {
  volunteers: 'Recherche de bénévoles',
  lend: 'Prêt ou don de matériel',
  borrow: 'Recherche de matériel',
  space: 'Salle ou local',
  partnership: 'Appel à partenariat',
  info: 'Information',
  other: 'Autre',
};

// Couleurs des associations : teintes terreuses, toutes lisibles avec du texte blanc (≥ 4,5:1).
// Voir docs/design.md.
const COLORS = [
  '#b4532a', // brique
  '#94691c', // ocre
  '#557548', // sauge
  '#2f6b4f', // forêt
  '#2b6f77', // canard
  '#4a6a8c', // ardoise
  '#34478a', // outremer
  '#7a4a7a', // prune
  '#a8445e', // framboise
  '#7b5b3e', // terre
  '#66682c', // olive
  '#5f5f5a', // gris
];

// Anciennes couleurs (première version) → nouvelles, pour migrer les bases existantes
const LEGACY_COLORS = {
  '#6366f1': '#34478a', '#8b5cf6': '#7a4a7a', '#ec4899': '#a8445e', '#ef4444': '#b4532a',
  '#f97316': '#b4532a', '#f59e0b': '#94691c', '#84cc16': '#66682c', '#10b981': '#2f6b4f',
  '#14b8a6': '#2b6f77', '#06b6d4': '#2b6f77', '#3b82f6': '#4a6a8c', '#64748b': '#5f5f5a',
};

module.exports = { CATEGORIES, PARTICIPATION_KINDS, POST_KINDS, COLORS, LEGACY_COLORS };
