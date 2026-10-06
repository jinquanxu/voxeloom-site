/*
 * The gift ideas page: the colour chips show one group of tiles at a time,
 * and a tile opens its idea in full in a dialog.
 *
 * The ideas themselves are in the page, in full, below the tiles. The page
 * hides them the moment it knows a script is running (the "gift-js" class);
 * if this script then finds no dialog support it shows them again, so a
 * tile's link still goes somewhere -- straight down to its idea.
 */
(function () {
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
    box.showModal();
    box.scrollTop = 0;
    return true;
  }

  document.querySelectorAll('.gift-tiles a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href').slice(1);
      if (open(id)) {
        e.preventDefault();
        // The address names the idea, so it can be sent to someone.
        history.replaceState(null, '', '#' + id);
      }
    });
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
  if (GROUPS.test(hash)) {
    show(hash);
    document.getElementById('ideas').scrollIntoView();
  } else if (hash) {
    open(hash);
  }
})();
