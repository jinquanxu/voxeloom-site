/*
 * The static gallery.
 *
 * The live site asks the server what designs exist; here the answer was
 * settled when the site was built, so it is a file. Same markup either way,
 * which is why the cards look identical.
 */
(function () {
  var target = document.getElementById('samples');
  if (!target) return;
  var featured = target.closest('#gallery') !== null;

  fetch('/data/samples.json').then(function (r) { return r.json(); }).then(function (all) {
    var shown = featured ? all.slice(0, 3) : all;
    target.innerHTML = shown.map(function (s, i) {
      return '<figure class="card" style="margin:0">'
        + '<a href="/gallery/' + s.slug + '/">'
        + '<img class="shot" loading="' + (i < 2 ? 'eager' : 'lazy') + '"'
        + ' data-slug="' + s.slug + '" data-turn="0" src="' + s.shots[0] + '"'
        + ' alt="A brick model: ' + esc(s.summary.slice(0, 120)) + '"></a>'
        + '<figcaption>'
        + '<h3 style="margin:16px 0 4px"><a href="/gallery/' + s.slug + '/">' + esc(s.name) + '</a></h3>'
        + '<p class="small muted">' + esc(s.summary) + '</p>'
        + '<p class="small muted">' + s.width + ' × ' + s.depth + ' studs · ' + s.courses + ' courses</p>'
        + '<div class="actions" style="margin-top:14px">'
        + '<a class="btn small primary" href="/gallery/' + s.slug + '/">Open it</a>'
        + '<button class="btn small turn" type="button">Turn it around</button>'
        + '</div></figcaption></figure>';
    }).join('');

    target.querySelectorAll('.turn').forEach(function (button) {
      button.addEventListener('click', function () {
        var img = button.closest('figure').querySelector('img');
        var s = shown.filter(function (x) { return x.slug === img.dataset.slug; })[0];
        var turn = (Number(img.dataset.turn) + 1) % s.shots.length;
        img.dataset.turn = String(turn);
        img.src = s.shots[turn];
      });
    });
  }).catch(function () {
    target.innerHTML = '<p class="muted">The gallery could not be loaded just now.</p>';
  });

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
