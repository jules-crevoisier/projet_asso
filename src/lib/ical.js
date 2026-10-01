/** Génération de fichiers iCalendar (RFC 5545), sans dépendance externe. */

const escape = (text) => String(text || '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function fold(line) {
  if (Buffer.byteLength(line) <= 75) return line;
  const parts = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length ? 74 : 75;
    if (Buffer.byteLength(current + char) > limit) { parts.push(current); current = ''; }
    current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function buildCalendar(events, { name, baseUrl, host }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Assos Troyes//Calendrier partage//FR',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escape(name)}`, 'X-WR-TIMEZONE:Europe/Paris',
  ];
  const now = stamp(new Date());
  for (const e of events) {
    const url = `${baseUrl}/evenements/${e.id}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:event-${e.id}@${host}`,
      `DTSTAMP:${now}`,
      `LAST-MODIFIED:${stamp(e.updated_at)}`,
      `DTSTART:${stamp(e.start_at)}`,
      `DTEND:${stamp(e.end_at)}`,
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape(e.location)}`,
      `DESCRIPTION:${escape(`Organisé par ${e.association_name}\n\n${e.description}\n\n${url}`)}`,
      `URL:${url}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

module.exports = { buildCalendar, fold };
