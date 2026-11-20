  // ---------- CURSOR / TOUCH FOLLOWER ----------
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');

  if (cursorDot && cursorRing && !reduceMotion) {
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let dotX = mouseX, dotY = mouseY;
    let ringX = mouseX, ringY = mouseY;
    let active = false;
    let hideTimer = null;

    function showFollower(){
      ensureCursorLoop();
      clearTimeout(hideTimer);
      if (!active){
        active = true;
        cursorDot.style.opacity = '1';
        cursorRing.style.opacity = '0.55';
      }
    }

    function scheduleHide(){
      hideTimer = setTimeout(() => {
        cursorDot.style.opacity = '0';
        cursorRing.style.opacity = '0';
        active = false;
      }, 500);
    }

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX; mouseY = e.clientY;
      showFollower();
    });

    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t) return;
      mouseX = t.clientX; mouseY = t.clientY;
      showFollower();
      spawnTapRipple(mouseX, mouseY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (!t) return;
      mouseX = t.clientX; mouseY = t.clientY;
      showFollower();
    }, { passive: true });

    window.addEventListener('touchend', scheduleHide, { passive: true });
    window.addEventListener('touchcancel', scheduleHide, { passive: true });

    let cursorRafId = null;
    function animateCursor(){
      const dotClose  = Math.abs(mouseX - dotX)  < 0.1 && Math.abs(mouseY - dotY)  < 0.1;
      const ringClose = Math.abs(mouseX - ringX) < 0.1 && Math.abs(mouseY - ringY) < 0.1;
      if (!dotClose || !ringClose){
        dotX += (mouseX - dotX) * 0.14;
        dotY += (mouseY - dotY) * 0.35;
        ringX += (mouseX - ringX) * 0.07;
        ringY += (mouseY - ringY) * 0.12;
        cursorDot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%,-50%)`;
        cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
        cursorRafId = requestAnimationFrame(animateCursor);
      } else {
        cursorRafId = null;
      }
    }
    function ensureCursorLoop(){
      if (cursorRafId === null) cursorRafId = requestAnimationFrame(animateCursor);
    }
    ensureCursorLoop();

    document.querySelectorAll('a, button, input, textarea, select, video').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursorRing.style.width = '48px';
        cursorRing.style.height = '48px';
        cursorRing.style.opacity = '0.85';
      });
      el.addEventListener('mouseleave', () => {
        cursorRing.style.width = '34px';
        cursorRing.style.height = '34px';
        cursorRing.style.opacity = '0.55';
      });
    });

    function spawnTapRipple(x, y){
      const ripple = document.createElement('div');
      ripple.className = 'tap-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      document.body.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    }
  }
