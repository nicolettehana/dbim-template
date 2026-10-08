/* Accessibility controls.
   Load this in the <head> (no defer) so a visitor's saved settings apply before the page paints.
   Settings are saved in this browser only (localStorage). Nothing is sent anywhere. */
(function () {
  var STORAGE_KEY = 'a11y-settings';
  var SIZES = [87.5, 100, 112.5, 125, 150, 175];          // text size as a percentage of normal
  var SATURATION_NAMES = ['normal', 'low', 'high'];
  var DEFAULTS = { contrast: false, invert: false, saturation: 0, size: 1, links: false, images: false, cursor: false };

  var root = document.documentElement;
  var state = load();
  apply();

  /* ----- saved settings ----- */
  function load() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { saved = {}; }
    var s = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      s[key] = typeof saved[key] === typeof DEFAULTS[key] ? saved[key] : DEFAULTS[key];
    });
    s.size = Math.min(Math.max(Math.round(s.size), 0), SIZES.length - 1);
    if (s.saturation !== 1 && s.saturation !== 2) s.saturation = 0;
    return s;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: settings last for this visit only */ }
  }

  /* ----- apply the settings to the page ----- */
  function apply() {
    root.classList.toggle('a11y-contrast', state.contrast);
    root.classList.toggle('a11y-invert', state.invert);
    root.classList.toggle('a11y-links', state.links);
    root.classList.toggle('a11y-noimg', state.images);
    root.classList.toggle('a11y-cursor', state.cursor);

    root.style.fontSize = SIZES[state.size] === 100 ? '' : SIZES[state.size] + '%';

    var filters = [];
    if (state.invert) filters.push('invert(1) hue-rotate(180deg)');
    if (state.saturation === 1) filters.push('saturate(0.4)');
    if (state.saturation === 2) filters.push('saturate(2.2)');
    root.style.filter = filters.join(' ');
  }

  /* ----- what each control does; each returns the message to announce ----- */
  var actions = {
    'contrast': function () {
      state.contrast = !state.contrast;
      if (state.contrast) state.invert = false;
      return 'Dark contrast ' + (state.contrast ? 'on' : 'off');
    },
    'invert': function () {
      state.invert = !state.invert;
      if (state.invert) state.contrast = false;
      return 'Invert colours ' + (state.invert ? 'on' : 'off');
    },
    'saturation': function () {
      state.saturation = (state.saturation + 1) % 3;
      return 'Saturation ' + SATURATION_NAMES[state.saturation];
    },
    'text-increase': function () {
      if (state.size >= SIZES.length - 1) return 'Largest text size reached';
      state.size += 1;
      return 'Text size ' + SIZES[state.size] + ' percent';
    },
    'text-decrease': function () {
      if (state.size <= 0) return 'Smallest text size reached';
      state.size -= 1;
      return 'Text size ' + SIZES[state.size] + ' percent';
    },
    'links': function () {
      state.links = !state.links;
      return 'Highlight links ' + (state.links ? 'on' : 'off');
    },
    'images': function () {
      state.images = !state.images;
      return 'Images ' + (state.images ? 'hidden' : 'shown');
    },
    'cursor': function () {
      state.cursor = !state.cursor;
      return 'Default cursor ' + (state.cursor ? 'on' : 'off');
    }
  };

  /* ----- the drawer ----- */
  function init() {
    var drawer = document.getElementById('a11y-drawer');
    var overlay = document.getElementById('a11y-overlay');
    if (!drawer || !overlay) return;

    var triggers = Array.prototype.slice.call(document.querySelectorAll('.accessibility-btn'));
    var tiles = Array.prototype.slice.call(drawer.querySelectorAll('[data-action]'));
    var closeButton = drawer.querySelector('.a11y-close');
    var resetButton = drawer.querySelector('.a11y-reset');
    var status = document.getElementById('a11y-status');
    var lastTrigger = null;

    function announce(message) {
      if (!status) return;
      status.textContent = '';
      setTimeout(function () { status.textContent = message; }, 50);
    }

    function sync() {
      tiles.forEach(function (tile) {
        var action = tile.getAttribute('data-action');
        if (action === 'text-increase') {
          tile.setAttribute('aria-disabled', state.size >= SIZES.length - 1 ? 'true' : 'false');
        } else if (action === 'text-decrease') {
          tile.setAttribute('aria-disabled', state.size <= 0 ? 'true' : 'false');
        } else {
          var on = action === 'saturation' ? state.saturation !== 0 : !!state[action];
          tile.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      });
      var label = drawer.querySelector('[data-state-for="saturation"]');
      if (label) label.textContent = state.saturation === 0 ? '' : SATURATION_NAMES[state.saturation];
    }

    tiles.forEach(function (tile) {
      tile.addEventListener('click', function () {
        var run = actions[tile.getAttribute('data-action')];
        if (!run) return;
        var message = run();
        apply(); save(); sync(); announce(message);
      });
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        Object.keys(DEFAULTS).forEach(function (key) { state[key] = DEFAULTS[key]; });
        apply(); save(); sync(); announce('All accessibility settings reset');
      });
    }

    function focusable() {
      return Array.prototype.slice.call(drawer.querySelectorAll('button:not([disabled])'));
    }

    function open(trigger) {
      lastTrigger = trigger || null;
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      root.classList.add('a11y-open');
      triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      requestAnimationFrame(function () { if (closeButton) closeButton.focus(); });
    }

    function close() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      root.classList.remove('a11y-open');
      triggers.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      if (lastTrigger) lastTrigger.focus();
    }

    triggers.forEach(function (trigger) {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', function () {
        if (drawer.classList.contains('is-open')) close(); else open(trigger);
      });
    });
    if (closeButton) closeButton.addEventListener('click', close);
    overlay.addEventListener('click', close);

    // Escape closes; Tab stays inside the drawer while it is open
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
