/* ===========================================================================
 * Tech Primer · Ambient 3D Background — Constellation + Data Globes
 *
 * The background is a wide constellation network of domain-tinted nodes
 * connected by proximity edges. Sprinkled through the constellation are a
 * handful of small "data globes" — wireframe icospheres with orbital pulse
 * points — that act as visual anchors without dominating the field.
 *
 * Behaviour rules (per spec):
 *   - The whole canvas stays on screen at all times (CSS `position:fixed`).
 *   - The structure does NOT auto-rotate. It only moves when the user scrolls
 *     the page (scrollY drives a Y-axis rotation of the network group).
 *   - Scrolling also drives a camera dolly — the camera zooms in toward the
 *     constellation as scrollY increases, hitting full zoom at zoomScrollPx.
 *   - Hover does nothing. The camera only responds to scroll, never to the
 *     mouse, so the user keeps whatever scroll-driven view they last set.
 *
 * Loaded as an ES module via the import map in index.html. Singleton wrapper
 * exposed on window.AetherBg so the legacy IIFE app.js can lifecycle it.
 * =========================================================================== */

import * as THREE from 'three';

/* Two-tone constellation: gold + blue, randomly assigned per node / edge /
 * star / globe. Each tone is deep on cream and bright on dark so contrast
 * stays right in both modes. Hero star variants are brighter shades of the
 * same hue. The domain palette stays unchanged so the globe pulse points
 * keep their per-domain identity. */
const PALETTE = {
  light: {
    bg:       0xf8f1e9,
    /* tone A = dark gold; tone B = dark navy. Both visible on cream. */
    toneA:        0xa8741a,
    toneB:        0x1f4a8b,
    toneAHero:    0xd09028,
    toneBHero:    0x3068b0,
    /* sd, ms, mq, spring — saturated for the globe pulse points only. */
    domains:      [0x2563eb, 0x7c3aed, 0x059669, 0x16a34a],
    edgeOpacity:  0.55,
    nodeAlpha:    0.85,
    starAlpha:    0.55,
    globeWireAlpha: 0.60,
  },
  dark: {
    bg:       0x1e1e1e,
    toneA:        0xd0b344,
    toneB:        0xf2df9b,
    toneAHero:    0xfff0b0,
    toneBHero:    0xfff7d6,
    domains:      [0xd0b344, 0xf2df9b, 0xffe8a3, 0xfff7d6],
    edgeOpacity:  0.70,
    nodeAlpha:    0.95,
    starAlpha:    0.80,
    globeWireAlpha: 0.75,
  },
};

const BUDGET = Object.freeze({
  /* Constellation density. The mesh is a single Points + a single LineSegments
   * pass each, so doubling these numbers stays cheap. */
  nodeCount:    window.innerWidth < 720 ? 75 : 120,
  /* Edges connect any pair of nodes within this distance. Tuned so each node
   * gets ~3-6 connections — readable mesh, not bowl-of-spaghetti. */
  edgeThreshold: 3.4,

  /* Constellation occupancy in worldspace. Wide x/y so the mesh fills the
   * viewport regardless of aspect; shallow z so foreshortening isn't extreme. */
  spreadX: 30,
  spreadY: 17,
  spreadZ: 22,

  /* Star layer for ambient depth — sparse so it doesn't visually compete. */
  starCount:    window.innerWidth < 720 ? 180 : 320,
  /* Independent gold-only stars on top of the constellation/star network —
   * adds a featured layer of warm pinpricks scattered through the scene. */
  goldStarCount: window.innerWidth < 720 ? 50 : 90,

  /* Scroll-driven zoom range. The camera lerps from cameraDefaultZ (page top,
   * full overview) to cameraZoomedZ (full zoom-in) as the page scrolls. The
   * zoomScrollPx value is the scroll distance (in pixels) it takes to reach
   * full zoom — bigger number = gentler zoom curve. */
  cameraDefaultZ: 16,
  cameraZoomedZ:  11.5,
  zoomScrollPx:   1500,
});

/* Mini data globes scattered through the constellation. Each gets a wireframe
 * icosphere + a few orbital pulse points. Positions chosen at random-looking
 * but stable offsets so the field reads the same on every load. */
const GLOBE_LAYOUT = [
  { x: -8.5, y:  3.4, z: -3.5, r: 0.79, c: 0 },   // sd
  { x:  9.0, y: -2.6, z: -7.0, r: 0.68, c: 1 },   // ms
  { x: -3.5, y: -5.2, z: -2.0, r: 0.61, c: 2 },   // mq
  { x:  5.2, y:  5.0, z: -9.0, r: 0.75, c: 3 },   // spring
  { x: -10.5, y: -3.0, z: -11.0, r: 0.64, c: 0 },
  { x:  10.0, y:  4.5, z: -4.5, r: 0.55, c: 2 },
];

const PULSES_PER_GLOBE = 3;
const PULSE_TO_GLOBE_RATIO = 0.05;

const prefersReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

class AmbientBg {
  constructor(canvas) {
    this.canvas = canvas;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
    } catch (e) {
      this.disabled = true;
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      120,
    );
    this.camera.position.set(0, 0, BUDGET.cameraDefaultZ);
    this.camera.lookAt(0, 0, 0);

    this.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    /* All structure lives under one Group so scroll-driven rotation is a
     * single transform write per frame rather than per-mesh. */
    this.network = new THREE.Group();
    this.scene.add(this.network);

    this._buildConstellation();
    this._buildGlobes();
    this._buildStars();
    this._buildGoldStars();

    /* Smoothed scroll value drives the network's Y rotation. */
    this.targetScroll = window.scrollY || 0;
    this.scroll = this.targetScroll;

    this._onScroll = () => { this.targetScroll = window.scrollY || 0; };
    this._onResize = () => this.resize();
    this._onVisibility = () => {
      if (document.hidden) {
        this.running = false;
      } else if (!this.running) {
        this.running = true;
        this._tLast = performance.now();
        requestAnimationFrame(this._tick);
      }
    };

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);

    this._tStart = performance.now();
    this._tLast = this._tStart;
    this.running = true;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);

    this.setTheme(this.theme);
  }

  /* ---- Build helpers ---- */

  /* Constellation = single Points layer (every node) + single LineSegments
   * layer (every proximity edge). Each node is randomly assigned tone A
   * (gold) or tone B (blue); edges inherit endpoint tones so a gold-blue
   * pair gradients smoothly across the segment via vertex colour interp. */
  _buildConstellation() {
    const N = BUDGET.nodeCount;
    const positions = new Float32Array(N * 3);
    const nodeColors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);

    /* Per-node tone (0 = A / gold, 1 = B / blue). Stored for setTheme() so we
     * can repaint per-vertex colours without losing the random assignment. */
    this.nodeTones = new Uint8Array(N);

    const toneAColor = new THREE.Color(PALETTE.light.toneA);
    const toneBColor = new THREE.Color(PALETTE.light.toneB);

    /* Node positions: random within the configured spread, with a small
     * negative-Z bias so the bulk of the cloud sits behind the camera plane. */
    const nodePositions = [];
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * BUDGET.spreadX;
      const y = (Math.random() - 0.5) * BUDGET.spreadY;
      const z = (Math.random() - 0.5) * BUDGET.spreadZ - 3;
      nodePositions.push({ x, y, z });
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const tone = Math.random() < 0.5 ? 0 : 1;
      this.nodeTones[i] = tone;
      const col = tone === 0 ? toneAColor : toneBColor;
      nodeColors[i * 3 + 0] = col.r;
      nodeColors[i * 3 + 1] = col.g;
      nodeColors[i * 3 + 2] = col.b;
      sizes[i] = 0.5 + Math.random() * 0.7;
    }

    const nodeGeom = new THREE.BufferGeometry();
    nodeGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nodeGeom.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
    nodeGeom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    /* Hard-edged solid dot for each node. Smoothstep sits in a narrow
     * antialiasing band (0.45 → 0.50) so the disc reads as a flat-filled
     * circle rather than a soft halo, but edges stay crisp without jaggies. */
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSize:       { value: 14.0 },
        uAlpha:      { value: PALETTE.light.nodeAlpha },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      /* Normal blending so the dark dot colours actually darken the cream
       * body in light mode (additive would brighten and wash out). */
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uPixelRatio;
        uniform float uSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aSize * uPixelRatio / max(1.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          /* (1 - smoothstep(0.45, 0.50, d)) yields 1.0 inside 0.45 radius,
           * 0.0 outside 0.50, with antialiased edge between → solid disc. */
          float a = (1.0 - smoothstep(0.45, 0.50, d)) * uAlpha;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });

    this.nodes = new THREE.Points(nodeGeom, nodeMat);
    this.nodeMat = nodeMat;
    this.network.add(this.nodes);

    /* Proximity edges. Each endpoint inherits its node's tone (gold or blue)
     * with a distance-fade multiplier — so gold↔blue pairs produce gradient
     * lines from one hue to the other across the segment. We also remember
     * each edge's endpoints + fade so setTheme() can re-tint without rebuild. */
    const edgePos = [];
    const edgeCol = [];
    const TH = BUDGET.edgeThreshold;
    /* Edge metadata for theme re-tinting: { i, j, fade } per edge. */
    this.edgeMeta = [];
    for (let i = 0; i < N; i++) {
      const a = nodePositions[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodePositions[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < TH) {
          const fade = 1 - d / TH;
          const ca = this.nodeTones[i] === 0 ? toneAColor : toneBColor;
          const cb = this.nodeTones[j] === 0 ? toneAColor : toneBColor;
          edgePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
          edgeCol.push(ca.r * fade, ca.g * fade, ca.b * fade,
                       cb.r * fade, cb.g * fade, cb.b * fade);
          this.edgeMeta.push({ i, j, fade });
        }
      }
    }

    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgePos), 3));
    edgeGeom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(edgeCol), 3));

    /* Solid connected edges — basic 1px lines with per-vertex colours so
     * gold↔blue endpoint pairs still gradient smoothly across the segment. */
    this.edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: PALETTE.light.edgeOpacity,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    this.edges = new THREE.LineSegments(edgeGeom, this.edgeMat);
    this.network.add(this.edges);
  }

  /* Mini data globes — small wireframe icospheres with orbital pulse points.
   * Each globe is a Group containing the sphere wire + a `userData` reference
   * used in _tick to update its pulses. */
  _buildGlobes() {
    this.globes = [];

    /* Aggregate all pulse points across all globes into one Points buffer for
     * a single draw call. */
    const allPulsePos = new Float32Array(GLOBE_LAYOUT.length * PULSES_PER_GLOBE * 3);
    const allPulseCol = new Float32Array(GLOBE_LAYOUT.length * PULSES_PER_GLOBE * 3);
    const allPulseSize = new Float32Array(GLOBE_LAYOUT.length * PULSES_PER_GLOBE);

    const themePalette = PALETTE.light;

    for (let i = 0; i < GLOBE_LAYOUT.length; i++) {
      const cfg = GLOBE_LAYOUT[i];
      const sphereGeom = new THREE.IcosahedronGeometry(cfg.r, 2);
      const wireGeom = new THREE.WireframeGeometry(sphereGeom);
      sphereGeom.dispose();

      /* Each globe randomly picks the gold or blue constellation tone for
       * its wireframe, so they harmonise with the rest of the network. */
      const tone = Math.random() < 0.5 ? 0 : 1;
      const wireColorHex = tone === 0 ? themePalette.toneA : themePalette.toneB;

      const wireMat = new THREE.LineBasicMaterial({
        color: wireColorHex,
        transparent: true,
        opacity: themePalette.globeWireAlpha,
        depthWrite: false,
      });
      const wire = new THREE.LineSegments(wireGeom, wireMat);

      const grp = new THREE.Group();
      grp.add(wire);
      grp.position.set(cfg.x, cfg.y, cfg.z);
      grp.userData = {
        cfg,
        tone,                 // 0 = A (gold), 1 = B (blue) — used by setTheme
        wireMat,
        spinSpeed: 0.10 + Math.random() * 0.10,
        pulses: [],
      };

      /* Pulses orbit at a slightly larger radius than the wire sphere so
       * they read as orbital traffic, not surface decoration. */
      const orbitR = cfg.r * 1.5;
      const colorHex = themePalette.domains[cfg.c];
      const col = new THREE.Color(colorHex);
      for (let p = 0; p < PULSES_PER_GLOBE; p++) {
        const phase = (p / PULSES_PER_GLOBE) * Math.PI * 2 + Math.random() * 0.6;
        const speed = 0.6 + Math.random() * 0.4;
        const tilt = Math.random() * Math.PI;
        grp.userData.pulses.push({ phase, speed, tilt, orbitR, color: col.clone() });
      }

      this.network.add(grp);
      this.globes.push(grp);

      /* Initialise the buffer slots for this globe's pulses (tinted to the
       * globe's domain colour). */
      for (let p = 0; p < PULSES_PER_GLOBE; p++) {
        const idx = (i * PULSES_PER_GLOBE + p) * 3;
        allPulsePos[idx + 0] = cfg.x;
        allPulsePos[idx + 1] = cfg.y;
        allPulsePos[idx + 2] = cfg.z;
        allPulseCol[idx + 0] = col.r;
        allPulseCol[idx + 1] = col.g;
        allPulseCol[idx + 2] = col.b;
        allPulseSize[i * PULSES_PER_GLOBE + p] = cfg.r;
      }
    }

    const pulseGeom = new THREE.BufferGeometry();
    pulseGeom.setAttribute('position', new THREE.BufferAttribute(allPulsePos, 3));
    pulseGeom.setAttribute('color', new THREE.BufferAttribute(allPulseCol, 3));
    pulseGeom.setAttribute('aSize', new THREE.BufferAttribute(allPulseSize, 1));

    this.pulseMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSize: { value: this._getPulsePointScale() },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      /* Pulses use additive on dark theme for a glowy "data packet" look,
       * but normal blending on light so they don't blow out. We pick the
       * blending mode at setTheme() time. Default to additive here. */
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uPixelRatio;
        uniform float uSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aSize * uPixelRatio / max(1.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(uv));
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });
    this.pulses = new THREE.Points(pulseGeom, this.pulseMat);
    this.network.add(this.pulses);
  }

  /* Two-tier star layer — most are small twinkling pinpricks, ~10 % are
   * "hero" stars (bigger + brighter halo). Each star is independently
   * assigned tone A (gold) or tone B (blue), and heroes use the brighter
   * variant of their assigned tone. Per-vertex colour drives the hue. */
  _buildStars() {
    const count = BUDGET.starCount;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const heroFlags = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    /* Stored per-star metadata so setTheme() can repaint without rebuilding. */
    this.starTones = new Uint8Array(count);
    this.starHero = heroFlags;       // alias — already a Float32Array view

    const cA      = new THREE.Color(PALETTE.light.toneA);
    const cB      = new THREE.Color(PALETTE.light.toneB);
    const cAHero  = new THREE.Color(PALETTE.light.toneAHero);
    const cBHero  = new THREE.Color(PALETTE.light.toneBHero);

    /* Two-tier size + flag + tone distribution. ~10 % become heroes; each
     * star independently picks gold or blue. */
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 8;
      phases[i] = Math.random() * Math.PI * 2;

      const isHero = Math.random() < 0.10 ? 1 : 0;
      heroFlags[i] = isHero;
      sizes[i] = isHero
        ? 1.7 + Math.random() * 0.9     // big bright stars
        : 0.4 + Math.random() * 0.8;    // pinpricks

      const tone = Math.random() < 0.5 ? 0 : 1;
      this.starTones[i] = tone;
      const col = tone === 0
        ? (isHero ? cAHero : cA)
        : (isHero ? cBHero : cB);
      colors[i * 3 + 0] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('phase',    new THREE.BufferAttribute(phases, 1));
    geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('isHero',   new THREE.BufferAttribute(heroFlags, 1));
    geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    this.starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uAlpha:      { value: PALETTE.light.starAlpha },
        uSize:       { value: 12.0 },
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      /* Normal blending so dark stars darken cream; bright per-vertex colours
       * still give a "shine" against the dark theme. */
      blending: THREE.NormalBlending,
      /* `attribute vec3 color;` is auto-prepended when vertexColors is true. */
      vertexShader: /* glsl */ `
        attribute float phase;
        attribute float aSize;
        attribute float isHero;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSize;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aSize * uPixelRatio / max(1.0, -mv.z);
          /* Heroes twinkle slower and brighter than pinpricks. */
          vTwinkle = isHero > 0.5
            ? 0.85 + 0.15 * sin(uTime * 0.5 + phase * 1.7)
            : 0.55 + 0.45 * sin(uTime * 1.0 + phase * 2.0);
          vIsHero = isHero;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          /* Heroes get a bright core + soft halo via two-stop falloff. */
          float core = smoothstep(0.5, 0.0, d);
          float halo = smoothstep(0.5, 0.18, d);
          float a = (vIsHero > 0.5)
            ? (core * 0.7 + halo * 0.3) * uAlpha * 1.2 * vTwinkle
            :  core * uAlpha * vTwinkle;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });

    /* Stars stay outside the network group so the scroll-driven rotation
     * doesn't drag them — they should feel like a steady sky behind the
     * constellation. */
    this.stars = new THREE.Points(geom, this.starMat);
    this.scene.add(this.stars);
  }

  /* Independent gold-only star layer. These sit on top of the dual-tone
   * star field as a featured warm pinprick layer — same shader pattern,
   * but every star is forced to tone A (gold), with a 15 % hero rate. */
  _buildGoldStars() {
    const count = BUDGET.goldStarCount;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const heroFlags = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    /* Need only the hero flags later for theme retinting (positions stay
     * fixed, sizes don't change). */
    this.goldStarHero = heroFlags;

    const cA     = new THREE.Color(PALETTE.light.toneA);
    const cAHero = new THREE.Color(PALETTE.light.toneAHero);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 8;
      phases[i] = Math.random() * Math.PI * 2;

      /* 15 % heroes — slightly higher than the 10 % rate of the dual-tone
       * star field so this layer reads as the "feature" stars. */
      const isHero = Math.random() < 0.15 ? 1 : 0;
      heroFlags[i] = isHero;
      sizes[i] = isHero
        ? 1.8 + Math.random() * 1.0     // bigger hero golds
        : 0.5 + Math.random() * 0.9;    // pinpricks

      const col = isHero ? cAHero : cA;
      colors[i * 3 + 0] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('phase',    new THREE.BufferAttribute(phases, 1));
    geom.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('isHero',   new THREE.BufferAttribute(heroFlags, 1));
    geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    this.goldStarMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uAlpha:      { value: PALETTE.light.starAlpha },
        uSize:       { value: 13.0 },          // ~10 % bigger than dual-tone stars
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.NormalBlending,
      /* Same shader as _buildStars() — kept duplicated rather than extracted
       * because Three.js ShaderMaterial caches by source string and trying to
       * share a single material between layers means juggling lots of state
       * (vertexColors, attributes). Cheaper to copy. */
      vertexShader: /* glsl */ `
        attribute float phase;
        attribute float aSize;
        attribute float isHero;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uSize;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * aSize * uPixelRatio / max(1.0, -mv.z);
          vTwinkle = isHero > 0.5
            ? 0.85 + 0.15 * sin(uTime * 0.5 + phase * 1.7)
            : 0.55 + 0.45 * sin(uTime * 1.0 + phase * 2.0);
          vIsHero = isHero;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vIsHero;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float core = smoothstep(0.5, 0.0, d);
          float halo = smoothstep(0.5, 0.18, d);
          float a = (vIsHero > 0.5)
            ? (core * 0.7 + halo * 0.3) * uAlpha * 1.2 * vTwinkle
            :  core * uAlpha * vTwinkle;
          gl_FragColor = vec4(vColor, a);
        }
      `,
    });

    /* Sit outside the network group so they don't rotate with scroll —
     * stars and gold sparkles should feel like a steady backdrop. */
    this.goldStars = new THREE.Points(geom, this.goldStarMat);
    this.scene.add(this.goldStars);
  }

  /* ---- Public API ---- */

  setTheme(theme) {
    const p = PALETTE[theme] || PALETTE.light;
    this.theme = theme;

    const cA      = new THREE.Color(p.toneA);
    const cB      = new THREE.Color(p.toneB);
    const cAHero  = new THREE.Color(p.toneAHero);
    const cBHero  = new THREE.Color(p.toneBHero);

    /* Constellation nodes — walk the stored per-node tone array and rewrite
     * each vertex's colour. */
    if (this.nodes && this.nodeMat && this.nodeTones) {
      const attr = this.nodes.geometry.attributes.color;
      const arr = attr.array;
      for (let i = 0; i < this.nodeTones.length; i++) {
        const col = this.nodeTones[i] === 0 ? cA : cB;
        arr[i * 3 + 0] = col.r;
        arr[i * 3 + 1] = col.g;
        arr[i * 3 + 2] = col.b;
      }
      attr.needsUpdate = true;
      this.nodeMat.uniforms.uAlpha.value = p.nodeAlpha;
    }

    /* Constellation edges — for each stored {i, j, fade} entry, rebuild the
     * two endpoints from the current tone palette × distance fade. Gold↔blue
     * pairs gradient automatically across the segment via vertex interp. */
    if (this.edges && this.edgeMeta && this.nodeTones) {
      const attr = this.edges.geometry.attributes.color;
      const arr = attr.array;
      for (let e = 0; e < this.edgeMeta.length; e++) {
        const meta = this.edgeMeta[e];
        const ca = this.nodeTones[meta.i] === 0 ? cA : cB;
        const cb = this.nodeTones[meta.j] === 0 ? cA : cB;
        const f = meta.fade;
        const base = e * 6;
        arr[base + 0] = ca.r * f;
        arr[base + 1] = ca.g * f;
        arr[base + 2] = ca.b * f;
        arr[base + 3] = cb.r * f;
        arr[base + 4] = cb.g * f;
        arr[base + 5] = cb.b * f;
      }
      attr.needsUpdate = true;
      this.edges.material.opacity = p.edgeOpacity;
    }

    /* Globes — each carries its own random tone in userData. Re-tint its
     * wireframe with the new theme's tone shade. Pulse points keep their
     * domain colour identity (independent of constellation tone). */
    if (this.globes) {
      this.globes.forEach((grp) => {
        const ud = grp.userData;
        const wireHex = ud.tone === 0 ? p.toneA : p.toneB;
        if (ud.wireMat) {
          ud.wireMat.color.set(wireHex);
          ud.wireMat.opacity = p.globeWireAlpha;
        }
        const colorHex = p.domains[ud.cfg.c];
        const col = new THREE.Color(colorHex);
        for (const pulse of ud.pulses) pulse.color.copy(col);
      });

      if (this.pulses && this.pulseMat) {
        const colAttr = this.pulses.geometry.attributes.color;
        const arr = colAttr.array;
        for (let g = 0; g < this.globes.length; g++) {
          const cfg = this.globes[g].userData.cfg;
          const col = new THREE.Color(p.domains[cfg.c]);
          for (let pp = 0; pp < PULSES_PER_GLOBE; pp++) {
            const idx = (g * PULSES_PER_GLOBE + pp) * 3;
            arr[idx + 0] = col.r;
            arr[idx + 1] = col.g;
            arr[idx + 2] = col.b;
          }
        }
        colAttr.needsUpdate = true;

        /* Pulse blending differs by theme: additive for glow on dark, normal
         * for legibility on cream. */
        const targetBlending = (theme === 'dark')
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;
        if (this.pulseMat.blending !== targetBlending) {
          this.pulseMat.blending = targetBlending;
          this.pulseMat.needsUpdate = true;
        }
      }
    }

    /* Stars — walk the stored per-star tone + hero arrays and rewrite each
     * vertex colour to match the current theme. */
    if (this.stars && this.starMat && this.starTones && this.starHero) {
      const attr = this.stars.geometry.attributes.color;
      const arr = attr.array;
      for (let i = 0; i < this.starTones.length; i++) {
        const isHero = this.starHero[i] > 0.5;
        const col = this.starTones[i] === 0
          ? (isHero ? cAHero : cA)
          : (isHero ? cBHero : cB);
        arr[i * 3 + 0] = col.r;
        arr[i * 3 + 1] = col.g;
        arr[i * 3 + 2] = col.b;
      }
      attr.needsUpdate = true;
      this.starMat.uniforms.uAlpha.value = p.starAlpha;
    }

    /* Independent gold stars — every star is tone A. Heroes get cA­Hero,
     * pinpricks get cA. Same retint-in-place pattern as the dual-tone stars. */
    if (this.goldStars && this.goldStarMat && this.goldStarHero) {
      const attr = this.goldStars.geometry.attributes.color;
      const arr = attr.array;
      for (let i = 0; i < this.goldStarHero.length; i++) {
        const isHero = this.goldStarHero[i] > 0.5;
        const col = isHero ? cAHero : cA;
        arr[i * 3 + 0] = col.r;
        arr[i * 3 + 1] = col.g;
        arr[i * 3 + 2] = col.b;
      }
      attr.needsUpdate = true;
      this.goldStarMat.uniforms.uAlpha.value = p.starAlpha;
    }
  }

  _getPulsePointScale() {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    return (window.innerHeight / Math.tan(halfFov)) * PULSE_TO_GLOBE_RATIO;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.starMat) {
      this.starMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
    if (this.nodeMat) {
      this.nodeMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
    if (this.pulseMat) {
      this.pulseMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
      this.pulseMat.uniforms.uSize.value = this._getPulsePointScale();
    }
    if (this.goldStarMat) {
      this.goldStarMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
  }

  /* ---- Frame loop ---- */

  _tick(now) {
    if (!this.running) return;
    const t = (now - this._tStart) / 1000;
    /* Clamp delta so a backgrounded tab can't catapult animations on resume. */
    const dt = Math.min((now - this._tLast) / 1000, 0.05);
    this._tLast = now;
    const motion = prefersReducedMotion ? 0.2 : 1.0;

    /* Smooth scroll. The network's Y rotation is purely scroll-driven —
     * absolute scrollY in pixels mapped to radians (full revolution per
     * ~6000px, so even a long page can't unwind it absurdly). */
    this.scroll += (this.targetScroll - this.scroll) * 0.06;
    if (this.network) {
      this.network.rotation.y = this.scroll * 0.0011;
      /* A faint X tilt over scroll too so the cloud feels three-dimensional
       * as you progress, not just spinning on a fixed axis. */
      this.network.rotation.x = Math.sin(this.scroll * 0.0004) * 0.18;
    }

    /* Scroll-driven zoom. Camera lerps from cameraDefaultZ → cameraZoomedZ
     * as scrollY ranges from 0 → zoomScrollPx, capped at full zoom past that.
     * `this.scroll` is already smoothed (0.06 lerp at the top of _tick), so
     * the camera Z animates in continuously without further easing. Hover
     * does nothing — only scroll moves the camera now. */
    const scrollProgress = Math.min(1, Math.max(0, this.scroll / BUDGET.zoomScrollPx));
    this.camera.position.z = BUDGET.cameraDefaultZ
      + (BUDGET.cameraZoomedZ - BUDGET.cameraDefaultZ) * scrollProgress;
    /* Camera always frames the origin — no drift. */
    this.camera.lookAt(0, 0, 0);

    /* Node twinkle uniform — cheapest possible "alive" cue while the structure
     * itself doesn't auto-rotate. Stars still twinkle via uTime; nodes are
     * solid discs now and have no time-dependent uniforms to feed. */
    if (this.starMat) this.starMat.uniforms.uTime.value = t * motion;
    if (this.goldStarMat) this.goldStarMat.uniforms.uTime.value = t * motion;

    /* Globes — each globe's wireframe spins on its own axis, and its pulse
     * points orbit at fixed angular speed. The globes aren't part of the
     * scroll-rotation behaviour because they live INSIDE the network group
     * and inherit the parent rotation; we only update local rotation here. */
    if (this.globes && this.pulses) {
      const posAttr = this.pulses.geometry.attributes.position;
      for (let g = 0; g < this.globes.length; g++) {
        const grp = this.globes[g];
        const ud = grp.userData;
        /* Self-spin (around the globe's own pivot — local axis). */
        grp.rotation.y += dt * ud.spinSpeed * motion;
        /* Pulse orbits — positions in WORLDSPACE, before parent rotation,
         * so we set them relative to the globe's local origin. */
        for (let pp = 0; pp < ud.pulses.length; pp++) {
          const pulse = ud.pulses[pp];
          const ang = t * pulse.speed * motion + pulse.phase;
          const x = ud.cfg.x + Math.cos(ang) * pulse.orbitR;
          const z = ud.cfg.z + Math.sin(ang) * pulse.orbitR;
          const y = ud.cfg.y + Math.sin(ang * 0.5) * pulse.orbitR * 0.4 * Math.sin(pulse.tilt);
          const idx = (g * PULSES_PER_GLOBE + pp) * 3;
          posAttr.array[idx + 0] = x;
          posAttr.array[idx + 1] = y;
          posAttr.array[idx + 2] = z;
        }
      }
      posAttr.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }

  dispose() {
    this.running = false;
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);

    if (this.nodes) {
      this.nodes.geometry.dispose();
      this.nodes.material.dispose();
    }
    if (this.edges) {
      this.edges.geometry.dispose();
      this.edges.material.dispose();
    }
    if (this.globes) {
      for (const grp of this.globes) {
        grp.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
      }
    }
    if (this.pulses) {
      this.pulses.geometry.dispose();
      this.pulses.material.dispose();
    }
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    if (this.goldStars) {
      this.goldStars.geometry.dispose();
      this.goldStars.material.dispose();
    }
    if (this.renderer) this.renderer.dispose();
  }
}

/* --------------------------------------------------------------------------
 * Singleton wrapper exposed to the legacy IIFE app.js.
 * -------------------------------------------------------------------------- */
let instance = null;

window.AetherBg = {
  init() {
    if (instance) return true;
    const canvas = document.getElementById('bg-3d-canvas');
    if (!canvas) return false;
    const bg = new AmbientBg(canvas);
    if (bg.disabled) return false;
    instance = bg;
    return true;
  },

  setTheme(theme) { if (instance) instance.setTheme(theme); },

  isActive() { return !!instance; },

  dispose() {
    if (instance) {
      instance.dispose();
      instance = null;
    }
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.AetherBg.init(), { once: true });
} else {
  window.AetherBg.init();
}
