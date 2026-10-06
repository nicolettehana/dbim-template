/* Arrow buttons for the logo carousel. Swiping works without this script. */
(function () {
  document.querySelectorAll('.logo-carousel').forEach(function (root) {
    var track = root.querySelector('.lc-track');
    var prev = root.querySelector('.lc-prev');
    var next = root.querySelector('.lc-next');
    if (!track || !prev || !next) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function pageWidth() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return track.clientWidth + gap;       // one "page" of tiles
    }

    function update() {
      var max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= max - 1;
    }

    function go(direction) {
      track.scrollBy({
        left: direction * pageWidth(),
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
