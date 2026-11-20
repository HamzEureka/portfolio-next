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
