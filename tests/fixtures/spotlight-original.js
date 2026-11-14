  // ---------- TESTIMONIALS: HYBRID (MOBILE AUTO / DESKTOP SCROLL) ----------
  (() => {
    const section = document.getElementById('testimonialsScroll');
    const track   = document.getElementById('spotlightTrack');
    const dotsBox = document.getElementById('spotlightDots');
    if (!section || !track || !dotsBox) return;

    const cards = Array.from(track.querySelectorAll('.testi-card'));
    const N = cards.length;
    if (!N) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    cards.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'spotlight-dot';
      dot.setAttribute('aria-label', 'الاقتباس رقم ' + (i + 1));
      dot.addEventListener('click', () => onDotClick(i));
      dotsBox.appendChild(dot);
    });
    const dots = Array.from(dotsBox.children);
    const setActiveDot = i => dots.forEach((d, k) => d.classList.toggle('active', k === i));

    // =========== MOBILE ===========
    let mTimer = null, mIndex = 0, mPaused = false;

    function renderMobile(activeIdx){
      cards.forEach((card, i) => {
        let d = i - activeIdx;
        if (d >  N/2) d -= N;
        if (d < -N/2) d += N;

        const ad = Math.abs(d);
        const x       = -d * 200;
        const scale   = 1 - Math.min(ad, 2) * 0.12;
        const opacity = ad > 2 ? 0 : Math.max(0, 1 - ad * 0.4);
        const z       = Math.round(100 - ad * 20);

        card.style.transform =
          `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(2);
        card.style.zIndex  = z;
        card.style.filter  = 'none';
      });
      setActiveDot(((Math.round(activeIdx) % N) + N) % N);
    }

    function mNext(){ mIndex = (mIndex + 1) % N; renderMobile(mIndex); }
    function startAuto(){ stopAuto(); mTimer = setInterval(() => { if (!mPaused) mNext(); }, 4500); }
    function stopAuto(){ if (mTimer){ clearInterval(mTimer); mTimer = null; } }

    let touchStartX = 0;
    track.parentElement.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      mPaused = true;
    }, { passive: true });
    track.parentElement.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40){
        mIndex = (mIndex + (dx > 0 ? 1 : -1) + N) % N;
        renderMobile(mIndex);
      }
      mPaused = false;
    }, { passive: true });
    track.parentElement.addEventListener('touchcancel', () => {
      mPaused = false; // FIX: Ensures autoplay doesn't get stuck if browser interrupts touch
    }, { passive: true });

    // =========== DESKTOP ===========
    let dTicking = false, lastNearest = -1;
    const GAP = () => (window.innerWidth <= 1000 ? 260 : 290);

    function renderDesktop(){
      dTicking = false;
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      let progress = Math.max(0, Math.min(1, (-rect.top) / scrollable));
      const padded = Math.max(0, Math.min(1, (progress - 0.08) / 0.84));
      const activeFloat = padded * (N - 1);

      const nearest = Math.round(activeFloat);
      if (nearest !== lastNearest){ lastNearest = nearest; setActiveDot(nearest); }

      const gap = GAP();
      cards.forEach((card, i) => {
        const d = i - activeFloat;
        const ad = Math.abs(d);
        const x      = -d * gap;
        const scale  = 1 - Math.min(ad, 2) * 0.15;
        const opacity = ad > 2.5 ? 0 : Math.max(0, 1 - ad * 0.35);
        const blur   = Math.min(ad, 2) * 3;
        const rotY   = Math.max(-12, Math.min(12, -d * 6));
        const z      = Math.round(100 - ad * 20);

        card.style.transform =
          `translate(-50%, -50%) translateX(${x.toFixed(2)}px) ` +
          `scale(${scale.toFixed(3)}) rotateY(${rotY.toFixed(2)}deg)`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter  = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : 'none';
        card.style.zIndex  = z;
      });
    }

    function onDesktopScroll(){
      if (!dTicking){ requestAnimationFrame(renderDesktop); dTicking = true; }
    }

    function desktopGoTo(i){
      const rect = section.getBoundingClientRect();
      const sectionTop = window.scrollY + rect.top;
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      window.scrollTo({
        top: sectionTop + (0.08 + (i / (N - 1)) * 0.84) * scrollable,
        behavior: 'smooth'
      });
    }

    function onDotClick(i){
      if (isMobile()){
        mIndex = i;
        renderMobile(mIndex);
        mPaused = true;
        setTimeout(() => mPaused = false, 3000);
      } else {
        desktopGoTo(i);
      }
    }

    // =========== SWITCH MODE ===========
    const mq = window.matchMedia('(max-width: 720px)');
    const isMobile = () => mq.matches;
    let mode = null;

    function cleanupDesktop(){
      window.removeEventListener('scroll', onDesktopScroll);
      cards.forEach(c => {
        c.style.transform = ''; c.style.opacity = '';
        c.style.filter = '';    c.style.zIndex = '';
      });
    }
    function cleanupMobile(){
      stopAuto();
      cards.forEach(c => {
        c.style.transform = ''; c.style.opacity = ''; c.style.zIndex = '';
      });
    }

    function applyMode(){
      const m = isMobile() ? 'mobile' : 'desktop';
      if (m === mode) return;
      if (mode === 'desktop') cleanupDesktop();
      if (mode === 'mobile')  cleanupMobile();
      mode = m;

      if (m === 'mobile'){
        mIndex = 0;
        renderMobile(0);
        startAuto();
      } else {
        window.addEventListener('scroll', onDesktopScroll, { passive: true });
        renderDesktop();
      }
    }

    mq.addEventListener('change', applyMode);
    window.addEventListener('resize', () => { if (mode === 'desktop') renderDesktop(); });
    applyMode();
  })();
