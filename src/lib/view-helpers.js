const lucide = require('lucide-static');
const { fmt, toParisInput, parisDateKey } = require('./time');
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
      .replace('stroke-width="2"', 'stroke-width="1.75"')
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

/** Teinte claire d'une couleur (mélange avec le blanc papier), pour les fonds d'événements. */
function tint(hex, amount = 0.84) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const paper = [255, 253, 248];
  return `#${rgb.map((c, i) => Math.round(c * (1 - amount) + paper[i] * amount).toString(16).padStart(2, '0')).join('')}`;
}

/** Regroupe des événements par jour (heure de Paris) : [{ key, date, events }]. */
function groupByDay(events) {
  const groups = new Map();
  for (const e of events) {
    const key = parisDateKey(e.start_at);
    if (!groups.has(key)) groups.set(key, { key, date: e.start_at, events: [] });
    groups.get(key).events.push(e);
  }
  return [...groups.values()];
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
  icon, initials, fullName, contrast, tint, groupByDay, plural, query, fmt, toParisInput, parisDateKey,
  CATEGORIES, POST_KINDS, PARTICIPATION_KINDS, COLORS,
};
