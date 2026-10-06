/*
 * The gift ideas page: the colour chips show one group of tiles at a time,
 * any link to an idea opens it in full in a dialog, and the days that move
 * each year say when they next fall.
 *
 * The ideas themselves are in the page, in full, below the tiles. The page
 * hides them the moment it knows a script is running (the "gift-js" class);
 * if this script then finds no dialog support it shows them again, so a
 * link to an idea still goes somewhere -- straight down to it.
 */
(function () {
  // ---- the days that matter: the next date, worked out on the day --------

  function nthWeekday(year, month, weekday, n) {
    var first = new Date(year, month, 1);
    var offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + 7 * (n - 1));
  }
  var DAYS = {
    valentine: function (y) { return new Date(y, 1, 14); },
    mother: function (y) { return nthWeekday(y, 4, 0, 2); },        // second Sunday in May
    father: function (y) { return nthWeekday(y, 5, 0, 3); },        // third Sunday in June
    grandparents: function (y) {                                    // the Sunday after Labor Day
      var labor = nthWeekday(y, 8, 1, 1);
      return new Date(y, 8, labor.getDate() + 6);
    },
  };
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  document.querySelectorAll('[data-day]').forEach(function (el) {
    var day = el.getAttribute('data-day');
    if (day === 'christmas') {
      // The owner's date for Christmas is 20 November; after it, the day itself.
      var askBy = new Date(today.getFullYear(), 10, 20);
      el.textContent = today <= askBy || today.getMonth() < 10 ? 'Ask by 20 November' : '25 December';
      return;
    }
    if (!DAYS[day]) return;
    var next = DAYS[day](today.getFullYear());
    if (next < today) next = DAYS[day](today.getFullYear() + 1);
    el.textContent = next.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  });

  // ---- the chooser and the dialog -----------------------------------------

  var root = document.documentElement;
  var box = document.getElementById('giftDialog');
  if (!box || typeof box.showModal !== 'function') {
    root.classList.remove('gift-js');
    return;
  }
  var body = box.querySelector('.gift-dialog-body');
  var tiles = document.querySelectorAll('.gift-tiles li');
  var chips = document.querySelectorAll('.gift-filter button');
  var GROUPS = /^(family|partners|milestones|thanks|remembrance)$/;

  function show(group) {
    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', String(chip.dataset.group === group));
    });
    tiles.forEach(function (tile) {
      tile.hidden = group !== 'all' && tile.dataset.group !== group;
    });
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { show(chip.dataset.group); });
  });

  // The idea's own words, copied into the dialog, in its group's colour.
  function open(id) {
    var idea = document.getElementById(id);
    if (!idea || !idea.classList.contains('gift-detail')) return false;
    body.innerHTML = idea.innerHTML;
    var hue = (idea.className.match(/hue-[a-z]+/) || [''])[0];
    box.className = 'gift-dialog gift-group ' + hue;
    var title = body.querySelector('h3');
    box.setAttribute('aria-label', title ? title.textContent : 'Gift idea');
    body.querySelectorAll('img').forEach(function (img) { img.loading = 'eager'; });
    if (!box.open) box.showModal();
    box.scrollTop = 0;
    return true;
  }

  // Where an address in the page leads: an idea opens, a group filters the
  // tiles, and the chooser itself shows them all.
  function go(id, how) {
    if (GROUPS.test(id) || id === 'ideas') {
      show(id === 'ideas' ? 'all' : id);
      document.getElementById('ideas').scrollIntoView({ behavior: how });
      return true;
    }
    return open(id);
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || link.closest('.gift-dialog')) return;
    var id = link.getAttribute('href').slice(1);
    if (id && go(id, 'smooth')) {
      e.preventDefault();
      // An idea's address can be sent to someone; a group's is just a view.
      history.replaceState(null, '', id.indexOf('for-') === 0 ? '#' + id : location.pathname + location.search);
    }
  });

  box.addEventListener('close', function () {
    history.replaceState(null, '', location.pathname + location.search);
  });
  // A click on the dimmed backdrop, outside the dialog's box, closes it.
  box.addEventListener('click', function (e) {
    if (e.target !== box) return;
    var r = box.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box.open) box.close();
  });

  // Arriving with an address: /gift-ideas/#partners shows that group,
  // /gift-ideas/#for-newlyweds opens that idea.
  var hash = location.hash.slice(1);
  if (hash) go(hash, 'auto');
})();
