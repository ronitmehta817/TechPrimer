/* ===========================================================================
 * Tech Primer · nebula background
 *
 * A port of the designer portfolio's WebGL gradient: soft colour blobs warped
 * by simplex noise, drifting slowly, dithered so the gradient never bands. The
 * five portfolio palettes are used as-is (hero navy, the vivid "play" mesh,
 * mirrored copies of both, and the contact palette), and scrolling wipes from
 * one palette to the next the way the portfolio's screens do.
 *
 *   Home     hero palette at the top, wiping to the contact palette over one
 *            screen of scroll, so the welcome text always sits on a dark sky.
 *   Chapters reading progress walks hero → play → hero (mirrored) →
 *            play (mirrored) → contact; text stays on its glass panel.
 *
 * Like the portfolio, the canvas renders at reduced resolution and is
 * stretched to the viewport, and a film-grain tile sits over it.
 * =========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* Film grain: the portfolio's 180px random-noise tile. */
  {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 180;
    const ctx = tile.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(180, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const grain = document.createElement('div');
      grain.className = 'tp-grain';
      grain.setAttribute('aria-hidden', 'true');
      grain.style.backgroundImage = `url(${tile.toDataURL()})`;
      document.body.appendChild(grain);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'tp-nebula';
  canvas.setAttribute('aria-hidden', 'true');

  let gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power' });
  } catch (_) {
    gl = null;
  }
  if (!gl) return;

  const VERT = 'attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 uv;
    uniform vec2 res;
    uniform float time;
    uniform float paletteFrom;
    uniform float paletteTo;
    uniform float wipe;
    uniform float light;

    vec3 perm(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = perm(perm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    float blob(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }

    vec3 hero(vec2 p, float a, float t) {
      vec2 w = p + 0.12 * vec2(snoise(p * 1.4 + vec2(t * 0.05, 0.0)), snoise(p * 1.4 + vec2(5.2, -t * 0.04)));
      float g1 = blob(w, vec2((0.80 + 0.14 * sin(t * 0.11)) * a, 0.24 + 0.12 * sin(t * 0.07 + 1.0)), 0.30);
      float g2 = blob(w, vec2((0.30 + 0.12 * sin(t * 0.09 + 2.0)) * a, 0.07 + 0.06 * cos(t * 0.13)), 0.22);
      float g3 = blob(w, vec2((0.88 + 0.08 * cos(t * 0.10)) * a, 0.68 + 0.10 * sin(t * 0.08 + 3.0)), 0.26);
      float g4 = blob(w, vec2((0.40 + 0.20 * sin(t * 0.06 + 4.0)) * a, 0.62 + 0.10 * cos(t * 0.09)), 0.20);
      vec3 blue = vec3(0.105, 0.20, 0.33);
      vec3 col = vec3(0.0, 0.004, 0.008);
      col += blue * (0.78 * g1 + 0.62 * g2 + 0.72 * g3) + vec3(0.03, 0.09, 0.13) * g4;
      col += vec3(0.04, 0.06, 0.09) * g1 * g1 * g1;
      col *= mix(0.18, 1.0, smoothstep(1.0, 0.66, p.y));
      col *= mix(0.4, 1.0, smoothstep(0.0, 0.32, p.x / a));
      return col;
    }

    vec3 acc; float tot;
    void add(vec3 c, vec2 w, vec2 at, float r, float k) { float b = blob(w, at, r) * k; acc += c * b; tot += b; }

    vec3 play(vec2 p, float a, float t) {
      vec2 w = p + 0.10 * vec2(snoise(p * 1.7 + vec2(t * 0.06, 1.3)), snoise(p * 1.7 + vec2(-2.1, t * 0.05)));
      acc = vec3(0.0); tot = 0.35;
      add(vec3(0.03, 0.60, 0.57), w, vec2((0.80 + 0.05 * sin(t * 0.12)) * a, 0.12 + 0.04 * cos(t * 0.10)), 0.30, 3.0);
      add(vec3(0.05, 0.66, 0.62), w, vec2((0.98 + 0.04 * sin(t * 0.08)) * a, 0.26), 0.18, 1.8);
      add(vec3(0.02, 0.42, 0.42), w, vec2((0.57 + 0.04 * cos(t * 0.09)) * a, 0.22), 0.14, 1.6);
      add(vec3(0.31, 0.01, 0.21), w, vec2((0.16 + 0.04 * sin(t * 0.08)) * a, 0.24 + 0.05 * sin(t * 0.11)), 0.22, 2.0);
      add(vec3(0.77, 0.58, 0.10), w, vec2((-0.02 + 0.03 * sin(t * 0.10)) * a, 0.52 + 0.06 * cos(t * 0.07)), 0.22, 2.4);
      add(vec3(0.47, 0.38, 0.02), w, vec2(0.06 * a, 0.95), 0.20, 1.6);
      add(vec3(0.58, 0.40, 0.66), w, vec2((0.30 + 0.04 * sin(t * 0.13)) * a, 0.80), 0.11, 1.2);
      add(vec3(0.85, 0.70, 0.56), w, vec2(0.13 * a, 0.66), 0.07, 0.8);
      add(vec3(0.83, 0.24, 0.07), w, vec2((0.70 + 0.06 * sin(t * 0.09)) * a, 1.05), 0.26, 3.2);
      add(vec3(0.84, 0.22, 0.10), w, vec2((0.96 + 0.03 * cos(t * 0.11)) * a, 0.98), 0.18, 2.2);
      add(vec3(0.86, 0.44, 0.11), w, vec2(0.46 * a, 1.0), 0.15, 2.0);
      return acc / tot;
    }

    vec3 contact(vec2 p, float a, float t) {
      vec2 w = p + 0.10 * vec2(snoise(p * 1.5 + vec2(t * 0.05, 0.0)), snoise(p * 1.5 + vec2(9.0, -t * 0.04)));
      vec3 col = vec3(0.004, 0.006, 0.01);
      col += vec3(0.42, 0.24, 0.0) * blob(w, vec2((0.12 + 0.06 * sin(t * 0.10)) * a, 0.98), 0.36);
      col += vec3(0.0, 0.30, 0.28) * blob(w, vec2((0.88 + 0.05 * cos(t * 0.09)) * a, 0.10), 0.34);
      col += vec3(0.10, 0.18, 0.32) * blob(w, vec2((0.55 + 0.10 * sin(t * 0.07)) * a, 0.45), 0.30);
      return col;
    }

    vec3 palette(float k, vec2 p, float a, float t) {
      if (k < 0.5) return hero(p, a, t);
      if (k < 1.5) return play(p, a, t);
      if (k < 2.5) return hero(vec2(a - p.x, p.y), a, t + 20.0);
      if (k < 3.5) return play(vec2(a - p.x, p.y), a, t + 40.0);
      return contact(p, a, t);
    }

    void main() {
      float a = res.x / res.y;
      vec2 p = vec2(uv.x * a, 1.0 - uv.y);
      float f = clamp(wipe, 0.0, 1.0);
      float e = 1.0 - f;
      float m = smoothstep(e - 0.55 * f, e + 0.55 * (1.0 - f), p.y);
      vec3 col = vec3(0.0);
      if (m < 0.999) col = palette(paletteFrom, p, a, time);
      if (m > 0.001) col = mix(col, palette(paletteTo, p, a, time), m);
      if (light > 0.5) {
        vec3 paper = vec3(0.972, 0.962, 0.945);
        float s = clamp(max(col.r, max(col.g, col.b)) * 1.2, 0.0, 1.0) * 0.55;
        col = paper * (1.0 - s) + mix(col, vec3(1.0), 0.45) * s;
      }
      col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  let u;
  try {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    u = {
      res: gl.getUniformLocation(prog, 'res'),
      time: gl.getUniformLocation(prog, 'time'),
      from: gl.getUniformLocation(prog, 'paletteFrom'),
      to: gl.getUniformLocation(prog, 'paletteTo'),
      wipe: gl.getUniformLocation(prog, 'wipe'),
      light: gl.getUniformLocation(prog, 'light'),
    };
  } catch (err) {
    console.warn('Nebula background disabled:', err);
    return;
  }

  document.body.insertBefore(canvas, document.body.firstChild);

  const t0 = performance.now();
  let last = t0;
  let lastDraw = -Infinity;
  let shown = false;
  let dirty = true;
  let lost = false;

  function size() {
    const k = Math.min(0.6, 1100 / Math.max(window.innerWidth, 1));
    canvas.width = Math.max(2, Math.round(window.innerWidth * k));
    canvas.height = Math.max(2, Math.round(window.innerHeight * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    dirty = true;
  }

  function readTheme() {
    gl.uniform1f(u.light, root.getAttribute('data-theme') === 'light' ? 1 : 0);
    dirty = true;
  }

  /* Position in the palette sequence. Home runs 0..1 (hero → contact); a
   * chapter runs 0..4 across reading progress. Both start on the hero palette,
   * so switching between them eases back to 0 before changing sequence. */
  let mode = null;
  let target = 0;
  let current = 0;
  let docHeight = root.scrollHeight;

  function readTarget() {
    const nextMode = document.body.classList.contains('home-page') ? 'home' : 'read';
    const vh = window.innerHeight || 1;
    const y = window.scrollY || 0;
    const s = nextMode === 'home'
      ? Math.min(1, y / vh)
      : Math.min(4, (y / Math.max(1, docHeight - vh)) * 4);
    if (mode === null) {
      mode = nextMode;
      current = target = s;
    } else if (nextMode !== mode) {
      target = 0;
      if (current < 0.002) {
        mode = nextMode;
        target = s;
      }
    } else {
      target = s;
    }
  }

  function draw(now, still) {
    let from = 0;
    let to = 4;
    let wipe = current;
    if (mode === 'read') {
      const k = Math.min(Math.floor(current), 3);
      from = k;
      to = k + 1;
      wipe = current - k;
    }
    gl.uniform1f(u.time, still ? 6 : ((now - t0) / 1000) * 2.2);
    gl.uniform1f(u.from, from);
    gl.uniform1f(u.to, to);
    gl.uniform1f(u.wipe, wipe);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (lost) return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    readTarget();
    const before = current;
    current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.0005) current = target;
    const still = !!(reduceMotion && reduceMotion.matches);
    // The drift is slow, so 30fps is plenty; scroll-driven wipes draw every frame.
    if (!document.hidden && (dirty || current !== before || (!still && now - lastDraw >= 33))) {
      draw(now, still);
      lastDraw = now;
      dirty = false;
      if (!shown) {
        shown = true;
        root.classList.add('tp-nebula-on');
      }
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    root.classList.remove('tp-nebula-on');
  });

  window.addEventListener('resize', size);
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.ResizeObserver) {
    new ResizeObserver(() => { docHeight = root.scrollHeight; }).observe(document.body);
  }
  if (reduceMotion && reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', () => { dirty = true; });
  }

  size();
  readTheme();
  requestAnimationFrame(frame);
})();
