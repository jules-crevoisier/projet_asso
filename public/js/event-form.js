// Formulaire d'événement : fin automatique et alerte de conflit en direct
(() => {
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const pad = (n) => String(n).padStart(2, '0');
  const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-event-form]');
    if (!form) return;
    const start = form.querySelector('[data-start]');
    const end = form.querySelector('[data-end]');
    const box = document.getElementById('live-conflicts');
    let timer;

    start.addEventListener('change', () => {
      if (!start.value) return;
      if (!end.value || end.value <= start.value) {
        const d = new Date(start.value);
        d.setHours(d.getHours() + 2);
        end.value = toInput(d);
      }
    });

    const check = async () => {
      if (!start.value || !end.value || end.value <= start.value) { box.classList.add('hidden'); return; }
      const qs = new URLSearchParams({ start: start.value, end: end.value, exclude: form.dataset.exclude || '' });
      try {
        const res = await fetch(`/api/conflits?${qs}`, { headers: { Accept: 'application/json' } });
        const conflicts = await res.json();
        if (!conflicts.length) {
          box.className = 'flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/15';
          box.innerHTML = '✓ Aucun autre événement sur ce créneau.';
          return;
        }
        box.className = 'rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20';
        box.innerHTML = `<p class="font-semibold">⚠ ${conflicts.length} autre${conflicts.length > 1 ? 's' : ''} événement${conflicts.length > 1 ? 's' : ''} sur ce créneau</p>
          <ul class="mt-1.5 space-y-1">${conflicts.map((c) => `
            <li class="flex items-center gap-2"><span class="size-2 shrink-0 rounded-full" style="background:${escapeHtml(c.color)}"></span>
            <span><a class="font-medium underline decoration-amber-300 underline-offset-2" target="_blank" href="/evenements/${c.id}">${escapeHtml(c.title)}</a> — ${escapeHtml(c.association)}, ${escapeHtml(fmt.format(new Date(c.start)))}, ${escapeHtml(c.location)}</span></li>`).join('')}
          </ul>`;
      } catch {
        box.classList.add('hidden');
      }
    };

    [start, end].forEach((input) => input.addEventListener('change', () => {
      clearTimeout(timer);
      timer = setTimeout(check, 200);
    }));
    if (start.value && end.value && !form.querySelector('input[name=confirm]')) check();
  });
})();
