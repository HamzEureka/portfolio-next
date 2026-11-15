  // ---------- CATEGORY DETONATION ----------
  let audioCtx = null;
  function getAudioCtx(){
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTick(freq){
    try{
      const ctx = getAudioCtx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.16);
    } catch(e){}
  }

  function playBoom(){
    try{
      const ctx = getAudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++){
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.6);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      noise.connect(filter).connect(noiseGain).connect(ctx.destination);
      noise.start();

      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.5);
      og.gain.setValueAtTime(0.9, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(og).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch(e){}
  }

  function spawnParticles(container){
    const box = container.querySelector('.explosion-particles');
    if (!box) return;
    box.innerHTML = '';
    const colors = ['#ff8a00', '#ff3d00', '#ffd54a', '#ff5e3a'];
    const count = 34;
    for (let i = 0; i < count; i++){
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
      const dist = 90 + Math.random() * 220;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      p.style.setProperty('--px', px + 'px');
      p.style.setProperty('--py', py + 'px');
      p.style.setProperty('--psize', (5 + Math.random() * 10) + 'px');
      p.style.setProperty('--pdur', (0.6 + Math.random() * 0.5) + 's');
      p.style.setProperty('--pcolor', colors[i % colors.length]);
      box.appendChild(p);
    }
    setTimeout(() => { box.innerHTML = ''; }, 1300);
  }

  function spawnSmoke(container){
    const box = container.querySelector('.explosion-particles');
    if (!box) return;
    const count = 16;
    for (let i = 0; i < count; i++){
      const s = document.createElement('div');
      s.className = 'smoke-puff';
      const offsetX = (Math.random() * 340 - 170);
      const offsetY = (Math.random() * 160 - 80);
      s.style.left = 'calc(50% + ' + offsetX + 'px)';
      s.style.bottom = 'calc(42% + ' + offsetY + 'px)';
      s.style.setProperty('--ssize', (160 + Math.random() * 220) + 'px');
      s.style.animationDelay = (Math.random() * 0.35) + 's';
      s.style.animationDuration = (1.6 + Math.random() * 0.8) + 's';
      box.appendChild(s);
    }
    setTimeout(() => { box.innerHTML = ''; }, 2600);
  }

  function detonateCategory(cover){
    if (cover.dataset.done) return;
    cover.dataset.done = '1';

    const cta = cover.querySelector('.cat-cover-cta');
    const bomb = cover.querySelector('.cat-bomb');
    const countdownEl = cover.querySelector('.cat-countdown');
    if (cta) cta.style.opacity = '0';
    if (bomb) bomb.style.opacity = '0';

    let n = 3;
    const tickFreqs = { 3: 660, 2: 740, 1: 830 };

    function tickStep(){
      countdownEl.textContent = String(n);
      countdownEl.classList.add('show');
      countdownEl.classList.remove('pulse');
      void countdownEl.offsetWidth;
      countdownEl.classList.add('pulse');
      playTick(tickFreqs[n] || 660);

      if (n > 1){
        n--;
        setTimeout(tickStep, 700);
      } else {
        setTimeout(() => {
          countdownEl.classList.remove('show');
          runExplosion(cover);
        }, 650);
      }
    }
    tickStep();
  }

  // ---------- EXPLOSION (Canvas 2D, no libraries) ----------
  function runCanvasExplosion(cover){
    const canvas = cover.querySelector('.explosion-3d');
    if (!canvas) return false;

    const rect = cover.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width  = rect.width  + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = rect.width / 2, cy = rect.height / 2;

    const particles = [];
    const N = 160;
    for (let i = 0; i < N; i++){
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 11;
      const isSmoke = Math.random() < 0.3;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: isSmoke ? 4 + Math.random() * 6 : 1.5 + Math.random() * 3,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        gravity: isSmoke ? -0.02 : 0.09,
        color: isSmoke
          ? 'rgba(120,115,130,0.55)'
          : `hsl(${15 + Math.random() * 35}, 100%, ${55 + Math.random() * 25}%)`
      });
    }

    canvas.classList.add('active');
    const start = performance.now();
    const DURATION = 1400;
    let rafId, lastT = start;

    function frame(now){
      const t = now - start;
      const dt = Math.min(32, now - lastT) / 16;
      lastT = now;

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles){
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.955; p.vy *= 0.955;
        p.vy += p.gravity * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (t < DURATION && !document.hidden){
        rafId = requestAnimationFrame(frame);
      } else {
        canvas.classList.remove('active');
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    }
    rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden){ cancelAnimationFrame(rafId); canvas.classList.remove('active'); }
    }, { once: true });
    return true;
  }

  function runExplosion(cover){
    playBoom();
    const flash = cover.querySelector('.explosion-flash');
    if (flash){
      flash.classList.remove('active');
      void flash.offsetWidth;
      flash.classList.add('active');
    }
    cover.classList.add('shake');

    const used3D = (window.run3DExplosion || runCanvasExplosion)(cover);
    if (!used3D){
      spawnParticles(cover);
      spawnBlackoutSmoke(cover);
      setTimeout(() => spawnSmoke(cover), 150);
    }
    setTimeout(() => { cover.classList.remove('shake'); }, 500);

    setTimeout(() => {
      cover.style.display = 'none';
      const cat = cover.dataset.cat;
      const projList = document.querySelector('.category-projects[data-cat="' + cat + '"]');
      if (projList){
        projList.style.display = '';
        projList.querySelectorAll('.stack-card').forEach((card, i) => {
          card.classList.remove('fly-in');
          void card.offsetWidth;
          card.style.animationDelay = (i * 0.08) + 's';
          card.classList.add('fly-in');
        });
      }
    }, 2200);
  }

  function spawnBlackoutSmoke(container){
    const box = container.querySelector('.explosion-particles');
    if (!box) return;
    const blackout = document.createElement('div');
    blackout.className = 'smoke-blackout';
    box.appendChild(blackout);
    setTimeout(() => blackout.remove(), 2000);
  }

  function resetCategory(cover){
    const cat = cover.dataset.cat;
    const projList = document.querySelector('.category-projects[data-cat="' + cat + '"]');
    if (projList) projList.style.display = 'none';
    cover.style.display = '';
    cover.dataset.done = '';
    const cta = cover.querySelector('.cat-cover-cta'); if (cta) cta.style.opacity = '';
    const bomb = cover.querySelector('.cat-bomb'); if (bomb) bomb.style.opacity = '';
    const countdownEl = cover.querySelector('.cat-countdown');
    if (countdownEl){ countdownEl.classList.remove('show', 'pulse'); }
  }

  document.querySelectorAll('.category-cover').forEach(cover => {
    cover.addEventListener('click', () => detonateCategory(cover));
  });

  const catSectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const cover = entry.target.querySelector('.category-cover');
      if (!cover || !cover.dataset.done) return;
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0){
        resetCategory(cover);
      }
    });
  }, { threshold: 0 });
  document.querySelectorAll('.category-section').forEach(sec => catSectionObserver.observe(sec));
