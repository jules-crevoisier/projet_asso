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

    // Les jours avec plusieurs événements affichent leur nombre (c'est là que naissent les conflits)
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
        const top = cell.querySelector('.fc-daygrid-day-top');
        top?.querySelector('.day-count')?.remove();
        if (canCreate) cell.classList.add('can-create');
        if (n > 1 && top) top.insertAdjacentHTML('beforeend', `<span class="day-count">${n} év.</span>`);
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
        title.textContent = info.view.title.replace(/^./, (c) => c.toUpperCase());
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
        return { html: `<div class="truncate"><span class="tabular-nums opacity-75">${escapeHtml(arg.timeText)}</span> <span class="font-semibold">${escapeHtml(arg.event.title)}</span></div>` };
      },
      eventDidMount: (arg) => {
        if (!arg.view.type.startsWith('list')) return;
        const p = arg.event.extendedProps;
        const titleCell = arg.el.querySelector('.fc-list-event-title');
        if (titleCell) titleCell.insertAdjacentHTML('beforeend', `<div class="mt-0.5 text-[14px] text-ink-2">${escapeHtml(p.association)} · ${escapeHtml(p.location)}${p.visibility === 'network' ? ' · réservé aux associations' : ''}</div>`);
      },
      eventMouseEnter: (arg) => {
        if (arg.view.type.startsWith('list') || !tooltip) return;
        const e = arg.event;
        const p = e.extendedProps;
        const time = `${timeFmt.format(e.start)}${e.end ? ` – ${timeFmt.format(e.end)}` : ''}`;
        const when = `${dayFmt.format(e.start).replace(/^./, (c) => c.toUpperCase())} · ${time}`;
        const rows = [
          ['Lieu', p.location],
          p.partners ? ['Partenaires', `${p.partners} association${p.partners > 1 ? 's' : ''}`] : null,
          p.volunteersNeeded ? ['Bénévoles', `${p.volunteersNeeded} recherché${p.volunteersNeeded > 1 ? 's' : ''}`] : null,
          p.visibility === 'network' ? ['Visibilité', 'Réservé aux associations'] : null,
        ].filter(Boolean);
        tooltip.innerHTML = `
          <p class="flex items-center gap-2 text-[13px] font-bold text-ink-2"><span class="inline-block size-2.5 rounded-[2px]" style="background:${escapeHtml(p.color)}"></span>${escapeHtml(p.association)}</p>
          <p class="mt-1 text-[17px] font-bold leading-snug text-ink">${escapeHtml(e.title)}</p>
          <p class="tnum mt-1 text-[15px] text-ink-2">${escapeHtml(when)}</p>
          <dl class="mt-2 space-y-0.5 text-[14px]">${rows.map(([k, v]) => `<div class="flex gap-2"><dt class="w-20 shrink-0 text-ink-3">${escapeHtml(k)}</dt><dd class="text-ink">${escapeHtml(v)}</dd></div>`).join('')}</dl>`;
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
