/* Back to top button. Adds the button to the page itself, so every page only needs
   this script and back-to-top.css.
   It appears the moment the page header has scrolled out of view. */
(function () {
  var FALLBACK = 300;   // pixels: used when the page has no header that scrolls away with the page

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.setAttribute('title', 'Back to top');
  document.body.appendChild(button);

  var header = document.querySelector('.site-header') || document.querySelector('header');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var waiting = false;

  // A header that stays stuck to the top is always in view, so it cannot be the trigger
  function isStuck(element) {
    while (element && element !== document.body) {
      var position = window.getComputedStyle(element).position;
      if (position === 'sticky' || position === 'fixed') return true;
      element = element.parentElement;
    }
    return false;
  }

  // How far down the page the bottom of the header is
  function showAfter() {
    if (!header || isStuck(header)) return FALLBACK;
    return Math.max(header.getBoundingClientRect().bottom + window.pageYOffset, 1);
  }

  function update() {
    waiting = false;
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var pastHeader = scrollable > 0 && window.pageYOffset > showAfter();
    button.classList.toggle('is-visible', pastHeader);
  }

  function onScroll() {
    if (!waiting) {
      waiting = true;
      window.requestAnimationFrame(update);
    }
  }

  button.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    // Keep keyboard users at the top of the page: the button hides itself once they arrive
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    document.body.addEventListener('blur', function () {
      document.body.removeAttribute('tabindex');
    }, { once: true });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  update();
})();
