/* ==========================================================================
   Documents section
   Reads documents.json (path set in data-source on the section) and renders
   search, sort, category filter, per-page, pagination and "View all" groups.
   Add a document = add an entry to documents.json. No code changes needed.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.querySelector("[data-docs-section]");
  if (!root) return;

  var el = {
    search: root.querySelector("#docSearch"),
    sort: root.querySelector("#docSort"),
    category: root.querySelector("#docCategory"),
    perPage: root.querySelector("#docPerPage"),
    list: root.querySelector("#docList"),
    pager: root.querySelector("#docPager"),
    archive: root.querySelector("#docArchive")
  };

  var state = { docs: [], page: 1, open: {} };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // allow only http(s) and relative links
  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https?:\/\/|\/|\.\/|\.\.\/|[\w-]+[\/.])/i.test(u) && !/^javascript:/i.test(u) ? u : "#";
  }

  function sortKey(d) {
    // newest first by date, falling back to year
    var t = d.date ? Date.parse(d.date) : NaN;
    return isNaN(t) ? Date.UTC(+d.year || 0, 0, 1) : t;
  }

  function setMessage(text) {
    el.list.innerHTML = '<p class="docs-message" role="status">' + esc(text) + "</p>";
    el.pager.innerHTML = "";
  }

  /* ---------- data ---------- */
  function load() {
    setMessage("Loading documents…");
    fetch(root.getAttribute("data-source"), { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        state.docs = (data.documents || []).map(function (d, i) {
          d._i = i;
          d._group = Array.isArray(d.files) && d.files.length > 0;
          d._search = (d.title + " " + (d._group ? d.files.map(function (f) { return f.title; }).join(" ") : "")).toLowerCase();
          return d;
        });
        fillCategories(data.categories || []);
        if (root.getAttribute("data-archive-url")) el.archive.href = root.getAttribute("data-archive-url");
        render();
      })
      .catch(function () {
        setMessage("Documents could not be loaded. Please refresh the page or try again later.");
      });
  }

  function fillCategories(cats) {
    var html = '<option value="">Category</option>';
    cats.forEach(function (c) {
      html += '<option value="' + esc(c.id) + '">' + esc(c.label) + "</option>";
    });
    el.category.innerHTML = html;
  }

  /* ---------- filter / sort ---------- */
  function visible() {
    var q = el.search.value.trim().toLowerCase();
    var cat = el.category.value;
    var out = state.docs.filter(function (d) {
      return (!q || d._search.indexOf(q) > -1) && (!cat || d.category === cat);
    });

    var mode = el.sort.value || "newest";
    out.sort(function (a, b) {
      switch (mode) {
        case "oldest":     return sortKey(a) - sortKey(b) || a._i - b._i;
        case "title-asc":  return a.title.localeCompare(b.title);
        case "title-desc": return b.title.localeCompare(a.title);
        default:           return sortKey(b) - sortKey(a) || a._i - b._i;
      }
    });
    return out;
  }

  /* ---------- rendering ---------- */
  function pdfIcon(type) {
    return (
      '<span class="filetype" aria-label="' + esc(type || "File") + '">' +
      '<span class="material-symbols-outlined" aria-hidden="true">picture_as_pdf</span>' +
      esc(type || "") + "</span>"
    );
  }

  function singleRow(d) {
    return (
      '<div class="announcementbox d-flex flex-wrap align-items-center gap-2" role="listitem">' +
        '<div class="col-title d-flex align-items-center gap-2">' +
          '<span class="material-symbols-outlined doc-icon" aria-hidden="true">description</span>' +
          '<p class="announcementbox-title doc-title">' + esc(d.title) + "</p>" +
        "</div>" +
        '<div class="col-year year">' + esc(d.year) + "</div>" +
        '<div class="col-type d-flex align-items-center">' + pdfIcon(d.type) +
          '<span class="filesize ms-2">' + esc(d.size) + "</span></div>" +
        '<div class="col-act">' +
          '<a class="download-btn" href="' + esc(safeUrl(d.url)) + '" target="_blank" rel="noopener" aria-label="View ' + esc(d.title) + ' (opens in a new tab)">' +
          '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>View</a>' +
        "</div>" +
      "</div>"
    );
  }

  function groupRow(d) {
    var id = "grp-" + d._i;
    var open = !!state.open[d._i];
    var kids = "";
    if (open) {
      kids = '<ul class="doc-children" id="' + id + '">';
      d.files.forEach(function (f) {
        kids +=
          "<li>" +
            '<div class="col-title d-flex align-items-center gap-2">' +
              '<span class="material-symbols-outlined doc-icon" aria-hidden="true">description</span>' +
              '<p class="doc-title">' + esc(f.title) + "</p>" +
            "</div>" +
            '<div class="col-type d-flex align-items-center">' + pdfIcon(f.type) +
              '<span class="filesize ms-2">' + esc(f.size) + "</span></div>" +
            '<div class="col-act">' +
              '<a class="download-btn" href="' + esc(safeUrl(f.url)) + '" target="_blank" rel="noopener" aria-label="View ' + esc(f.title) + ' (opens in a new tab)">' +
              '<span class="material-symbols-outlined" aria-hidden="true">visibility</span>View</a>' +
            "</div>" +
          "</li>";
      });
      kids += "</ul>";
    }
    return (
      '<div class="doc-group" role="listitem">' +
        '<div class="announcementbox d-flex flex-wrap align-items-center gap-2">' +
          '<div class="col-title d-flex align-items-center gap-2">' +
            '<span class="material-symbols-outlined doc-icon" aria-hidden="true">content_copy</span>' +
            '<p class="announcementbox-title doc-title">' + esc(d.title) +
              '<span class="counter-box" aria-label="' + d.files.length + ' files">' + d.files.length + "</span></p>" +
          "</div>" +
          '<div class="col-year year">' + esc(d.year) + "</div>" +
          '<div class="col-type"></div>' +
          '<div class="col-act">' +
            '<button type="button" class="download-btn border-0" data-toggle="' + d._i + '" aria-expanded="' + open + '" aria-controls="' + id + '">' +
            '<span class="material-symbols-outlined" aria-hidden="true">' + (open ? "visibility_off" : "visibility") + "</span>" +
            (open ? "Hide" : "View all") + "</button>" +
          "</div>" +
        "</div>" + kids +
      "</div>"
    );
  }

  function pagerHTML(page, pages) {
    var h = '<li><button type="button" class="button-item previous" data-p="' + (page - 1) + '"' +
      (page === 1 ? " disabled" : "") + ' aria-label="Previous page"><span class="material-symbols-outlined">chevron_left</span></button></li>';

    // window: first, last, and 1 either side of current
    var shown = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 1) shown.push(i);
    }
    var prev = 0;
    shown.forEach(function (n) {
      if (n - prev > 1) h += '<li class="gap" aria-hidden="true">…</li>';
      h += '<li><button type="button" class="page-link button-item hover' + (n === page ? " active" : "") + '" data-p="' + n + '"' +
        (n === page ? ' aria-current="page"' : "") + ' aria-label="Page ' + n + '">' + n + "</button></li>";
      prev = n;
    });

    h += '<li><button type="button" class="button-item next" data-p="' + (page + 1) + '"' +
      (page === pages ? " disabled" : "") + ' aria-label="Next page"><span class="material-symbols-outlined">chevron_right</span></button></li>';
    return h;
  }

  function render() {
    var list = visible();
    var per = parseInt(el.perPage.value, 10) || 10;
    var pages = Math.max(1, Math.ceil(list.length / per));
    state.page = Math.min(Math.max(1, state.page), pages);

    var slice = list.slice((state.page - 1) * per, state.page * per);
    if (!slice.length) {
      setMessage(state.docs.length
        ? "No documents match your search. Clear the search or category to see all documents."
        : "No documents have been published yet.");
      return;
    }
    el.list.innerHTML = slice.map(function (d) { return d._group ? groupRow(d) : singleRow(d); }).join("");
    el.pager.innerHTML = pagerHTML(state.page, pages);
  }

  /* ---------- events ---------- */
  var timer;
  el.search.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.page = 1; render(); }, 200);
  });
  [el.sort, el.category, el.perPage].forEach(function (s) {
    s.addEventListener("change", function () { state.page = 1; render(); });
  });

  el.pager.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]");
    if (!b || b.disabled) return;
    state.page = parseInt(b.getAttribute("data-p"), 10);
    render();
    root.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  el.list.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-toggle]");
    if (!b) return;
    var k = b.getAttribute("data-toggle");
    state.open[k] = !state.open[k];
    render();
    var again = el.list.querySelector('button[data-toggle="' + k + '"]');
    if (again) again.focus();
  });

  load();
})();
