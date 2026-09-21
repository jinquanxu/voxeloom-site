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

  // The homepage cards turn by themselves, a quarter every TURN_MS -- but
  // never on the same tick as each other. Three cards flipping together
  // reads as a page twitching; the same three spread evenly through the
  // interval read as models being shown, one after another.
  //
  // Homepage only. This file also draws the gallery page, where seven cards
  // all turning would be a fairground.
  var AUTOTURN = ['rhode-island-state-house', 'beavertail-light', 'the-towers'];
  var TURN_MS = 800;

  // Somebody who has asked their system for less movement keeps the button.
  var calm = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    var turners = calm || !featured ? [] : shown.filter(function (s) {
      return AUTOTURN.indexOf(s.slug) >= 0
        && target.querySelector('img[data-slug="' + s.slug + '"]');
    });

    turners.forEach(function (s) {
      var button = target
        .querySelector('img[data-slug="' + s.slug + '"]')
        .closest('figure').querySelector('.turn');
      if (button) button.parentNode.removeChild(button);
    });

    // Every angle of every card is fetched before any of them turns. Waiting
    // for all of them, rather than starting each as it is ready, is what
    // makes the stagger hold: otherwise three preloads finishing at three
    // different moments would set the offsets, and could land together.
    var ready = 0;
    turners.forEach(function (s) {
      preload(s.shots, function () {
        if (++ready < turners.length) return;
        turners.forEach(function (card, i) {
          var img = target.querySelector('img[data-slug="' + card.slug + '"]');
          setTimeout(function () { spin(img, card.shots); },
                     Math.round(i * TURN_MS / turners.length));
        });
      });
    });
  }).catch(function () {
    target.innerHTML = '<p class="muted">The gallery could not be loaded just now.</p>';
  });

  function preload(urls, done) {
    var left = urls.length;
    urls.forEach(function (url) {
      var im = new Image();
      im.onload = im.onerror = function () { if (--left === 0) done(); };
      im.src = url;
    });
  }

  function spin(img, shots) {
    var at = 0;
    setInterval(function () {
      // A card in a background tab turns for nobody.
      if (document.hidden) return;
      at = (at + 1) % shots.length;
      img.dataset.turn = String(at);
      img.src = shots[at];
    }, TURN_MS);
  }

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
