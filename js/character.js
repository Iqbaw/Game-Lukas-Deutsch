import * as THREE from 'three';

// A lightweight articulated cast. All garment colors come from the original data.
export function buildCharacter(cfg) {
  const group = new THREE.Group();
  const H = cfg.height || 1;
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
  const skin = material(cfg.skinColor), cloth = material(cfg.bodyColor);
  const pants = material(cfg.pantsColor), shoes = material(cfg.shoesColor);
  const hairMat = material(cfg.hairColor), ink = material(0x1a1a1a);
  function oval(parent, mat, size, pos) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
    mesh.scale.set(...size.map(n => n * H));
    mesh.position.set(...pos.map(n => n * H));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Mesh geometry is sized directly so children inherit rotation, not body scale.
  function form(parent, mat, size, pos) {
    const mesh = oval(parent, mat, size, pos);
    mesh.geometry.scale(...mesh.scale.toArray());
    mesh.scale.set(1, 1, 1);
    return mesh;
  }
  const body = form(group, cloth, [0.29, 0.43, 0.19], [0, 1.06, 0]);
  form(body, cloth, [0.255, 0.105, 0.18], [0, -0.32, 0]);
  form(body, skin, [0.085, 0.13, 0.085], [0, 0.43, 0]);
  const head = form(group, skin, [0.225, 0.255, 0.215], [0, 1.74, 0]);
  for (const side of [-1, 1]) {
    oval(head, skin, [0.047, 0.075, 0.04], [side * 0.22, 0, 0]);
    oval(head, ink, [0.024, 0.032, 0.013], [side * 0.082, 0.025, 0.199]);
    oval(head, hairMat, [0.047, 0.012, 0.015], [side * 0.084, 0.085, 0.192]);
  }
  oval(head, skin, [0.035, 0.045, 0.045], [0, -0.025, 0.208]);
  oval(head, ink, [0.045, 0.008, 0.008], [0, -0.106, 0.195]);
  const hair = oval(head, hairMat, [0.237, 0.12, 0.225], [0, 0.18, -0.018]);
  for (let i = 0; i < 3; i++) {
    const lock = oval(head, hairMat, [0.095, 0.064, 0.054], [(i - 1) * 0.12, 0.155 - i * 0.014, 0.162]);
    lock.rotation.z = -0.22;
  }
  if (cfg.hairStyle === 'bun') oval(head, hairMat, [0.14, 0.14, 0.13], [0, 0.16, -0.22]);
  if (cfg.hairStyle === 'long') {
    oval(head, hairMat, [0.23, 0.27, 0.11], [0, -0.06, -0.165]);
    for (const side of [-1, 1]) oval(head, hairMat, [0.065, 0.21, 0.08], [side * 0.205, -0.065, -0.035]);
  }
  if (cfg.hairStyle === 'messy') {
    for (let i = 0; i < 4; i++) {
      const tuft = oval(head, hairMat, [0.09, 0.12, 0.075], [(i - 1.5) * 0.095, 0.23, -0.01]);
      tuft.rotation.z = (i - 1.5) * -0.3;
    }
  }
  if (cfg.hairStyle === 'twintails') for (const side of [-1, 1]) {
    const tail = oval(head, hairMat, [0.072, 0.215, 0.075], [side * 0.265, -0.13, -0.02]);
    tail.rotation.z = side * -0.28;
    oval(head, material(0xc83a3a), [0.079, 0.033, 0.08], [side * 0.25, 0.045, -0.02]);
  }
  if (cfg.hasGlasses) {
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.06 * H, 0.009 * H, 5, 16), ink);
      lens.position.set(side * 0.082 * H, 0.025 * H, 0.22 * H);
      head.add(lens);
    }
    oval(head, ink, [0.035, 0.008, 0.009], [0, 0.027, 0.224]);
  }
  if (cfg.hasMustache) for (const side of [-1, 1]) {
    const mustache = oval(head, material(0xeeeeee), [0.064, 0.025, 0.029], [side * 0.048, -0.075, 0.211]);
    mustache.rotation.z = side * -0.18;
  }
  if (cfg.hasSailorHat) {
    const hat = material(cfg.hatColor);
    oval(head, hat, [0.255, 0.105, 0.25], [0, 0.265, 0]);
    oval(head, hat, [0.26, 0.024, 0.29], [0, 0.205, 0.035]);
    oval(head, material(0xf4c430), [0.032, 0.035, 0.012], [0, 0.265, 0.242]);
  }
  if (cfg.hasHeadphones) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.26 * H, 0.022 * H, 6, 16, Math.PI), ink);
    head.add(band);
    for (const side of [-1, 1]) oval(head, ink, [0.055, 0.09, 0.075], [side * 0.245, 0, 0]);
  }
  if (cfg.hasApron) {
    const apron = material(cfg.apronColor);
    oval(body, apron, [0.23, 0.32, 0.036], [0, -0.09, 0.174]);
    oval(body, apron, [0.025, 0.15, 0.025], [0, 0.26, 0.17]);
  }
  if (cfg.hasBackpack) {
    const pack = material(cfg.backpackColor);
    oval(body, pack, [0.22, 0.27, 0.12], [0, 0, -0.225]);
    for (const side of [-1, 1]) oval(body, pack, [0.025, 0.29, 0.026], [side * 0.16, 0.03, 0.16]);
  }
  if (cfg.hoodie) {
    oval(body, cloth, [0.235, 0.13, 0.16], [0, 0.38, -0.09]);
    oval(body, cloth, [0.16, 0.095, 0.04], [0, -0.15, 0.174]);
    for (const side of [-1, 1]) oval(body, material(0xffffff), [0.01, 0.105, 0.01], [side * 0.048, 0.22, 0.185]);
  }
  function limb(side, arm) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (arm ? 0.32 : 0.13) * H, (arm ? 1.4 : 0.66) * H, 0);
    group.add(pivot);
    const length = arm ? 0.33 : 0.28;
    const mat = arm ? cloth : pants;
    oval(pivot, mat, [arm ? 0.105 : 0.105, length * 0.62, 0.105], [0, -length / 2, 0]);
    const joint = new THREE.Group();
    joint.position.y = -length * H;
    pivot.add(joint);
    oval(joint, mat, [0.087, length * 0.62, 0.09], [0, -length / 2, 0]);
    const end = oval(joint, arm ? skin : shoes, arm ? [0.075, 0.09, 0.075] : [0.108, 0.075, 0.18], [0, -length - (arm ? 0.045 : 0.015), arm ? 0 : 0.06]);
    pivot.userData.joint = joint;
    pivot.userData.end = end;
    pivot.userData.baseY = pivot.position.y;
    return pivot;
  }
  const leftArm = limb(-1, true), rightArm = limb(1, true);
  const leftLeg = limb(-1, false), rightLeg = limb(1, false);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4 * H, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);
  const upperParts = [body, head];
  for (const part of upperParts) Object.assign(part.userData, { baseY: part.position.y, baseRotationX: part.rotation.x, baseRotationZ: part.rotation.z });
  return { group, body, head, hair, leftArm, rightArm, leftLeg, rightLeg, leftHand: leftArm.userData.end, rightHand: rightArm.userData.end, shadow, upperParts, height: H };
}

export function animateCharacter(rig, dt, time, pace = 0, running = false) {
  const blend = 1 - Math.exp(-12 * Math.min(dt, 0.1));
  const smooth = (object, axis, target) => { object.rotation[axis] += (target - object.rotation[axis]) * blend; };
  rig.walkCycle = (rig.walkCycle || 0) + dt * (running ? 10 : 7) * pace;
  const amplitude = Math.min(1, pace) * (running ? 0.8 : 0.5);
  for (const [index, side] of ['left', 'right'].entries()) {
    const phase = rig.walkCycle + index * Math.PI;
    const leg = rig[side + 'Leg'], arm = rig[side + 'Arm'];
    smooth(leg, 'x', Math.sin(phase) * amplitude);
    smooth(leg.userData.joint, 'x', Math.max(0, -Math.cos(phase)) * amplitude * 1.35);
    smooth(arm, 'x', -Math.sin(phase) * amplitude * 0.8 + Math.sin(time * 1.5) * 0.025);
    smooth(arm, 'z', index === 0 ? -0.065 : 0.065);
    smooth(arm.userData.joint, 'x', -(running ? 0.85 : 0.15) - amplitude * 0.12);
  }
  const H = rig.height || 1;
  const bob = (Math.sin(time * 1.6) * 0.009 + (1 - Math.cos(rig.walkCycle * 2)) * amplitude * 0.018) * H;
  for (const part of rig.upperParts) part.position.y = part.userData.baseY + bob;
  smooth(rig.body, 'x', (rig.data?.body.slouch || 0) + (running ? 0.09 : 0));
  smooth(rig.body, 'y', Math.sin(rig.walkCycle) * amplitude * 0.07);
  smooth(rig.head, 'y', pace > 0.05 ? 0 : Math.sin(time * 0.45) * 0.09);
}
