/* ==========================================================================
   Expenditure page
   Reads one JSON file (data-source on <main>). File paths inside the JSON are
   relative to data-base (the expenditure folder).

   {
     "documents": [ { "id": "...", "title": "..." }, ... ],      // optional, shown in this order
     "financialYears": [
       { "year": "2025-2026",
         "months": [ { "month": "April",
                       "files": { "<document id>": "2025-2026/april/x.pdf"
                                  or { "url": "...", "size": "1.2 MB" }
                                  or null / missing = "Not available" } } ] } ]
   }
   Financial year and month are both always selected (latest by default).
   URL state:  #fy=2025-2026&m=april
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-expenditure-section]');
  if (!root) return;

  var BASE = (root.getAttribute('data-base') || '../../expenditure').replace(/\/+$/, '');
  var SOURCE = root.getAttribute('data-source') || BASE + '/expenditure.json';

  var FY_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  var DEFAULT_DOCS = [
    { id: 'appropriation-accounts', title: 'Appropriation Accounts' },
    { id: 'subsidiary-register', title: 'Subsidiary Register' },
    { id: 'warning-slip', title: 'Warning Slip' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    fy: $('fySelect'), month: $('monthSelect'), title: $('viewTitle'), count: $('viewCount'),
    view: $('listView'), list: $('docList'), msg: $('viewMsg'), status: $('docStatus')
  };

  var data = null;                 // { docs, years }
  var current = { fy: null };
  var firstRoute = true;

  /* ---------- helpers ---------- */
  function str(v) { return String(v == null ? '' : v).trim(); }
  function ext(file) { var m = /\.([a-z0-9]+)$/i.exec(file); return m ? m[1].toUpperCase() : 'FILE'; }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function symbol(name) {
    var s = h('span', 'material-symbols-outlined', name);
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  function show(node, on) { node.classList.toggle('hide', !on); }

  function safePath(p) {
    p = str(p).replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
    if (!p || /(^|\/)\.\.(\/|$)/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p)) return '';
    return p;
  }
  function fileUrl(path) {
    return BASE + '/' + path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  }

  /* April-December belong to the first year of the FY, January-March to the second. */
  function calendarYear(fy, monthName) {
    var start = parseInt(fy.slice(0, 4), 10);
    return FY_MONTHS.indexOf(monthName) <= 8 ? start : start + 1;
  }
  function periodLabel(fy, monthName) { return monthName + ' ' + calendarYear(fy, monthName); }

  /* ---------- data ---------- */
  function parse(json) {
    var docs = (json && json.documents && json.documents.length ? json.documents : DEFAULT_DOCS)
      .map(function (d) { return { id: str(d.id), title: str(d.title) }; })
      .filter(function (d) { return d.id && d.title; });

    var seen = {};
    var years = ((json && json.financialYears) || []).map(function (y) {
      var year = str(y.year).replace(/\s*-\s*/, '-');
      var months = (y.months || []).map(function (m) {
        var name = FY_MONTHS.filter(function (n) { return n.toLowerCase() === str(m.month).toLowerCase(); })[0];
        return name ? { name: name, key: name.toLowerCase(), files: m.files || {} } : null;
      }).filter(Boolean).sort(function (a, b) { return FY_MONTHS.indexOf(a.name) - FY_MONTHS.indexOf(b.name); });
      return { year: year, months: months };
    }).filter(function (y) {
      if (!/^\d{4}-\d{4}$/.test(y.year) || !y.months.length || seen[y.year]) return false;
      return (seen[y.year] = true);
    }).sort(function (a, b) { return parseInt(b.year, 10) - parseInt(a.year, 10); });

    return { docs: docs, years: years };
  }
  function entry(v) {
    if (!v) return null;
    var path = safePath(typeof v === 'string' ? v : v.url);
    return path ? { url: fileUrl(path), file: path, size: typeof v === 'string' ? '' : str(v.size) } : null;
  }

  /* ---------- size (Excel/JSON "size" if given, else ask the server) ---------- */
  var sizeCache = new Map();
  function fmtSize(b) {
    if (!(b > 0)) return '';
    return b < 1048576 ? (b / 1024).toFixed(2) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
  }

  function iconFor(file) {
  var e = ext(file);
  if (e === 'PDF') return 'picture_as_pdf';
  if (/^(JPG|JPEG|PNG|GIF|WEBP)$/.test(e)) return 'image';
  if (/^(XLS|XLSX|CSV)$/.test(e)) return 'table';
  return 'description';
}
  function fillSize(scope, href) {
  var col = scope.querySelector('.col-type');
  if (!col || !col.querySelector('.filetype') || col.querySelector('.filesize')) return;
  if (!sizeCache.has(href)) {
    sizeCache.set(href, fetch(href, { method: 'HEAD' }).then(function (r) {
      return r.ok ? fmtSize(parseInt(r.headers.get('content-length'), 10)) : '';
    }).catch(function () { return ''; }));
  }
  sizeCache.get(href).then(function (txt) {
    if (txt && !col.querySelector('.filesize')) col.appendChild(h('span', 'filesize ms-2', txt));
  });
}

  /* ---------- routing ---------- */
  function hashFor(fy, m) { return '#fy=' + encodeURIComponent(fy) + (m ? '&m=' + encodeURIComponent(m) : ''); }

  function fillMonths(yearObj) {
    el.month.textContent = '';
    yearObj.months.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m.key; o.textContent = periodLabel(yearObj.year, m.name);
      el.month.appendChild(o);
    });
  }

  function route() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var yearObj = data.years.filter(function (y) { return y.year === p.get('fy'); })[0] || data.years[0];
    if (current.fy !== yearObj.year) { fillMonths(yearObj); current.fy = yearObj.year; }

    // latest month with data is the default
    var monthObj = yearObj.months.filter(function (m) { return m.key === p.get('m'); })[0]
      || yearObj.months[yearObj.months.length - 1];

    el.fy.value = yearObj.year;
    el.month.value = monthObj.key;
    render(yearObj, monthObj);
    if (!firstRoute) el.title.focus();
    firstRoute = false;
  }

  /* ---------- rendering ---------- */
  function row(doc, fy, month) {
    var e = entry(month.files[doc.id]);
    var r = h('div', 'announcementbox d-flex align-items-center');
    r.setAttribute('role', 'listitem');
    var ic = symbol('description'); ic.classList.add('doc-icon');
    r.appendChild(ic);
    r.appendChild(h('p', 'doc-title col-title', doc.title));
    var period = h('span', 'col-year'); period.appendChild(h('span', 'year', periodLabel(fy, month.name)));
    r.appendChild(period);

    var type = h('span', 'col-type d-flex align-items-center');
    var act = h('span', 'col-act');
    if (e) {
      var t = h('span', 'filetype');
      t.appendChild(symbol(iconFor(e.file)));        // icon on top
      t.appendChild(h('span', null, ext(e.file)));   // "PDF" underneath
      type.appendChild(t);
      if (e.size) type.appendChild(h('span', 'filesize ms-2', e.size));   // size beside it
      type.appendChild(t);
      var a = h('a', 'download-btn');
      a.href = e.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', 'View ' + doc.title + ', ' + periodLabel(fy, month.name) + ' (opens in a new tab)');
      a.appendChild(symbol('visibility'));
      a.appendChild(document.createTextNode('View'));
      act.appendChild(a);
    } else {
      act.appendChild(h('span', 'exp-unavailable', 'Not available'));
    }
    r.appendChild(type); r.appendChild(act);
    if (e && !e.size) fillSize(r, e.url);
    return r;
  }

  function render(yearObj, monthObj) {
    show(el.msg, false); show(el.view, true);
    el.title.textContent = 'Expenditure \u00B7 ' + periodLabel(yearObj.year, monthObj.name) + ' (FY ' + yearObj.year + ')';
    el.list.textContent = '';
    data.docs.forEach(function (d) { el.list.appendChild(row(d, yearObj.year, monthObj)); });
    var available = data.docs.filter(function (d) { return entry(monthObj.files[d.id]); }).length;
    el.count.textContent = available + (available === 1 ? ' document' : ' documents') + ' available';
    el.status.textContent = el.title.textContent + '. ' + el.count.textContent;
  }

  function showError(text) {
    show(el.view, false);
    el.title.textContent = 'Expenditure';
    el.count.textContent = '';
    el.msg.textContent = text;
    show(el.msg, true);
  }

  /* ---------- start ---------- */
  el.fy.addEventListener('change', function () { location.hash = hashFor(el.fy.value); });
  el.month.addEventListener('change', function () { location.hash = hashFor(el.fy.value, el.month.value); });
  window.addEventListener('hashchange', function () { if (data) route(); });

  fetch(SOURCE, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (json) {
      data = parse(json);
      if (!data.years.length) { showError('No expenditure documents are available at the moment.'); return; }
      data.years.forEach(function (y) {
        var o = document.createElement('option'); o.value = y.year; o.textContent = y.year; el.fy.appendChild(o);
      });
      route();
    })
    .catch(function () { showError('The expenditure documents could not be loaded. Please try again later.'); });
})();
