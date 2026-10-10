/* ==========================================================================
   State Budget page
   Reads the budget Excel files in the browser (needs SheetJS: window.XLSX).

   Folder layout (relative to data-base on <main>):
     financialyear.xlsx                    sheet 1, column "Financial Year"
     {fy}/{fy}.xlsx                        CardName | FileName | IsMultiple | Icons
     {fy}/{FileName as given}              e.g. others/budget_speech.pdf
     {fy}/{category}/{category}.xlsx       Header | Filename | isMultiple
     {fy}/{category}/{Filename}            e.g. 01.pdf

   Main table  = the rows of {fy}.xlsx.
   "View all"  = IsMultiple TRUE row; FileName "general.xlsx" opens the list
                 in {fy}/general/general.xlsx.
   Category dropdown = All | Others (single PDFs) | one entry per IsMultiple row.
   URL state:  #fy=2025-2026   #fy=2025-2026&cat=general   #fy=2025-2026&grp=others
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-budget-section]');
  if (!root) return;

  var BASE = (root.getAttribute('data-base') || '../../budget_documents').replace(/\/+$/, '');
  var MASTER = root.getAttribute('data-master') || 'financialyear.xlsx';

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    fy: $('fySelect'), cat: $('catSelect'), search: $('docSearch'), per: $('docPerPage'),
    title: $('viewTitle'), count: $('viewCount'), back: $('backLink'),
    listView: $('listView'), docList: $('docList'), pagerNav: $('pagerNav'), pager: $('docPager'),
    msg: $('viewMsg'), status: $('docStatus')
  };

  var OTHERS = '__others';
  var years = [];
  var state = { fy: null, cards: null, card: null, cat: null, grp: '', docs: [], q: '', page: 1, per: 20 };
  var routeToken = 0;
  var firstRoute = true;
  var cache = new Map();

  /* ---------- helpers ---------- */
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
  function announce(t) { el.status.textContent = t; }
  function plural(n) { return n + (n === 1 ? ' document' : ' documents'); }

  /* Paths come from Excel: plain relative paths only, no "..", no schemes. */
  function safePath(p) {
    p = str(p).replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
    if (!p || /(^|\/)\.\.(\/|$)/.test(p) || /^[a-z][a-z0-9+.-]*:/i.test(p)) return '';
    return p;
  }
  function url() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      String(arguments[i]).split('/').forEach(function (s) { if (s) parts.push(encodeURIComponent(s)); });
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
        .then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + u); return r.arrayBuffer(); })
        .then(function (buf) {
          var wb = XLSX.read(buf, { type: 'array' });
          return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }).map(normRow);
        });
      p.catch(function () { cache.delete(u); });
      cache.set(u, p);
    }
    return cache.get(u);
  }

  /* ---------- row mappers ---------- */
  function toCard(r) {
    var name = str(r.cardname || r.title || r.header);
    var file = safePath(r.filename);
    if (!name || !file) return null;
    return { name: name, file: file, multiple: toBool(r.ismultiple), size: str(r.size) };
  }
  function toDoc(r) {
    var title = str(r.header || r.title || r.name || r.cardname);
    var file = safePath(r.filename || r.file);
    if (!title || !file) return null;
    return { title: title, file: file, multiple: toBool(r.ismultiple), size: str(r.size) };
  }

  /* Main-table order: General, Khasi, Jaintia, Garo, Receipt, any other category, then single documents ("Others"). */
  var CATEGORY_ORDER = ['general', 'khasi', 'jaintia', 'garo', 'receipt', 'receipts'];
  function sortCards(cards) {
    function rank(c) {
      if (!c.multiple) return 100;
      var i = CATEGORY_ORDER.indexOf(stem(c.file).toLowerCase());
      return i === -1 ? 50 : i;
    }
    return cards
      .map(function (c, i) { return { c: c, i: i }; })
      .sort(function (a, b) { return rank(a.c) - rank(b.c) || a.i - b.i; })
      .map(function (x) { return x.c; });
  }

  /* ---------- routing ---------- */
  function hashFor(fy, cat, grp) {
    var s = '#fy=' + encodeURIComponent(fy);
    if (cat) s += '&cat=' + encodeURIComponent(cat);
    else if (grp) s += '&grp=' + encodeURIComponent(grp);
    return s;
  }
  function setHash(fy, cat, grp) { location.hash = hashFor(fy, cat, grp); }

  async function route() {
    var token = ++routeToken;
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    var fy = p.get('fy');
    var cat = p.get('cat');
    if (years.indexOf(fy) === -1) fy = years[0];

    el.fy.value = fy;
    if (fy !== state.fy) { state.fy = fy; state.cards = null; el.cat.textContent = ''; }
    state.q = ''; el.search.value = ''; state.page = 1;
    state.grp = p.get('grp') === 'others' ? 'others' : '';

    show(el.msg, false);
    el.title.textContent = 'Loading…';
    el.listView.setAttribute('aria-busy', 'true');

    try {
      if (!state.cards) {
        var rows = await loadSheet(url(fy, fy + '.xlsx'));
        state.cards = sortCards(rows.map(toCard).filter(Boolean));
        fillCategories();
      }
      if (token !== routeToken) return;

      state.card = cat ? (state.cards.filter(function (c) { return c.multiple && stem(c.file) === cat; })[0] || null) : null;
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

    el.listView.removeAttribute('aria-busy');
    render();
    if (!firstRoute) el.title.focus();
    firstRoute = false;
  }

  function showError(text) {
    show(el.listView, false); show(el.back, false);
    el.count.textContent = '';
    el.title.textContent = 'State Budget';
    el.msg.textContent = text;
    show(el.msg, true);
    el.listView.removeAttribute('aria-busy');
  }

  function fillCategories() {
    function opt(v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; el.cat.appendChild(o); }
    opt('', 'All categories');
    opt(OTHERS, 'Others');
    state.cards.forEach(function (c) { if (c.multiple) opt(stem(c.file), c.name); });
  }

  /* ---------- rendering ---------- */
  /* File size: use the Excel "Size" column if present, else ask the server (HEAD -> Content-Length). */
  var sizeCache = new Map();
  function fmtSize(bytes) {
    if (!(bytes > 0)) return '';
    return bytes < 1048576 ? (bytes / 1024).toFixed(2) + ' KB' : (bytes / 1048576).toFixed(2) + ' MB';
  }
  function fillSize(scope, href) {
    var t = scope.querySelector('.filetype');
    if (!t || t.querySelector('.filesize')) return;
    if (!sizeCache.has(href)) {
      sizeCache.set(href, fetch(href, { method: 'HEAD' }).then(function (r) {
        return r.ok ? fmtSize(parseInt(r.headers.get('content-length'), 10)) : '';
      }).catch(function () { return ''; }));
    }
    sizeCache.get(href).then(function (txt) {
      if (txt && !t.querySelector('.filesize')) t.appendChild(h('span', 'filesize', txt));
    });
  }

  function typeSize(file, size) {
    var s = h('span', 'col-type');
    if (file) {
      var t = h('span', 'filetype');
      t.appendChild(h('span', null, ext(file)));
      if (size) t.appendChild(h('span', 'filesize', size));
      s.appendChild(t);
    }
    return s;
  }
  function yearCol() {
    var s = h('span', 'col-year');
    s.appendChild(h('span', 'year', state.fy));
    return s;
  }
  function actionLink(label, aria, href, newTab) {
    var a = h('a', 'download-btn');
    a.href = href;
    if (newTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; aria += ' (opens in a new tab)'; }
    a.setAttribute('aria-label', aria);
    a.appendChild(symbol('visibility'));
    a.appendChild(document.createTextNode(label));
    return a;
  }
  function baseRow(iconName, title) {
    var row = h('div', 'announcementbox d-flex align-items-center');
    row.setAttribute('role', 'listitem');
    var ic = symbol(iconName); ic.classList.add('doc-icon');
    row.appendChild(ic);
    var t = h('p', 'doc-title col-title', title);
    row.appendChild(t);
    return { row: row, titleEl: t };
  }
  function fileRow(title, href, file, size) {
    var b = baseRow('description', title);
    b.row.appendChild(yearCol());
    b.row.appendChild(typeSize(file, size));
    var act = h('span', 'col-act');
    act.appendChild(actionLink('View', 'View ' + title, href, true));
    b.row.appendChild(act);
    if (!size) fillSize(b.row, href);
    return b.row;
  }
  function categoryRow(c) {
    var cat = stem(c.file);
    var b = baseRow('file_copy', c.name);
    var badge = h('span', 'counter-box', '');
    badge.hidden = true;
    b.titleEl.appendChild(badge);
    b.row.appendChild(yearCol());
    b.row.appendChild(typeSize(null));
    var act = h('span', 'col-act');
    act.appendChild(actionLink('View all', 'View all documents in ' + c.name, hashFor(state.fy, cat), false));
    b.row.appendChild(act);
    // document count, filled in once the category sheet has loaded
    loadSheet(url(state.fy, cat, cat + '.xlsx')).then(function (rows) {
      badge.textContent = rows.map(toDoc).filter(Boolean).length;
      badge.hidden = false;
    }).catch(function () {});
    return b.row;
  }

  /* isMultiple row inside a category sheet: Filename is another .xlsx in the same folder */
  function groupNode(d, idx) {
    var wrap = h('div', 'doc-group');
    wrap.setAttribute('role', 'listitem');
    var b = baseRow('file_copy', d.title);
    b.row.setAttribute('role', 'presentation');
    b.row.appendChild(yearCol());
    b.row.appendChild(typeSize(null));
    var act = h('span', 'col-act');
    var btn = h('button', 'download-btn');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'grp-' + idx);
    btn.appendChild(symbol('visibility'));
    btn.appendChild(document.createTextNode('View all'));
    act.appendChild(btn); b.row.appendChild(act);

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
          li.appendChild(actionLink('View', 'View ' + f.title, url(state.fy, state.cat, f.file), true));
          kids.appendChild(li);
          if (!f.size) fillSize(li, url(state.fy, state.cat, f.file));
        });
        loaded = true;
      } catch (e) {
        kids.textContent = '';
        kids.appendChild(h('li', null, 'These files could not be loaded.'));
      }
    });
    wrap.appendChild(b.row);
    wrap.appendChild(kids);
    return wrap;
  }

  /* Items for the current view, after the category filter and search */
  function currentItems() {
    var q = state.q.toLowerCase();
    if (state.card) {
      return state.docs.filter(function (d) { return d.title.toLowerCase().indexOf(q) !== -1; });
    }
    return state.cards.filter(function (c) {
      if (state.grp === 'others' && c.multiple) return false;
      return c.name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    show(el.msg, false); show(el.listView, true);
    var inCat = !!state.card;
    show(el.back, inCat);
    if (inCat) el.back.href = hashFor(state.fy);

    el.cat.value = inCat ? state.cat : (state.grp === 'others' ? OTHERS : '');
    el.title.textContent = (inCat ? state.card.name : (state.grp === 'others' ? 'Other budget documents' : 'Budget documents')) + ' \u00B7 ' + state.fy;
    el.search.placeholder = 'Search...';

    var items = currentItems();
    var pages = Math.max(1, Math.ceil(items.length / state.per));
    state.page = Math.min(state.page, pages);
    var start = (state.page - 1) * state.per;
    var slice = items.slice(start, start + state.per);

    el.count.textContent = plural(items.length);
    el.docList.textContent = '';
    if (!slice.length) {
      el.docList.appendChild(h('div', 'docs-message', state.q ? 'No documents match your search.' : 'No documents available here.'));
    }
    slice.forEach(function (it, i) {
      var node;
      if (inCat) {
        node = it.multiple ? groupNode(it, start + i) : fileRow(it.title, url(state.fy, state.cat, it.file), it.file, it.size);
      } else {
        node = it.multiple ? categoryRow(it) : fileRow(it.name, url(state.fy, it.file), it.file, it.size);
      }
      el.docList.appendChild(node);
    });
    renderPager(pages);
    announce(items.length ? 'Showing ' + (start + 1) + ' to ' + (start + slice.length) + ' of ' + items.length + ' documents' : 'No documents found');
  }

  function renderPager(pages) {
    el.pager.textContent = '';
    show(el.pagerNav, pages > 1);
    if (pages <= 1) return;
    function add(node, cls) { var li = h('li', cls); li.appendChild(node); el.pager.appendChild(li); }
    function go(n) { state.page = n; render(); el.listView.scrollIntoView({ block: 'start' }); }
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
    if (state.cards) render();
  });
  el.fy.addEventListener('change', function () { setHash(el.fy.value); });
  el.cat.addEventListener('change', function () {
    var v = el.cat.value;
    if (v === OTHERS) setHash(state.fy, null, 'others');
    else if (v) setHash(state.fy, v);
    else setHash(state.fy);
  });
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
        var keys = Object.keys(r);
        var v = r.financialyear != null ? r.financialyear : (keys.length ? r[keys[0]] : '');
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
