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

// Couleurs des associations : teintes claires de même intensité, toujours avec du texte noir
// (contraste ≥ 9:1), lisibles en mode clair comme en mode sombre. Voir docs/design.md.
const COLORS = [
  '#8fd6cf', // menthe
  '#c9b3f0', // lilas
  '#9cc9f5', // ciel
  '#f2afc1', // rose
  '#a9d99a', // vert
  '#e8d77a', // moutarde
  '#f5c3a0', // pêche
  '#b7c4f2', // pervenche
  '#cfe38a', // anis
  '#e3b7e8', // orchidée
  '#d9c7a7', // sable
  '#bcc7cf', // ardoise
];

// Couleurs des versions précédentes → nouvelles, pour migrer les bases existantes
const LEGACY_COLORS = {
  '#6366f1': '#b7c4f2', '#8b5cf6': '#c9b3f0', '#ec4899': '#f2afc1', '#ef4444': '#f5c3a0',
  '#f97316': '#f5c3a0', '#f59e0b': '#e8d77a', '#84cc16': '#cfe38a', '#10b981': '#8fd6cf',
  '#14b8a6': '#8fd6cf', '#06b6d4': '#9cc9f5', '#3b82f6': '#9cc9f5', '#64748b': '#bcc7cf',
  '#b4532a': '#f5c3a0', '#94691c': '#e8d77a', '#557548': '#a9d99a', '#2f6b4f': '#8fd6cf',
  '#2b6f77': '#9cc9f5', '#4a6a8c': '#bcc7cf', '#34478a': '#b7c4f2', '#7a4a7a': '#c9b3f0',
  '#a8445e': '#f2afc1', '#7b5b3e': '#d9c7a7', '#66682c': '#cfe38a', '#5f5f5a': '#bcc7cf',
};

module.exports = { CATEGORIES, PARTICIPATION_KINDS, POST_KINDS, COLORS, LEGACY_COLORS };
