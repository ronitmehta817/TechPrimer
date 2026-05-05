/* ===========================================================================
 * Tech Primer · Welcome 3D Hero — Network Topology
 *
 * A scroll-reactive 3D system topology rendered in the welcome hero. A central
 * iridescent hub is connected by glowing edges to domain satellite nodes
 * (System Design, Microservices, Message Queues, Spring, Design Patterns), with small data
 * packets travelling along the edges in both directions. Faint sub-nodes form
 * a background mesh that hints at a wider network.
 *
 * Relevance > novelty: this metaphor maps directly to what the site teaches —
 * services connected by messaging, latency and reliability, all visible at a
 * glance.
 *
 * Interactions:
 *   - Mouse parallax tilts the camera.
 *   - Window scroll drives the network's Y-rotation (scrub-through effect).
 *   - Hover a domain node → glass tooltip with the domain label.
 *   - Click a domain node → onDomainClick(prefix) → existing app.js routing.
 *
 * Loaded as an ES module via the import map in index.html. Singleton wrapper
 * exposed on window.AetherWelcome for the legacy IIFE app.js.
 * =========================================================================== */

import * as THREE from 'three';

const PALETTE = {
  light: { core: 0xffffff, rim: 0xb09828, warm: 0xfd971f, edge: 0xb09828, packet: 0xffd277, sub: 0x9b8c6e },
  dark:  { core: 0xfff7e0, rim: 0xd0b344, warm: 0xff8000, edge: 0xd0b344, packet: 0xfff0b0, sub: 0x6a6354 },
};

const prefersReducedMotion = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

/* Radial placement so all domain nodes stay readable around the hub. */
const NODE_LAYOUT = [
  { x:  0.00, y:  1.62, z:  0.50 },   // sd
  { x: -1.54, y:  0.50, z: -0.35 },   // ms
  { x:  1.54, y:  0.50, z: -0.35 },   // mq
  { x: -0.95, y: -1.30, z:  0.45 },   // spring
  { x:  0.95, y: -1.30, z:  0.45 },   // design patterns
];

/* Sub-nodes drift around the network as a faint background mesh. */
const SUB_NODE_COUNT = 10;
/* Two packets per hub→domain edge, looping back-to-back. */
const PACKETS_PER_EDGE = 2;

class NetworkScene {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    const size = this.opts.size || 320;
    this._size = size;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      this.disabled = true;
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(size, size, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    /* Camera pulled back so domain nodes project to ~55% radius, comfortably
     * inside the canvas mask's fully-opaque centre region. */
    this.camera.position.set(0, 0, 6.4);

    this.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    this._buildLights();

    /* The whole network sits in a Group so mouse parallax + scroll rotation
     * can be applied uniformly. */
    this.network = new THREE.Group();
    this.scene.add(this.network);

    this._buildHub();
    this._buildDomainNodes(this.opts.domains || []);
    this._buildSubNodes();
    this._buildEdges();
    this._buildPackets();

    /* Interaction state */
    this.targetMouse = new THREE.Vector2(0, 0);
    this.mouse = new THREE.Vector2(0, 0);
    this.targetScroll = window.scrollY || 0;
    this.scroll = this.targetScroll;
    this.raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2(99, 99);
    this._hovered = null;

    this._onMove = this._onMove.bind(this);
    this._onLeave = this._onLeave.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('mouseleave', this._onLeave);
    canvas.addEventListener('click', this._onClick);
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('scroll', this._onScroll, { passive: true });

    this._tStart = performance.now();
    this._tLast = this._tStart;
    this.running = true;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);

    this.setTheme(this.theme);
  }

  /* ---- Build helpers ---- */

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2.5, 4, 4);
    this.scene.add(key);

    this.rim = new THREE.PointLight(PALETTE.light.rim, 1.4, 12);
    this.rim.position.set(-2.5, 1.2, -1.5);
    this.scene.add(this.rim);

    this.warm = new THREE.PointLight(PALETTE.light.warm, 1.0, 12);
    this.warm.position.set(2.5, -1.5, 0);
    this.scene.add(this.warm);
  }

  _buildHub() {
    const geom = new THREE.IcosahedronGeometry(0.42, 1);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.10,
      iridescence: 1.0,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [120, 480],
    });
    this.hub = new THREE.Mesh(geom, mat);
    this.network.add(this.hub);
  }

  _buildDomainNodes(domains) {
    /* Each domain gets a distinct shape so they're identifiable even before
     * a tooltip appears. Size scaled up vs the orbiter version so they read
     * as proper nodes, not satellites. */
    const shapes = [
      () => new THREE.OctahedronGeometry(0.30, 0),    // sd
      () => new THREE.TetrahedronGeometry(0.36, 0),   // ms
      () => new THREE.DodecahedronGeometry(0.30, 0),  // mq
      () => new THREE.IcosahedronGeometry(0.32, 0),   // spring
      () => new THREE.BoxGeometry(0.46, 0.46, 0.46),   // design patterns
    ];

    this.domainNodes = [];
    domains.forEach((d, i) => {
      if (i >= NODE_LAYOUT.length) return;
      const pos = NODE_LAYOUT[i];
      const baseColor = new THREE.Color(d.color || 0xffffff);

      const geom = (shapes[i] || shapes[0])();
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.18),
        emissive: baseColor.clone(),
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { domain: d, basePos: { ...pos } };
      this.network.add(mesh);

      this.domainNodes.push({
        mesh,
        domain: d,
        basePos: pos,
        baseEmissive: 0.7,
        baseColor,
        idleSpinSpeed: 0.7 + i * 0.13,
      });
    });
  }

  _buildSubNodes() {
    /* Faint mesh of small spheres that hint at a wider network. Random walk
     * positions ensure each load looks slightly different without being
     * visually noisy. */
    this.subNodes = [];
    for (let i = 0; i < SUB_NODE_COUNT; i++) {
      const r = 2.4 + Math.random() * 0.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.6;
      const x = r * Math.cos(theta) * Math.cos(phi);
      const y = r * Math.sin(phi);
      const z = r * Math.sin(theta) * Math.cos(phi);

      const geom = new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: PALETTE.light.sub,
        transparent: true,
        opacity: 0.55,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      this.network.add(mesh);
      this.subNodes.push({ mesh, base: { x, y, z }, phase: Math.random() * Math.PI * 2 });
    }
  }

  /* Draws hub→domain edges (bright, accent-tinted) and a few faint cross-edges
   * between domains so the topology reads as connected rather than a star. */
  _buildEdges() {
    const segments = [];           // Float32 positions (paired)
    const colors = [];             // matching per-vertex colors (RGB)

    /* Bright hub→domain edges, tinted to the destination's domain colour. */
    this.brightEdges = [];
    for (const node of this.domainNodes) {
      const src = new THREE.Vector3(0, 0, 0);
      const dst = new THREE.Vector3(node.basePos.x, node.basePos.y, node.basePos.z);
      this.brightEdges.push({ a: src, b: dst, color: node.baseColor.clone() });
      this._pushSegment(segments, colors, src, dst, node.baseColor);
    }

    /* Sparse domain↔domain links to give the topology its mesh feel. Picking
     * 4 of the 6 possible pairs at deterministic offsets so it's stable. */
    const pairs = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]];
    const dimColor = new THREE.Color(0x888080).multiplyScalar(0.5);
    for (const [a, b] of pairs) {
      const na = this.domainNodes[a]; const nb = this.domainNodes[b];
      if (!na || !nb) continue;
      const va = new THREE.Vector3(na.basePos.x, na.basePos.y, na.basePos.z);
      const vb = new THREE.Vector3(nb.basePos.x, nb.basePos.y, nb.basePos.z);
      this._pushSegment(segments, colors, va, vb, dimColor);
    }

    /* A handful of hub→sub-node edges for additional life. */
    const subDimColor = new THREE.Color(0x6a6357).multiplyScalar(0.6);
    for (let i = 0; i < Math.min(5, this.subNodes.length); i++) {
      const sn = this.subNodes[i];
      const src = new THREE.Vector3(0, 0, 0);
      const dst = new THREE.Vector3(sn.base.x, sn.base.y, sn.base.z);
      this._pushSegment(segments, colors, src, dst, subDimColor);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.edges = new THREE.LineSegments(geom, mat);
    this.network.add(this.edges);
  }

  _pushSegment(positions, colors, a, b, color) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  /* Data packets — bright additive points that loop along each hub→domain
   * edge. Per-frame position update is cheap for ~8 points. */
  _buildPackets() {
    this.packets = [];
    for (let e = 0; e < this.brightEdges.length; e++) {
      for (let p = 0; p < PACKETS_PER_EDGE; p++) {
        this.packets.push({
          edge: e,
          t: p / PACKETS_PER_EDGE,
          speed: 0.35 + Math.random() * 0.25,
          dir: p % 2 === 0 ? 1 : -1,
        });
      }
    }

    const count = this.packets.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    this.packetGeom = new THREE.BufferGeometry();
    this.packetGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.packetGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    /* Tiny shader for circular soft-edged points. PointsMaterial would draw
     * squares; we want bright dots with falloff. */
    this.packetMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uSize: { value: 22.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      /* `attribute vec3 color;` is auto-prepended whenever `vertexColors:true`
       * — redeclaring it triggers a shader compile "redefinition" error. */
      vertexShader: /* glsl */ `
        varying vec3 vColor;
        uniform float uPixelRatio;
        uniform float uSize;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uPixelRatio / max(1.0, -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });

    this.packetPoints = new THREE.Points(this.packetGeom, this.packetMat);
    this.network.add(this.packetPoints);
  }

  /* ---- Pointer + scroll interaction ---- */

  _onMove(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    this.targetMouse.x =  x * 2 - 1;
    this.targetMouse.y = -(y * 2 - 1);
    this._pointer.x = this.targetMouse.x;
    this._pointer.y = this.targetMouse.y;
  }

  _onLeave() {
    this.targetMouse.set(0, 0);
    this._pointer.set(99, 99);
    this._setHovered(null);
  }

  _onClick() {
    if (this._hovered && typeof this.opts.onDomainClick === 'function') {
      this.opts.onDomainClick(this._hovered.domain.prefix);
    }
  }

  _onResize() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this._size, this._size, false);
    if (this.packetMat && this.packetMat.uniforms) {
      this.packetMat.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    }
  }

  _onScroll() { this.targetScroll = window.scrollY || 0; }

  _setHovered(o) {
    if (this._hovered === o) return;
    this._hovered = o;
    if (typeof this.opts.onHover === 'function') {
      this.opts.onHover(o ? o.domain : null);
    }
    this.canvas.style.cursor = o ? 'pointer' : 'default';
  }

  /* ---- Public API ---- */

  setTheme(theme) {
    const p = PALETTE[theme] || PALETTE.light;
    this.theme = theme;
    if (this.rim)  this.rim.color.set(p.rim);
    if (this.warm) this.warm.color.set(p.warm);
    if (this.hub) this.hub.material.color.set(p.core);
    if (this.subNodes) {
      for (const s of this.subNodes) s.mesh.material.color.set(p.sub);
    }
  }

  highlight(prefix) {
    if (!this.domainNodes) return;
    for (const n of this.domainNodes) {
      const isMatch = !prefix || n.domain.prefix === prefix;
      n.mesh.material.emissiveIntensity = isMatch ? 1.1 : n.baseEmissive;
    }
  }

  /* ---- Frame loop ---- */

  _tick(now) {
    if (!this.running) return;
    const t = (now - this._tStart) / 1000;
    const dt = Math.min((now - this._tLast) / 1000, 0.05);
    this._tLast = now;
    const motion = prefersReducedMotion ? 0.25 : 1.0;

    /* Smooth pointer + scroll. */
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.08;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.08;
    this.scroll += (this.targetScroll - this.scroll) * 0.08;

    /* Camera parallax — the scene tilts toward the cursor without moving. */
    this.camera.position.x = this.mouse.x * 0.55;
    this.camera.position.y = this.mouse.y * 0.45;
    this.camera.lookAt(0, 0, 0);

    /* The network rotates: a gentle baseline + a scroll-driven term that
     * lets the user "scrub" through the topology by scrolling. The scroll
     * factor is tuned so the network completes a half-turn over ~1500px. */
    if (this.network) {
      const baseRotY = t * 0.18 * motion;
      const scrollRotY = (this.scroll / 1500) * Math.PI;
      this.network.rotation.y = baseRotY + scrollRotY;
      this.network.rotation.x = Math.sin(t * 0.18 * motion) * 0.10
                              + (this.scroll / 4000) * Math.PI * 0.25;
    }

    /* Hub: subtle iridescent rotation. */
    if (this.hub) {
      this.hub.rotation.x += dt * 0.40 * motion;
      this.hub.rotation.y += dt * 0.55 * motion;
    }

    /* Domain nodes: slow self-rotation + small idle bob along their basePos. */
    if (this.domainNodes) {
      for (const n of this.domainNodes) {
        const bp = n.basePos;
        n.mesh.position.x = bp.x;
        n.mesh.position.y = bp.y + Math.sin(t * 0.9 + bp.x) * 0.05;
        n.mesh.position.z = bp.z + Math.cos(t * 0.7 + bp.y) * 0.05;
        n.mesh.rotation.x += dt * n.idleSpinSpeed * 0.5 * motion;
        n.mesh.rotation.y += dt * n.idleSpinSpeed * motion;
      }
    }

    /* Sub-nodes drift slightly so the background mesh feels alive. */
    if (this.subNodes) {
      for (const s of this.subNodes) {
        s.mesh.position.x = s.base.x + Math.sin(t * 0.3 + s.phase) * 0.08;
        s.mesh.position.y = s.base.y + Math.cos(t * 0.4 + s.phase) * 0.08;
      }
    }

    /* Packets travel along their assigned hub→domain edge, looping when t
     * leaves [0, 1]. dir flips so half the packets travel hub→domain and
     * half travel domain→hub for a two-way feel. */
    if (this.packets && this.packetGeom && this.brightEdges) {
      const posAttr = this.packetGeom.attributes.position;
      const colAttr = this.packetGeom.attributes.color;
      for (let i = 0; i < this.packets.length; i++) {
        const p = this.packets[i];
        p.t += p.speed * dt * p.dir * motion;
        if (p.t > 1) p.t -= 1; else if (p.t < 0) p.t += 1;

        const e = this.brightEdges[p.edge];
        const x = e.a.x + (e.b.x - e.a.x) * p.t;
        const y = e.a.y + (e.b.y - e.a.y) * p.t;
        const z = e.a.z + (e.b.z - e.a.z) * p.t;
        posAttr.array[i * 3 + 0] = x;
        posAttr.array[i * 3 + 1] = y;
        posAttr.array[i * 3 + 2] = z;

        /* Packet brightness ramps up near the destination so the eye reads
         * it as "arriving". */
        const fadeT = Math.abs(0.5 - p.t) * 2;        // 1 at endpoints, 0 at midpoint
        const intensity = 0.6 + (1 - fadeT) * 0.6;
        colAttr.array[i * 3 + 0] = e.color.r * intensity;
        colAttr.array[i * 3 + 1] = e.color.g * intensity;
        colAttr.array[i * 3 + 2] = e.color.b * intensity;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    /* Hover detection — only when the pointer is inside the canvas. */
    if (this.domainNodes && this._pointer.x >= -1 && this._pointer.x <= 1) {
      this.raycaster.setFromCamera(this._pointer, this.camera);
      const meshes = this.domainNodes.map(n => n.mesh);
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      const o = hit ? this.domainNodes.find(x => x.mesh === hit.object) : null;
      this._setHovered(o);

      /* Smooth emissive ramp on hover. */
      for (const n of this.domainNodes) {
        const target = (n === o) ? 1.25 : n.baseEmissive;
        const cur = n.mesh.material.emissiveIntensity;
        n.mesh.material.emissiveIntensity = cur + (target - cur) * 0.18;
      }
    } else if (this.domainNodes) {
      for (const n of this.domainNodes) {
        const cur = n.mesh.material.emissiveIntensity;
        n.mesh.material.emissiveIntensity = cur + (n.baseEmissive - cur) * 0.18;
      }
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }

  dispose() {
    this.running = false;
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this._onMove);
      this.canvas.removeEventListener('mouseleave', this._onLeave);
      this.canvas.removeEventListener('click', this._onClick);
      this.canvas.style.cursor = '';
    }
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onScroll);

    /* Walk every mesh/line/points in the network group and free GPU buffers. */
    if (this.network) {
      this.network.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    if (this.renderer) this.renderer.dispose();
  }
}

/* --------------------------------------------------------------------------
 * Singleton wrapper for the legacy IIFE app.js — same API as before so
 * showWelcome() and removeParallaxShapes() require no changes.
 * -------------------------------------------------------------------------- */
let instance = null;
let mountedRoot = null;
let tooltipEl = null;

function ensureTooltip(root) {
  if (tooltipEl && tooltipEl.parentNode === root) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'welcome-3d-tooltip';
  tooltipEl.setAttribute('role', 'status');
  tooltipEl.setAttribute('aria-live', 'polite');
  root.appendChild(tooltipEl);
  return tooltipEl;
}

window.AetherWelcome = {
  mount(container, options) {
    this.dispose();
    if (!container) return false;

    const size = (options && options.size) || 320;
    const canvas = document.createElement('canvas');
    canvas.className = 'welcome-3d-canvas';
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    container.appendChild(canvas);

    const tip = ensureTooltip(container);

    const opts = Object.assign({}, options, {
      onHover: (domain) => {
        if (!tip) return;
        if (domain) {
          tip.textContent = domain.label;
          tip.classList.add('visible');
        } else {
          tip.classList.remove('visible');
        }
      },
    });

    const scene = new NetworkScene(canvas, opts);
    if (scene.disabled) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
      tooltipEl = null;
      return false;
    }

    instance = scene;
    mountedRoot = container;
    container.classList.add('welcome-3d-active');
    return true;
  },

  setTheme(theme) { if (instance) instance.setTheme(theme); },

  highlight(prefix) { if (instance) instance.highlight(prefix); },

  isActive() { return !!instance; },

  dispose() {
    if (instance) {
      instance.dispose();
      instance = null;
    }
    if (mountedRoot) {
      mountedRoot.classList.remove('welcome-3d-active');
      const oldCanvas = mountedRoot.querySelector('canvas.welcome-3d-canvas');
      if (oldCanvas) oldCanvas.remove();
      const oldTip = mountedRoot.querySelector('.welcome-3d-tooltip');
      if (oldTip) oldTip.remove();
      mountedRoot = null;
    }
    tooltipEl = null;
  },
};
