/* Builds assets/search-index.json from every .html page in the site.
   Run from the site's root folder:   node tools/build-search-index.js
   Run it again whenever you add or change pages.

   Skipped: the assets, tools and node_modules folders, search.html, 404.html,
   pages with <meta name="robots" content="noindex">, and anything marked data-search-ignore.
   Only the main content is indexed (header, menu, footer, forms and buttons are left out). */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');          // npm install cheerio

const ROOT = path.resolve(process.argv[2] || '.');
const OUTPUT = path.join(ROOT, 'assets', 'search-index.json');
const SKIP_DIRS = new Set(['node_modules', 'assets', 'tools', '.git']);
const SKIP_FILES = new Set(['search.html', '404.html']);
const MAX_CONTENT = 20000;                   // most characters kept from one page

function findPages(dir, found) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) findPages(full, found);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html') && !SKIP_FILES.has(entry.name)) {
      found.push(full);
    }
  });
  return found;
}

function tidy(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const pages = [];

findPages(ROOT, []).forEach(function (file) {
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));

  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  if (robots.indexOf('noindex') !== -1) return;

  const relative = path.relative(ROOT, file).split(path.sep).join('/');

  // Leave out parts that repeat on every page or are not content
  $('script, style, noscript, template, header, nav, footer, form, button, select, [aria-hidden="true"], [data-search-ignore]').remove();

  const scope = $('main').first().length ? $('main').first() : $('body');

  const title = tidy($('title').first().text()) || tidy(scope.find('h1').first().text()) || relative;
  const description = tidy($('meta[name="description"]').attr('content') || '');
  const headings = scope.find('h1, h2, h3').map(function () { return tidy($(this).text()); }).get().join(' | ');
  const content = tidy(scope.text()).slice(0, MAX_CONTENT);

  pages.push({ url: relative, title: title, description: description, headings: headings, content: content });
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(pages));
console.log('Indexed ' + pages.length + ' page(s) into ' + path.relative(process.cwd(), OUTPUT) +
            ' (' + Math.round(fs.statSync(OUTPUT).size / 1024) + ' KB)');
pages.forEach(function (p) { console.log('  ' + p.url + '  -  ' + p.title); });
