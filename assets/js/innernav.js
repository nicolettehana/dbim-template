/* Inner banner navigation: shows the arrows only when the links overflow,
   moves the list left and right, and starts with the current page in view. */
(function () {
  document.querySelectorAll('.innernav').forEach(function (box) {
    var list = box.querySelector('.nav');
    var prev = box.querySelector('.nav-arrow-prev');
    var next = box.querySelector('.nav-arrow-next');
    if (!list || !prev || !next) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function update() {
      var max = list.scrollWidth - list.clientWidth;
      var overflows = max > 1;
      prev.hidden = !overflows;
      next.hidden = !overflows;
      prev.disabled = list.scrollLeft <= 1;
      next.disabled = list.scrollLeft >= max - 1;
    }

    function move(direction) {
      list.scrollBy({
        left: direction * list.clientWidth * 0.8,
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    }

    prev.addEventListener('click', function () { move(-1); });
    next.addEventListener('click', function () { move(1); });
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('load', update);      // fonts can change the widths

    // Start with the current page centred
    var current = list.querySelector('.nav-link.active, .nav-link[aria-current="page"]');
    var item = current && current.closest('.nav-item');
    if (item) list.scrollLeft = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;

    update();
  });
})();
