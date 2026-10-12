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

  // The gallery page sorts its cards by the kind of place, in this order.
  var KINDS = ["Homes", "Lighthouses", "Churches", "Landmarks", "Farms & country"];

  fetch('/data/samples.json').then(function (r) { return r.json(); }).then(function (all) {
    var shown = featured ? all.slice(0, 3) : all;
    target.innerHTML = shown.map(function (s, i) {
      return '<figure class="card" data-kind="' + key(s.kind || '') + '" style="margin:0">'
        + '<a href="/gallery/' + s.slug + '/">'
        + '<img class="shot" loading="' + (i < 2 && !featured ? 'eager' : 'lazy') + '"'
        + ' data-slug="' + s.slug + '" data-turn="0" src="' + s.shots[0] + '"'
        + ' alt="A brick model: ' + esc(s.summary.slice(0, 120)) + '"></a>'
        + turner(s)
        + '<figcaption>'
        + '<div class="card-head"><h3><a href="/gallery/' + s.slug + '/">' + esc(s.name) + '</a></h3>'
        + '<span class="size muted">' + s.width + ' × ' + s.depth + ' studs · ' + s.courses + ' courses</span></div>'
        + sizes(s)
        + '<div class="blurb small muted"><p>' + esc(s.summary) + '</p>'
        + '<button class="more" type="button" aria-expanded="false">more …</button></div>'
        + '<div class="actions">'
        + '<a class="btn small primary" href="/gallery/' + s.slug + '/">Open it</a>'
        + '</div></figcaption></figure>';
    }).join('');

    // Each card's summary is held to five lines, so the cards line up and
    // "Open it" sits at the same height on every one. Where the summary runs
    // longer it ends in "more …", and the rest opens over the card while the
    // pointer rests there -- or on a tap, on a phone, or Enter, from the
    // keyboard. The whole summary is in the page all along, for a screen
    // reader and for search.
    target.querySelectorAll('.blurb').forEach(blurb);
    trim();
    if (document.fonts) document.fonts.ready.then(trim);
    window.addEventListener('resize', trim);

    // Turning a card: the arrows step round it, a dot goes straight to that
    // side, and the dot for the side showing is filled. They sit right under
    // the picture, so the picture turning is always in sight of the hand
    // turning it. The other sides are fetched the first time a hand comes
    // near, so the first turn does not wait.
    target.querySelectorAll('.turner').forEach(function (bar) {
      var img = bar.closest('figure').querySelector('img');
      var s = shown.filter(function (x) { return x.slug === img.dataset.slug; })[0];
      var fetched = false;
      function ready() {
        if (fetched) return;
        fetched = true;
        preload(s.shots, function () {});
      }
      bar.addEventListener('pointerenter', ready);
      bar.addEventListener('focusin', ready);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var n = s.shots.length;
        var at = b.dataset.at !== undefined ? Number(b.dataset.at)
          : (Number(img.dataset.turn) + Number(b.dataset.step) + n) % n;
        img.dataset.turn = String(at);
        img.src = s.shots[at];
        bar.querySelectorAll('.dot').forEach(function (d, k) {
          if (k === at) d.setAttribute('aria-current', 'true');
          else d.removeAttribute('aria-current');
        });
      });
    });

    if (!featured) sorter(all);

    var turners = calm || !featured ? [] : shown.filter(function (s) {
      return AUTOTURN.indexOf(s.slug) >= 0
        && target.querySelector('img[data-slug="' + s.slug + '"]');
    });

    turners.forEach(function (s) {
      var bar = target
        .querySelector('img[data-slug="' + s.slug + '"]')
        .closest('figure').querySelector('.turner');
      if (bar) bar.parentNode.removeChild(bar);
    });

    // Every angle of every card is fetched before any of them turns. Waiting
    // for all of them, rather than starting each as it is ready, is what
    // makes the stagger hold: otherwise three preloads finishing at three
    // different moments would set the offsets, and could land together.
    //
    // And none is fetched until the cards come near the screen: on a phone
    // they are a dozen screens down the front page, and every angle of three
    // models is the better part of a megabyte the first view does not need.
    whenNear(target, function () {
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
    });
  }).catch(function () {
    target.innerHTML = '<p class="muted">The gallery could not be loaded just now.</p>';
  });

  // A design that comes in more than one size says so under its name, where
  // it is seen before the summary, and links the other sizes; the page
  // itself has a card for each.
  function sizes(s) {
    if (!s.sizes) return '';
    var count = ['', '', 'Two', 'Three'][s.sizes.length] || String(s.sizes.length);
    return '<p class="small"><span class="badge gold">' + count + ' sizes</span> '
      + s.sizes.map(function (x) {
        return x.slug === s.slug
          ? '<strong>' + esc(x.size) + '</strong>'
          : '<a href="/gallery/' + x.slug + '/">' + esc(x.size) + '</a>';
      }).join(' · ') + '</p>';
  }

  // "more …" shows only on a summary the five lines cut short. A card the
  // kind buttons have hidden has no size to measure, so it is measured again
  // when it is shown.
  function trim() {
    target.querySelectorAll('.blurb').forEach(function (box) {
      var p = box.querySelector('p');
      if (!p.clientHeight || box.classList.contains('open')) return;
      box.classList.toggle('cut', p.scrollHeight > p.clientHeight + 1);
    });
  }

  function blurb(box) {
    var more = box.querySelector('.more');
    var resting = false;              // the mouse is on it, and opened it
    function set(open) {
      box.classList.toggle('open', open);
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    more.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      resting = true;
      set(true);
    });
    box.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      resting = false;
      set(false);
    });
    // A tap or Enter opens and closes it; a click while the mouse rests on
    // it leaves it open rather than shutting what the hover just opened.
    more.addEventListener('click', function () {
      if (!resting) set(!box.classList.contains('open'));
    });
    document.addEventListener('click', function (e) {
      if (resting || !box.classList.contains('open')) return;
      if (e.target !== more) set(false);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) { set(false); more.focus(); }
    });
    box.addEventListener('focusout', function (e) {
      if (!resting && !box.contains(e.relatedTarget)) set(false);
    });
  }

  // The sides of a model, in the order its pictures are drawn.
  var SIDES = ['Front', 'Right side', 'Back', 'Left side'];
  var LEFT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" '
    + 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" '
    + 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function turner(s) {
    if (!s.shots || s.shots.length < 2) return '';
    return '<div class="turner" role="group" aria-label="Turn ' + esc(s.name) + ' around">'
      + '<button class="arrow" type="button" data-step="-1" aria-label="Previous side">' + LEFT + '</button>'
      + s.shots.map(function (_, k) {
        return '<button class="dot" type="button" data-at="' + k + '" aria-label="'
          + (SIDES[k] || 'Side ' + (k + 1)) + '"' + (k === 0 ? ' aria-current="true"' : '') + '></button>';
      }).join('')
      + '<button class="arrow" type="button" data-step="1" aria-label="Next side">' + RIGHT + '</button>'
      + '</div>';
  }

  // A row of buttons over the gallery's cards: All, and each kind of place
  // with how many there are. The address keeps the choice (#lighthouses), so
  // it can be sent to someone and survives going back.
  function sorter(all) {
    var kinds = KINDS.filter(function (k) { return all.some(function (s) { return s.kind === k; }); });
    if (kinds.length < 2) return;
    var choices = [['', 'All', all.length]].concat(kinds.map(function (k) {
      return [key(k), k, all.filter(function (s) { return s.kind === k; }).length];
    }));
    var bar = document.createElement('div');
    bar.className = 'kinds';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Show sets');
    bar.innerHTML = choices.map(function (c) {
      return '<button type="button" class="btn small" data-kind="' + c[0] + '">'
        + esc(c[1]) + ' <span class="count">' + c[2] + '</span></button>';
    }).join('');
    target.parentNode.insertBefore(bar, target);

    function show(k) {
      if (!choices.some(function (c) { return c[0] === k; })) k = '';
      bar.querySelectorAll('button').forEach(function (b) {
        var on = b.dataset.kind === k;
        b.classList.toggle('primary', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      target.querySelectorAll('figure.card').forEach(function (f) {
        f.style.display = k && f.dataset.kind !== k ? 'none' : '';
      });
      trim();
    }

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      show(b.dataset.kind);
      history.replaceState(null, '', b.dataset.kind ? '#' + b.dataset.kind : location.pathname + location.search);
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
    show(location.hash.slice(1));
  }

  function key(kind) {
    return kind.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  }

  function whenNear(node, go) {
    if (!('IntersectionObserver' in window)) return go();
    var watch = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      watch.disconnect();
      go();
    }, { rootMargin: '600px 0px' });
    watch.observe(node);
  }

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
