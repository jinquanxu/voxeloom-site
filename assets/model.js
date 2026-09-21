/*
 * One model, from pictures drawn when the site was built.
 *
 * The live page asks the server for any view it likes. Here the views that
 * exist are the ones in `shots`, so turning resets the slider rather than
 * asking for a picture nobody rendered.
 */
(function () {
  var el = function (id) { return document.getElementById(id); };
  var img = el('render');
  var slider = el('layer');
  var state = { turn: 0, lights: false, peel: courses.length - 1, assembly: false };

  function show() {
    if (state.assembly && assembly) img.src = assembly;
    else if (state.lights) img.src = shots.night;
    else if (state.peel < courses.length - 1) img.src = shots.peel[state.peel];
    else img.src = shots.turn[state.turn];

    el('layerLabel').textContent = state.peel === courses.length - 1
      ? 'All ' + courses[courses.length - 1] + ' courses'
      : 'Up to course ' + courses[state.peel] + ' of ' + courses[courses.length - 1];
  }

  var watch = el('assembly');
  if (watch) {
    watch.addEventListener('click', function () {
      state.assembly = !state.assembly;
      watch.textContent = state.assembly ? 'Show the model' : 'Watch it built';
      watch.setAttribute('aria-pressed', String(state.assembly));
      show();
    });
  }

  function stopWatching() {
    state.assembly = false;
    if (watch) {
      watch.textContent = 'Watch it built';
      watch.setAttribute('aria-pressed', 'false');
    }
  }

  document.querySelectorAll('[data-turn]').forEach(function (button) {
    button.addEventListener('click', function () {
      stopWatching();
      state.turn = Number(button.dataset.turn);
      state.lights = false;
      state.peel = courses.length - 1;
      slider.value = String(state.peel);
      el('night').setAttribute('aria-pressed', 'false');
      el('night').textContent = 'Lights on';
      document.querySelectorAll('[data-turn]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === button));
      });
      show();
    });
  });

  el('night').addEventListener('click', function () {
    stopWatching();
    state.lights = !state.lights;
    el('night').textContent = state.lights ? 'Lights off' : 'Lights on';
    el('night').setAttribute('aria-pressed', String(state.lights));
    show();
  });

  slider.addEventListener('input', function () {
    stopWatching();
    state.peel = Number(slider.value);
    state.lights = false;
    state.turn = 0;
    el('night').setAttribute('aria-pressed', 'false');
    el('night').textContent = 'Lights on';
    document.querySelectorAll('[data-turn]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.turn === '0'));
    });
    show();
  });

  document.querySelectorAll('[data-tab]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === button));
      });
      el('tabParts').hidden = button.dataset.tab !== 'parts';
      el('tabLights').hidden = button.dataset.tab !== 'lights';
    });
  });
})();
