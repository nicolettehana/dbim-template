/* Tabs for Key Offerings. Switches the list and points "View more" at the selected tab's page.
   Keyboard: Left/Right arrows, Home and End move between tabs. */
(function () {
  document.querySelectorAll('.offerings').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var more = root.querySelector('[data-tab-more]');
    if (!tabs.length) return;

    function activate(tab, moveFocus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (more) {
        more.href = tab.getAttribute('data-more');
        more.setAttribute('aria-label', tab.getAttribute('data-label') || 'View more');
      }
      if (moveFocus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next;
        if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        activate(tabs[next], true);
      });
    });

    var initial = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    activate(initial, false);
  });
})();
