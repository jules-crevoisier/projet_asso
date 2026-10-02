// Toutes les dates sont stockées en UTC (ISO 8601) et affichées à l'heure de Paris,
// quel que soit le fuseau du serveur.
const TZ = 'Europe/Paris';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function parisParts(date) {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

function offsetAt(ms) {
  const p = parisParts(new Date(ms));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-10T14:00" (heure de Paris) → Date (UTC). Renvoie null si invalide. */
function parseParisInput(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = naive - offsetAt(naive);
  utc = naive - offsetAt(utc);
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n) => String(n).padStart(2, '0');

/** Date/ISO → "2026-10-10T14:00" (heure de Paris), pour les champs datetime-local. */
function toParisInput(value) {
  if (!value) return '';
  const p = parisParts(new Date(value));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Date du jour à Paris au format AAAA-MM-JJ. */
function parisDateKey(value = new Date()) {
  const p = parisParts(new Date(value));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const fmtCache = new Map();
function format(value, options) {
  const key = JSON.stringify(options);
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...options }));
  return fmtCache.get(key).format(new Date(value));
}

const fmt = {
  day: (v) => format(v, { day: 'numeric' }),
  monthShort: (v) => format(v, { month: 'short' }).replace('.', ''),
  time: (v) => format(v, { hour: '2-digit', minute: '2-digit' }),
  /** Heure à la française : « 15 h », « 15 h 30 ». */
  hour: (v) => {
    const p = parisParts(new Date(v));
    return p.minute ? `${p.hour}\u00a0h\u00a0${String(p.minute).padStart(2, '0')}` : `${p.hour}\u00a0h`;
  },
  date: (v) => format(v, { weekday: 'long', day: 'numeric', month: 'long' }),
  weekdayShort: (v) => format(v, { weekday: 'short' }).replace('.', ''),
  dayHeading: (v) => {
    const s = format(v, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  monthYear: (v) => format(v, { month: 'long', year: 'numeric' }),
  dateYear: (v) => format(v, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  short: (v) => format(v, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  full: (v) => format(v, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
  sameDay: (a, b) => parisDateKey(a) === parisDateKey(b),
  range(start, end) {
    if (fmt.sameDay(start, end)) return `${fmt.dateYear(start)}, ${fmt.hour(start)} – ${fmt.hour(end)}`;
    return `${fmt.date(start)}, ${fmt.hour(start)} → ${fmt.date(end)}, ${fmt.hour(end)}`;
  },
  hourRange: (start, end) => `${fmt.hour(start)}\u00a0– ${fmt.hour(end)}`,
  ago(value) {
    const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
    if (s < 60) return 'à l’instant';
    if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
    if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), 'day');
    return format(value, { day: 'numeric', month: 'long', year: 'numeric' });
  },
};

/** Lundi (AAAA-MM-JJ) de la semaine contenant le jour donné. */
function weekStartKey(dateKey = parisDateKey()) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Décale un jour AAAA-MM-JJ de n jours. */
function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Minuit (heure de Paris) du jour donné, en ISO UTC. */
const parisMidnight = (dateKey) => parseParisInput(`${dateKey}T00:00`).toISOString();

/** Numéro de semaine ISO 8601. */
function isoWeek(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

module.exports = {
  TZ, parseParisInput, toParisInput, parisDateKey, parisParts, fmt, weekStartKey, addDays, parisMidnight, isoWeek,
};
