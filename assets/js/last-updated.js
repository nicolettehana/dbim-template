/* Fills the footer's "Last Updated On" date from the server's Last-Modified header.
   If the header is missing or the request fails, the date typed in the HTML stays. */
(function () {
  var el = document.getElementById('last-updated');
  if (!el || !window.fetch) return;

  fetch(window.location.href, { method: 'HEAD', cache: 'no-cache' })
    .then(function (response) {
      var header = response.headers.get('Last-Modified');
      if (!header) return;                       // server sent no date: keep the typed one
      var d = new Date(header);
      if (isNaN(d.getTime())) return;

      var dd = String(d.getDate()).padStart(2, '0');
      var mm = String(d.getMonth() + 1).padStart(2, '0');
      var yyyy = d.getFullYear();

      el.textContent = dd + '.' + mm + '.' + yyyy;           // 06.10.2026
      el.setAttribute('datetime', yyyy + '-' + mm + '-' + dd);
    })
    .catch(function () { /* keep the typed date */ });
})();
