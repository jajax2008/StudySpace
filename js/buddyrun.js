/* Buddy Run — StudySpace 3D endless runner.
   The approved StudyBuddy and LifeBuddy models live in mascotmodels.js and
   keep their exact geometry, materials, face, glasses, sprout and bandana.
   The running stage, camera, controls and HUD are new: an anchored ground,
   scrolling lane markers, pooled obstacles, instanced coins, an intro drop,
   delta-time movement, damped lane changes and a trailing spring camera.

   Loaded lazily as a module by js/games.js. Exposes window.ssRun. */
import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* The approved mascot models live in mascotmodels.js and are shared with the
   rest of the app, unchanged. */
import { createStudyBuddy, createLifeBuddy, animateMascot } from './mascotmodels.js';
import { mountPortrait } from './mascots.js';

/* ================= STAGE ================= */
const LANE = 2.15;
const PLAYER_SCALE = 0.6;
const PLAYER_Y = 1.25 * PLAYER_SCALE;
/* A slight three-quarter back view keeps the buddy readable from behind and
   hides the edge-on glasses arms that a straight back view exposed. */
const RUN_YAW = Math.PI - 0.42;

const PAL = [
  { n: 'Sage Meadow', sky: 0xbfe6d3, ground: 0x8ed3a6, track: 0x64759b, rail: 0xf3e2b0, leafA: 0x53a477, leafB: 0x79c79a },
  { n: 'Terracotta Dusk', sky: 0xffc7a4, ground: 0xd98a63, track: 0x7b5b79, rail: 0xffe6b9, leafA: 0xc2563c, leafB: 0xe7944f },
  { n: 'Sakura Lane', sky: 0xffd9e8, ground: 0xf0a9c6, track: 0x8b6fb8, rail: 0xfff1f7, leafA: 0xe57aa6, leafB: 0xc4a2ff },
  { n: 'Night Focus', sky: 0x283566, ground: 0x254463, track: 0x3b4272, rail: 0xffe58a, leafA: 0x2f7d8f, leafB: 0x44a89e },
  { n: 'Autumn Study', sky: 0xf6e0b0, ground: 0xc89a4a, track: 0x615b6c, rail: 0xffedb8, leafA: 0xd9692b, leafB: 0xe8b13a }
];

let stage = null;

function buildStage() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  /* Keep the fill-rate sane on very large phone screens so the run stays smooth. */
  if (window.innerWidth * window.innerHeight * dpr * dpr > 1.35e6) dpr = 1.5;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.className = 'gr-canvas';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL[0].sky);
  scene.fog = new THREE.Fog(PAL[0].sky, 34, 118);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe9d8dc, 1.25));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.9); sun.position.set(6, 12, 7); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffc2dd, 0.85); rim.position.set(-6, 5, -7); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
  camera.position.set(0, 3.6, 8.6);
  camera.lookAt(0, 1.1, -10);

  const M = {
    ground: new THREE.MeshLambertMaterial({ color: PAL[0].ground }),
    track: new THREE.MeshLambertMaterial({ color: PAL[0].track }),
    rail: new THREE.MeshLambertMaterial({ color: PAL[0].rail }),
    lane: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13 }),
    leafA: new THREE.MeshLambertMaterial({ color: PAL[0].leafA }),
    leafB: new THREE.MeshLambertMaterial({ color: PAL[0].leafB }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x7a5238 }),
    hudLine: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
  };
  const hazardMat = new THREE.MeshLambertMaterial({ color: 0xe07a4e });
  const hazardLight = new THREE.MeshLambertMaterial({ color: 0xfff0dc });
  const wallA = new THREE.MeshLambertMaterial({ color: 0xb97f4c });
  const wallB = new THREE.MeshLambertMaterial({ color: 0x7d5330 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xff9bb3 });

  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CONE = new THREE.ConeGeometry(1, 1, 9);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
  const SPH = new THREE.SphereGeometry(1, 12, 8);
  const mk = (geo, mat, sx, sy, sz, x, y, z, parent) => {
    const o = new THREE.Mesh(geo, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, z); parent && parent.add(o); return o;
  };

  /* ground + track */
  const ground = mk(new THREE.PlaneGeometry(240, 420).rotateX(-Math.PI / 2), M.ground, 1, 1, 1, 0, 0, -150);
  const track = mk(new THREE.PlaneGeometry(6.9, 420).rotateX(-Math.PI / 2), M.track, 1, 1, 1, 0, 0.012, -150);
  const shoulderL = mk(BOX, M.rail, 0.26, 0.2, 420, -3.58, 0.1, -150);
  const shoulderR = mk(BOX, M.rail, 0.26, 0.2, 420, 3.58, 0.1, -150);
  scene.add(ground, track, shoulderL, shoulderR);

  /* scrolling lane dashes — two instanced meshes, so 144 dashes cost 2 draw calls */
  const laneDashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.02, 1.6), M.lane, 84);
  const edgeDashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.02, 0.9), M.hudLine, 60);
  laneDashes.frustumCulled = false; edgeDashes.frustumCulled = false;
  scene.add(laneDashes, edgeDashes);

  /* pools */
  const obstaclePool = { jump: [], slide: [], wall: [] };
  function makeJump() {
    const g = new THREE.Group();
    mk(BOX, hazardMat, 1.72, 0.62, 0.42, 0, 0.31, 0, g);
    mk(BOX, hazardLight, 1.74, 0.12, 0.45, 0, 0.5, 0, g);
    mk(BOX, hazardLight, 1.74, 0.12, 0.45, 0, 0.16, 0, g);
    scene.add(g); return g;
  }
  function makeSlide() {
    const g = new THREE.Group();
    mk(BOX, hazardMat, 0.17, 1.9, 0.17, -0.86, 0.95, 0, g);
    mk(BOX, hazardMat, 0.17, 1.9, 0.17, 0.86, 0.95, 0, g);
    mk(BOX, hazardMat, 1.9, 0.5, 0.34, 0, 1.34, 0, g);
    mk(BOX, hazardLight, 1.92, 0.1, 0.36, 0, 1.34, 0, g);
    scene.add(g); return g;
  }
  function makeWall() {
    const g = new THREE.Group();
    mk(BOX, wallA, 1.7, 2.0, 1.1, 0, 1.0, 0, g);
    for (const y of [0.4, 1.5]) mk(BOX, wallB, 1.74, 0.16, 1.14, 0, y, 0, g);
    scene.add(g); return g;
  }
  for (let i = 0; i < 10; i++) {
    const j = makeJump(), s = makeSlide(), w = makeWall();
    j.visible = s.visible = w.visible = false;
    obstaclePool.jump.push(j); obstaclePool.slide.push(s); obstaclePool.wall.push(w);
  }

  /* Coins: a bevelled gold disc with a raised rim and a soft centre boss.
     Three instanced meshes (disc, rim, boss) keep the whole pool at 3 draws. */
  const coinProfile = [
    new THREE.Vector2(0.0, 0.052), new THREE.Vector2(0.2, 0.052),
    new THREE.Vector2(0.245, 0.036), new THREE.Vector2(0.285, 0.018),
    new THREE.Vector2(0.3, 0.0), new THREE.Vector2(0.285, -0.018),
    new THREE.Vector2(0.245, -0.036), new THREE.Vector2(0.2, -0.052),
    new THREE.Vector2(0.0, -0.052)
  ];
  const coinGeo = new THREE.LatheGeometry(coinProfile, 40).rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshPhysicalMaterial({ color: 0xffd35a, metalness: 0.55, roughness: 0.24, clearcoat: 1.0, clearcoatRoughness: 0.1, emissive: 0x9a5c00, emissiveIntensity: 0.4 });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, 80);
  coins.frustumCulled = false;
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(coins);

  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xffeaa0, metalness: 0.6, roughness: 0.18, clearcoat: 1.0, emissive: 0xa86a00, emissiveIntensity: 0.45 });
  const coinRims = new THREE.InstancedMesh(new THREE.TorusGeometry(0.262, 0.017, 8, 36), rimMat, 80);
  coinRims.frustumCulled = false;
  coinRims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(coinRims);

  const bossMat = new THREE.MeshPhysicalMaterial({ color: 0xffe08a, metalness: 0.5, roughness: 0.26, clearcoat: 0.8, emissive: 0x8a5600, emissiveIntensity: 0.4 });
  const coinBoss = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.03, 24).rotateX(Math.PI / 2), bossMat, 80);
  coinBoss.frustumCulled = false;
  coinBoss.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(coinBoss);

  const hideAll = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < 80; i++) { coins.setMatrixAt(i, hideAll); coinRims.setMatrixAt(i, hideAll); coinBoss.setMatrixAt(i, hideAll); }

  /* Collect sparkle: one Points cloud, recycled per pickup. */
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = sparkCanvas.height = 64;
  const sctx = sparkCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,248,214,1)');
  grad.addColorStop(0.35, 'rgba(255,214,98,.9)');
  grad.addColorStop(1, 'rgba(255,180,40,0)');
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 64, 64);
  const sparkTex = new THREE.CanvasTexture(sparkCanvas);
  sparkTex.colorSpace = THREE.SRGBColorSpace;
  const sparkN = 64;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(sparkN * 3);
  for (let i = 0; i < sparkN; i++) { sparkPos[i * 3 + 1] = -999; }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ size: 0.34, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.95 });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkLife = new Float32Array(sparkN);
  const sparkVel = new Float32Array(sparkN * 3);
  let sparkAt = 0;

  /* extra scrolling markers on the shoulders keep the world moving while the
     ground mesh itself stays perfectly still */
  const shoulderDashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.015, 0.7), M.hudLine, 44);
  shoulderDashes.frustumCulled = false;
  scene.add(shoulderDashes);

  /* question gates */
  const gateMat = new THREE.MeshLambertMaterial({ color: 0x8b6fb8 });
  const gateGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const gatePool = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    mk(BOX, gateMat, 0.26, 3.2, 0.26, -3.95, 1.6, 0, g);
    mk(BOX, gateMat, 0.26, 3.2, 0.26, 3.95, 1.6, 0, g);
    mk(BOX, gateMat, 8.2, 0.34, 0.3, 0, 3.2, 0, g);
    mk(new THREE.PlaneGeometry(6.4, 2.9).rotateX(-Math.PI / 2), gateGlow, 1, 1, 1, 0, 0.04, 0, g);
    g.visible = false; scene.add(g); gatePool.push(g);
  }

  /* roadside decor (built once, then recycled ahead of the runner) */
  const decor = [];
  function decorItem(kind) {
    const g = new THREE.Group();
    if (kind === 0) { // tree
      mk(CYL, M.trunk, 0.16, 1.1, 0.16, 0, 0.55, 0, g);
      const leaf = new THREE.Mesh(SPH, Math.random() < 0.5 ? M.leafA : M.leafB);
      leaf.scale.set(1.05, 0.95, 1.05); leaf.position.y = 1.75; g.add(leaf);
      const cone = new THREE.Mesh(CONE, M.leafB); cone.scale.set(0.9, 1.5, 0.9); cone.position.y = 2.6; g.add(cone);
    } else if (kind === 1) { // lamp
      mk(CYL, M.trunk, 0.06, 2.7, 0.06, 0, 1.35, 0, g);
      mk(SPH, leafMat, 0.24, 0.24, 0.24, 0, 2.78, 0, g);
    } else if (kind === 2) { // bush
      mk(SPH, M.leafA, 0.8, 0.55, 0.8, 0, 0.4, 0, g);
      mk(SPH, M.leafB, 0.55, 0.4, 0.55, 0.6, 0.32, 0.2, g);
    } else { // hill
      const h = new THREE.Mesh(CONE, M.leafB);
      h.scale.set(5.5, 3.4, 5.5); h.position.y = 1.6; g.add(h);
    }
    scene.add(g);
    return { g, kind };
  }
  for (let i = 0; i < 26; i++) {
    const it = decorItem(i % 4 === 3 ? 3 : i % 3);
    decor.push({ obj: it.g, s: i * 13 + 20, side: i % 2 ? 1 : -1, x: 5.4 + Math.random() * 9 });
  }

  /* player contact shadow */
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2b2430, transparent: true, opacity: 0.24, depthWrite: false }));
  scene.add(shadow);

  const buddies = { study: createStudyBuddy(), life: createLifeBuddy() };
  for (const k in buddies) {
    const b = buddies[k];
    b.scale.setScalar(PLAYER_SCALE);
    b.userData.anim = 'idle';
    b.userData.shadow.visible = false;
    b.rotation.y = RUN_YAW;
    b.position.set(0, PLAYER_Y, 0);
    scene.add(b);
  }

  function newObstacle(kind) {
    const m = kind === 'jump' ? makeJump() : kind === 'slide' ? makeSlide() : makeWall();
    m.visible = false;
    obstaclePool[kind].push(m);
    return m;
  }

  return { renderer, scene, camera, M, laneDashes, edgeDashes, shoulderDashes, coins, coinRims, coinBoss, coinDummy: new THREE.Object3D(), obstaclePool, gatePool, decor, shadow, buddies, pal: { i: 0, t: null }, sun, newObstacle, sparks, sparkGeo, sparkLife, sparkVel };
}

/* ================= ENGINE ================= */
const ICON = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.4-4.6-7.4-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.4 3.1C19.4 15.4 12 20 12 20Z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.7" style="fill:#e8b349;stroke:#a8741f"/><circle cx="12" cy="12" r="5.9" style="fill:none;stroke:#fff8e2;stroke-width:1.2;opacity:.78"/><path d="M8.3 9.7c1.1-1.7 3.5-2.1 5.2-1" style="fill:none;stroke:#fff;stroke-width:1.3;opacity:.85"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
  jump: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/></svg>',
  slide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6l8 6-8 6zM17 5v14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

function h(tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
}

class BuddyRun {
  constructor(opts) {
    this.opts = opts || {};
    this.root = null;
    this.playing = false;
    this.paused = false;
    this.over = false;
    this.qOpen = false;
    this.timeScale = 1;
    this.raf = 0;
    this.lastT = 0;
    this.t = 0;
    this.questions = [];
    this.qPool = [];
    this.best = Number(this.opts.best) || 0;
    this.resizeBound = () => this.resize();
    this.keyBound = (e) => this.onKey(e);
  }

  mount() {
    const root = h('div', 'gr');
    root.id = 'gr';
    root.innerHTML =
      '<div class="gr-scene"></div>' +
      '<div class="gr-vig" aria-hidden="true"></div>' +
      '<div class="gr-hud">' +
        '<div class="gr-hearts" id="grHearts" aria-label="Hearts"></div>' +
        '<div class="gr-meta">' +
          '<span class="gr-chip" id="grCoins">' + ICON.coin + '<b>0</b></span>' +
          '<span class="gr-chip" id="grDist"><b>0</b> m</span>' +
          '<span class="gr-chip gr-lvl" id="grLvl">Lv 1</span>' +
        '</div>' +
        '<button class="gr-round" id="grPause" type="button" aria-label="Pause" title="Pause">' + ICON.pause + '</button>' +
      '</div>' +
      '<div class="gr-recover" id="grRecover" hidden><b id="grRecoverTxt">Recovery 0/2</b><i><b></b></i></div>' +
      '<div class="gr-hurt" id="grHurt" aria-hidden="true"><b>-1</b><span>heart</span></div>' +
      '<div class="gr-toast" id="grToast" aria-live="polite"></div>' +
      '<div class="gr-question" id="grQ" hidden>' +
        '<div class="gr-q-top"><span class="gr-q-kind" id="grQKind">Question</span><span class="gr-q-time" id="grQTime">10</span></div>' +
        '<p class="gr-q-text" id="grQText"></p>' +
        '<div class="gr-choices" id="grChoices"></div>' +
        '<div class="gr-q-foot"><i class="gr-tbar"><b id="grTFill"></b></i><button class="gr-skip" id="grSkip" type="button">' + ICON.skip + '<span id="grSkipN">3</span></button></div>' +
      '</div>' +
      '<div class="gr-dock" id="grDock">' +
        '<button class="gr-tap" type="button" data-act="left" aria-label="Move left" title="Move left">' + ICON.left + '</button>' +
        '<button class="gr-tap" type="button" data-act="jump" aria-label="Jump" title="Jump">' + ICON.jump + '</button>' +
        '<button class="gr-tap" type="button" data-act="slide" aria-label="Slide" title="Slide">' + ICON.slide + '</button>' +
        '<button class="gr-tap" type="button" data-act="right" aria-label="Move right" title="Move right">' + ICON.right + '</button>' +
      '</div>' +
      '<div class="gr-sheet" id="grSheet" hidden></div>';
    document.body.appendChild(root);
    this.root = root;
    this.el = {
      scene: root.querySelector('.gr-scene'), hearts: root.querySelector('#grHearts'),
      coins: root.querySelector('#grCoins b'), dist: root.querySelector('#grDist b'),
      lvl: root.querySelector('#grLvl'), pause: root.querySelector('#grPause'),
      recover: root.querySelector('#grRecover'), recoverTxt: root.querySelector('#grRecoverTxt'), hurt: root.querySelector('#grHurt'),
      toast: root.querySelector('#grToast'), q: root.querySelector('#grQ'),
      qKind: root.querySelector('#grQKind'), qTime: root.querySelector('#grQTime'),
      qText: root.querySelector('#grQText'), choices: root.querySelector('#grChoices'),
      tFill: root.querySelector('#grTFill'), skip: root.querySelector('#grSkip'), skipN: root.querySelector('#grSkipN'),
      dock: root.querySelector('#grDock'), sheet: root.querySelector('#grSheet')
    };

    if (!stage) stage = buildStage();
    this.stage = stage;
    this.el.scene.appendChild(stage.renderer.domElement);
    this.resize();

    this.bindUI();
    this.resetRun();
    this.resizeBound && window.addEventListener('resize', this.resizeBound);
    this.loop = (now) => this.frame(now);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  bindUI() {
    const root = this.root;
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) { this.act(act.dataset.act); return; }
      if (e.target.closest('#grPause')) { this.togglePause(); return; }
      if (e.target.closest('#grSkip')) { this.skipQuestion(); return; }
      const choice = e.target.closest('[data-choice]');
      if (choice) { this.answer(Number(choice.dataset.choice)); return; }
      const sheetBtn = e.target.closest('[data-sheet]');
      if (sheetBtn) { this.sheetAction(sheetBtn.dataset.sheet); return; }
    });

    /* swipe on the 3D view: ← → lanes, ↑ jump, ↓ slide; tap a side to change lane */
    let sx = 0, sy = 0, st = 0, moved = false;
    const canvas = this.stage.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); moved = false; });
    canvas.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 14 || Math.abs(e.clientY - sy) > 14) moved = true; });
    canvas.addEventListener('pointerup', (e) => {
      if (this.paused || this.over) return;
      const dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - st;
      if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) this.act(dx > 0 ? 'right' : 'left');
      else if (Math.abs(dy) > 34) this.act(dy < 0 ? 'jump' : 'slide');
      else if (!moved && dt < 500) {
        const w = this.root.clientWidth;
        if (e.clientX < w * 0.34) this.act('left');
        else if (e.clientX > w * 0.66) this.act('right');
        else this.act('jump');
      }
    });
    document.addEventListener('keydown', this.keyBound);
    root.tabIndex = -1;
  }

  onKey(e) {
    if (!this.root) return;
    const k = e.key;
    if (k === 'Escape') { this.togglePause(); return; }
    if (this.paused || this.over) return;
    if (k === 'ArrowLeft' || k === 'a') this.act('left');
    else if (k === 'ArrowRight' || k === 'd') this.act('right');
    else if (k === 'ArrowUp' || k === 'w' || k === ' ') { e.preventDefault(); this.act('jump'); }
    else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); this.act('slide'); }
  }

  resize() {
    if (!this.root || !this.stage) return;
    const w = this.root.clientWidth || window.innerWidth;
    const hh = this.root.clientHeight || window.innerHeight;
    this.stage.renderer.setSize(w, hh, false);
    const cam = this.stage.camera;
    cam.aspect = w / hh;
    cam.fov = cam.aspect < 0.8 ? 68 : 58;
    cam.updateProjectionMatrix();
  }

  resetRun() {
    const s = this.stage;
    this.run = {
      px: 0, targetX: 0, lane: 1, py: 0, vy: 0, slideT: 0,
      speed: 8.4, travel: 0, hearts: 3, recover: 0, coins: 0, correct: 0,
      skips: 3, lifeUsed: false, invuln: 0, shake: 0, dodged: 0,
      spawnS: 46, gate: 340, level: 1, hitFlash: 0, started: false,
      intro: 1.15, introY: 6.9, stagger: 0, splash: 0, land: null, nextQ: '', grace: 0
    };
    this.timeScale = 1;
    this.qOpen = false;
    this.sparkCursor = 0;
    this.active = [];
    this.coins = [];
    this.coinUsed = new Array(80).fill(0);
    this.gates = [];
    this.q = null;
    this.over = false;
    this.paused = false;
    this.qOpen = false;
    this.timeScale = 1;
    this.t = 0;
    this.animT = 0;
    this.lastHud = '';
    this.nextPalAt = 240 + Math.random() * 80;
    this.dying = false;
    clearTimeout(this._qT);
    clearTimeout(this._animT);

    /* clear stage */
    this.active.forEach((o) => { o.mesh.visible = false; });
    this.coins = [];
    this.gates.forEach((g) => { g.mesh.visible = false; });

    /* question pool */
    const list = (this.opts.questions || []).filter((x) => x && x.q && x.a && Array.isArray(x.choices) && x.choices.length >= 2);
    this.questions = list.map((x) => ({
      q: String(x.q).slice(0, 220),
      a: String(x.a),
      choices: x.choices.map(String).slice(0, 4),
      e: x.e || x.explain || '',
      lvl: typeof x.lvl === 'number' ? x.lvl : -1
    }));
    this.qPool = [];
    this.seed = Math.floor(Math.random() * 999999);

    /* world reset */
    s.pal.i = Math.floor(Math.random() * PAL.length);
    this.applyPalette(s.pal.i, true);
    this.active = [];
    for (const k in s.obstaclePool) s.obstaclePool[k].forEach((m) => { m.visible = false; });
    this.coinUsed = new Array(80).fill(0);
    const hideCoin = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 80; i++) { s.coins.setMatrixAt(i, hideCoin); s.coinRims.setMatrixAt(i, hideCoin); s.coinBoss.setMatrixAt(i, hideCoin); }
    s.coins.instanceMatrix.needsUpdate = true;
    s.coinRims.instanceMatrix.needsUpdate = true;
    s.coinBoss.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 64; i++) { s.sparkLife[i] = 0; s.sparkGeo.attributes.position.array[i * 3 + 1] = -999; }
    s.sparkGeo.attributes.position.needsUpdate = true;
    s.gatePool.forEach((g) => { g.visible = false; });
    s.decor.forEach((d, i) => { d.s = 20 + i * 12; d.side = i % 2 ? 1 : -1; d.x = 5.4 + Math.random() * 9; });

    const who = this.opts.character === 'life' ? 'life' : 'study';
    for (const k in s.buddies) {
      const b = s.buddies[k];
      b.visible = k === who;
      b.position.set(0, PLAYER_Y, 0);
      b.rotation.y = RUN_YAW;
      b.userData.anim = 'idle';
    }
    this.who = who;
    this.el.pause.hidden = false;
    this.el.dock.hidden = false;
    this.el.recover.hidden = true;
    this.el.q.hidden = true;
    this.el.sheet.hidden = true;
    this.el.sheet.innerHTML = '';
    this.disposeHero();
    this.root.classList.remove('gr-over', 'gr-pause', 'gr-qopen');
    this.el.hurt && this.el.hurt.classList.remove('on');
    this.paintHearts();
    this.paintSkip();
    this.updateHud(true);
  }

  start() {
    if (!this.root) this.mount();
    this.resetRun();
    this.playing = true;
    this.toast('', 0.1);
    clearTimeout(this._introT);
    this._introT = setTimeout(() => {
      if (this.root && this.playing && !this.over) this.toast('Swipe ←→ to change lanes · ↑ jump · ↓ slide', 3.2);
    }, 1150);
  }

  applyPalette(i, instant) {
    const p = PAL[i], s = this.stage;
    this.palC = {
      sky: new THREE.Color(p.sky), ground: new THREE.Color(p.ground), track: new THREE.Color(p.track),
      rail: new THREE.Color(p.rail), leafA: new THREE.Color(p.leafA), leafB: new THREE.Color(p.leafB)
    };
    if (instant) {
      s.scene.background.copy(this.palC.sky);
      s.scene.fog.color.copy(this.palC.sky);
      s.M.ground.color.copy(this.palC.ground);
      s.M.track.color.copy(this.palC.track);
      s.M.rail.color.copy(this.palC.rail);
      s.M.leafA.color.copy(this.palC.leafA);
      s.M.leafB.color.copy(this.palC.leafB);
    }
  }

  diff() { return clamp(this.run.travel / 950, 0, 1); }

  /* ---------- world building ---------- */
  spawn(kind, lane, s) {
    const pool = this.stage.obstaclePool[kind];
    let mesh = pool.find((m) => !m.visible);
    /* Grow the pool instead of stealing a mesh that is still on screen: that
       steal was what made obstacles disappear mid-lane. */
    if (!mesh) mesh = this.stage.newObstacle(kind);
    if (!mesh) return;
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    mesh.position.set((lane - 1) * LANE, 0, -(s - this.run.travel));
    this.active.push({ kind, lane, s, mesh, judged: false, flash: 0, baseY: 0 });
  }

    spawnCoins(lane, s, count, arc) {
    const x = (lane - 1) * LANE;
    for (let i = 0; i < count; i++) {
      let slot = -1;
      for (let k = 0; k < 80; k++) { if (!this.coinUsed[k]) { slot = k; break; } }
      if (slot < 0) return;
      const cs = s + i * 1.35;
      /* never bury a coin inside an obstacle that occupies this lane */
      const blocked = this.active.some((o) => o.lane === lane && Math.abs(o.s - cs) < 3.2) ||
        this.gates.some((g) => Math.abs(g.s - cs) < 5);
      if (blocked) continue;
      this.coinUsed[slot] = 1;
      const y = arc ? 0.55 + Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 1.05 : 0.75;
      this.coins.push({ slot, x, y, s: cs, got: false, lane, rot: 0 });
    }
  }

  spawnGate(s) {
    const mesh = this.stage.gatePool.find((m) => !m.visible);
    if (!mesh) return;
    mesh.visible = true;
    mesh.position.set(0, 0, -(s - this.run.travel));
    this.gates.push({ mesh, s, used: false });
  }

  spawnRow() {
    const r = this.run, d = this.diff();
    const gap = lerp(27, 17, d) + Math.random() * 4;
    r.spawnS += gap;
    const s = r.spawnS;
    /* keep the question gate clear of obstacle rows */
    if (s > r.gate - 16 && s < r.gate + 26) return;
    const roll = Math.random();
    if (roll < 0.2) {
      const lane = Math.floor(Math.random() * 3);
      this.spawn(Math.random() < 0.5 ? 'jump' : 'slide', lane, s);
      this.spawnCoins((lane + 1) % 3, s - 4, 4, false);
    } else if (roll < 0.42) {
      const kind = Math.random() < 0.55 ? 'jump' : 'slide';
      for (let i = 0; i < 3; i++) this.spawn(kind, i, s);
      this.spawnCoins(1, s - 2, 5, kind === 'jump');
    } else if (roll < 0.66) {
      /* two lanes blocked, one always open */
      const open = Math.floor(Math.random() * 3);
      for (let i = 0; i < 3; i++) if (i !== open) this.spawn('wall', i, s);
      this.spawnCoins(open, s - 5, 5, false);
    } else if (roll < 0.84) {
      const lane = Math.floor(Math.random() * 3);
      this.spawn('wall', lane, s);
      this.spawnCoins(lane === 1 ? 0 : 1, s - 4, 3, false);
    } else {
      const lane = Math.floor(Math.random() * 3);
      const kind = Math.random() < 0.5 ? 'jump' : 'slide';
      this.spawn(kind, lane, s);
      const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      if (lane2 !== lane) this.spawn(Math.random() < 0.5 ? 'wall' : 'jump', lane2, s + 9);
      this.spawnCoins(lane, s - 3, 4, kind === 'jump');
    }
    const nd = this.diff();
    if (r.spawnS > r.gate) { this.spawnGate(r.gate + 6); r.gate += lerp(430, 300, nd); }
  }

  /* ---------- questions ---------- */
  pickQuestion() {
    if (!this.questions.length) return null;
    if (!this.qPool.length) this.qPool = this.questions.map((_, i) => i).sort(() => Math.random() - 0.5);
    const level = clamp(Math.floor(this.run.travel / 420), 0, 2);
    let at = this.qPool.findIndex((i) => this.questions[i].lvl >= 0 && this.questions[i].lvl <= level);
    if (at < 0) at = this.qPool.findIndex((i) => this.questions[i].lvl < 0);
    if (at < 0) at = 0;
    const item = this.questions[this.qPool.splice(at, 1)[0]];
    const choices = item.choices.slice();
    if (!choices.includes(item.a)) choices[0] = item.a;
    const uniq = [...new Set(choices)].slice(0, 4);
    while (uniq.length < 3) uniq.push('None of these');
    return { ...item, choices: uniq.sort(() => Math.random() - 0.5) };
  }

  askQuestion(kind) {
    if (this.q || this.over) return;
    const item = this.pickQuestion();
    if (!item) { this.gameOver(); return; }
    if (kind === 'rescue') this.run.lifeUsed = true;
    this.q = { kind, item, t: 10 };
    this.qOpen = true;
    const el = this.el;
    el.q.hidden = false;
    el.qKind.textContent = kind === 'rescue' ? 'LifeBuddy rescue' : kind === 'bonus' ? 'Bonus question' : 'Recovery question';
    el.qText.textContent = item.q;
    el.qTime.textContent = '10';
    el.tFill.style.width = '100%';
    el.tFill.classList.remove('low');
    el.choices.innerHTML = '';
    item.choices.forEach((c, i) => {
      const b = h('button', 'gr-choice', '<span>' + String.fromCharCode(65 + i) + '</span>' + escapeHtml(c));
      b.type = 'button';
      b.dataset.choice = String(i);
      el.choices.appendChild(b);
    });
    el.skip.hidden = kind === 'rescue';
    el.skip.disabled = this.run.skips <= 0;
    el.skip.classList.toggle('off', this.run.skips <= 0);
    el.skipN.textContent = String(this.run.skips);
    this.root.classList.add('gr-qopen');
  }

  answer(idx) {
    const q = this.q;
    if (!q || q.done) return;
    const item = q.item;
    const correct = item.choices[idx] === item.a;
    this.resolveQuestion(correct, false);
  }

  skipQuestion() {
    const q = this.q;
    if (!q || q.done || q.kind === 'rescue') return;
    if (this.run.skips <= 0) return;
    this.run.skips--;
    this.paintSkip();
    this.resolveQuestion(false, true);
  }

  resolveQuestion(correct, skipped) {
    const q = this.q;
    if (!q || q.done) return;
    q.done = true;
    this.el.q.hidden = true;
    this.root.classList.remove('gr-qopen');
    const r = this.run;

    if (q.kind === 'rescue') {
      if (correct) {
        r.hearts = 1;
        r.recover = 0;
        this.dying = false;
        this.paintHearts();
        this.toast('LifeBuddy gave you a heart. Keep going!', 2.6);
        this.resumeRun();
        r.invuln = Math.max(r.invuln, 2.6);
        this.setBuddy('celebrate', 1.1);
      } else {
        this.gameOver();
      }
      return;
    }

    /* Whatever happens in here, the gate must close and the run must resume —
       otherwise a thrown effect leaves the question open forever. */
    try {
      if (correct) {
        r.correct++;
        const gain = q.kind === 'bonus' ? 15 : 10;
        r.coins += gain;
        if (r.hearts < 3) {
          r.recover++;
          if (r.recover >= 2) {
            r.hearts++;
            r.recover = 0;
            this.toast('+' + gain + ' coins · heart recovered +1', 2.4);
          } else {
            this.toast('+' + gain + ' coins · recovery ' + r.recover + '/2', 2.2);
          }
        } else {
          this.toast('+' + gain + ' coins · correct!', 1.8);
        }
        this.burstSpark(r.px, 0.85, 0.2);
      } else {
        if (!skipped && q.kind === 'hit') r.recover = 0;
        const tail = q.item.e ? ' ' + q.item.e : '';
        this.toast((skipped ? 'Skipped. Answer: ' : 'Not quite. Answer: ') + q.item.a + '.' + tail, 4);
      }
    } catch (e) {
      try { console.error('Question reward failed', e); } catch (x) {}
    } finally {
      this.paintHearts();
      this.updateHud(true);
      this.resumeRun();
    }
  }

  /* Closing the Question Gate hands control straight back to the runner: the
     stagger slow-motion ends, the world snaps back to full speed, the input
     lock clears and a short grace window stops the same obstacle hitting again. */
  resumeRun() {
    const r = this.run;
    if (!r) return;
    this.q = null;
    this.qOpen = false;
    this.paused = false;
    this.timeScale = 1;
    r.stagger = 0;
    r.nextQ = '';
    r.grace = Math.max(r.grace || 0, 1.5);
    r.invuln = Math.max(r.invuln || 0, 1.5);
    r.speed = Math.max(r.speed, 10.5 + Math.min(9.5, r.travel / 210));
    this.root.classList.remove('gr-qopen');
    this.el.q.hidden = true;
    this.lastT = performance.now();
    const b = this.stage && this.stage.buddies[this.who];
    if (b) { b.visible = true; b.userData.anim = 'run'; }
  }

  setBuddy(anim, ms) {
    const b = this.stage.buddies[this.who];
    if (!b) return;
    b.userData.anim = anim;
    clearTimeout(this._animT);
    if (ms) this._animT = setTimeout(() => { if (b) b.userData.anim = 'run'; }, ms * 1000);
  }

  /* Heart-loss feedback: a short floating "-1 heart" and a pulse on the HUD. */
  hurt() {
    const el = this.el.hurt;
    if (el) {
      el.classList.remove('on');
      void el.offsetWidth;
      el.classList.add('on');
    }
    const h = this.el.hearts;
    if (h) {
      h.classList.remove('gr-hpulse');
      void h.offsetWidth;
      h.classList.add('gr-hpulse');
    }
  }

  /* Gold sparkle burst when a coin is collected. */
  burstSpark(x, y, z) {
    const s = this.stage;
    if (!s || !s.sparkGeo) return;
    const arr = s.sparkGeo.attributes.position.array;
    for (let n = 0; n < 9; n++) {
      const i = (this.sparkCursor = (this.sparkCursor + 1) % 64);
      s.sparkLife[i] = 0.5 + Math.random() * 0.28;
      arr[i * 3] = x + (Math.random() - 0.5) * 0.28;
      arr[i * 3 + 1] = y + (Math.random() - 0.5) * 0.28;
      arr[i * 3 + 2] = z + (Math.random() - 0.5) * 0.28;
      s.sparkVel[i * 3] = (Math.random() - 0.5) * 2.4;
      s.sparkVel[i * 3 + 1] = 1.2 + Math.random() * 1.9;
      s.sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    }
    s.sparkGeo.attributes.position.needsUpdate = true;
  }

  updateSparks(dt) {
    const s = this.stage;
    if (!s || !s.sparkGeo) return;
    const a = s.sparkGeo.attributes.position.array;
    let any = false;
    for (let i = 0; i < 64; i++) {
      if (s.sparkLife[i] <= 0) continue;
      any = true;
      s.sparkLife[i] -= dt;
      if (s.sparkLife[i] <= 0) { a[i * 3 + 1] = -999; continue; }
      a[i * 3] += s.sparkVel[i * 3] * dt;
      a[i * 3 + 1] += s.sparkVel[i * 3 + 1] * dt;
      a[i * 3 + 2] += s.sparkVel[i * 3 + 2] * dt;
      s.sparkVel[i * 3 + 1] -= 5.2 * dt;
    }
    if (any) s.sparkGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- actions ---------- */
  act(kind) {
    if (!this.playing || this.paused || this.over || this.q || this.qOpen) return;
    const r = this.run;
    if (r.intro > 0 || r.stagger > 0) return;
    if (kind === 'left') r.lane = clamp(r.lane - 1, 0, 2);
    else if (kind === 'right') r.lane = clamp(r.lane + 1, 0, 2);
    else if (kind === 'jump') { if (r.py <= 0.001) { r.vy = 7.6; r.slideT = 0; } }
    else if (kind === 'slide') { r.slideT = 0.6; if (r.py > 0.001) r.vy = Math.min(r.vy, -9); }
  }

  togglePause() {
    if (this.over || this.q) return;
    if (this.paused) this.resume();
    else this.pause();
  }

  pause() {
    if (!this.playing || this.over) return;
    this.paused = true;
    this.root.classList.add('gr-pause');
    this.el.dock.hidden = true;
    this.showSheet(
      '<h2>Paused</h2><p class="gr-sub">' + Math.floor(this.run.travel) + ' m · ' + this.run.coins + ' coins · ' + this.run.correct + ' correct</p>' +
      '<div class="gr-sheet-btns"><button class="gr-btn" type="button" data-sheet="resume">Resume</button>' +
      '<button class="gr-btn ghost" type="button" data-sheet="quit">End run</button></div>'
    );
  }

  resume() {
    if (!this.playing || this.over) return;
    this.paused = false;
    this.root.classList.remove('gr-pause');
    this.el.sheet.hidden = true;
    this.el.sheet.innerHTML = '';
    this.el.dock.hidden = false;
    this.lastT = performance.now();
  }

  sheetAction(kind) {
    if (kind === 'resume') this.resume();
    else if (kind === 'quit') this.quit();
    else if (kind === 'again') { this.disposeHero(); this.el.sheet.hidden = true; this.start(); }
    else if (kind === 'hub') this.quit();
  }

  showSheet(html) {
    this.el.sheet.innerHTML = '<div class="gr-card">' + html + '</div>';
    this.el.sheet.hidden = false;
  }

  quit() {
    /* Leaving early still banks the coins collected and any task you completed. */
    if (this.playing && !this.over && this.opts.onEnd) {
      try {
        const r = this.run;
        this.opts.onEnd({ dist: Math.floor(r.travel), coins: r.coins, correct: r.correct, dodged: r.dodged, level: r.level, character: this.who, best: this.best });
      } catch (e) {}
    }
    this.playing = false;
    this.paused = false;
    if (this.opts.onQuit) this.opts.onQuit();
    this.destroy();
  }

  gameOver() {
    if (this.over) return;
    this.over = true;
    this.playing = false;
    const r = this.run;
    const prevBest = this.best || 0;
    if (r.travel > this.best) this.best = Math.floor(r.travel);
    const stats = { dist: Math.floor(r.travel), coins: r.coins, correct: r.correct, dodged: r.dodged, level: r.level, character: this.who, best: this.best };
    let extra = null;
    try { if (this.opts.onEnd) extra = this.opts.onEnd(stats) || null; } catch (e) { try { console.error(e); } catch (x) {} }
    const best = stats.dist > prevBest;
    this.root.classList.add('gr-over');
    this.root.classList.remove('gr-qopen');
    this.el.dock.hidden = true;
    this.el.pause.hidden = true;
    this.el.q.hidden = true;
    this.el.recover.hidden = true;
    this.el.toast.style.opacity = '0';
    this.q = null;
    this.qOpen = false;
    this.timeScale = 1;
    r.stagger = 0;
    r.nextQ = '';
    r.grace = 0;
    for (const k in this.stage.buddies) this.stage.buddies[k].visible = k === this.who;
    const rows = [
      ['Distance', stats.dist + ' m'],
      ['Coins earned', '+' + stats.coins],
      ['Questions answered', stats.correct]
    ];
    let html = '<div class="gr-hero" id="grHero" aria-hidden="true"></div>' +
      '<div class="gr-over-top"><span class="gr-badge">Run complete</span><h2>' + (best ? 'New best distance!' : 'Great run, buddy') + '</h2>' +
      '<p class="gr-sub">' + (this.who === 'life' ? 'LifeBuddy' : 'StudyBuddy') + ' is proud of you.</p></div>' +
      '<div class="gr-stats">' + rows.map((row) => '<div><b>' + row[1] + '</b><span>' + row[0] + '</span></div>').join('') + '</div>';
    if (extra && extra.tasks && extra.tasks.length) {
      html += '<div class="gr-rewards"><b>Task rewards</b>' + extra.tasks.map((t) => '<div class="gr-rw"><span>' + escapeHtml(t.t) + '</span><b>+' + t.r + '</b></div>').join('') + '</div>';
    }
    if (extra && extra.bank) html += '<p class="gr-sub">Wallet: ' + extra.bank + ' coins</p>';
    html += '<div class="gr-sheet-btns"><button class="gr-btn" type="button" data-sheet="again">Play Again</button>' +
      '<button class="gr-btn ghost" type="button" data-sheet="hub">Back to Lobby</button></div>';
    this.showSheet(html);
    const hero = this.el.sheet.querySelector('#grHero');
    if (hero) {
      this.hero = hero;
      try { mountPortrait(hero, this.who, 'celebrate'); } catch (e) { try { console.error(e); } catch (x) {} }
    }
  }

  disposeHero() {
    if (!this.hero) return;
    try { if (window.ssMascot && window.ssMascot.disposeEl) window.ssMascot.disposeEl(this.hero); } catch (e) {}
    this.hero = null;
  }

  toast(msg, secs) {
    this.toastT = secs || 2;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
  }

  /* ---------- HUD ---------- */
  paintHearts() {
    const r = this.run;
    let html = '';
    for (let i = 0; i < 3; i++) html += '<i class="' + (i < r.hearts ? 'on' : '') + '">' + ICON.heart + '</i>';
    this.el.hearts.innerHTML = html;
    const show = r.hearts < 3;
    this.el.recover.hidden = !show;
    if (show) {
      this.el.recoverTxt.textContent = 'Recovery ' + r.recover + '/2';
      this.el.recover.querySelector('i b').style.width = (r.recover / 2) * 100 + '%';
    }
  }

  paintSkip() {
    this.el.skipN.textContent = String(this.run.skips);
    this.el.skip.disabled = this.run.skips <= 0;
    this.el.skip.classList.toggle('off', this.run.skips <= 0);
  }

  updateHud(force) {
    const r = this.run;
    const key = r.coins + ':' + Math.floor(r.travel) + ':' + r.level;
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.el.coins.textContent = String(r.coins);
    this.el.dist.textContent = String(Math.floor(r.travel));
    this.el.lvl.textContent = 'Lv ' + r.level;
  }

  /* ---------- loop ---------- */
  frame(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000)) * (this.timeScale || 1);
    this.lastT = now;
    if (!this.playing) { this.renderIdle(dt); return; }
    if (this.paused || this.over) { this.renderIdle(dt); return; }
    this.update(dt);
    if (this.over) { this.renderIdle(dt); return; }
    this.draw(dt);
  }

  update(dt) {
    const r = this.run, s = this.stage, q = this.q;
    this.t += dt;

    /* Intro: the buddy drops from above the track, lands with a squash and
       only then does the run settle into its rhythm. */
    if (r.intro > 0) {
      r.intro = Math.max(0, r.intro - dt);
      const k = clamp(1 - r.intro / 1.15, 0, 1);
      r.introK = k;
      const fall = clamp(k / 0.7, 0, 1);
      r.introY = 6.9 * Math.pow(1 - fall, 2);
      if (fall >= 1 && r.introY <= 0.001) {
        r.introY = 0;
        if (r.land == null) { r.land = 1; r.splash = 1; this.toast('Go!', 0.9); }
      }
    }
    r.land = r.land == null ? 0 : Math.max(0, r.land - dt * 3.2);
    r.splash = Math.max(0, r.splash - dt * 2.4);

    /* A hit slows the world down for a beat before the question opens. */
    if (r.stagger > 0) {
      r.stagger = Math.max(0, r.stagger - dt);
      if (r.stagger === 0 && !this.q && !this.over) {
        const kind = r.nextQ || 'hit';
        r.nextQ = '';
        this.askQuestion(kind);
      }
    }
    const sdt = dt * (r.intro > 0 ? 0.55 : 1) * (r.stagger > 0 ? 0.24 : 1);

    const base = 10.5 + Math.min(9.5, r.travel / 210);
    const target = q ? Math.max(3.2, base * 0.32) : r.intro > 0 ? 7.4 : base;
    /* Ease down into the gate, but snap back to full speed when it closes so
       the run never limps along in leftover slow motion. */
    r.speed += (target - r.speed) * Math.min(1, dt * (q ? 6 : r.speed < target ? 12 : 2.4));
    if (!q && Math.abs(target - r.speed) < 0.02) r.speed = target;
    const prev = r.travel;
    r.travel += r.speed * sdt;
    r.level = 1 + Math.min(11, Math.floor(r.travel / 210));
    r.invuln = Math.max(0, r.invuln - dt);
    r.slideT = Math.max(0, r.slideT - dt);
    r.shake = Math.max(0, r.shake - dt * 3.4);
    r.hitFlash = Math.max(0, r.hitFlash - dt * 3);

    /* question timer */
    if (q) {
      q.t = Math.max(0, q.t - dt);
      this.el.qTime.textContent = String(Math.ceil(q.t));
      this.el.tFill.style.width = (q.t / 10) * 100 + '%';
      this.el.tFill.classList.toggle('low', q.t <= 3.2);
      if (q.t <= 0) this.resolveQuestion(false, false);
    }

    /* lane + jump */
    const targetX = (r.lane - 1) * LANE;
    r.px += (targetX - r.px) * Math.min(1, dt * 15);
    if (Math.abs(targetX - r.px) < 0.002) r.px = targetX;
    if (r.py > 0 || r.vy > 0) {
      r.vy -= 24 * sdt;
      r.py += r.vy * sdt;
      if (r.py <= 0) { r.py = 0; r.vy = 0; }
    }

    /* spawn ahead */
    while (r.spawnS < r.travel + 135) this.spawnRow();

    /* move objects */
    for (const o of this.active) {
      o.mesh.position.z = -(o.s - r.travel);
      if (o.flash > 0) { o.flash -= dt; o.mesh.visible = o.flash <= 0 || Math.floor(o.flash * 18) % 2 === 0; }
    }
    const dummy = s.coinDummy, hideM = this.hideM || (this.hideM = new THREE.Matrix4().makeScale(0, 0, 0));
    for (const c of this.coins) {
      const dz = c.s - r.travel;
      if (!c.got && Math.abs(dz) < 0.8 && Math.abs(c.x - r.px) < 0.9 && Math.abs(c.y - (r.py + 0.55)) < 1.05) {
        c.got = true; r.coins++;
        s.coins.setMatrixAt(c.slot, hideM);
        s.coinRims.setMatrixAt(c.slot, hideM);
        s.coinBoss.setMatrixAt(c.slot, hideM);
        this.burstSpark(c.x, c.y, -dz);
        const chip = this.el.coins.parentElement;
        if (chip) { chip.classList.remove('gr-pop'); void chip.offsetWidth; chip.classList.add('gr-pop'); }
        continue;
      }
      c.rot += dt * 3.6;
      dummy.position.set(c.x, c.y + Math.sin(this.t * 2.4 + c.s) * 0.03, -dz);
      dummy.rotation.set(0, c.rot, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      s.coins.setMatrixAt(c.slot, dummy.matrix);
      s.coinRims.setMatrixAt(c.slot, dummy.matrix);
      s.coinBoss.setMatrixAt(c.slot, dummy.matrix);
    }
    s.coins.instanceMatrix.needsUpdate = true;
    s.coinRims.instanceMatrix.needsUpdate = true;
    s.coinBoss.instanceMatrix.needsUpdate = true;
    this.updateSparks(dt);
    for (const g of this.gates) {
      g.mesh.position.z = -(g.s - r.travel);
      if (!g.used && r.travel >= g.s) {
        g.used = true;
        this.askQuestion('bonus');
        g.mesh.visible = false;
      }
    }

    /* collisions */
    if (q) r.invuln = Math.max(r.invuln, 0.2);
    for (const o of this.active) {
      if (o.judged) continue;
      if (r.travel < o.s) continue;
      o.judged = true;
      const hitZ = -(o.s - r.travel);
      const dz = Math.abs(o.s - prev);
      const close = Math.abs(((o.lane - 1) * LANE) - r.px) < 1.0;
      let safe = true;
      if (close) {
        if (o.kind === 'jump') safe = r.py > 0.6;
        else if (o.kind === 'slide') safe = r.slideT > 0;
        else safe = false;
      }
      if (safe) { r.dodged++; continue; }
      if (r.invuln > 0 || q || r.stagger > 0) continue;
      r.invuln = 1.3;
      r.shake = 0.85;
      r.hitFlash = 1;
      /* break the obstacle on impact so it never sits inside the buddy */
      o.mesh.visible = false;
      this.burstSpark((o.lane - 1) * LANE, 0.7, hitZ);
      r.hearts = Math.max(0, r.hearts - 1);
      this.paintHearts();
      this.hurt();
      if (r.hearts <= 0) {
        if (!r.lifeUsed) {
          r.lifeUsed = true;
          this.dying = true;
          r.stagger = 0.62;
          r.nextQ = 'rescue';
        } else {
          this.dying = true;
          this.gameOver();
        }
      } else if (!this.dying) {
        /* ~0.7s impact stagger, then the question slides in. */
        r.stagger = 0.72;
        r.nextQ = 'hit';
      }
      break;
    }

    /* recycle */
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      if (o.s < r.travel - 14) {
        o.mesh.visible = false;
        this.active.splice(i, 1);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.s < r.travel - 14 || c.got) {
        if (!c.got) { s.coins.setMatrixAt(c.slot, hideM); s.coinRims.setMatrixAt(c.slot, hideM); s.coinBoss.setMatrixAt(c.slot, hideM); }
        this.coinUsed[c.slot] = 0;
        this.coins.splice(i, 1);
      }
    }
    for (let i = this.gates.length - 1; i >= 0; i--) {
      if (this.gates[i].s < r.travel - 14) { this.gates[i].mesh.visible = false; this.gates.splice(i, 1); }
    }

    /* palette change (colours ease toward the next palette) */
    if (this.palC) {
      const kk = Math.min(1, dt * 1.4);
      s.scene.background.lerp(this.palC.sky, kk);
      s.scene.fog.color.copy(s.scene.background);
      s.M.ground.color.lerp(this.palC.ground, kk);
      s.M.track.color.lerp(this.palC.track, kk);
      s.M.rail.color.lerp(this.palC.rail, kk);
      s.M.leafA.color.lerp(this.palC.leafA, kk);
      s.M.leafB.color.lerp(this.palC.leafB, kk);
    }
    if (r.travel > this.nextPalAt) {
      this.nextPalAt = r.travel + 260 + Math.random() * 120;
      const next = (s.pal.i + 1 + Math.floor(Math.random() * (PAL.length - 1))) % PAL.length;
      s.pal.i = next;
      this.applyPalette(next, false);
      this.toast(PAL[next].n, 1.8);
    }

    /* buddy animation */
    const slow = q ? 0.45 : 1;
    this.animT += dt * (0.9 + r.speed / 9) * slow;
    const b = s.buddies[this.who];
    b.position.x = r.px;
    b.position.y = PLAYER_Y + r.py + r.introY;
    /* The intro fall shows the buddy's face, then turns into the run. */
    b.rotation.y = r.intro > 0 ? RUN_YAW * clamp(((r.introK || 0) - 0.7) / 0.3, 0, 1) : RUN_YAW;
    b.userData.anim = q || r.intro > 0 ? 'idle' : 'run';
    animateMascot(b, this.animT, 0, dt);
    if (r.slideT > 0 && !q && r.intro <= 0) {
      const u = b.userData;
      u.bodyGroup.rotation.x = -0.85;
      u.bodyGroup.scale.y *= 0.62;
      u.bodyGroup.position.y -= 0.36;
    } else if (r.py > 0.02) {
      b.userData.bodyGroup.rotation.x -= 0.12;
    }
    if (r.land > 0) {
      b.userData.bodyGroup.scale.y *= 1 - 0.26 * r.land;
      b.userData.bodyGroup.position.y -= 0.08 * r.land;
    }
    b.userData.bodyGroup.rotation.z += (targetX - r.px) * 0.09;

    /* Post-question grace: blink for ~1.5s so the dodge window is obvious. */
    if (r.grace > 0) {
      r.grace = Math.max(0, r.grace - dt);
      b.visible = r.grace > 0.1 ? Math.floor(r.grace * 9) % 2 === 0 : true;
      if (r.grace === 0) b.visible = true;
    }

    /* shadow */
    const airY = r.py + r.introY;
    s.shadow.position.set(r.px, 0.035, 0.02);
    s.shadow.scale.setScalar(clamp(1 - airY * 0.16, 0.32, 1.06));
    s.shadow.material.opacity = 0.24 * clamp(1 - airY * 0.2, 0.22, 1);

    /* dash scroll (instanced) — the ground itself never moves */
    const off = r.travel % 5, off2 = r.travel % 7, off3 = r.travel % 9;
    const dd = s.coinDummy; dd.rotation.set(0, 0, 0); dd.scale.setScalar(1);
    for (let i = 0; i < 84; i++) {
      dd.position.set((i < 42 ? -1 : 1) * LANE / 2, 0.03, 8 - (i % 42) * 5 - off);
      dd.updateMatrix(); s.laneDashes.setMatrixAt(i, dd.matrix);
    }
    for (let i = 0; i < 60; i++) {
      dd.position.set((i < 30 ? -1 : 1) * 3.35, 0.03, 6 - (i % 30) * 7 - off2);
      dd.updateMatrix(); s.edgeDashes.setMatrixAt(i, dd.matrix);
    }
    for (let i = 0; i < 44; i++) {
      dd.position.set((i < 22 ? -1 : 1) * 3.6, 0.23, 6 - (i % 22) * 9 - off3);
      dd.updateMatrix(); s.shoulderDashes.setMatrixAt(i, dd.matrix);
    }
    s.laneDashes.instanceMatrix.needsUpdate = true;
    s.edgeDashes.instanceMatrix.needsUpdate = true;
    s.shoulderDashes.instanceMatrix.needsUpdate = true;

    /* decor scroll */
    for (const it of s.decor) {
      if (it.s < r.travel - 20) {
        it.s = r.travel + 130 + Math.random() * 80;
        it.side = Math.random() < 0.5 ? -1 : 1;
        it.x = 5.2 + Math.random() * 10;
      }
      it.obj.position.set(it.side * it.x, it.obj.position.y, -(it.s - r.travel));
    }

    this.updateHud(false);
    this.toastT = (this.toastT || 0) - dt;
    if (this.toastT <= 0) this.el.toast.style.opacity = '0';
  }

  draw(dt) {
    const r = this.run, s = this.stage, cam = s.camera;
    /* The camera is anchored during a run: no lane drift, no shake, no jump
       follow. Only the markers and obstacles scroll, so the road stays planted
       under the runner's feet for the whole run. Hit feedback lives in the HUD. */
    const k = 1 - Math.exp(-dt * 7.5);
    cam.position.x += (0 - cam.position.x) * k;
    cam.position.y += (3.55 - cam.position.y) * k;
    cam.position.z += (8.4 - cam.position.z) * Math.min(1, dt * 4);
    this.look = this.look || new THREE.Vector3(0, 1.1, -10);
    this.look.x += (0 - this.look.x) * k;
    this.look.y += (1.15 - this.look.y) * k;
    this.look.z = -10;
    cam.lookAt(this.look);
    s.renderer.render(s.scene, cam);
    this.root.classList.toggle('gr-hit', r.hitFlash > 0.55);
  }

  renderIdle(dt) {
    const s = this.stage;
    if (!s) return;
    const who = this.who || 'study';
    const b = s.buddies[who];
    if (b) {
      b.visible = true;
      if (this.over || !this.playing) {
        b.userData.anim = 'idle';
        this.animT = (this.animT || 0) + dt;
        animateMascot(b, this.animT, 0, dt);
      }
    }
    const cam = s.camera;
    if (!this.playing) {
      cam.position.x += (0 - cam.position.x) * Math.min(1, dt * 3);
      cam.position.y += (2.4 - cam.position.y) * Math.min(1, dt * 3);
      cam.position.z += (7.2 - cam.position.z) * Math.min(1, dt * 3);
      this.look = this.look || new THREE.Vector3(0, 1.1, -4);
      this.look.y += (PLAYER_Y - 0.1 - this.look.y) * Math.min(1, dt * 3);
      cam.lookAt(this.look);
    }
    s.renderer.render(s.scene, cam);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this._animT);
    clearTimeout(this._qT);
    clearTimeout(this._introT);
    this.disposeHero();
    document.removeEventListener('keydown', this.keyBound);
    window.removeEventListener('resize', this.resizeBound);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    if (this.stage) {
      const s = this.stage;
      s.renderer.dispose();
      try { s.renderer.forceContextLoss(); } catch (e) {}
      stage = null;
    }
    this.root = null;
    this.playing = false;
    if (window.ssRun) window.ssRun.current = null;
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.ssRun = {
  current: null,
  running: function () { return !!(window.ssRun.current && window.ssRun.current.playing); },
  start: function (opts) {
    try {
      if (window.ssRun.current) window.ssRun.current.destroy();
      const g = new BuddyRun(opts || {});
      g.mount();
      g.start();
      window.ssRun.current = g;
      return true;
    } catch (err) {
      try { console.error('Buddy Run failed to start', err); } catch (e) {}
      if (opts && opts.onError) opts.onError(err);
      return false;
    }
  },
  stop: function () {
    const g = window.ssRun.current;
    if (g) g.destroy();
  }
};
