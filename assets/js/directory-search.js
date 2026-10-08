(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('#dirList .directoryBox'));
  var alpha = document.getElementById('alphabet');
  var search = document.getElementById('dirSearch');
  var clearBtn = document.getElementById('clearAll');
  var empty = document.getElementById('dirEmpty');
  var letter = '';

  // A-Z buttons: click a letter to filter, click it again to deselect
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (l) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = l;
    b.addEventListener('click', function () {
      letter = (letter === l) ? '' : l; render();
    });
    alpha.appendChild(b);
  });

  function matches(row) {
    var q = search.value.trim().toLowerCase();
    // ignore honorifics so "Shri Jitin Prasada" files under J
    var key = row.dataset.name.toLowerCase().replace(/^(shri|smt|dr|sh)\.?\s+/, '');
    return (!letter || key.charAt(0) === letter.toLowerCase()) &&
           (!q || row.textContent.toLowerCase().indexOf(q) > -1);
  }

  function render() {
    var shown = 0;
    rows.forEach(function (r) {
      var ok = matches(r);
      r.hidden = !ok;
      if (ok) shown++;
    });
    empty.hidden = shown > 0;
    clearBtn.hidden = !(letter || search.value.trim());

    Array.prototype.forEach.call(alpha.children, function (b) {
      var on = b.textContent === letter;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  clearBtn.addEventListener('click', function () {
    letter = ''; search.value = ''; render(); search.focus();
  });
  search.addEventListener('input', render);
  render();
})();