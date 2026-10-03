/*
 * The design studio, replayed: designs we made from photographs, shown the
 * way the studio makes one.
 *
 * The site has no server, so nothing is designed here. What is shown is
 * true all the same: the photographs a design was made from, the design as
 * cubes, the LEGO model with its piece count and estimate, in the order the
 * studio reaches them and under the stage names it reports. The page says
 * plainly that it is a replay.
 *
 * One example at a time: picking another stops the replay that is running.
 * "Skip to the end" stops it too, and leaves everything finished.
 */
import { HeirloomView, VoxelView, pixelate, reducedMotion, wait } from '/assets/journey.js?v=dc3d97d4e8';

const el = (id) => document.getElementById(id);
const examples = JSON.parse(el('examplesData').textContent);

// The live studio's stages (DesignPipeline.kt), in its words.
const STAGES = [
  ['READING', 'Reading your brief'],
  ['DESIGNING', 'Laying out the model'],
  ['BUILDING', 'Turning it into bricks'],
  ['CHECKING', 'Checking how it looks'],
  ['WRITING', 'Writing the instructions'],
];

const CAPTIONS = {
  pixel: '<strong class="vox">Pixel.</strong> The photographs, read as colour and shape, in the colours of the bricks.',
  voxel: '<strong class="vox">Voxel.</strong> The design as a grid of cubes, each a stud wide and a brick high. Drag to turn it.',
  heirloom: '<strong class="loom">Heirloom.</strong> Every cube made from real LEGO pieces. Turn it, light it, peel it open.',
};

const state = {
  example: null,      // the JSON of the one shown
  photo: null,        // its first photograph, loaded
  view: 'pixel',
  reached: new Set(),
  voxels: null,       // the VoxelView, or null when the browser cannot draw it
  heirloom: new HeirloomView(el('heirloom'), {
    slider: 'layer', label: 'layerLabel', night: 'night', turns: '#heirloomTools [data-turn]',
  }),
  run: null,          // the AbortController of the replay that is running
};

try {
  state.voxels = new VoxelView(el('voxels'));
} catch (error) {
  // No WebGL 2: the picture of the cubes stands in for them.
  el('voxels').hidden = true;
  el('voxelStill').hidden = false;
}

/* ---------------- picking an example ---------------- */

function drawExamples() {
  el('examples').innerHTML = examples.map((x) =>
    '<button type="button" class="choice" data-slug="' + x.slug + '" aria-pressed="false">'
    + '<img src="' + x.thumb + '" alt="" width="96" height="96">'
    + '<span><strong>' + x.name + '</strong>' + x.where + '</span></button>').join('')
    + '<a class="choice" href="' + el('examples').dataset.own + '">'
    + '<span class="own" aria-hidden="true">+</span>'
    + '<span><strong>Your own place</strong>' + el('examples').dataset.ownText + '</span></a>';
  el('examples').querySelectorAll('button.choice').forEach((b) =>
    b.addEventListener('click', () => choose(b.dataset.slug)));
}

async function choose(slug) {
  if (state.run) state.run.abort();
  state.run = null;
  el('examples').querySelectorAll('button.choice').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.slug === slug)));
  if (history.replaceState) history.replaceState(null, '', '#' + slug);

  const example = await fetch('/data/studio/' + slug + '.json').then((r) => r.json());
  state.example = example;
  el('briefName').textContent = example.name;
  el('briefText').textContent = '“' + example.brief + '”';
  el('briefSize').textContent = example.facts.studs + ' studs';
  el('briefPhotos').innerHTML = example.photos.length
    ? example.photos.map((p) => '<figure><img src="' + p.src + '" alt="A photograph of ' + example.name + '">'
        + (p.credit ? '<figcaption>' + p.credit + '</figcaption>' : '') + '</figure>').join('')
    : '<p class="small muted">Photographs to come.</p>';
  el('go').textContent = 'Design it';
  state.photo = await load(example.photos.length ? example.photos[0].src : example.shots.turn[0]);
  el('voxelStill').src = example.voxelStill;
  if (state.voxels) state.voxels.load(example.voxels);
  state.heirloom.set(example.shots, example.courses);
  reset();
}

/** Back to the brief: the photograph as it is, nothing reached yet. */
function reset() {
  if (state.run) state.run.abort();
  state.run = null;
  state.mosaicLater = false;
  state.reached = new Set();
  el('result').hidden = true;
  el('go').hidden = false;
  el('skip').hidden = true;
  drawProgress(-1);
  show('pixel', true);
  drawPhoto();
}

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The photograph as it is, before anything has read it. */
function drawPhoto() {
  const canvas = el('pixel');
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  const ctx = canvas.getContext('2d');
  const img = state.photo;
  const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  ctx.drawImage(img, (canvas.width - img.naturalWidth * s) / 2, (canvas.height - img.naturalHeight * s) / 2,
    img.naturalWidth * s, img.naturalHeight * s);
}

/* ---------------- the three pictures ---------------- */

function show(view, force) {
  if (!force && !state.reached.has(view)) return;
  state.view = view;
  document.querySelectorAll('.pvh-steps button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
    b.disabled = !state.reached.has(b.dataset.view) && b.dataset.view !== view;
  });
  el('pixel').hidden = view !== 'pixel';
  el('standIn').hidden = view !== 'pixel' || state.example.photos.length > 0;
  el('voxelBox').hidden = view !== 'voxel';
  el('heirloom').hidden = view !== 'heirloom';
  el('heirloomTools').hidden = view !== 'heirloom';
  el('caption').innerHTML = CAPTIONS[view];
  // Skipped to the end while the photograph was out of sight: the mosaic
  // is drawn now it can be measured.
  if (view === 'pixel' && state.mosaicLater) {
    state.mosaicLater = false;
    pixelate(el('pixel'), state.photo, state.example.voxels.palette, { duration: 0 });
  }
  if (state.voxels) {
    if (view === 'voxel') state.voxels.start();
    else state.voxels.stop();
  }
}

document.querySelectorAll('.pvh-steps button').forEach((b) =>
  b.addEventListener('click', () => show(b.dataset.view)));

/* ---------------- the replay ---------------- */

function drawProgress(at, doneAll) {
  el('progress').innerHTML = STAGES.map(([, label], i) => {
    const cls = doneAll || i < at ? 'done' : i === at ? 'live' : '';
    return '<div class="row ' + cls + '"><span class="dot"></span><span>' + label + '</span></div>';
  }).join('');
}

async function replay() {
  const run = new AbortController();
  state.run = run;
  const signal = run.signal;
  const example = state.example;
  el('go').hidden = true;
  el('skip').hidden = false;
  el('result').hidden = true;
  const slow = reducedMotion() ? 0.15 : 1;
  // On a phone the pictures are under the brief, out of sight of the button.
  if (window.innerWidth <= 860) {
    el('view').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  try {
    drawProgress(0);
    state.reached.add('pixel');
    show('pixel');
    await pixelate(el('pixel'), state.photo, example.voxels.palette, { duration: 3600 * slow, signal });

    drawProgress(1);
    state.reached.add('voxel');
    show('voxel');
    if (state.voxels) {
      const rising = state.voxels.rise(7500);
      await Promise.race([rising, wait(60000, signal)]);
      if (signal.aborted) throw new DOMException('stopped', 'AbortError');
    } else {
      await wait(2500 * slow, signal);
    }
    await wait(900 * slow, signal);

    drawProgress(2);
    state.reached.add('heirloom');
    show('heirloom');
    state.heirloom.turn(0);
    await wait(2400 * slow, signal);

    drawProgress(3);
    for (const k of [1, 2, 3, 0]) {
      state.heirloom.turn(k);
      await wait(1100 * slow, signal);
    }

    drawProgress(4);
    finishFacts(true);
    await wait(2300 * slow, signal);
    finish();
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
    if (state.run === run) finish();
  }
}

/** Everything as the replay leaves it, at once. */
function finish() {
  const example = state.example;
  if (state.run) state.run.abort();
  state.run = null;
  ['pixel', 'voxel', 'heirloom'].forEach((v) => state.reached.add(v));
  drawProgress(STAGES.length, true);
  if (el('pixel').hidden) state.mosaicLater = true;
  else pixelate(el('pixel'), state.photo, example.voxels.palette, { duration: 0 });
  if (state.voxels) state.voxels.finish();
  show('heirloom');
  state.heirloom.turn(0);
  finishFacts(false);
  el('skip').hidden = true;
  el('go').hidden = false;
  el('go').textContent = 'Watch it again';
}

function finishFacts(countUp) {
  const f = state.example.facts;
  el('resultName').textContent = state.example.name;
  el('factSize').textContent = f.studs + ' studs · ' + f.base + ' base, ' + f.height + ' tall';
  el('factPrice').textContent = f.estimate;
  el('factFrom').textContent = f.from;
  el('openDesign').href = state.example.gallery;
  el('askPrice').href = state.example.ask;
  el('sizesNote').innerHTML = state.example.sizes || '';
  el('sizesNote').hidden = !state.example.sizes;
  el('result').hidden = false;
  const pieces = el('factPieces');
  if (!countUp || reducedMotion()) { pieces.textContent = f.pieces.toLocaleString('en-US'); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 1800);
    pieces.textContent = Math.round(f.pieces * t * (2 - t)).toLocaleString('en-US');
    if (t < 1 && !el('result').hidden) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

el('go').addEventListener('click', () => {
  if (!state.example) return;
  reset();
  replay();
});
el('skip').addEventListener('click', finish);

drawExamples();
const first = examples.find((x) => '#' + x.slug === location.hash) || examples[0];
choose(first.slug);
