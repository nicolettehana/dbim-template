/* Search results page. Reads ?q=... , loads the search index and lists matching pages.
   The index is built by tools/build-search-index.js. */
(function () {
  var PER_PAGE = 10;

  var results = document.getElementById('search-results');
  var status = document.getElementById('search-status');
  var input = document.getElementById('search-input');
  var moreButton = document.getElementById('search-more');
  if (!results || !status) return;

  var indexUrl = results.getAttribute('data-index') || 'assets/search-index.json';
  var query = (new URLSearchParams(window.location.search).get('q') || '').trim();
  var baseTitle = document.title;
  var shown = 0;
  var matches = [];
  var terms = [];

  if (input) input.value = query;

  /* ----- helpers ----- */
  function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function countOf(haystack, needle, cap) {
    var count = 0, at = haystack.indexOf(needle);
    while (at !== -1 && count < cap) { count++; at = haystack.indexOf(needle, at + needle.length); }
    return count;
  }

  // Wraps matching words in <mark>, building DOM nodes (never innerHTML)
  function highlight(text, node) {
    var pattern = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
    text.split(pattern).forEach(function (part, i) {
      if (i % 2 === 1) {
        var mark = document.createElement('mark');
        mark.textContent = part;
        node.appendChild(mark);
      } else if (part) {
        node.appendChild(document.createTextNode(part));
      }
    });
  }

  function snippet(page) {
    var content = page.content;
    var lower = page.contentLower;
    var at = -1;
    terms.forEach(function (term) {
      var found = lower.indexOf(term);
      if (found !== -1 && (at === -1 || found < at)) at = found;
    });
    if (at === -1) return page.description || content.slice(0, 160);
    var start = Math.max(0, at - 70);
    var end = Math.min(content.length, at + 150);
    return (start > 0 ? '… ' : '') + content.slice(start, end).trim() + (end < content.length ? ' …' : '');
  }

  /* ----- scoring: every word must appear somewhere on the page ----- */
  function score(page) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var inTitle = page.titleLower.indexOf(term) !== -1;
      var inHeadings = page.headingsLower.indexOf(term) !== -1;
      var inDescription = page.descriptionLower.indexOf(term) !== -1;
      var inBody = countOf(page.contentLower, term, 10);
      if (!inTitle && !inHeadings && !inDescription && !inBody) return 0;
      total += (inTitle ? 10 : 0) + (inHeadings ? 5 : 0) + (inDescription ? 3 : 0) + inBody;
    }
    if (terms.length > 1) {
      var phrase = query.toLowerCase();
      if (page.titleLower.indexOf(phrase) !== -1) total += 10;
      else if (page.contentLower.indexOf(phrase) !== -1) total += 5;
    }
    return total;
  }

  /* ----- showing results ----- */
  function renderMore() {
    var next = matches.slice(shown, shown + PER_PAGE);
    next.forEach(function (page) {
      var item = document.createElement('li');
      item.className = 'search-item';

      var heading = document.createElement('h2');
      heading.className = 'search-item-title';
      var link = document.createElement('a');
      link.href = page.url;
      highlight(page.title, link);
      heading.appendChild(link);

      var address = document.createElement('p');
      address.className = 'search-item-url';
      address.textContent = page.url;

      var text = document.createElement('p');
      text.className = 'search-item-text';
      highlight(snippet(page), text);

      item.appendChild(heading);
      item.appendChild(address);
      item.appendChild(text);
      results.appendChild(item);
    });
    shown += next.length;
    if (moreButton) moreButton.hidden = shown >= matches.length;
  }

  function say(message) { status.textContent = message; }

  /* ----- start ----- */
  if (query.length < 2) {
    say('Type at least two letters in the search box.');
    return;
  }

  terms = query.toLowerCase().split(/\s+/).filter(function (t, i, all) {
    return t && all.indexOf(t) === i;
  }).slice(0, 8);

  document.title = 'Search results for "' + query + '" | ' + baseTitle;
  say('Searching…');

  fetch(indexUrl)
    .then(function (response) {
      if (!response.ok) throw new Error('index not found');
      return response.json();
    })
    .then(function (pages) {
      pages.forEach(function (page) {
        page.titleLower = (page.title || '').toLowerCase();
        page.descriptionLower = (page.description || '').toLowerCase();
        page.headingsLower = (page.headings || '').toLowerCase();
        page.contentLower = (page.content || '').toLowerCase();
      });

      matches = pages
        .map(function (page) { return { page: page, score: score(page) }; })
        .filter(function (entry) { return entry.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (entry) { return entry.page; });

      if (!matches.length) {
        say('No results found for "' + query + '". Check the spelling or try different words.');
        return;
      }
      say(matches.length + (matches.length === 1 ? ' result' : ' results') + ' for "' + query + '"');
      renderMore();
    })
    .catch(function () {
      say('Search is not available right now. Please try again later.');
    });

  if (moreButton) {
    moreButton.addEventListener('click', function () {
      var before = shown;
      renderMore();
      var firstNew = results.children[before];
      if (firstNew) { var link = firstNew.querySelector('a'); if (link) link.focus(); }
    });
  }
})();
