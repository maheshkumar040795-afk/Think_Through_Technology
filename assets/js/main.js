/* ============================================================
   Think Through Technology — Shared Site Behaviour
   Theme toggle, navbar scroll/hide, mobile menu, footer year
   ============================================================ */

document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

/* ---------- Theme (Day / Night mode) ---------- */
(function initTheme(){
  const KEY = 'ttt-theme';
  const saved = localStorage.getItem(KEY);
  const preferred = saved || 'dark';
  document.documentElement.setAttribute('data-theme', preferred);

  function updateToggleIcons(theme){
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = theme === 'light'
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to night mode' : 'Switch to day mode');
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    updateToggleIcons(document.documentElement.getAttribute('data-theme'));
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(KEY, next);
        updateToggleIcons(next);
      });
    });
  });
})();

/* ---------- Navbar show/hide on scroll ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const navEl = document.getElementById('siteNav');
  if (!navEl) return;
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    navEl.classList.toggle('scrolled', y > 40);
    if (y > lastY && y > 200) navEl.classList.add('hide-nav');
    else navEl.classList.remove('hide-nav');
    lastY = y;
  });

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector('.burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
    }));
  }
});
