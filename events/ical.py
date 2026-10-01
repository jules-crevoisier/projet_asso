"""Génération minimale de fichiers iCalendar (RFC 5545), sans dépendance externe."""

from datetime import timezone as dt_timezone

from django.utils import timezone


def _escape(text):
    return (
        (text or "")
        .replace("\\", "\\\\")
        .replace(";", "\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line):
    """Coupe les lignes à 75 octets comme l'exige la norme."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, current = [], b""
    for char in line:
        encoded = char.encode("utf-8")
        limit = 75 if not parts else 74
        if len(current) + len(encoded) > limit:
            parts.append(current.decode("utf-8"))
            current = b""
        current += encoded
    parts.append(current.decode("utf-8"))
    return "\r\n ".join(parts)


def _dt(value):
    return value.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_calendar(events, request, name):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Assos Troyes//Calendrier partage//FR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(name)}",
        "X-WR-TIMEZONE:Europe/Paris",
    ]
    now = _dt(timezone.now())
    host = request.get_host().split(":")[0]
    for event in events:
        url = request.build_absolute_uri(event.get_absolute_url())
        description = f"Organisé par {event.association}\n\n{event.description}\n\n{url}"
        lines += [
            "BEGIN:VEVENT",
            f"UID:event-{event.pk}@{host}",
            f"DTSTAMP:{now}",
            f"LAST-MODIFIED:{_dt(event.updated_at)}",
            f"DTSTART:{_dt(event.start)}",
            f"DTEND:{_dt(event.end)}",
            f"SUMMARY:{_escape(event.title)}",
            f"LOCATION:{_escape(event.location)}",
            f"DESCRIPTION:{_escape(description)}",
            f"ORGANIZER;CN={_escape(event.association.name)}:mailto:{event.association.email or 'noreply@' + host}",
            f"URL:{url}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
