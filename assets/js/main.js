/* ============================================================
   Think Through Technology — shared behaviour
   Theme toggle, navbar, mobile menu, footer year,
   scroll reveals and the sideways work strip.
   Nothing here blocks scrolling: listeners are passive and
   the only animated properties are opacity and transform.
   ============================================================ */

(function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Day / night ---------- */
  var KEY = 'ttt-theme';
  var root = document.documentElement;
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  root.setAttribute('data-theme', saved || 'light');

  function paintToggles() {
    var light = root.getAttribute('data-theme') !== 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.innerHTML = light ? MOON : SUN;
      btn.setAttribute('aria-label', light ? 'Switch to night mode' : 'Switch to day mode');
    });
  }
  paintToggles();
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paintToggles();
    });
  });

  /* ---------- Navbar: border after scrolling, tuck away on the way down ---------- */
  var navEl = document.getElementById('siteNav');
  if (navEl) {
    var lastY = window.scrollY, ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        navEl.classList.toggle('scrolled', y > 20);
        navEl.classList.toggle('hide-nav', y > lastY && y > 260);
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  var burger = document.querySelector('.burger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      burger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  /* ---------- Reveal on scroll (each element once, then we stop watching it) ---------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('in');
          io.unobserve(en.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ---------- Work strip arrows (the strip itself is plain native scrolling) ---------- */
  var strip = document.getElementById('workStrip');
  if (strip) {
    document.querySelectorAll('[data-strip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = strip.querySelector('.work');
        var step = card ? card.getBoundingClientRect().width + 22 : 360;
        strip.scrollBy({ left: step * (btn.dataset.strip === 'next' ? 1 : -1), behavior: 'smooth' });
      });
    });
  }
})();
