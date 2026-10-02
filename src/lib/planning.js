/**
 * Planning hebdomadaire façon « programme de festival » : une ligne par jour,
 * les heures en colonnes. Calcule la position de chaque événement (en %),
 * le répartit sur plusieurs voies quand il en chevauche un autre et repère
 * les plages où deux événements se recouvrent (conflits).
 */
const { parisDateKey, parisParts, addDays, parisMidnight, fmt } = require('./time');

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function buildPlanning(events, weekStart, { minHour = 8, maxHour = 22 } = {}) {
  const days = DAY_NAMES.map((name, i) => {
    const key = addDays(weekStart, i);
    return { key, name, number: Number(key.slice(8, 10)), start: parisMidnight(key), end: parisMidnight(addDays(key, 1)), items: [] };
  });

  // Découpe chaque événement par jour, en heures décimales (heure de Paris)
  for (const e of events) {
    for (const day of days) {
      if (e.start_at >= day.end || e.end_at <= day.start) continue;
      const from = e.start_at > day.start ? hourOf(e.start_at) : 0;
      const to = e.end_at < day.end ? hourOf(e.end_at) || 24 : 24;
      day.items.push({ event: e, from, to: Math.max(to, from + 0.5) });
    }
  }

  // Plage horaire affichée : 8 h – 22 h, élargie si besoin
  for (const day of days) {
    for (const it of day.items) {
      minHour = Math.min(minHour, Math.floor(it.from));
      maxHour = Math.max(maxHour, Math.ceil(it.to));
    }
  }
  const span = maxHour - minHour;
  const pct = (h) => ((Math.min(Math.max(h, minHour), maxHour) - minHour) / span) * 100;

  for (const day of days) {
    day.items.sort((a, b) => a.from - b.from || b.to - a.to);
    const lanes = [];
    for (const it of day.items) {
      let lane = lanes.findIndex((end) => end <= it.from);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = it.to;
      it.lane = lane;
      it.left = pct(it.from);
      it.width = Math.max(pct(it.to) - it.left, 2);
      it.label = fmt.hourRange(it.event.start_at, it.event.end_at);
    }
    day.lanes = Math.max(lanes.length, 1);

    // Plages de chevauchement entre deux événements distincts
    const zones = [];
    for (let i = 0; i < day.items.length; i += 1) {
      for (let j = i + 1; j < day.items.length; j += 1) {
        const a = day.items[i];
        const b = day.items[j];
        const from = Math.max(a.from, b.from);
        const to = Math.min(a.to, b.to);
        if (to > from) zones.push({ from, to });
      }
    }
    day.conflicts = mergeZones(zones).map((z) => ({ ...z, left: pct(z.from), width: pct(z.to) - pct(z.from), label: `${formatHour(z.from)}\u00a0– ${formatHour(z.to)}` }));
  }

  const hours = [];
  for (let h = minHour; h <= maxHour; h += 2) hours.push({ label: `${h}\u00a0h`, left: pct(h) });
  return { days, hours, minHour, maxHour, today: parisDateKey(), conflictCount: days.reduce((n, d) => n + d.conflicts.length, 0) };
}

function hourOf(iso) {
  const p = parisParts(new Date(iso));
  return p.hour + p.minute / 60;
}

function formatHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}\u00a0h\u00a0${String(mm).padStart(2, '0')}` : `${hh}\u00a0h`;
}

function mergeZones(zones) {
  const sorted = zones.sort((a, b) => a.from - b.from);
  const out = [];
  for (const z of sorted) {
    const last = out[out.length - 1];
    if (last && z.from <= last.to) last.to = Math.max(last.to, z.to);
    else out.push({ ...z });
  }
  return out;
}

module.exports = { buildPlanning };
