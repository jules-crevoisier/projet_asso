// Calendrier partagé (FullCalendar)
(() => {
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('calendar');
    if (!el || !window.FullCalendar) return;
    const filters = document.querySelector('[data-cal-filters]');
    const title = document.querySelector('[data-cal-title]');
    const tooltip = document.getElementById('cal-tooltip');
    const viewButtons = [...document.querySelectorAll('[data-cal-views] [data-view]')];
    const canCreate = el.dataset.canCreate === '1';
    const mobile = window.matchMedia('(max-width: 640px)').matches;

    const params = () => {
      const data = Object.fromEntries(new FormData(filters));
      Object.keys(data).forEach((k) => { if (!data[k]) delete data[k]; });
      return data;
    };

    const markBusyDays = (events) => {
      const counts = {};
      events.forEach((ev) => {
        const start = new Date(ev.start);
        const end = new Date((ev.end || ev.start).getTime() - 1);
        for (const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
          counts[dateKey(d)] = (counts[dateKey(d)] || 0) + 1;
        }
      });
      el.querySelectorAll('.fc-daygrid-day[data-date]').forEach((cell) => {
        const n = counts[cell.dataset.date] || 0;
        cell.classList.toggle('busy-day', n > 1);
        cell.title = n > 1 ? `${n} événements ce jour-là` : '';
      });
    };

    const setActiveView = (type) => viewButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === type));

    const calendar = new FullCalendar.Calendar(el, {
      locale: 'fr',
      initialView: mobile ? 'listMonth' : 'dayGridMonth',
      initialDate: el.dataset.initialDate || undefined,
      headerToolbar: false,
      height: 'auto',
      firstDay: 1,
      fixedWeekCount: false,
      dayMaxEvents: 3,
      nowIndicator: true,
      navLinks: false,
      eventDisplay: 'block',
      displayEventEnd: false,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', meridiem: false },
      slotMinTime: '07:00:00',
      slotMaxTime: '24:00:00',
      scrollTime: '09:00:00',
      allDaySlot: false,
      noEventsContent: 'Aucun événement sur cette période',
      events: { url: '/api/evenements', extraParams: params },
      loading: (isLoading) => el.classList.toggle('opacity-60', isLoading),
      datesSet: (info) => {
        title.textContent = info.view.title;
        setActiveView(info.view.type);
      },
      eventsSet: markBusyDays,
      dateClick: (info) => {
        if (!canCreate) return;
        const d = dateKey(info.date);
        window.location.href = `/evenements/nouveau?date=${d}`;
      },
      eventContent: (arg) => {
        if (arg.view.type.startsWith('list')) return true;
        const p = arg.event.extendedProps;
        const lock = p.visibility === 'network' ? '🔒 ' : '';
        return { html: `<div class="truncate"><span class="opacity-80 tabular-nums">${escapeHtml(arg.timeText)}</span> <span class="font-semibold">${lock}${escapeHtml(arg.event.title)}</span></div>` };
      },
      eventDidMount: (arg) => {
        if (!arg.view.type.startsWith('list')) return;
        const p = arg.event.extendedProps;
        const titleCell = arg.el.querySelector('.fc-list-event-title');
        if (titleCell) titleCell.insertAdjacentHTML('beforeend', `<div class="mt-0.5 text-xs text-slate-500">${escapeHtml(p.association)} · ${escapeHtml(p.location)}</div>`);
      },
      eventMouseEnter: (arg) => {
        if (arg.view.type.startsWith('list') || !tooltip) return;
        const e = arg.event;
        const p = e.extendedProps;
        const time = `${timeFmt.format(e.start)}${e.end ? ` – ${timeFmt.format(e.end)}` : ''}`;
        tooltip.innerHTML = `
          <div class="flex items-center gap-2 text-xs text-slate-300"><span class="size-2 rounded-full" style="background:${escapeHtml(e.backgroundColor)}"></span>${escapeHtml(p.association)}</div>
          <div class="mt-1 font-semibold leading-snug">${escapeHtml(e.title)}</div>
          <div class="mt-2 space-y-0.5 text-xs text-slate-300">
            <div class="first-letter:uppercase">${escapeHtml(dayFmt.format(e.start))} · ${escapeHtml(time)}</div>
            <div>📍 ${escapeHtml(p.location)}</div>
            ${p.partners ? `<div>🤝 ${p.partners} association(s) partenaire(s)</div>` : ''}
            ${p.volunteersNeeded ? `<div>🙋 Cherche ${p.volunteersNeeded} bénévole(s)</div>` : ''}
            ${p.visibility === 'network' ? '<div>🔒 Réservé au réseau</div>' : ''}
          </div>`;
        tooltip.classList.remove('hidden');
        const r = arg.el.getBoundingClientRect();
        const left = Math.min(window.innerWidth - tooltip.offsetWidth - 12, Math.max(12, r.left));
        const top = r.bottom + 8 + tooltip.offsetHeight > window.innerHeight ? r.top - tooltip.offsetHeight - 8 : r.bottom + 8;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      },
      eventMouseLeave: () => tooltip?.classList.add('hidden'),
    });
    calendar.render();

    document.querySelector('[data-cal="prev"]').addEventListener('click', () => calendar.prev());
    document.querySelector('[data-cal="next"]').addEventListener('click', () => calendar.next());
    document.querySelector('[data-cal="today"]').addEventListener('click', () => calendar.today());
    viewButtons.forEach((b) => b.addEventListener('click', () => calendar.changeView(b.dataset.view)));

    filters.addEventListener('change', () => {
      const qs = new URLSearchParams(params()).toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
      calendar.refetchEvents();
    });
    filters.addEventListener('submit', (e) => e.preventDefault());
  });
})();
