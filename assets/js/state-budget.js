/* ==========================================================================
   State Budget page
   Reads the budget Excel files in the browser (needs SheetJS: window.XLSX).

   Folder layout (relative to data-base on <main>):
     financialyear.xlsx                    sheet 1, column "Financial Year"
     {fy}/{fy}.xlsx                        CardName | FileName | IsMultiple | Icons
     {fy}/{FileName as given}              e.g. others/budget_speech.pdf
     {fy}/{category}/{category}.xlsx       Header | Filename | isMultiple
     {fy}/{category}/{Filename}            e.g. 01.pdf

   A card with IsMultiple = TRUE and FileName "general.xlsx" opens the list in
   {fy}/general/general.xlsx. Column names are matched case-insensitively.
   URL state lives in the hash:  #fy=2025-2026&cat=general
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-budget-section]');
  if (!root) return;

  var BASE = (root.getAttribute('data-base') || '../../budget_documents').replace(/\/+$/, '');
  var MASTER = root.getAttribute('data-master') || 'financialyear.xlsx';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    fy: $('fySelect'), search: $('docSearch'), perWrap: $('perPageWrap'), per: $('docPerPage'),
    title: $('viewTitle'), count: $('viewCount'), back: $('backLink'),
    cardView: $('cardView'), cardList: $('cardList'),
    listView: $('listView'), docList: $('docList'), pagerNav: $('pagerNav'), pager: $('docPager'),
    msg: $('viewMsg'), status: $('docStatus')
  };

  var years = [];
  var state = { fy: null, cards: null, cat: null, card: null, docs: [], q: '', page: 1, per: 20 };
  var routeToken = 0;
  var firstRoute = true;
  var cache = new Map();

  /* ---------- small helpers ---------- */
  function str(v) { return String(v == null ? '' : v).trim(); }
  function toBool(v) { return v === true || /^(true|yes|y|1)$/i.test(str(v)); }
  function stem(file) { return file.replace(/\.[^./]+$/, '').split('/').pop(); }
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
  function announce(text) { el.status.textContent = text; }

  /* Paths come from Excel: allow only plain relative paths, no "..", no schemes. */
  function safePath(p) {
    p = str(p).replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
    if (!p || /(^|\/)\.\.(\/|$)/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p)) return '';
    return p;
  }
  function url() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      String(arguments[i]).split('/').forEach(function (seg) { if (seg) parts.push(encodeURIComponent(seg)); });
    }
    return BASE + '/' + parts.join('/');
  }

  function normRow(row) {
    var out = {};
    Object.keys(row).forEach(function (k) {
      var v = row[k];
      out[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = typeof v === 'string' ? v.trim() : v;
    });
    return out;
  }

  function loadSheet(u) {
    if (!cache.has(u)) {
      var p = fetch(u, { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + ' ' + u);
          return r.arrayBuffer();
        })
        .then(function (buf) {
          var wb = XLSX.read(buf, { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          return XLSX.utils.sheet_to_json(ws, { defval: '' }).map(normRow);
        });
      p.catch(function () { cache.delete(u); });
      cache.set(u, p);
    }
    return cache.get(u);
  }

  /* ---------- hash routing ---------- */
  function hashFor(fy, cat) {
    return '#fy=' + encodeURIComponent(fy) + (cat ? '&cat=' + encodeURIComponent(cat) : '');
  }
  function setHash(fy, cat) { location.hash = hashFor(fy, cat); }

  async function route() {
    var token = ++routeToken;
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var fy = params.get('fy');
    var cat = params.get('cat');
    if (years.indexOf(fy) === -1) fy = years[0];

    el.fy.value = fy;
    if (fy !== state.fy) { state.fy = fy; state.cards = null; }
    state.q = ''; el.search.value = ''; state.page = 1;

    show(el.msg, false);
    el.msg.textContent = '';
    el.title.textContent = 'Loading…';
    el.cardView.setAttribute('aria-busy', 'true');

    try {
      if (!state.cards) {
        var rows = await loadSheet(url(fy, fy + '.xlsx'));
        state.cards = rows.map(toCard).filter(Boolean);
      }
      if (token !== routeToken) return;

      state.card = null;
      if (cat) {
        state.card = state.cards.filter(function (c) { return c.multiple && stem(c.file) === cat; })[0] || null;
      }
      if (state.card) {
        state.cat = cat;
        var drows = await loadSheet(url(fy, cat, cat + '.xlsx'));
        if (token !== routeToken) return;
        state.docs = drows.map(toDoc).filter(Boolean);
      } else {
        state.cat = null;
      }
    } catch (err) {
      if (token !== routeToken) return;
      showError(state.card || cat
        ? 'The documents for this category could not be loaded. Please try again later.'
        : 'The budget documents for ' + fy + ' could not be loaded. Please try again later.');
      return;
    }

    el.cardView.removeAttribute('aria-busy');
    render();
    if (!firstRoute) { el.title.focus(); }
    firstRoute = false;
  }

  function showError(text) {
    show(el.cardView, false); show(el.listView, false); show(el.perWrap, false); show(el.back, false);
    el.count.textContent = '';
    el.title.textContent = 'State Budget';
    el.msg.textContent = text;
    show(el.msg, true);
    el.cardView.removeAttribute('aria-busy');
  }

  /* ---------- row mappers ---------- */
  function toCard(r) {
    var name = str(r.cardname || r.title || r.header);
    var file = safePath(r.filename);
    if (!name || !file) return null;
    return { name: name, file: file, multiple: toBool(r.ismultiple), icon: str(r.icons || r.icon) };
  }
  function toDoc(r) {
    var title = str(r.header || r.title || r.name || r.cardname);
    var file = safePath(r.filename || r.file);
    if (!title || !file) return null;
    return { title: title, file: file, multiple: toBool(r.ismultiple), size: str(r.size) };
  }

  /* ---------- rendering ---------- */
  function render() {
    show(el.msg, false);
    if (state.card) renderList(); else renderCards();
  }

  function renderCards() {
    show(el.cardView, true); show(el.listView, false); show(el.perWrap, false); show(el.back, false);
    el.title.textContent = 'Budget documents \u00B7 ' + state.fy;
    el.search.setAttribute('placeholder', 'Search budget documents...');
    el.search.setAttribute('aria-label', 'Search budget documents');

    var q = state.q.toLowerCase();
    var items = state.cards.filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1; });
    el.count.textContent = items.length + (items.length === 1 ? ' document' : ' documents');
    el.cardList.textContent = '';
    if (!items.length) {
      el.cardList.appendChild(h('div', 'docs-message', q ? 'No documents match your search.' : 'No documents available for this financial year.'));
    }
    items.forEach(function (c) { el.cardList.appendChild(cardNode(c)); });
    announce(el.count.textContent);
  }

  function iconSrc(raw) {
    var v = str(raw);
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) {
      return location.protocol === 'https:' ? v.replace(/^http:/i, 'https:') : v;
    }
    var p = safePath(v);
    return p ? url(p) : '';
  }
  function iconNode(raw, fallbackName) {
    var wrap = h('span', 'bgt-card-icon');
    var fallback = function () { wrap.textContent = ''; wrap.appendChild(symbol(fallbackName)); };
    var src = iconSrc(raw);
    if (!src) { fallback(); return wrap; }
    var img = document.createElement('img');
    img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy';
    img.addEventListener('error', fallback);
    img.src = src;
    wrap.appendChild(img);
    return wrap;
  }

  function cardNode(c) {
    var col = h('div', 'col-12 col-md-6 col-xl-4');
    col.setAttribute('role', 'listitem');
    var a = h('a', 'bgt-card');
    var body = h('span', 'bgt-card-body');
    body.appendChild(h('span', 'bgt-card-title', c.name));

    if (c.multiple) {
      a.href = hashFor(state.fy, stem(c.file));
      body.appendChild(h('span', 'bgt-card-meta', 'View all documents'));
      a.appendChild(iconNode(c.icon, 'folder_open'));
      a.appendChild(body);
      a.appendChild(symbol('chevron_right')).classList.add('bgt-card-go');
    } else {
      a.href = url(state.fy, c.file);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      body.appendChild(h('span', 'bgt-card-meta', ext(c.file)));
      a.appendChild(iconNode(c.icon, 'description'));
      a.appendChild(body);
      a.appendChild(symbol('open_in_new')).classList.add('bgt-card-go');
      a.appendChild(h('span', 'visually-hidden', '(opens in a new tab)'));
    }
    col.appendChild(a);
    return col;
  }

  /* ----- category view ----- */
  function filteredDocs() {
    var q = state.q.toLowerCase();
    return state.docs.filter(function (d) { return d.title.toLowerCase().indexOf(q) !== -1; });
  }

  function renderList() {
    show(el.cardView, false); show(el.listView, true); show(el.perWrap, true); show(el.back, true);
    el.title.textContent = state.card.name + ' \u00B7 ' + state.fy;
    el.search.setAttribute('placeholder', 'Search documents...');
    el.search.setAttribute('aria-label', 'Search documents');
    el.back.href = hashFor(state.fy);

    var items = filteredDocs();
    var pages = Math.max(1, Math.ceil(items.length / state.per));
    state.page = Math.min(state.page, pages);
    var start = (state.page - 1) * state.per;
    var slice = items.slice(start, start + state.per);

    el.count.textContent = items.length + (items.length === 1 ? ' document' : ' documents');
    el.docList.textContent = '';
    if (!slice.length) {
      el.docList.appendChild(h('div', 'docs-message', state.q ? 'No documents match your search.' : 'No documents available in this category.'));
    }
    slice.forEach(function (d, i) { el.docList.appendChild(d.multiple ? groupNode(d, start + i) : rowNode(d)); });
    renderPager(pages);
    announce(items.length ? 'Showing ' + (start + 1) + ' to ' + (start + slice.length) + ' of ' + items.length + ' documents' : 'No documents found');
  }

  function viewLink(title, file) {
    var a = h('a', 'download-btn');
    a.href = url(state.fy, state.cat, file);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'View ' + title + ' (opens in a new tab)');
    a.appendChild(symbol('open_in_new'));
    a.appendChild(document.createTextNode('View'));
    return a;
  }
  function typeSize(file, size) {
    var s = h('span', 'col-type');
    var t = h('span', 'filetype');
    t.appendChild(h('span', null, ext(file)));
    if (size) t.appendChild(h('span', 'filesize', size));
    s.appendChild(t);
    return s;
  }

  function rowNode(d) {
    var row = h('div', 'announcementbox d-flex align-items-center');
    row.setAttribute('role', 'listitem');
    var ic = symbol('picture_as_pdf'); ic.classList.add('doc-icon');
    row.appendChild(ic);
    row.appendChild(h('p', 'doc-title col-title', d.title));
    row.appendChild(typeSize(d.file, d.size));
    var act = h('span', 'col-act'); act.appendChild(viewLink(d.title, d.file));
    row.appendChild(act);
    return row;
  }

  /* A row with isMultiple = TRUE: Filename is another .xlsx in the same category
     folder (columns Header | Filename) listing the files of that group. */
  function groupNode(d, idx) {
    var wrap = h('div', 'doc-group');
    wrap.setAttribute('role', 'listitem');
    var head = h('div', 'announcementbox d-flex align-items-center');
    var ic = symbol('folder_open'); ic.classList.add('doc-icon');
    head.appendChild(ic);
    head.appendChild(h('p', 'doc-title col-title', d.title));
    var act = h('span', 'col-act');
    var btn = h('button', 'download-btn');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'grp-' + idx);
    btn.appendChild(document.createTextNode('View all'));
    act.appendChild(btn); head.appendChild(act);

    var kids = h('ul', 'doc-children');
    kids.id = 'grp-' + idx;
    kids.hidden = true;
    var loaded = false;

    btn.addEventListener('click', async function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      kids.hidden = !open;
      if (!open || loaded) return;
      kids.appendChild(h('li', null, 'Loading…'));
      try {
        var rows = await loadSheet(url(state.fy, state.cat, d.file));
        kids.textContent = '';
        var files = rows.map(toDoc).filter(Boolean);
        if (!files.length) kids.appendChild(h('li', null, 'No files listed.'));
        files.forEach(function (f) {
          var li = document.createElement('li');
          li.appendChild(h('p', 'doc-title col-title', f.title));
          li.appendChild(typeSize(f.file, f.size));
          li.appendChild(viewLink(f.title, f.file));
          kids.appendChild(li);
        });
        loaded = true;
      } catch (e) {
        kids.textContent = '';
        kids.appendChild(h('li', null, 'These files could not be loaded.'));
      }
    });

    wrap.appendChild(head);
    wrap.appendChild(kids);
    return wrap;
  }

  /* ----- pagination ----- */
  function renderPager(pages) {
    el.pager.textContent = '';
    show(el.pagerNav, pages > 1);
    if (pages <= 1) return;

    function add(node, cls) { var li = h('li', cls); li.appendChild(node); el.pager.appendChild(li); }
    function go(n) {
      state.page = n; renderList();
      el.listView.scrollIntoView({ block: 'start' });
    }
    function arrow(name, label, disabled, target) {
      var b = h('button', 'button-item ' + (name === 'chevron_left' ? 'previous' : 'next'));
      b.type = 'button'; b.disabled = disabled;
      b.setAttribute('aria-label', label);
      b.appendChild(symbol(name));
      b.addEventListener('click', function () { go(target); });
      add(b);
    }

    arrow('chevron_left', 'Previous page', state.page === 1, state.page - 1);
    var nums = {};
    [1, pages, state.page - 1, state.page, state.page + 1].forEach(function (n) { if (n >= 1 && n <= pages) nums[n] = true; });
    var last = 0;
    Object.keys(nums).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      if (n - last > 1) { var g = h('span', 'gap', '\u2026'); g.setAttribute('aria-hidden', 'true'); add(g); }
      var b = h('button', 'page-link' + (n === state.page ? ' active' : ''), String(n));
      b.type = 'button';
      b.setAttribute('aria-label', 'Page ' + n);
      if (n === state.page) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', function () { go(n); });
      add(b);
      last = n;
    });
    arrow('chevron_right', 'Next page', state.page === pages, state.page + 1);
  }

  /* ---------- events ---------- */
  var timer;
  el.search.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.q = el.search.value.trim(); state.page = 1;
      if (state.cards) render();
    }, 200);
  });
  el.search.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  el.per.addEventListener('change', function () {
    state.per = parseInt(el.per.value, 10) || 20; state.page = 1;
    if (state.card) renderList();
  });
  el.fy.addEventListener('change', function () { setHash(el.fy.value); });
  window.addEventListener('hashchange', route);

  /* ---------- start ---------- */
  async function init() {
    if (typeof XLSX === 'undefined') {
      showError('The spreadsheet reader could not be loaded. Please try again later.');
      return;
    }
    try {
      var rows = await loadSheet(url(MASTER));
      var seen = {};
      years = rows.map(function (r) {
        var v = r.financialyear != null ? r.financialyear : Object.keys(r).length ? r[Object.keys(r)[0]] : '';
        return str(v).replace(/\s*-\s*/, '-');
      }).filter(function (y) {
        if (!/^\d{4}-\d{4}$/.test(y) || seen[y]) return false;
        return (seen[y] = true);
      });
    } catch (e) { years = []; }

    if (!years.length) { showError('No financial years are available at the moment.'); return; }

    years.forEach(function (y) {
      var o = document.createElement('option'); o.value = y; o.textContent = y; el.fy.appendChild(o);
    });
    state.per = parseInt(el.per.value, 10) || 20;
    route();
  }
  init();
})();
