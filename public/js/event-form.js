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
          box.className = 'notice notice-success';
          box.innerHTML = '<p>Aucun autre événement sur ce créneau.</p>';
          return;
        }
        box.className = 'notice notice-warn flex-col gap-1';
        box.innerHTML = `<p class="font-bold">${conflicts.length} autre${conflicts.length > 1 ? 's' : ''} événement${conflicts.length > 1 ? 's' : ''} sur ce créneau</p>
          <ul class="space-y-1">${conflicts.map((c) => `
            <li><span class="swatch mr-1.5" style="background:${escapeHtml(c.color)}"></span><a class="link-quiet font-semibold" target="_blank" href="/evenements/${c.id}">${escapeHtml(c.title)}</a>, ${escapeHtml(c.association)}, <span class="tnum">${escapeHtml(fmt.format(new Date(c.start)))}</span>, ${escapeHtml(c.location)}</li>`).join('')}
          </ul>
          <p class="text-[15px]">Vous pourrez quand même publier si vos publics ne se recoupent pas.</p>`;
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
