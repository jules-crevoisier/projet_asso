// Interactions communes (sans framework)
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  document.addEventListener('DOMContentLoaded', () => {
    // Menu mobile
    const menuToggle = $('[data-menu-toggle]');
    const mobileMenu = $('#menu-mobile');
    const setMenu = (open) => {
      if (!menuToggle) return;
      mobileMenu.classList.toggle('hidden', !open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.textContent = open ? 'Fermer' : 'Menu';
    };
    menuToggle?.addEventListener('click', () => setMenu(mobileMenu.classList.contains('hidden')));

    // Menus déroulants
    const closeMenus = (except) => $$('[data-dropdown]').forEach((dd) => {
      const menu = $('[data-dropdown-menu]', dd);
      if (menu === except) return;
      menu.classList.add('hidden');
      $('[data-dropdown-toggle]', dd).setAttribute('aria-expanded', 'false');
    });
    $$('[data-dropdown]').forEach((dd) => {
      const menu = $('[data-dropdown-menu]', dd);
      const toggle = $('[data-dropdown-toggle]', dd);
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenus(menu);
        const open = menu.classList.toggle('hidden') === false;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) menu.querySelector('a, button')?.focus();
      });
      menu.addEventListener('click', (e) => e.stopPropagation());
    });
    document.addEventListener('click', () => closeMenus());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openToggle = $$('[data-dropdown-toggle][aria-expanded="true"]')[0];
      closeMenus();
      setMenu(false);
      openToggle?.focus();
    });

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
      if (!target) return;
      const open = target.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
      if (open) target.querySelector('input:not([type=hidden]), textarea, select')?.focus();
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

    // Messages : fermés par la personne, jamais automatiquement (WCAG 2.2.1)
    $$('[data-flash] [data-dismiss]').forEach((b) => b.addEventListener('click', () => b.closest('[data-flash]').remove()));
  });
})();
