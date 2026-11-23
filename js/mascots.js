/* StudySpace 3D mascots on the page.
   Renders StudyBuddy and LifeBuddy into small canvas hosts for Home cards,
   buddy chat headers, the Study Games lobby and the Accessories fitting room.
   The mascots are deliberately non-interactive outside the fitting room: no tap
   reactions, no speech bubbles, no orbit controls. They breathe, blink and sway
   on their own, and sleep on the Life Tracker schedule with a locked sleeping
   state that never briefly wakes when views or tabs change. */
import * as THREE from './vendor/three.module.js';
import { createStudyBuddy, createLifeBuddy, animateMascot } from './mascotmodels.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function sleepNow() {
  try { if (typeof window.sleepTime === 'function') return !!window.sleepTime(); } catch (e) {}
  const h = new Date().getHours();
  return h >= 22 || h < 5;
}

/* Soft repeating "z z z" texture for the sleeping state. */
let zTex = null;
function zTexture() {
  if (zTex) return zTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#5d6e64';
  g.font = '700 92px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 64, 68);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

function makeLashes(face) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x3b3236 });
  const out = [];
  [-1, 1].forEach((side) => {
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 18, Math.PI), mat);
    lash.position.set(side * 0.25, 0.075, 0.945);
    lash.rotation.z = Math.PI;
    lash.visible = false;
    face.add(lash);
    out.push(lash);
  });
  return out;
}

class MascotView {
  constructor(host, opts) {
    this.host = host;
    this.opts = opts || {};
    this.kind = this.opts.kind === 'life' ? 'life' : 'study';
    this.mode = this.opts.mode || 'idle';
    this.free = !!this.opts.free;
    this.view = this.opts.view || this.kind;
    this.t = 0;
    this.animT = 0;
    this.last = 0;
    this.yaw = this.free ? 0.18 : (this.opts.yaw != null ? this.opts.yaw : 0.16);
    this.yawTarget = this.yaw;
    this.pitch = 0;
    this.pitchTarget = 0;
    this.drag = null;
    this.auto = 0;
    this.visible = true;
    this.sleeping = this.mode === 'sleep' && sleepNow();
    this.models = {};
    this.zzz = [];
    this.alive = true;
    this.frames = 0;

    this.build();
    this.resize();
    this.bind();

    this.io = null;
    try {
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) this.visible = e.isIntersecting;
      }, { rootMargin: '60px' });
      this.io.observe(host);
    } catch (e) { this.visible = true; }

    this.ro = null;
    try {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
    } catch (e) {}

    this.loop = (now) => this.frame(now);
    this.raf = requestAnimationFrame(this.loop);
  }

  build() {
    const host = this.host;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.domElement.className = 'b3d-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe7d3d8, 1.35));
    const key = new THREE.DirectionalLight(0xfff4e4, 2.1); key.position.set(2.4, 4.2, 5.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc2dd, 0.9); rim.position.set(-3.2, 2.4, -3.4); scene.add(rim);

    this.camera = new THREE.PerspectiveCamera(31, 1, 0.1, 40);
    if (this.mode === 'fitting') {
      /* a little further back so the whole buddy sits inside the stage */
      this.camera.position.set(0, 0.34, 6.6);
    } else {
      this.camera.position.set(0, 0.28, 5.2);
    }
    this.camera.lookAt(0, -0.02, 0);

    this.pivot = new THREE.Group();
    scene.add(this.pivot);

    const study = createStudyBuddy();
    const life = createLifeBuddy();
    [study, life].forEach((m) => {
      const u = m.userData;
      u.anim = 'idle';
      u.w = { idle: 1, run: 0, celebrate: 0 };
      u.spin = 0;
      u.hb0 = [u.leftHand.position.clone(), u.rightHand.position.clone()];
      u.eyes = [u.face.getObjectByName('leftEye'), u.face.getObjectByName('rightEye')];
      u.smile = u.face.getObjectByName('smile');
      u.lashes = makeLashes(u.face);
      u.sleepEyes = false;
      this.pivot.add(m);
    });
    this.models.study = study;
    this.models.life = life;

    if (this.mode === 'sleep' && this.sleeping) this.setSleepVisual(true);

    /* floating zZz — only visible while asleep */
    const tex = zTexture();
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.setScalar(0.3 + i * 0.06);
      sp.visible = false;
      this.pivot.add(sp);
      this.zzz.push(sp);
    }

    this.applyView(true);
  }

  applyView(instant) {
    const duo = this.view === 'duo';
    const showStudy = this.view !== 'life';
    const showLife = this.view !== 'study';
    const s = duo ? 0.66 : 0.82;
    if (!this.layout) this.layout = {};
    Object.keys(this.models).forEach((k) => {
      const m = this.models[k];
      const show = k === 'study' ? showStudy : showLife;
      /* target pose for this view; the render loop eases the rig towards it so
         StudyBuddy / LifeBuddy / Duo swap in place without rebuilding models */
      const L = this.layout[k] = {
        x: duo ? (k === 'study' ? -0.82 : 0.82) : 0,
        y: duo ? -0.12 : 0,
        z: duo ? 0.15 : 0,
        s,
        ry: duo ? (k === 'study' ? 0.2 : -0.2) : 0
      };
      if (!show) { m.visible = false; return; }
      if (instant) {
        m.visible = true;
        m.position.set(L.x, L.y, L.z);
        m.rotation.y = L.ry;
        m.scale.setScalar(L.s);
      } else if (!m.visible) {
        /* a newly shown buddy grows into place instead of popping */
        m.visible = true;
        m.position.set(L.x, L.y, L.z);
        m.rotation.y = L.ry;
        m.scale.setScalar(L.s * 0.6);
      }
    });
    if (this.pivot) this.pivot.rotation.y = this.yaw;
    this.resize();
  }

  /* Ease the rigs towards the current view's target pose. */
  tweenLayout(dt) {
    if (!this.layout) return;
    const k = Math.min(1, dt * 9);
    Object.keys(this.models).forEach((key) => {
      const m = this.models[key], L = this.layout[key];
      if (!L || !m.visible) return;
      m.position.x += (L.x - m.position.x) * k;
      m.position.y += (L.y - m.position.y) * k;
      m.position.z += (L.z - m.position.z) * k;
      m.rotation.y += (L.ry - m.rotation.y) * k;
      m.scale.setScalar(m.scale.x + (L.s - m.scale.x) * k);
    });
  }

  setView(v) {
    this.view = v === 'life' || v === 'duo' ? v : 'study';
    /* face the room again after a spin; otherwise the duo lines up edge-on */
    this.yawTarget = 0.2;
    this.yaw = 0.2;
    this.pitchTarget = 0;
    this.pitch = 0;
    this.auto = 0;
    this.applyView(true);
  }

  setMode(mode) {
    this.mode = mode || 'idle';
    if (this.mode === 'sleep') {
      this.sleeping = true;
      this.setSleepVisual(true);
    } else {
      this.sleeping = false;
      this.setSleepVisual(false);
    }
  }

  setSleepVisual(on) {
    Object.keys(this.models).forEach((k) => {
      const u = this.models[k].userData;
      if (u.lashes) u.lashes.forEach((l) => { l.visible = !!on; });
      u.sleepEyes = !!on;
      if (!on) {
        u.bodyGroup.position.y = 0;
        u.bodyGroup.rotation.set(0, 0, 0);
        u.bodyGroup.scale.set(1, 1, 1);
      }
    });
    if (!on) this.zzz.forEach((sp) => { sp.visible = false; sp.material.opacity = 0; });
  }

  bind() {
    if (!this.free) return;
    const el = this.host;
    el.classList.add('b3d-drag');
    const down = (e) => {
      this.drag = { x: e.clientX, y: e.clientY, yaw: this.yawTarget, pitch: this.pitchTarget };
      this.auto = 0;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const move = (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.yawTarget = this.drag.yaw + dx * 0.011;
      this.pitchTarget = clamp(this.drag.pitch + dy * 0.004, -0.3, 0.3);
      this.auto = 0;
    };
    const up = () => { this.drag = null; this.auto = performance.now(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (this.drag && e.buttons === 0) up(); });
    this.cleanupDrag = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }

  resize() {
    if (!this.renderer || !this.host) return;
    const w = Math.max(24, this.host.clientWidth || 80);
    const h = Math.max(24, this.host.clientHeight || 80);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    /* only touch the drawing buffer when something actually changed — calling
       setSize every switch reallocates the canvas and stutters the room */
    if (this._dpr !== dpr) { this.renderer.setPixelRatio(dpr); this._dpr = dpr; }
    if (this._w !== w || this._h !== h) {
      this.renderer.setSize(w, h, false);
      this._w = w; this._h = h;
    }
    const aspect = w / h;
    this.camera.aspect = aspect;
    const duo = this.view === 'duo';
    const tan = Math.tan((this.camera.fov * Math.PI / 180) / 2);
    const needW = duo ? 3.5 : 2.45;
    const dist = Math.max(
      4.7,
      (needW / 2) / (tan * aspect) * 1.12,
      (2.55 / 2) / tan * 1.12
    );
    this.camera.position.z = dist;
    this.camera.position.y = 0.26;
    this.camera.lookAt(0, -0.04, 0);
    this.camera.updateProjectionMatrix();
  }

  frame(now) {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;

    /* Idle mascots only need ~30fps and nothing while off-screen or hidden.
       While a fitting room is open they pause completely so the room gets the
       whole GPU. */
    if (this.mode === 'idle' && !this.free) {
      if (fittingViews > 0) return;
      this.frames++;
      if (this.frames % 2) return;
    }
    if (!this.visible || document.hidden) return;
    this.t += dt;
    this.render(dt);
  }

  render(dt) {
    const duo = this.view === 'duo';
    const list = Object.keys(this.models).map((k) => this.models[k]).filter((m) => m.visible);

    if (this.free) {
      if (!this.drag) {
        const idleFor = performance.now() - (this.auto || 0);
        if (idleFor > 2600) this.yawTarget += dt * 0.22;
      }
      /* damped inertia: 0.12 per 60Hz frame, frame-rate independent */
      const damp = 1 - Math.pow(1 - 0.12, dt * 60);
      this.yaw += (this.yawTarget - this.yaw) * damp;
      this.pitch += (this.pitchTarget - this.pitch) * damp;
      this.pivot.rotation.y = this.yaw;
      this.pivot.rotation.x = this.pitch * 0.45;
      this.pitch = clamp(this.pitch, -0.3, 0.3);
    }

    this.tweenLayout(dt);

    if (this.sleeping) {
      this.animT += dt;
      list.forEach((m) => this.applySleep(m, this.animT, dt));
      this.floatZ(dt);
    } else {
      const speed = this.mode === 'portrait' ? 1.35 : 1;
      this.animT += dt * speed;
      if (this.mode === 'portrait') {
        /* happy bounce facing the player, never spinning the face away */
        this.pivot.rotation.y = 0.26 + Math.sin(this.t * 0.85) * 0.34;
      }
      list.forEach((m) => {
        if (m.userData.anim !== 'idle') m.userData.anim = 'idle';
        animateMascot(m, this.animT, duo ? (m === this.models.study ? 0 : 1.7) : 0, dt);
        m.userData.sleepEyes = false;
        if (m.userData.lashes) m.userData.lashes.forEach((l) => { if (l.visible) l.visible = false; });
      });
      this.zzz.forEach((sp) => { sp.visible = false; });
    }

    this.renderer.render(this.scene, this.camera);
  }

  applySleep(m, t, dt) {
    const u = m.userData;
    if (!u.hb0) u.hb0 = [u.leftHand.position.clone(), u.rightHand.position.clone()];
    const sy = 1 + 0.028 * Math.sin(t * 1.25);
    const sx = 1 / Math.sqrt(sy);
    u.bodyGroup.position.y = -0.06 + Math.sin(t * 1.1) * 0.025;
    u.bodyGroup.rotation.x = lerp(u.bodyGroup.rotation.x, 0.15, Math.min(1, dt * 5));
    u.bodyGroup.rotation.z = Math.sin(t * 0.5) * 0.025;
    u.bodyGroup.scale.set(sx, sy, sx);

    u.ears.forEach((e, i) => {
      const s = i ? 1 : -1;
      e.rotation.z = lerp(e.rotation.z, s * 0.34, Math.min(1, dt * 4));
    });
    u.eyes.forEach((e) => { e.scale.y += (0.1 - e.scale.y) * Math.min(1, dt * 12); });
    if (u.smile) u.smile.scale.set(1, 0.3, 1);
    [u.leftHand, u.rightHand].forEach((h, i) => {
      const b = u.hb0[i];
      h.position.set(b.x * 0.93, b.y - 0.08, b.z + 0.06);
    });
    if (u.sprout) {
      u.sprout.rotation.x = lerp(u.sprout.rotation.x, 0.36, Math.min(1, dt * 4));
      u.sprout.rotation.z = Math.sin(t * 0.9) * 0.05;
    }
    u.tails.forEach((tl) => { tl.rotation.z = tl.userData.rz + Math.sin(t * 1.2) * 0.06; });
    u.shadow.scale.setScalar(1); u.shadow.material.opacity = 0.22;
  }

  floatZ(dt) {
    const base = this.view === 'duo' ? 0.95 : 0.78;
    this.zzz.forEach((sp, i) => {
      sp.visible = true;
      const phase = (this.t * 0.4 + i * 0.32) % 1;
      sp.position.set((this.kind === 'life' ? 0.66 : 0.6) + phase * 0.2, base + phase * 0.62, 1.25);
      sp.scale.setScalar((0.3 + i * 0.05) * (0.85 + phase * 0.45));
      sp.material.opacity = Math.sin(phase * Math.PI) * 0.85;
    });
  }

  updateSleep() {
    if (this.mode !== 'idle' && this.mode !== 'sleep') return;
    const nowSleep = sleepNow();
    if (nowSleep && !this.sleeping) {
      this.mode = 'sleep';
      this.sleeping = true;
      this.setSleepVisual(true);
    } else if (!nowSleep && this.sleeping) {
      this.mode = 'idle';
      this.sleeping = false;
      this.setSleepVisual(false);
    }
  }

  dispose() {
    this.alive = false;
    if (this.mode === 'fitting' && !this._fitCounted) { this._fitCounted = true; fittingViews = Math.max(0, fittingViews - 1); }
    cancelAnimationFrame(this.raf);
    try { this.io && this.io.disconnect(); } catch (e) {}
    try { this.ro && this.ro.disconnect(); } catch (e) {}
    try { this.cleanupDrag && this.cleanupDrag(); } catch (e) {}
    this.models && Object.keys(this.models).forEach((k) => {
      const m = this.models[k];
      m.traverse && m.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((x) => x.dispose());
          else o.material.dispose();
        }
      });
    });
    if (this.renderer) {
      try { this.renderer.dispose(); this.renderer.forceContextLoss(); } catch (e) {}
      if (this.renderer.domElement && this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      this.renderer = null;
    }
    this.host = null;
  }
}

/* ============ manager ============ */
const live = new Set();
const explicit = new WeakMap();
/* How many fitting rooms are currently mounted. Idle mascots stand down while
   one is open so the room renders at a steady frame rate. */
let fittingViews = 0;

function makeIdle(el) {
  if (el.__b3d) return el.__b3d;
  const kind = el.getAttribute('data-buddy3d') === 'life' ? 'life' : 'study';
  try {
    const iv = new MascotView(el, { kind: kind, mode: sleepNow() ? 'sleep' : 'idle' });
    el.__b3d = iv;
    live.add(iv);
    return iv;
  } catch (e) {
    /* no WebGL on this device: the soft placeholder stays */
    el.classList.add('b3d-flat');
    return null;
  }
}

function scan() {
  document.querySelectorAll('[data-buddy3d]:not([data-b3d-manual])').forEach((el) => {
    if (!el.__b3d) makeIdle(el);
  });
  for (const iv of Array.from(live)) {
    if (!iv.host || !document.contains(iv.host)) {
      live.delete(iv);
      iv.dispose();
    }
  }
}

function fitting(el, view) {
  if (!el) return null;
  let iv = explicit.get(el);
  if (!iv) {
    try {
      iv = new MascotView(el, { kind: 'study', free: true, mode: 'fitting', view: view || 'study', yaw: 0.2 });
      explicit.set(el, iv);
      el.__b3dView = iv;
      live.add(iv);
      fittingViews++;
      el.classList.add('is-3d');
    } catch (e) { el.classList.add('b3d-flat'); return null; }
  }
  iv.setView(view || 'study');
  return iv;
}

function portrait(el, kind, anim) {
  if (!el) return null;
  try {
    const iv = new MascotView(el, { kind: kind === 'life' ? 'life' : 'study', mode: anim === 'celebrate' ? 'portrait' : 'idle', yaw: 0.25 });
    el.__b3dPortrait = iv;
    live.add(iv);
    return iv;
  } catch (e) { return null; }
}

function disposeAll() {
  for (const iv of Array.from(live)) {
    live.delete(iv);
    try { iv.dispose(); } catch (e) {}
  }
}

function disposeEl(el) {
  if (!el) return;
  const iv = explicit.get(el) || el.__b3dPortrait || el.__b3d;
  if (iv) {
    live.delete(iv);
    try { iv.dispose(); } catch (e) {}
    if (el.__b3dView === iv) el.__b3dView = null;
    if (el.__b3dPortrait === iv) el.__b3dPortrait = null;
    if (el.__b3d === iv) el.__b3d = null;
  }
}

/* Keep the sleeping state authoritative across tabs and view switches. */
setInterval(() => { for (const iv of live) iv.updateSleep(); }, 12000);
document.addEventListener('visibilitychange', () => {
  for (const iv of live) iv.updateSleep();
});

let queued = false;
function refresh() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scan();
  });
}

try {
  const view = document.getElementById('view');
  if (view) new MutationObserver(refresh).observe(view, { childList: true, subtree: true });
  new MutationObserver(refresh).observe(document.body, { childList: true });
} catch (e) {}

try {
  const oldRender = window.render;
  if (typeof oldRender === 'function') {
    window.render = function () {
      const out = oldRender.apply(this, arguments);
      refresh();
      return out;
    };
  }
} catch (e) {}

window.ssMascot = {
  refresh: refresh,
  fitting: fitting,
  portrait: portrait,
  disposeEl: disposeEl,
  disposeAll: disposeAll,
  state: function () {
    return Array.from(live).map((iv) => ({ kind: iv.kind, mode: iv.sleeping ? 'sleep' : iv.mode, view: iv.view, alive: iv.alive }));
  }
};

/* First paint: placeholders show immediately, models arrive with the module. */
refresh();
setTimeout(refresh, 400);

/* Buddy Run imports this to show the played buddy on the game-over card. */
export { portrait as mountPortrait };
