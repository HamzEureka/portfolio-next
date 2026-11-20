/* enhancements.js — add-on layer for the portfolio (no changes to existing code needed).
   Adds: hero background media, scroll progress, light/dark theme, and a Canvas-2D
   explosion that replaces the Three.js one (so Three.js can be removed).

   Usage: <script src="js/enhancements.js"
                  data-poster="assets/hero-poster.jpg"
                  data-video="assets/hero-loop.mp4"></script>   (last thing before </body>) */
(function () {
  'use strict';
  var SCRIPT = document.currentScript;
  var $ = function (s) { return document.querySelector(s); };
  function h(t, a) { var e = document.createElement(t); for (var k in (a || {})) e.setAttribute(k, a[k]); return e; }

  /* ---------- theme (applied immediately to avoid a flash) ---------- */
  var KEY = 'portfolio-theme';
  function store(v) { try { if (v) localStorage.setItem(KEY, v); else return localStorage.getItem(KEY); } catch (e) {} }
  document.documentElement.dataset.theme = store() || 'dark';

  /* ---------- Canvas-2D explosion (overrides the Three.js version) ---------- */
  function sprite(stops) {
    var s = document.createElement('canvas'); s.width = s.height = 64;
    var g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (st) { gr.addColorStop(st[0], st[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
  }
  function explode2D(cover) {
    var cv = cover.querySelector('.explosion-3d'); if (!cv) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), r = cover.getBoundingClientRect();
    var W = r.width || innerWidth, H = r.height || innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var fire = sprite([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,205,90,1)'], [.6, 'rgba(255,100,20,.8)'], [1, 'rgba(255,60,0,0)']]);
    var smoke = sprite([[0, 'rgba(150,145,158,.9)'], [.5, 'rgba(95,90,102,.5)'], [1, 'rgba(60,56,66,0)']]);
    var cx = W / 2, cy = H / 2, i, P = [], S = [];
    for (i = 0; i < 200; i++) { var a = Math.random() * 6.283, sp = 2 + Math.random() * 9;
      P.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .8, r: 10 + Math.random() * 22, max: 600 + Math.random() * 500 }); }
    for (i = 0; i < 36; i++) S.push({ x: cx + (Math.random() - .5) * 160, y: cy + (Math.random() - .3) * 80,
      vx: (Math.random() - .5) * 1.2, vy: -.4 - Math.random() * 1.1, r: 50 + Math.random() * 60, delay: Math.random() * 250 });
    cv.classList.add('active');
    var t0 = performance.now(), DUR = 2100;
    (function frame(now) {
      var t = now - t0; ctx.clearRect(0, 0, W, H);
      var k = Math.min(1, t / 700);                       // shockwave ring
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = (1 - k) * .8;
      ctx.lineWidth = 1 + 6 * (1 - k); ctx.strokeStyle = '#ffd9a0';
      ctx.beginPath(); ctx.arc(cx, cy, k * Math.min(W, H) * .45, 0, 6.283); ctx.stroke();
      S.forEach(function (s) {                            // smoke
        if (t < s.delay) return; var q = (t - s.delay) / (DUR - s.delay); if (q > 1) return;
        s.x += s.vx; s.y += s.vy; var rr = s.r * (1 + q * 1.6);
        ctx.globalAlpha = Math.min(1, q * 4) * (1 - q) * .85; ctx.drawImage(smoke, s.x - rr, s.y - rr, rr * 2, rr * 2);
      });
      ctx.globalCompositeOperation = 'lighter';           // fire
      P.forEach(function (p) {
        if (t > p.max) return; var q = t / p.max;
        p.vx *= .95; p.vy *= .95; p.vy += .06; p.x += p.vx; p.y += p.vy;
        var rr = p.r * (1 - q * .6); ctx.globalAlpha = 1 - q; ctx.drawImage(fire, p.x - rr, p.y - rr, rr * 2, rr * 2);
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (t < DUR) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, W, H); cv.classList.remove('active'); }
    })(t0);
    return true;
  }
  window.run3DExplosion = explode2D;   // the page's runExplosion() calls this by name

  /* ---------- hero background media ---------- */
  function heroMedia() {
    var hero = $('.hero'); if (!hero) return;
    var poster = SCRIPT.dataset.poster || 'assets/hero-poster.jpg';
    var video = SCRIPT.dataset.video || 'assets/hero-loop.mp4';
    var wrap = h('div', { class: 'hero-bg-media', 'aria-hidden': 'true' });
    var img = h('img', { class: 'hero-bg-poster', alt: '', src: poster, decoding: 'async' });
    wrap.append(img); hero.prepend(wrap);
    img.addEventListener('load', function () { wrap.classList.add('on'); });
    img.addEventListener('error', function () { wrap.remove(); });

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var small = matchMedia('(max-width: 720px)').matches;
    var c = navigator.connection || {};
    var slow = c.saveData || /(^|-)2g$/.test(c.effectiveType || '');
    if (reduce) return;
    if (small || slow) { wrap.classList.add('kb'); return; }     // poster + slow zoom only

    var v = h('video', { class: 'hero-bg-video', loop: '', playsinline: '', preload: 'none', poster: poster });
    v.muted = true;
    var src = h('source', { src: video, type: 'video/mp4' }); v.append(src); wrap.append(v);
    v.addEventListener('canplay', function () { v.classList.add('ready'); });
    v.addEventListener('error', function () { v.remove(); wrap.classList.add('kb'); }, true);
    v.play().catch(function () { wrap.classList.add('kb'); });
    if ('IntersectionObserver' in window)                          // pause when off-screen
      new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) v.play().catch(function () {}); else v.pause(); });
      }).observe(hero);
  }

  /* ---------- scroll progress ---------- */
  function progress() {
    var bar = h('div', { id: 'scrollProgress', 'aria-hidden': 'true' }); document.body.append(bar);
    var tick = false;
    function upd() {
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')'; tick = false;
    }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd); upd();
  }

  /* ---------- theme toggle ---------- */
  function themeToggle() {
    var links = $('#navLinks'); if (!links) return;
    var b = h('button', { type: 'button', class: 'theme-btn', 'aria-label': 'تبديل الوضع الليلي والنهاري' });
    b.innerHTML = '<svg class="moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    b.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.classList.add('theme-anim');
      document.documentElement.dataset.theme = next; store(next);
      setTimeout(function () { document.documentElement.classList.remove('theme-anim'); }, 450);
    });
    links.append(b);
  }

  /* ---------- boot: wait for the stylesheet, then build ---------- */
  function start() { heroMedia(); progress(); themeToggle(); }
  var link = h('link', { rel: 'stylesheet', href: SCRIPT.src.replace(/js\/[^\/]*$/, 'css/enhancements.css') });
  var done = false; function go() { if (!done) { done = true; start(); } }
  link.addEventListener('load', go); link.addEventListener('error', go);
  document.head.append(link);
})();
