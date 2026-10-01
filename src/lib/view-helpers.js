const lucide = require('lucide-static');
const { fmt, toParisInput } = require('./time');
const { CATEGORIES, POST_KINDS, PARTICIPATION_KINDS, COLORS } = require('./constants');

const iconCache = new Map();

/** Icône Lucide en SVG inline : icon('Calendar', 'size-4'). */
function icon(name, cls = 'size-4') {
  const key = `${name}|${cls}`;
  if (!iconCache.has(key)) {
    const svg = lucide[name];
    if (!svg) throw new Error(`Icône inconnue : ${name}`);
    iconCache.set(key, svg
      .replace(/class="[^"]*"/, `class="${cls} shrink-0" aria-hidden="true"`)
      .replace(/\s(width|height)="24"/g, '')
      .replace(/\n\s*/g, ' '));
  }
  return iconCache.get(key);
}

function initials(first = '', last = '') {
  if (!last && first.includes(' ')) [first, last] = first.split(' ');
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?';
}

const fullName = (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim();

/** Couleur de texte lisible (noir/blanc) sur un fond donné. */
function contrast(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#0f172a' : '#ffffff';
}

const plural = (n, word, pluralWord = `${word}s`) => `${n} ${n > 1 ? pluralWord : word}`;

function query(current, changes) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) {
    if (v !== undefined && v !== null && v !== '' && v !== false) params.set(k, v);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

module.exports = {
  icon, initials, fullName, contrast, plural, query, fmt, toParisInput,
  CATEGORIES, POST_KINDS, PARTICIPATION_KINDS, COLORS,
};
