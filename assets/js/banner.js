/* Banner slider: swiping works natively; this adds the arrows, dots,
   auto-advance and the pause / play button. */
(function () {
  var DELAY = 6000;   // milliseconds each banner stays: keep it above 5 seconds

  document.querySelectorAll('.hero').forEach(function (root) {
    var track = root.querySelector('.hero-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.hero-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.hero-dots button'));
    var prev = root.querySelector('.hero-prev');
    var next = root.querySelector('.hero-next');
    var toggle = root.querySelector('.hero-toggle');
    if (!track || slides.length < 2) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var current = 0;
    var playing = !reduceMotion.matches;       // starts paused for people who prefer less motion
    var held = false;                          // pointer or keyboard focus is on the banner
    var timer = null;
    var scrollLock = false;
    var lockTimer = null;

    function setActive(i) {
      dots.forEach(function (dot, k) {
        if (k === i) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      slides.forEach(function (slide, k) {      // keep hidden banners out of the tab order
        if (k === i) slide.removeAttribute('inert');
        else slide.setAttribute('inert', '');
      });
    }

    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(function () {
        if (held || document.hidden) schedule();
        else goTo(current + 1);
      }, DELAY);
    }

    function goTo(i) {
      var target = (i + slides.length) % slides.length;
      var instant = reduceMotion.matches || Math.abs(target - current) > 1;
      current = target;
      scrollLock = true;                        // ignore scroll events caused by this move
      clearTimeout(lockTimer);
      lockTimer = setTimeout(function () { scrollLock = false; }, 700);
      track.scrollTo({ left: current * track.clientWidth, behavior: instant ? 'auto' : 'smooth' });
      setActive(current);
      schedule();
    }

    function setPlaying(value) {
      playing = value;
      root.classList.toggle('is-paused', !playing);
      if (toggle) {
        var label = playing ? 'Pause banner slideshow' : 'Play banner slideshow';
        toggle.setAttribute('aria-label', label);
        toggle.setAttribute('title', label);
      }
      track.setAttribute('aria-live', playing ? 'off' : 'polite');
      schedule();
    }

    // Keep the dots in step when the visitor swipes
    track.addEventListener('scroll', function () {
      if (scrollLock) return;
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== current && i >= 0 && i < slides.length) {
        current = i;
        setActive(i);
        schedule();
      }
    }, { passive: true });

    if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
    if (next) next.addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot, k) { dot.addEventListener('click', function () { goTo(k); }); });
    if (toggle) toggle.addEventListener('click', function () { setPlaying(!playing); });

    // Hold the slideshow while the pointer or keyboard focus is on the banners themselves
    track.addEventListener('mouseenter', function () { held = true; });
    track.addEventListener('mouseleave', function () { held = false; });
    track.addEventListener('focusin', function () { held = true; });
    track.addEventListener('focusout', function () { held = false; });

    window.addEventListener('resize', function () {
      track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' });
    });

    setActive(0);
    setPlaying(playing);
  });
})();
