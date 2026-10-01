// Interactions communes (sans framework)
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  document.addEventListener('DOMContentLoaded', () => {
    // Barre latérale mobile
    const sidebar = $('[data-sidebar]');
    const backdrop = $('[data-sidebar-backdrop]');
    const setSidebar = (open) => {
      if (!sidebar) return;
      sidebar.classList.toggle('-translate-x-full', !open);
      backdrop.classList.toggle('hidden', !open);
      document.body.classList.toggle('overflow-hidden', open);
    };
    $$('[data-sidebar-open]').forEach((b) => b.addEventListener('click', () => setSidebar(true)));
    $$('[data-sidebar-close]').forEach((b) => b.addEventListener('click', () => setSidebar(false)));
    backdrop?.addEventListener('click', () => setSidebar(false));

    // Menus déroulants
    const closeMenus = (except) => $$('[data-dropdown-menu]').forEach((m) => { if (m !== except) m.classList.add('hidden'); });
    $$('[data-dropdown]').forEach((dd) => {
      const menu = $('[data-dropdown-menu]', dd);
      $('[data-dropdown-toggle]', dd).addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenus(menu);
        menu.classList.toggle('hidden');
      });
    });
    document.addEventListener('click', () => closeMenus());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); setSidebar(false); } });

    // Confirmation avant les actions destructrices
    $$('form[data-confirm]').forEach((form) => form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    }));

    // Filtres qui se soumettent tout seuls
    $$('form[data-autosubmit]').forEach((form) => {
      let timer;
      form.addEventListener('change', (e) => { if (e.target.type !== 'search') form.requestSubmit(); });
      form.addEventListener('input', (e) => {
        if (e.target.type !== 'search') return;
        clearTimeout(timer);
        timer = setTimeout(() => form.requestSubmit(), 450);
      });
    });

    // Afficher / masquer un bloc
    $$('[data-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const target = $(btn.dataset.toggle);
      target?.classList.toggle('hidden');
      target?.querySelector('input:not([type=hidden]), textarea, select')?.focus();
    }));

    // Copier dans le presse-papiers
    $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
      const input = $(btn.dataset.copy);
      const label = btn.querySelector('span');
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        input.select();
        document.execCommand('copy');
      }
      if (label) { const old = label.textContent; label.textContent = 'Copié !'; setTimeout(() => { label.textContent = old; }, 1600); }
    }));
    $$('[data-select-on-focus]').forEach((i) => i.addEventListener('focus', () => i.select()));

    // Messages flash
    $$('[data-flash] [data-dismiss]').forEach((b) => b.addEventListener('click', () => b.closest('[data-flash]').remove()));
    $$('[data-flash]').forEach((f) => setTimeout(() => {
      f.style.transition = 'opacity .4s'; f.style.opacity = '0';
      setTimeout(() => f.remove(), 400);
    }, 7000));
  });
})();
