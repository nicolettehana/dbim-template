/* Announcements ticker: duplicates the list for a seamless loop,
   sets a steady speed, and wires up the pause / play button. */
(function () {
  var SPEED = 60;   // pixels per second: raise it to scroll faster

  document.querySelectorAll('.ticker').forEach(function (root) {
    var viewport = root.querySelector('.ticker-viewport');
    var move = root.querySelector('.ticker-move');
    var list = root.querySelector('.ticker-list');
    var toggle = root.querySelector('.ticker-toggle');
    if (!viewport || !move || !list || !toggle) return;

    // Copy of the list for the loop: hidden from screen readers and keyboard
    var clone = list.cloneNode(true);
    clone.classList.add('ticker-clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    move.appendChild(clone);
    root.classList.add('is-ready');

    function setSpeed() {
      move.style.setProperty('--ticker-min', viewport.clientWidth + 'px');
      var width = list.getBoundingClientRect().width;
      move.style.setProperty('--ticker-duration', Math.max(width / SPEED, 10) + 's');
    }
    setSpeed();
    window.addEventListener('resize', setSpeed);

    var paused = false;
    function setPaused(value) {
      paused = value;
      root.classList.toggle('is-paused', paused);
      var label = paused ? 'Play announcements' : 'Pause announcements';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    }
    toggle.addEventListener('click', function () { setPaused(!paused); });
    setPaused(false);
  });
})();
