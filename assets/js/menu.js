/* Main navigation: the Menu button (small screens) and the sub-menu buttons.
   Escape closes what is open; clicking elsewhere or tabbing away closes the sub-menus. */
(function () {
  document.querySelectorAll('.main-nav').forEach(function (nav) {
    var menuButton = nav.querySelector('.nav-menu-btn');
    var toggles = Array.prototype.slice.call(nav.querySelectorAll('.nav-toggle'));
    var desktop = window.matchMedia('(min-width: 992px)');

    nav.classList.add('is-ready');

    function panelOf(toggle) {
      return document.getElementById(toggle.getAttribute('aria-controls'));
    }

    function closeSubs(except) {
      toggles.forEach(function (toggle) {
        if (toggle === except) return;
        toggle.setAttribute('aria-expanded', 'false');
        var panel = panelOf(toggle);
        if (panel) panel.hidden = true;
      });
    }

    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      if (menuButton) menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) closeSubs();
    }

    if (menuButton) {
      menuButton.addEventListener('click', function () {
        setMenu(!nav.classList.contains('is-open'));
      });
    }

    toggles.forEach(function (toggle) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        closeSubs(toggle);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        var panel = panelOf(toggle);
        if (panel) panel.hidden = !open;
      });
    });

    // Click outside the menu
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) closeSubs();
    });

    // Tab away from the menu
    nav.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !nav.contains(e.relatedTarget)) closeSubs();
    });

    // Escape: close the open sub-menu first, then the whole menu on small screens
    nav.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var openToggle = toggles.filter(function (t) { return t.getAttribute('aria-expanded') === 'true'; })[0];
      if (openToggle) {
        closeSubs();
        openToggle.focus();
      } else if (!desktop.matches && nav.classList.contains('is-open') && menuButton) {
        setMenu(false);
        menuButton.focus();
      }
    });

    // Reset when the window crosses the desktop breakpoint
    desktop.addEventListener('change', function () { setMenu(false); });
  });
})();
