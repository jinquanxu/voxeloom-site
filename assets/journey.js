/*
 * Pixel, voxel, heirloom: the three pictures of a design being made.
 *
 * The name says what the business does -- photographs (pixels) become a
 * place in cubes (voxels) become a LEGO set to keep (the heirloom) -- and
 * the studio shows exactly that, one picture after the other. This file is
 * those three pictures and nothing else, so the studio demo on the static
 * site and the live studio on the server draw them the same way.
 *
 *  - pixelate(): a photograph dissolving into a mosaic, in the colours of
 *    the set it becomes.
 *  - VoxelView: the design as cubes in 3D, rising a layer at a time, that
 *    turns by itself and can be dragged round. Plain WebGL 2: a few hundred
 *    lines here instead of a 3D library for the visitor to download.
 *  - HeirloomView: the finished model's pictures -- four turns, lights on,
 *    and the slider that peels it open.
 */

export const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wait = (ms, signal) => new Promise((resolve, reject) => {
  if (signal && signal.aborted) return reject(new DOMException('stopped', 'AbortError'));
  const timer = setTimeout(resolve, ms);
  if (signal) signal.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new DOMException('stopped', 'AbortError'));
  }, { once: true });
});

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** A canvas drawn at the size it is shown, in device pixels -- or left as it
 *  is while it is not shown at all, rather than shrunk to nothing. */
function fit(canvas) {
  if (!canvas.clientWidth) return [canvas.width, canvas.height];
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return [w, h];
}

/* ------------------------------------------------------------------ pixel */

/**
 * Draws `image` into `canvas`, then breaks it into ever larger squares until
 * it is `across` squares wide, and settles each square on the nearest of the
 * set's own colours with a stud on top: the photograph read as pixels, in
 * the bricks it is going to be made of. Resolves when the mosaic is down.
 */
export async function pixelate(canvas, image, palette, { across = 48, duration = 3200, signal } = {}) {
  const [w, h] = fit(canvas);
  const ctx = canvas.getContext('2d');
  // Cover the canvas, as a photograph fills a frame.
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const iw = image.naturalWidth * scale;
  const ih = image.naturalHeight * scale;
  const draw = () => ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);

  ctx.imageSmoothingEnabled = true;
  draw();
  const still = reducedMotion();
  if (!still) await wait(duration * 0.25, signal);

  const small = document.createElement('canvas');
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const target = w / across;
  const steps = still ? [target] : [target / 8, target / 4, target / 2, target];
  for (const block of steps) {
    const cols = Math.max(1, Math.round(w / Math.max(block, 1)));
    const rows = Math.max(1, Math.round(h / Math.max(block, 1)));
    small.width = cols;
    small.height = rows;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(canvas, 0, 0, w, h, 0, 0, cols, rows);
    if (block === target) {
      mosaic(ctx, sctx, cols, rows, w, h, palette.map(rgb));
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, cols, rows, 0, 0, w, h);
      await wait(duration * 0.75 / steps.length, signal);
    }
  }
}

function mosaic(ctx, sctx, cols, rows, w, h, colours) {
  const data = sctx.getImageData(0, 0, cols, rows).data;
  const cw = w / cols;
  const ch = h / rows;
  const gap = Math.max(1, Math.round(Math.min(cw, ch) * 0.06));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      // Nearest colour, weighted the way eyes weigh red, green and blue.
      let best = colours[0];
      let bestD = Infinity;
      for (const c of colours) {
        const dr = data[i] - c[0];
        const dg = data[i + 1] - c[1];
        const db = data[i + 2] - c[2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bestD) { bestD = d; best = c; }
      }
      const px = x * cw;
      const py = y * ch;
      // The seam between two pieces is the piece's own colour in shadow,
      // not a black grid laid over the picture.
      ctx.fillStyle = 'rgb(' + (best[0] * 0.62 | 0) + ',' + (best[1] * 0.62 | 0) + ',' + (best[2] * 0.62 | 0) + ')';
      ctx.fillRect(px, py, cw + 1, ch + 1);
      ctx.fillStyle = 'rgb(' + best[0] + ',' + best[1] + ',' + best[2] + ')';
      ctx.fillRect(px + gap, py + gap, cw - 2 * gap, ch - 2 * gap);
      // A stud: a lighter ring, as the light catches a round top.
      ctx.beginPath();
      ctx.arc(px + cw / 2, py + ch / 2, Math.min(cw, ch) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------------ voxel */

/** The packed cells, four bytes a cube: x, up, back, colour. */
export function decodeVoxels(base64) {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

const VERTEX = `#version 300 es
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_cell;
layout(location=3) in float a_height;
uniform mat4 u_viewProj;
uniform vec3 u_scale;
uniform vec3 u_centre;
uniform float u_level;
uniform vec3 u_palette[64];
out vec3 v_normal;
out vec3 v_colour;
out vec3 v_local;
void main() {
  // Layers below the level are down; the one at it is still falling in.
  float t = clamp(u_level - a_cell.y, 0.0, 1.0);
  if (t <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 cell = vec3(a_cell.x, a_cell.y + (1.0 - t) * 4.0, -a_cell.z);
  vec3 local = vec3(a_pos.x + 0.5, (a_pos.y + 0.5) * a_height, a_pos.z - 0.5);
  vec3 world = (cell + local) * u_scale - u_centre;
  gl_Position = u_viewProj * vec4(world, 1.0);
  v_normal = a_normal;
  v_colour = u_palette[int(a_cell.w)];
  v_local = a_pos;
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_normal;
in vec3 v_colour;
in vec3 v_local;
uniform vec3 u_light;
out vec4 colour;
void main() {
  vec3 n = normalize(v_normal);
  float light = 0.58 + 0.42 * max(dot(n, u_light), 0.0) + 0.06 * n.y;
  // Every cube keeps its edges: how far this point is from the nearest
  // edge of the face it is on, darkened in a thin band there.
  vec3 e = vec3(0.5) - abs(v_local) + step(0.5, abs(n));
  float edge = smoothstep(0.0, 0.06, min(e.x, min(e.y, e.z)));
  colour = vec4(v_colour * light * mix(0.7, 1.0, edge), 1.0);
}`;

function cube() {
  // Six faces, two triangles each, counter-clockwise from outside.
  const faces = [
    [[1, 0, 0], [[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]]],
    [[-1, 0, 0], [[-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-.5, -.5, -.5]]],
    [[0, 1, 0], [[-.5, .5, -.5], [-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5]]],
    [[0, -1, 0], [[-.5, -.5, .5], [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5]]],
    [[0, 0, 1], [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]]],
    [[0, 0, -1], [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]]],
  ];
  const out = [];
  for (const [n, q] of faces) {
    for (const k of [0, 1, 2, 0, 2, 3]) out.push(...q[k], ...n);
  }
  return new Float32Array(out);
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

function lookAt(eye, target, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
  }
  return out;
}

/**
 * The design as cubes, on one canvas for the life of the page: load() puts
 * a design on it, and another load() replaces it. A design is {size: [x, up,
 * back], palette: [hex], data: base64}, and may say how tall a unit of `up`
 * is against a stud's width (`unit`: 1.2 for a brick, the default, 0.4 for a
 * plate) and how many units each cube stands (`heights`, a byte each in
 * base64; one if not given) -- a design drawn in plates and bricks keeps its
 * courses their true heights.
 *
 * Throws if the browser cannot draw in WebGL 2, for the caller to show a
 * picture instead.
 */
export class VoxelView {
  constructor(canvas, { yaw = -22, pitch = 26, turn = true } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('This browser cannot draw the cubes in 3D.');
    this.canvas = canvas;
    this.gl = gl;
    this.count = 0;
    this.home = [yaw * Math.PI / 180, pitch * Math.PI / 180];
    this.turn = turn;
    this.running = false;

    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const box = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, box);
    gl.bufferData(gl.ARRAY_BUFFER, cube(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    this.cellBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, 4, 0);
    gl.vertexAttribDivisor(2, 1);
    this.heightBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.heightBuffer);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 1, 0);
    gl.vertexAttribDivisor(3, 1);

    gl.useProgram(program);
    const where = (name) => gl.getUniformLocation(program, name);
    this.u = {
      viewProj: where('u_viewProj'), scale: where('u_scale'), centre: where('u_centre'),
      level: where('u_level'), light: where('u_light'), palette: where('u_palette'),
    };
    const l = [-0.45, 0.8, 0.55];
    const ll = Math.hypot(...l);
    gl.uniform3fv(this.u.light, l.map((v) => v / ll));

    this.drag(canvas);
    this.frame = this.frame.bind(this);
  }

  /** Puts a design on the canvas, whole, seen from the front corner -- or,
   *  with `keepView`, from wherever it is being looked at: a new layout of
   *  the same design should not swing the camera round. */
  load(voxels, { keepView = false } = {}) {
    const gl = this.gl;
    this.stop();
    this.rising = null;
    this.size = voxels.size;
    const cells = decodeVoxels(voxels.data);
    this.count = cells.length / 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
    const heights = voxels.heights ? decodeVoxels(voxels.heights) : new Uint8Array(this.count).fill(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.heightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, heights, gl.STATIC_DRAW);
    gl.useProgram(this.program);
    this.scale = [1, voxels.unit || 1.2, 1];
    gl.uniform3fv(this.u.scale, this.scale);
    const palette = new Float32Array(64 * 3);
    voxels.palette.slice(0, 64).forEach((hex, i) => {
      rgb(hex).forEach((v, k) => { palette[i * 3 + k] = v / 255; });
    });
    gl.uniform3fv(this.u.palette, palette);
    const s = this.scale;
    gl.uniform3fv(this.u.centre, [this.size[0] / 2 * s[0], this.size[1] / 2 * s[1], -this.size[2] / 2 * s[2]]);
    this.radius = Math.hypot(this.size[0], this.size[1] * s[1], this.size[2]) / 2;
    if (!keepView) {
      [this.yaw, this.pitch] = this.home;
      this.turning = this.turn && !reducedMotion();
    }
    this.level = this.size[1] + 1;
    this.draw();
  }

  /** Drag to turn it; on a phone a sideways swipe turns it and an upward one still scrolls the page. */
  drag(canvas) {
    let from = null;
    canvas.addEventListener('pointerdown', (e) => {
      from = { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
      canvas.setPointerCapture(e.pointerId);
      this.turning = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!from) return;
      this.yaw -= (e.clientX - from.x) * 0.008;
      if (!from.touch) {
        this.pitch = Math.min(1.35, Math.max(0.08, this.pitch + (e.clientY - from.y) * 0.006));
      }
      from.x = e.clientX;
      from.y = e.clientY;
      this.draw();
    });
    const end = () => { from = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  draw() {
    if (!this.size || !this.canvas.clientWidth) return;
    const gl = this.gl;
    const [w, h] = fit(this.canvas);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    const fov = 0.62;
    // Far enough that the box round the model fits whichever way it is
    // turned; a little nearer than the sphere round it, which never fills.
    const distance = this.radius / Math.sin(fov / 2) * 0.9;
    const eye = [
      Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      Math.sin(this.pitch) * distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    ];
    const proj = perspective(fov, w / h, distance * 0.05, distance * 4);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.viewProj, false, multiply(proj, lookAt(eye, [0, 0, 0], [0, 1, 0])));
    gl.uniform1f(this.u.level, this.level);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.count);
  }

  frame(now) {
    if (!this.running) return;
    const dt = this.last ? Math.min(now - this.last, 100) : 16;
    this.last = now;
    if (this.turning && !document.hidden) this.yaw += dt * 0.00018;
    if (this.rising) {
      const t = Math.min(1, (now - this.rising.start) / this.rising.duration);
      this.level = t * (this.size[1] + 1);
      if (t >= 1) { const done = this.rising.done; this.rising = null; done(); }
    }
    this.draw();
    requestAnimationFrame(this.frame);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  stop() { this.running = false; }

  /**
   * Lays the cubes a layer at a time, from the ground up. Finishes on time
   * even when nothing is drawn: a browser stops animating a tab nobody is
   * looking at, and whoever is waiting on the rise -- the bricks, next --
   * must not wait for them to come back.
   */
  rise(duration = 7000) {
    if (reducedMotion()) { this.level = this.size[1] + 1; this.draw(); return Promise.resolve(); }
    this.level = 0;
    this.start();
    return new Promise((done) => {
      const rising = { start: performance.now(), duration, done };
      this.rising = rising;
      setTimeout(() => { if (this.rising === rising) this.finish(); }, duration + 400);
    });
  }

  finish() {
    if (this.rising) { const done = this.rising.done; this.rising = null; done(); }
    this.level = this.size[1] + 1;
    this.draw();
  }
}

/* --------------------------------------------------------------- heirloom */

/**
 * The finished model's pictures in one <img>. set() gives it a model:
 * `shots` has four turns, the night picture and one picture per cut;
 * `courses` the course each cut stops at, the whole model last. Buttons and
 * the slider are found by the ids given and wired once, here.
 */
export class HeirloomView {
  /** `load`, if given, turns a picture's address into one an <img> can show:
   *  the live studio fetches its pictures with the visitor's own header. */
  constructor(img, ids, load) {
    this.img = img;
    this.load = load || ((url) => Promise.resolve(url));
    const el = (id) => document.getElementById(id);
    this.slider = el(ids.slider);
    this.label = el(ids.label);
    this.night = el(ids.night);
    this.turns = Array.from(document.querySelectorAll(ids.turns));
    this.turns.forEach((button) => button.addEventListener('click', () => {
      this.state = { turn: Number(button.dataset.turn), lights: false, peel: this.courses.length - 1 };
      this.show();
    }));
    this.night.addEventListener('click', () => {
      this.state.lights = !this.state.lights;
      this.state.peel = this.courses.length - 1;
      this.show();
    });
    this.slider.addEventListener('input', () => {
      this.state = { turn: 0, lights: false, peel: Number(this.slider.value) };
      this.show();
    });
  }

  set(shots, courses) {
    this.shots = shots;
    this.courses = courses;
    this.slider.max = String(courses.length - 1);
    this.turn(0);
  }

  turn(k) {
    this.state = { turn: k, lights: false, peel: this.courses.length - 1 };
    this.show();
  }

  show() {
    const s = this.state;
    const all = this.courses.length - 1;
    const url = s.lights ? this.shots.night : s.peel < all ? this.shots.peel[s.peel] : this.shots.turn[s.turn];
    this.wanted = url;
    this.img.classList.add('busy');
    this.load(url).then((src) => {
      if (this.wanted !== url) return;
      this.img.src = src;
      this.img.classList.remove('busy');
    }).catch(() => this.img.classList.remove('busy'));
    this.slider.value = String(s.peel);
    this.label.textContent = s.peel === all
      ? 'All ' + this.courses[all] + ' courses'
      : 'Up to course ' + this.courses[s.peel] + ' of ' + this.courses[all];
    this.night.textContent = s.lights ? 'Lights off' : 'Lights on';
    this.night.setAttribute('aria-pressed', String(s.lights));
    this.turns.forEach((b) => b.setAttribute('aria-pressed',
      String(!s.lights && s.peel === all && Number(b.dataset.turn) === s.turn)));
  }
}
