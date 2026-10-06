/* Persona slider: swipe works natively; this adds the arrows and dots.
   Arrows loop round (last to first and first to last). */
(function () {
  document.querySelectorAll('.persona').forEach(function (root) {
    var track = root.querySelector('.persona-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.persona-slide'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('.persona-dots button'));
    var prev = root.querySelector('.persona-prev');
    var next = root.querySelector('.persona-next');
    if (!track || !slides.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var current = 0;

    function setActive(i) {
      dots.forEach(function (dot, k) {
        if (k === i) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }

    function goTo(i) {
      current = (i + slides.length) % slides.length;
      track.scrollTo({ left: current * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      setActive(current);
    }

    // Keep the dots in step when the user swipes
    track.addEventListener('scroll', function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== current && i >= 0 && i < slides.length) {
        current = i;
        setActive(i);
      }
    }, { passive: true });

    if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
    if (next) next.addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot, k) { dot.addEventListener('click', function () { goTo(k); }); });

    window.addEventListener('resize', function () {
      track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' });
    });

    setActive(0);
  });
})();
