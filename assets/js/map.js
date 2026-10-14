(function () {
    document.querySelectorAll('.map-section').forEach(function (section) {
    var frame = section.querySelector('.map-frame');
    var link = section.querySelector('.map-open');
    var buttons = section.querySelectorAll('[data-query]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = encodeURIComponent(btn.dataset.query);
        frame.src = 'https://www.google.com/maps?q=' + q + '&output=embed';
        frame.title = 'Map showing ' + btn.querySelector('.fw-bold').textContent;
        link.href = 'https://www.google.com/maps/search/?api=1&query=' + q;

        buttons.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          if (on) { b.setAttribute('aria-current', 'true'); } else { b.removeAttribute('aria-current'); }
        });
      });
    });
  });
})();