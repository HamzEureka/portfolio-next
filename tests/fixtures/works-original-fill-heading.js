  // ---------- PORTFOLIO FILL HEADING ----------
  const fillHeading = document.getElementById('portfolioFillHeading');
  if (fillHeading && !reduceMotion) {
    const fillSpan = fillHeading.querySelector('.sfh-fill');
    let ticking = false;

    function updateFill(){
      const rect = fillHeading.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.9;
      const end = vh * 0.25;
      let progress = (start - rect.top) / (start - end);
      progress = Math.max(0, Math.min(1, progress));
      const inset = 100 - progress * 100;
      fillSpan.style.clipPath = `inset(0 ${inset}% 0 0)`;
      ticking = false;
    }

    function onScroll(){
      if (!ticking) {
        requestAnimationFrame(updateFill);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateFill();
  }
