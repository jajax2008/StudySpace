/* Buddy Run — StudySpace 3D endless runner.
   The StudyBuddy and LifeBuddy models below are the app's approved mascot
   models, copied verbatim (geometry, materials, face, glasses, sprout and
   bandana are untouched). Only the running stage, camera, controls and HUD are
   new: pooled meshes, delta-time movement, damped lane changes and a camera
   that trails the buddy with a smooth spring.

   Loaded lazily as a module by js/games.js. Exposes window.ssRun. */
import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ================= MASCOTS (unchanged) ================= */
function createCuteFace({ eyeColor = 0x382c30, browColor = 0x8c6d76 }) {
  const faceGroup = new THREE.Group();
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: eyeColor, roughness: 0.12, clearcoat: 1.0 });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeGeo = new THREE.SphereGeometry(0.115, 32, 32);
  const shineBigGeo = new THREE.SphereGeometry(0.038, 16, 16);
  const shineSmallGeo = new THREE.SphereGeometry(0.018, 16, 16);

  [-1, 1].forEach((side) => {
    const eyeHolder = new THREE.Group();
    eyeHolder.position.set(side * 0.25, 0.07, 0.88);
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.scale.set(0.92, 1.08, 0.55); eyeHolder.add(eye);
    const shine1 = new THREE.Mesh(shineBigGeo, shineMat); shine1.position.set(-0.032, 0.042, 0.055); eyeHolder.add(shine1);
    const shine2 = new THREE.Mesh(shineSmallGeo, shineMat); shine2.position.set(0.035, -0.035, 0.055); eyeHolder.add(shine2);
    eyeHolder.name = side === -1 ? "leftEye" : "rightEye";
    faceGroup.add(eyeHolder);

    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 16, 32, Math.PI * 0.65), new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.5 }));
    brow.position.set(side * 0.25, 0.23, 0.87);
    brow.rotation.z = Math.PI * 0.18 + side * -0.08;
    faceGroup.add(brow);
  });

  const blushGeo = new THREE.SphereGeometry(0.09, 24, 24);
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8da6, transparent: true, opacity: 0.35 });
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.scale.set(1.3, 0.75, 0.3); blush.position.set(side * 0.42, -0.06, 0.83); blush.rotation.y = side * 0.35;
    faceGroup.add(blush);
  });

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.024, 16, 32, Math.PI * 0.82), new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.3 }));
  smile.position.set(0, -0.05, 0.91);
  smile.rotation.z = Math.PI + Math.PI * 0.09;
  smile.rotation.x = -0.15;
  smile.name = "smile";
  faceGroup.add(smile);
  return faceGroup;
}

function createShadowDisc(colorHex) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -1.25;
  return disc;
}

function baseBody(bodyMat, earMat, earScale, earY, handMat, handR, handPos, shineMatOpacity = 0.45) {
  const root = new THREE.Group(), bodyGroup = new THREE.Group();
  bodyGroup.rotation.order = "YXZ"; root.add(bodyGroup);
  const mainBody = new THREE.Mesh(new THREE.SphereGeometry(0.95, 64, 64), bodyMat); mainBody.scale.set(1.03, 0.97, 0.96); bodyGroup.add(mainBody);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: shineMatOpacity }));
  shine.scale.set(1.5, 0.55, 0.2); shine.position.set(-0.26, 0.55, 0.76); shine.rotation.z = 0.35; shine.rotation.x = -0.5; bodyGroup.add(shine);
  const ears = [];
  [-1, 1].forEach((side) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(earScale[0], 32, 32), earMat);
    ear.scale.set(0.55, earScale[1], 0.75); ear.position.set(side * 0.96, earY, 0); bodyGroup.add(ear); ears.push(ear); });
  const handGeo = new THREE.SphereGeometry(handR, 32, 32);
  const leftHand = new THREE.Mesh(handGeo, handMat), rightHand = new THREE.Mesh(handGeo, handMat);
  leftHand.position.set(-handPos[0], handPos[1], handPos[2]); rightHand.position.set(handPos[0], handPos[1], handPos[2]);
  bodyGroup.add(leftHand, rightHand);
  return { root, bodyGroup, ears, leftHand, rightHand };
}

function createStudyBuddy() {
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xf9cedf, emissive: 0xd95f8c, emissiveIntensity: 0.08, roughness: 0.24, metalness: 0.02, clearcoat: 0.75, clearcoatRoughness: 0.18 });
  const accent = new THREE.MeshPhysicalMaterial({ color: 0xe6739f, roughness: 0.3, clearcoat: 0.5 });
  const handMat = new THREE.MeshPhysicalMaterial({ color: 0xfadce8, roughness: 0.25, clearcoat: 0.6 });
  const { root, bodyGroup, ears, leftHand, rightHand } = baseBody(bodyMat, accent, [0.22, 1.05], 0.06, handMat, 0.17, [0.92, -0.34, 0.38]);

  const face = createCuteFace({ eyeColor: 0x3b3236, browColor: 0xc97b98 }); bodyGroup.add(face);

  const glasses = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x3b3538, roughness: 0.22, metalness: 0.2, clearcoat: 0.9 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, clearcoat: 1.0, depthWrite: false });
  [-1, 1].forEach((side) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.032, 24, 48), frameMat); rim.position.set(side * 0.27, 0.07, 0.95); glasses.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 36), lensMat); lens.position.set(side * 0.27, 0.07, 0.955); glasses.add(lens);
    const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 16), frameMat);
    temple.rotation.x = Math.PI / 2; temple.rotation.z = side * -0.18; temple.position.set(side * 0.54, 0.08, 0.72); glasses.add(temple);
  });
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.026, 16, 24, Math.PI), frameMat); bridge.position.set(0, 0.08, 0.96); glasses.add(bridge);
  bodyGroup.add(glasses);

  const shadow = createShadowDisc(0xd96b96); root.add(shadow);
  root.userData = { bodyGroup, leftHand, rightHand, ears, face, shadow, sprout: null, tails: [] };
  return root;
}

function createLifeBuddy() {
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xf7dfc6, emissive: 0xd98236, emissiveIntensity: 0.08, roughness: 0.25, metalness: 0.02, clearcoat: 0.75, clearcoatRoughness: 0.18 });
  const amber = new THREE.MeshPhysicalMaterial({ color: 0xd18741, roughness: 0.32, clearcoat: 0.5 });
  const handMat = new THREE.MeshPhysicalMaterial({ color: 0xf5d4b3, roughness: 0.26, clearcoat: 0.6 });
  const { root, bodyGroup, ears, leftHand, rightHand } = baseBody(bodyMat, amber, [0.21, 1.0], 0.08, handMat, 0.175, [0.88, -0.36, 0.42]);

  const face = createCuteFace({ eyeColor: 0x382b24, browColor: 0xb5835a }); bodyGroup.add(face);

  const sprout = new THREE.Group(); sprout.position.set(0, 0.91, 0);
  const sproutMat = new THREE.MeshPhysicalMaterial({ color: 0xc97f38, emissive: 0x8fba4b, emissiveIntensity: 0.12, roughness: 0.28, clearcoat: 0.65 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.22, 16), sproutMat); stem.position.y = 0.09; sprout.add(stem);
  [-1, 1].forEach((side) => { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 28, 28), sproutMat);
    leaf.scale.set(1.25, 0.45, 0.7); leaf.position.set(side * 0.16, 0.21, 0); leaf.rotation.z = side * 0.42; sprout.add(leaf); });
  bodyGroup.add(sprout);

  const bandana = new THREE.Group();
  const bandanaMat = new THREE.MeshPhysicalMaterial({ color: 0xe6be96, roughness: 0.42, clearcoat: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc97f38, roughness: 0.4 });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.13, 24, 48), bandanaMat);
  scarf.rotation.x = Math.PI / 2 + 0.08; scarf.position.set(0, -0.58, 0.03); bandana.add(scarf);
  const knotTail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 24), trimMat);
  knotTail.position.set(0.56, -0.74, 0.36); knotTail.rotation.z = -0.85; knotTail.rotation.x = 0.35; knotTail.userData.rz = -0.85; bandana.add(knotTail);
  bodyGroup.add(bandana);

  const shadow = createShadowDisc(0xc97f38); root.add(shadow);
  root.userData = { bodyGroup, leftHand, rightHand, ears, face, shadow, sprout, tails: [knotTail] };
  return root;
}

/* Pose blending, identical to the mascot design. */
function poses(time) {
  const j = Math.abs(Math.sin(time * 3.4));
  return {
    idle: { y: Math.sin(time * 1.7) * 0.1, sy: 1 + 0.03 * Math.sin(time * 2.3), tx: 0, tz: Math.sin(time * 0.9) * 0.05, ear: Math.sin(time * 3) * 0.12, hb: Math.sin(time * 2) * 0.06, hz: 0, hu: 0, sway: 0.07, smile: 1 },
    run: { y: Math.abs(Math.sin(time * 10)) * 0.13, sy: 1 + 0.05 * Math.cos(time * 20), tx: 0.35, tz: Math.sin(time * 10) * 0.06, ear: -0.3 + Math.sin(time * 16) * 0.25, hb: Math.sin(time * 10) * 0.12, hz: Math.sin(time * 10) * 0.3, hu: 0, sway: 0.22, smile: 1.5 },
    celebrate: { y: j * 0.8, sy: 0.9 + 0.2 * j, tx: -0.05, tz: Math.sin(time * 6.8) * 0.08, ear: 0.5 + Math.sin(time * 14) * 0.3, hb: 0, hz: 0, hu: 0.5, sway: 0.16, smile: 1.6 },
  };
}
function animateMascot(m, t, phase, dt) {
  const u = m.userData, time = t + phase;
  if (!u.w) { u.w = { idle: 1, run: 0, celebrate: 0 }; u.spin = 0; u.hb0 = [u.leftHand.position.clone(), u.rightHand.position.clone()]; u.eyes = [u.face.getObjectByName("leftEye"), u.face.getObjectByName("rightEye")]; u.smile = u.face.getObjectByName("smile"); }
  for (const k in u.w) u.w[k] += ((k === u.anim ? 1 : 0) - u.w[k]) * Math.min(1, dt * 7);
  const ps = poses(time), P = {};
  for (const key in ps.idle) { P[key] = 0; for (const k in u.w) P[key] += u.w[k] * ps[k][key]; }

  u.spin += dt * 6.8 * u.w.celebrate;
  u.spin += (Math.round(u.spin / TAU) * TAU - u.spin) * Math.min(1, dt * 5) * (1 - u.w.celebrate);
  u.bodyGroup.position.y = P.y; u.bodyGroup.rotation.set(P.tx, u.spin, P.tz);
  const sx = 1 / Math.sqrt(P.sy); u.bodyGroup.scale.set(sx, P.sy, sx);

  u.ears.forEach((e, i) => { const s = i ? 1 : -1; e.rotation.z = s * (P.ear + (i ? 0.5 : 0) * 0.0 + Math.sin(time * 3.4 + (i ? 1.6 : 0)) * 0.05); });
  [u.leftHand, u.rightHand].forEach((h, i) => { const s = i ? 1 : -1, b = u.hb0[i];
    h.position.set(b.x + s * P.hu * 0.15, b.y + P.hb * s + P.hu, b.z + P.hz * s); });

  const blinkScaleY = (time % 3.8) > 3.62 ? 0.12 : 1.0;
  u.eyes.forEach((e) => (e.scale.y += (blinkScaleY - e.scale.y) * Math.min(1, dt * 20)));
  u.smile.scale.set(1, P.smile, 1);

  if (u.sprout) { u.sprout.rotation.z = Math.sin(time * 2.1) * P.sway; u.sprout.rotation.x = Math.sin(time * 1.7 + 1) * P.sway * 0.4; }
  u.tails.forEach((tl) => (tl.rotation.z = tl.userData.rz + Math.sin(time * (3 + u.w.run * 9)) * (0.08 + u.w.run * 0.3)));

  u.shadow.scale.setScalar(1 - P.y * 0.28); u.shadow.material.opacity = 0.22 - P.y * 0.12;
}

/* ================= STAGE ================= */
const LANE = 2.15;
const PLAYER_SCALE = 0.6;
const PLAYER_Y = 1.25 * PLAYER_SCALE;

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
  camera.position.set(0, 4.4, 8.6);
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

  /* coins — one instanced mesh for the whole pool */
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.075, 18).rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffcc4d, metalness: 0.75, roughness: 0.25, emissive: 0x6b4700, emissiveIntensity: 0.35 });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, 80);
  coins.frustumCulled = false;
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(coins);
  const hideAll = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < 80; i++) coins.setMatrixAt(i, hideAll);

  /* question gates */
  const gateMat = new THREE.MeshLambertMaterial({ color: 0x8b6fb8 });
  const gateGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const gatePool = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    mk(BOX, gateMat, 0.26, 3.2, 0.26, -3.2, 1.6, 0, g);
    mk(BOX, gateMat, 0.26, 3.2, 0.26, 3.2, 1.6, 0, g);
    mk(BOX, gateMat, 6.7, 0.34, 0.3, 0, 3.2, 0, g);
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
    b.rotation.y = Math.PI;
    b.position.set(0, PLAYER_Y, 0);
    scene.add(b);
  }

  return { renderer, scene, camera, M, laneDashes, edgeDashes, coins, coinDummy: new THREE.Object3D(), obstaclePool, gatePool, decor, shadow, buddies, pal: { i: 0, t: null }, sun };
}

/* ================= ENGINE ================= */
const ICON = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.4-4.6-7.4-9.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.4 3.1C19.4 15.4 12 20 12 20Z"/></svg>',
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.8v8.4M9.6 10.2h4.8M9.6 13.8h4.8"/></svg>',
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
      recover: root.querySelector('#grRecover'), recoverTxt: root.querySelector('#grRecoverTxt'),
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
      speed: 10.5, travel: 0, hearts: 3, recover: 0, coins: 0, correct: 0,
      skips: 3, lifeUsed: false, invuln: 0, shake: 0, dodged: 0,
      spawnS: 16, gate: 340, level: 1, hitFlash: 0, started: false
    };
    this.active = [];
    this.coins = [];
    this.coinUsed = new Array(80).fill(0);
    this.gates = [];
    this.q = null;
    this.over = false;
    this.paused = false;
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
    for (let i = 0; i < 80; i++) s.coins.setMatrixAt(i, hideCoin);
    s.coins.instanceMatrix.needsUpdate = true;
    s.gatePool.forEach((g) => { g.visible = false; });
    s.decor.forEach((d, i) => { d.s = 20 + i * 12; d.side = i % 2 ? 1 : -1; d.x = 5.4 + Math.random() * 9; });

    const who = this.opts.character === 'life' ? 'life' : 'study';
    for (const k in s.buddies) {
      const b = s.buddies[k];
      b.visible = k === who;
      b.position.set(0, PLAYER_Y, 0);
      b.rotation.y = Math.PI;
      b.userData.anim = 'idle';
    }
    this.who = who;
    this.el.pause.hidden = false;
    this.el.dock.hidden = false;
    this.el.recover.hidden = true;
    this.el.q.hidden = true;
    this.el.sheet.hidden = true;
    this.el.sheet.innerHTML = '';
    this.root.classList.remove('gr-over', 'gr-pause', 'gr-qopen');
    this.paintHearts();
    this.paintSkip();
    this.updateHud(true);
  }

  start() {
    if (!this.root) this.mount();
    this.resetRun();
    this.playing = true;
    this.toast('Swipe ←→ to change lanes · ↑ jump · ↓ slide', 3.2);
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
    if (!mesh) {
      const oldest = this.active.find((a) => a.kind === kind);
      if (oldest) { mesh = oldest.mesh; this.active.splice(this.active.indexOf(oldest), 1); }
      else return;
    }
    mesh.visible = true;
    mesh.position.set((lane - 1) * LANE, 0, -(s - this.run.travel));
    this.active.push({ kind, lane, s, mesh, judged: false, flash: 0, baseY: 0 });
  }

    spawnCoins(lane, s, count, arc) {
    const x = (lane - 1) * LANE;
    for (let i = 0; i < count; i++) {
      let slot = -1;
      for (let k = 0; k < 80; k++) { if (!this.coinUsed[k]) { slot = k; break; } }
      if (slot < 0) return;
      this.coinUsed[slot] = 1;
      const cs = s + i * 1.35;
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
    this.q = { kind, item, t: 10, locked: true };
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
    this.el.q.hidden = true;
    this.root.classList.remove('gr-qopen');
    const r = this.run;

    if (q.kind === 'rescue') {
      this.q = null;
      if (correct) {
        r.hearts = 1;
        r.recover = 0;
        r.invuln = 2.6;
        this.dying = false;
        this.paintHearts();
        this.toast('LifeBuddy gave you a heart. Keep going!', 2.6);
        this.setBuddy('celebrate', 1.1);
      } else {
        this.gameOver();
      }
      return;
    }

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
      this.burst(q.kind === 'bonus' ? 0x8b6fb8 : 0x7bc79a);
    } else {
      if (!skipped && q.kind === 'hit') r.recover = 0;
      const tail = q.item.e ? ' ' + q.item.e : '';
      this.toast((skipped ? 'Skipped. Answer: ' : 'Not quite. Answer: ') + q.item.a + '.' + tail, 4);
    }
    this.q = null;
    this.paintHearts();
    this.updateHud(true);
  }

  setBuddy(anim, ms) {
    const b = this.stage.buddies[this.who];
    if (!b) return;
    b.userData.anim = anim;
    clearTimeout(this._animT);
    if (ms) this._animT = setTimeout(() => { if (b) b.userData.anim = 'run'; }, ms * 1000);
  }

  burst(color) {
    // small coin sparkle reuses the toast only; kept lightweight on purpose
  }

  /* ---------- actions ---------- */
  act(kind) {
    if (!this.playing || this.paused || this.over || (this.q && this.q.locked)) return;
    const r = this.run;
    if (kind === 'left') r.lane = clamp(r.lane - 1, 0, 2);
    else if (kind === 'right') r.lane = clamp(r.lane + 1, 0, 2);
    else if (kind === 'jump') { if (r.py <= 0.001) { r.vy = 7.6; r.slideT = 0; } }
    else if (kind === 'slide') { r.slideT = 0.6; if (r.py > 0.001) r.vy = Math.min(r.vy, -9); }
  }

  togglePause() {
    if (this.over) return;
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
    else if (kind === 'again') { this.el.sheet.hidden = true; this.start(); }
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
    if (r.travel > this.best) this.best = Math.floor(r.travel);
    const stats = { dist: Math.floor(r.travel), coins: r.coins, correct: r.correct, dodged: r.dodged, level: r.level, character: this.who, best: this.best };
    let extra = null;
    try { if (this.opts.onEnd) extra = this.opts.onEnd(stats) || null; } catch (e) { try { console.error(e); } catch (x) {} }
    const best = stats.dist >= (this.best || 0);
    this.root.classList.add('gr-over');
    this.root.classList.remove('gr-qopen');
    this.el.dock.hidden = true;
    this.el.pause.hidden = true;
    this.el.q.hidden = true;
    this.el.recover.hidden = true;
    this.q = null;
    const rows = [
      ['Distance', stats.dist + ' m'],
      ['Correct answers', stats.correct],
      ['Coins earned', '+' + stats.coins]
    ];
    let html = '<div class="gr-over-top"><span class="gr-badge">Run complete</span><h2>' + (best ? 'New best distance!' : 'Nice run') + '</h2></div>' +
      '<div class="gr-stats">' + rows.map((row) => '<div><b>' + row[1] + '</b><span>' + row[0] + '</span></div>').join('') + '</div>';
    if (extra && extra.tasks && extra.tasks.length) {
      html += '<div class="gr-rewards"><b>Task rewards</b>' + extra.tasks.map((t) => '<div class="gr-rw"><span>' + escapeHtml(t.t) + '</span><b>+' + t.r + '</b></div>').join('') + '</div>';
    }
    if (extra && extra.bank) html += '<p class="gr-sub">Wallet: ' + extra.bank + ' coins</p>';
    html += '<div class="gr-sheet-btns"><button class="gr-btn" type="button" data-sheet="again">Run again</button>' +
      '<button class="gr-btn ghost" type="button" data-sheet="hub">Back to hub</button></div>';
    this.showSheet(html);
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
    const dt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000));
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

    const base = 10.5 + Math.min(9.5, r.travel / 210);
    const target = q ? Math.max(3.2, base * 0.32) : base;
    r.speed += (target - r.speed) * Math.min(1, dt * (q ? 6 : 2.4));
    const prev = r.travel;
    r.travel += r.speed * dt;
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
      r.vy -= 24 * dt;
      r.py += r.vy * dt;
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
        continue;
      }
      c.rot += dt * 4.2;
      dummy.position.set(c.x, c.y, -dz);
      dummy.rotation.set(0, c.rot, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      s.coins.setMatrixAt(c.slot, dummy.matrix);
    }
    s.coins.instanceMatrix.needsUpdate = true;
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
      const dz = Math.abs(o.s - prev);
      const close = Math.abs(((o.lane - 1) * LANE) - r.px) < 1.0;
      let safe = true;
      if (close) {
        if (o.kind === 'jump') safe = r.py > 0.6;
        else if (o.kind === 'slide') safe = r.slideT > 0;
        else safe = false;
      }
      if (safe) { r.dodged++; continue; }
      if (r.invuln > 0 || q) continue;
      r.invuln = 1.1;
      r.shake = 0.7;
      r.hitFlash = 1;
      o.flash = 0.5;
      r.hearts = Math.max(0, r.hearts - 1);
      this.paintHearts();
      if (r.hearts <= 0) {
        if (!r.lifeUsed) {
          r.lifeUsed = true;
          this.dying = true;
          this.askQuestion('rescue');
        } else {
          this.dying = true;
          this.gameOver();
        }
      } else if (!this.dying) {
        clearTimeout(this._qT);
        this._qT = setTimeout(() => this.askQuestion('hit'), 320);
      }
      this.toast('Obstacle hit · -1 heart', 1.6);
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
        if (!c.got) s.coins.setMatrixAt(c.slot, hideM);
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
    b.position.y = PLAYER_Y + r.py;
    b.userData.anim = q ? 'idle' : 'run';
    animateMascot(b, this.animT, 0, dt);
    if (r.slideT > 0 && !q) {
      const u = b.userData;
      u.bodyGroup.rotation.x = -0.85;
      u.bodyGroup.scale.y *= 0.62;
      u.bodyGroup.position.y -= 0.36;
    } else if (r.py > 0.02) {
      b.userData.bodyGroup.rotation.x -= 0.12;
    }
    b.userData.bodyGroup.rotation.z += (targetX - r.px) * 0.09;

    /* shadow */
    s.shadow.position.set(r.px, 0.035, 0.02);
    s.shadow.scale.setScalar(clamp(1 - r.py * 0.35, 0.45, 1));
    s.shadow.material.opacity = 0.24 * clamp(1 - r.py * 0.4, 0.35, 1);

    /* dash scroll (instanced) */
    const off = r.travel % 5, off2 = r.travel % 7;
    const dd = s.coinDummy; dd.rotation.set(0, 0, 0); dd.scale.setScalar(1);
    for (let i = 0; i < 84; i++) {
      dd.position.set((i < 42 ? -1 : 1) * LANE / 2, 0.03, 8 - (i % 42) * 5 - off);
      dd.updateMatrix(); s.laneDashes.setMatrixAt(i, dd.matrix);
    }
    for (let i = 0; i < 60; i++) {
      dd.position.set((i < 30 ? -1 : 1) * 3.35, 0.03, 6 - (i % 30) * 7 - off2);
      dd.updateMatrix(); s.edgeDashes.setMatrixAt(i, dd.matrix);
    }
    s.laneDashes.instanceMatrix.needsUpdate = true;
    s.edgeDashes.instanceMatrix.needsUpdate = true;

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
    const shake = r.shake;
    const k = 1 - Math.exp(-dt * 7.5);
    const targetCamX = r.px * 0.42 + (Math.random() - 0.5) * shake * 0.22;
    const targetCamY = 4.3 + r.py * 0.28 + (Math.random() - 0.5) * shake * 0.18;
    cam.position.x += (targetCamX - cam.position.x) * k;
    cam.position.y += (targetCamY - cam.position.y) * k;
    cam.position.z += (8.4 - cam.position.z) * Math.min(1, dt * 4);
    this.look = this.look || new THREE.Vector3(0, 1.1, -10);
    this.look.x += (r.px * 0.5 - this.look.x) * k;
    this.look.y += (1.05 + r.py * 0.35 - this.look.y) * k;
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
      if (this.over || !this.playing) {
        b.userData.anim = this.over ? 'idle' : 'idle';
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
