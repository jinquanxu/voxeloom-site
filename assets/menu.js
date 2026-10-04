/*
 * The site's menu on a phone or a tablet.
 *
 * Below 861px the header has room for the wordmark, the price button and not
 * much else, so the other links -- the gallery, gift ideas, prices, the studio
 * -- fold into one button that opens them all. The links themselves stay
 * where they are in the page; this only adds the button and opens and closes
 * the list. Without script nothing folds, and the header behaves as it
 * always has.
 */
(function () {
  var header = document.querySelector('header.site');
  var nav = header && header.querySelector('nav.site');
  if (!nav || header.querySelector('.menu-toggle')) return;

  if (!nav.id) nav.id = 'site-nav';
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-toggle';
  button.setAttribute('aria-controls', nav.id);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Menu');
  button.innerHTML = '<span></span><span></span><span></span>';
  nav.parentNode.insertBefore(button, nav.nextSibling);
  document.documentElement.classList.add('has-menu');

  function set(open) {
    header.classList.toggle('menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close the menu' : 'Menu');
  }

  button.addEventListener('click', function () {
    set(!header.classList.contains('menu-open'));
  });
  // Choosing a link, pressing Escape or tapping anywhere else closes it.
  nav.addEventListener('click', function (event) {
    if (event.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) {
      set(false);
      button.focus();
    }
  });
  document.addEventListener('click', function (event) {
    if (!header.contains(event.target)) set(false);
  });
  // Turning a tablet to landscape can put the full header back.
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) set(false);
  });
})();
