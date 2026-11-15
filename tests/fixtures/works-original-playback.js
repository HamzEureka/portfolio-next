  // ---------- STACK VIDEO PLAYBACK: ONLY THE FOCUSED CARD PLAYS ----------
  (() => {
    const stackCards = Array.from(document.querySelectorAll('.stack-card'));
    if (!stackCards.length) return;

    const STICKY_TOP = 96;
    let ticking = false;
    let lastFocused = -1;

    function getFocusedIndex(){
      for (let i = stackCards.length - 1; i >= 0; i--){
        const rect = stackCards[i].getBoundingClientRect();
        if (rect.top <= STICKY_TOP + 2 && rect.bottom > STICKY_TOP + 40){
          return i;
        }
      }
      return -1;
    }

    function update(){
      ticking = false;
      const focused = getFocusedIndex();
      if (focused === lastFocused) return;
      lastFocused = focused;

      stackCards.forEach((card, i) => {
        const video = card.querySelector('video');
        if (!video) return;
        if (i === focused){
          video.muted = true;
          video.play().catch(() => {});
        } else if (!video.paused){
          video.pause();
        }
      });
    }

    function onScroll(){
      if (!ticking){
        requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    setTimeout(update, 100);

    // شبكة أمان: لا صوتان معاً لو شغّل المستخدم يدوياً
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      video.addEventListener('play', () => {
        allVideos.forEach(v => { if (v !== video && !v.paused) v.pause(); });
      });
    });
  })();
