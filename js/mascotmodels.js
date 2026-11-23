/* StudySpace 3D mascots — StudyBuddy and LifeBuddy.
   These are the approved mascot models used by Buddy Run. Geometry, materials,
   face, glasses, sprout, bandana and poses are kept exactly as approved. This
   module only exports them so Home, Chat, the Accessories fitting room and the
   game all render the same characters. */
import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;

export function createCuteFace({ eyeColor = 0x382c30, browColor = 0x8c6d76 } = {}) {
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
    eyeHolder.name = side === -1 ? 'leftEye' : 'rightEye';
    faceGroup.add(eyeHolder);

    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 16, 32, Math.PI * 0.65), new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.5 }));
    brow.position.set(side * 0.25, 0.23, 0.955);
    brow.rotation.z = Math.PI * 0.18 + side * -0.08;
    faceGroup.add(brow);
  });

  const blushGeo = new THREE.SphereGeometry(0.09, 24, 24);
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8da6, transparent: true, opacity: 0.35 });
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.scale.set(1.3, 0.75, 0.3); blush.position.set(side * 0.42, -0.06, 0.885); blush.rotation.y = side * 0.35;
    faceGroup.add(blush);
  });

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.024, 16, 32, Math.PI * 0.82), new THREE.MeshStandardMaterial({ color: eyeColor, roughness: 0.3 }));
  smile.position.set(0, -0.26, 0.945);
  smile.rotation.z = Math.PI + Math.PI * 0.09;
  smile.rotation.x = -0.15;
  smile.name = 'smile';
  faceGroup.add(smile);
  return faceGroup;
}

export function createShadowDisc(colorHex) {
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -1.25;
  return disc;
}

export function baseBody(bodyMat, earMat, earScale, earY, handMat, handR, handPos, shineMatOpacity = 0.45) {
  const root = new THREE.Group(), bodyGroup = new THREE.Group();
  bodyGroup.rotation.order = 'YXZ'; root.add(bodyGroup);
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

export function createStudyBuddy() {
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

export function createLifeBuddy() {
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
export function poses(time) {
  const j = Math.abs(Math.sin(time * 3.4));
  return {
    idle: { y: Math.sin(time * 1.7) * 0.1, sy: 1 + 0.03 * Math.sin(time * 2.3), tx: 0, tz: Math.sin(time * 0.9) * 0.05, ear: Math.sin(time * 3) * 0.12, hb: Math.sin(time * 2) * 0.06, hz: 0, hu: 0, sway: 0.07, smile: 1 },
    run: { y: Math.abs(Math.sin(time * 10)) * 0.13, sy: 1 + 0.05 * Math.cos(time * 20), tx: 0.35, tz: Math.sin(time * 10) * 0.06, ear: -0.3 + Math.sin(time * 16) * 0.25, hb: Math.sin(time * 10) * 0.12, hz: Math.sin(time * 10) * 0.3, hu: 0, sway: 0.22, smile: 1.5 },
    celebrate: { y: j * 0.8, sy: 0.9 + 0.2 * j, tx: -0.05, tz: Math.sin(time * 6.8) * 0.08, ear: 0.5 + Math.sin(time * 14) * 0.3, hb: 0, hz: 0, hu: 0.5, sway: 0.16, smile: 1.6 },
  };
}

export function animateMascot(m, t, phase, dt) {
  const u = m.userData, time = t + phase;
  if (!u.w) { u.w = { idle: 1, run: 0, celebrate: 0 }; u.spin = 0; u.hb0 = [u.leftHand.position.clone(), u.rightHand.position.clone()]; u.eyes = [u.face.getObjectByName('leftEye'), u.face.getObjectByName('rightEye')]; u.smile = u.face.getObjectByName('smile'); }
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
