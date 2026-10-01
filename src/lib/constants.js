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
  info: { label: 'Information', tone: 'slate', icon: 'Info' },
  volunteers: { label: 'Recherche de bénévoles', tone: 'amber', icon: 'HandHeart' },
  lend: { label: 'Prêt / don de matériel', tone: 'emerald', icon: 'PackageOpen' },
  borrow: { label: 'Recherche de matériel', tone: 'orange', icon: 'PackageSearch' },
  partnership: { label: 'Appel à partenariat', tone: 'indigo', icon: 'Handshake' },
  space: { label: 'Salle / local', tone: 'sky', icon: 'DoorOpen' },
  other: { label: 'Autre', tone: 'slate', icon: 'MessageSquare' },
};

// Couleurs proposées pour identifier chaque association dans le calendrier
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
];

module.exports = { CATEGORIES, PARTICIPATION_KINDS, POST_KINDS, COLORS };
