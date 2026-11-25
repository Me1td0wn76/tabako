import * as THREE from "three";
import { seeded, some } from "../world/kit.js";
import { TAU, cottages, forest, streetLamp } from "../world/parts.js";
import { guardrail, nameboard } from "./common.js";

/*
 * 土地をつなぐ道。西：林道（キャンプ地へ）　東：海沿いの道（港へ）　北：峠のトンネル（旅館へ）
 */

export const ROADS = { models: ["bush", "conifer"], images: ["asphalt", "forest", "concrete", "brickwall", "grassland", "snow"] };

export function buildRoads(kit, api) {
  const random = seeded(41);
  const asphalt = kit.material("asphalt", { repeat: [18, 1.2], color: "#8a8c92", roughness: 0.85, bump: 0.8 });
  const soil = kit.material("forest", { repeat: [24, 24], color: "#7d766c", bump: 1.4 });
  const white = kit.solid("#b8babc", { roughness: 0.8 });

  /* ---- 西の林道 ---- */
  kit.ground([130, 150], -0.06, soil, [-140, 0]);
  const west = kit.ground([92, 6.6], 0.005, asphalt, [-109, 0]);
  west.userData.flat = true;
  const marks = [];
  for (let x = -70; x > -152; x -= 5) marks.push({ geometry: new THREE.BoxGeometry(2.2, 0.01, 0.12), position: [x, 0.012, 0] });
  for (let x = 70; x < 136; x += 5) marks.push({ geometry: new THREE.BoxGeometry(2.2, 0.01, 0.12), position: [x, 0.012, 0] });
  kit.merged(white, marks).userData.flat = true;
  guardrail(kit, [-66, 4.2], [-150, 4.2]);
  guardrail(kit, [-66, -4.2], [-150, -4.2]);
  for (const [x, z] of [[-74, 3.9], [-96, -3.9], [-118, 3.9], [-140, -3.9]]) streetLamp(kit, x, z, { height: 4.6, power: 7, reach: 12, color: "#ffd9a0", arm: 0.4 });
  forest(kit, { count: 380, x: [-158, -70], z: [-58, -15], y: -0.2, height: [7, 14], color: "#1d2b24", seed: 3 });
  forest(kit, { count: 380, x: [-158, -70], z: [15, 58], y: -0.2, height: [7, 14], color: "#1d2b24", seed: 4 });
  kit.scatter("conifer", Array.from({ length: some(34) }, (_, i) => ({ position: [-68 - (i >> 1) * 5.2 - random() * 3, -0.15, (i % 2 ? 1 : -1) * (7.6 + random() * 5)], yaw: random() * TAU, scale: 0.8 + random() * 0.6 })), { color: "#5a6a58" });
  nameboard(kit, "← 湖のキャンプ場", [-69, 2.2, -4.6], 0, { width: 2.6, height: 0.6, back: "#20543e" });
  kit.cylinder(0.05, 0.05, 2.2, [-69, 1.1, -4.7], white, undefined, undefined, 10);
  api.area({ x: [-156, -62], z: [-3.9, 3.9], y: 0.01, surface: "road" });

  /* ---- 東の道 ---- */
  kit.ground([80, 150], -0.06, kit.material("grassland", { repeat: [16, 30], color: "#6d7a66", bump: 1 }), [104, 0]);
  kit.ground([80, 6.6], 0.005, asphalt, [102, 0]).userData.flat = true;
  guardrail(kit, [66, 4.2], [122, 4.2]);
  guardrail(kit, [66, -4.2], [122, -4.2]);
  for (const [x, z] of [[76, -3.9], [98, 3.9], [120, -3.9]]) streetLamp(kit, x, z, { height: 4.6, power: 7, reach: 12, color: "#ffe2b8", arm: 0.4 });
  cottages(kit, [[78, -18], [92, -20], [106, -17], [118, -22], [80, 18], [95, 21], [110, 18]].map(([x, z]) => ({ position: [x, 0, z], yaw: random() * TAU, scale: 0.9 + random() * 0.2 })), { walls: ["#a49a90", "#8f8890", "#b0a698"], lit: 0.5, seed: 8 });
  forest(kit, { count: 160, x: [68, 134], z: [-60, -28], y: -0.2, height: [5, 11], color: "#39463c", seed: 8 });
  forest(kit, { count: 160, x: [68, 134], z: [28, 60], y: -0.2, height: [5, 11], color: "#39463c", seed: 9 });
  kit.scatter("bush", Array.from({ length: 34 }, (_, i) => ({ position: [68 + i * 1.6, -0.05, (i % 2 ? 1 : -1) * (5.4 + random())], yaw: random() * TAU, height: 0.8 + random() * 0.5 })), { color: "#8f9d84" });
  nameboard(kit, "港　→", [69, 2.2, 4.6], Math.PI, { width: 1.6, height: 0.6, back: "#1f4f86" });
  kit.cylinder(0.05, 0.05, 2.2, [69, 1.1, 4.7], white, undefined, undefined, 10);
  api.area({ x: [62, 146], z: [-3.9, 3.9], y: 0.01, surface: "road" });

  /* ---- 北のトンネル ---- */
  kit.ground([7, 70], 0.006, asphalt, [0, -95]).userData.flat = true;
  kit.ground([80, 22], -0.05, soil, [0, -72]);
  api.area({ x: [-3.2, 3.2], z: [-142, -60], y: 0.01, surface: "road" });
  guardrail(kit, [-4.4, -61], [-4.4, -79]);
  guardrail(kit, [4.4, -61], [4.4, -79]);
  forest(kit, { count: 90, x: [-60, -9], z: [-79, -63], y: -0.2, height: [6, 12], color: "#27332c", seed: 12 });
  forest(kit, { count: 90, x: [9, 60], z: [-79, -63], y: -0.2, height: [6, 12], color: "#27332c", seed: 13 });
  nameboard(kit, "↑ 雪見の宿", [-4.9, 2.4, -63], 0, { width: 2.2, height: 0.6, back: "#5a2a24" });
  kit.cylinder(0.05, 0.05, 2.4, [-4.9, 1.2, -63.1], white, undefined, undefined, 10);
  // 山
  const earth = kit.material("forest", { repeat: [12, 5], color: "#4a5248", bump: 2 });
  // トンネルの通る所だけ、くり抜く
  earth.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vBore;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvBore = vec2(position.x * 80.0, position.y * 30.0 - 2.0);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vBore;").replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (abs(vBore.x) < 4.4 && vBore.y < 6.4) discard;");
  };
  const hill = kit.mesh(new THREE.SphereGeometry(1, 40, 18, 0, TAU, 0, Math.PI / 2), earth, [0, -2, -103]);
  hill.scale.set(80, 30, 21.6);
  hill.userData.far = true;
  const cones = [];
  for (let i = 0; i < 300; i += 1) {
    const x = (random() * 2 - 1) * 76;
    const t = (random() * 2 - 1) * 0.94;
    const z = t * 21.6;
    const inside = 1 - (x / 80) ** 2 - t * t;
    if (inside < 0.06) continue;
    const h = 4.5 + random() * 4;
    cones.push({ position: [x, -2 + 30 * Math.sqrt(inside) - 0.6, -103 + z], yaw: random() * TAU, scale: [h * 0.32, h, h * 0.32], color: new THREE.Color(z < -6 ? "#9fb0c8" : "#26332b").offsetHSL(0, 0, random() * 0.04) });
  }
  const cone = new THREE.ConeGeometry(0.5, 1, 7);
  cone.translate(0, 0.5, 0);
  kit.many(cone, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), cones).userData.far = true;
  // 坑門（南と北）
  const shape = new THREE.Shape();
  shape.moveTo(-13, 0);
  shape.lineTo(-13, 7.4);
  shape.lineTo(13, 7.4);
  shape.lineTo(13, 0);
  shape.lineTo(3.35, 0);
  shape.lineTo(3.35, 2.4);
  shape.absarc(0, 2.4, 3.35, 0, Math.PI, false);
  shape.lineTo(-3.35, 0);
  shape.lineTo(-13, 0);
  const portal = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false, curveSegments: 20 });
  const uv = portal.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) / 7, uv.getY(i) / 7);
  const stone = kit.material("brickwall", { color: "#8f8c86", bump: 1 });
  for (const z of [-80.8, -126.1]) {
    kit.mesh(portal, stone, [0, 0, z]);
    for (const side of [-1, 1]) kit.block([9.6, 7, 0.9], [side * 8.2, 3.5, z + 0.45]);
  }
  nameboard(kit, "風見隧道", [0, 6.4, -79.86], 0, { width: 3, height: 0.7, back: "#3a3a38", glow: 0.15 });
  // 内壁
  const lining = kit.material("concrete", { repeat: [12, 1], color: "#8a8278", side: THREE.BackSide });
  const arch = new THREE.CylinderGeometry(3.35, 3.35, 45.6, 24, 1, true, 0, Math.PI);
  arch.rotateX(Math.PI / 2);
  arch.rotateZ(Math.PI / 2);
  kit.mesh(arch, lining, [0, 2.4, -103.2]).userData.noCast = true;
  const side = kit.material("concrete", { repeat: [12, 0.6], color: "#8a8278" });
  for (const x of [-3.5, 3.5]) kit.box([0.3, 2.5, 45], [x, 1.2, -103.2], side);
  for (let z = -84; z > -124; z -= 6.4) {
    for (const x of [-3.1, 3.1]) kit.bulb([0.1, 0.1, 0.8], "#ffae5c", 2.2, [x, 3.1, z]);
    kit.light("#ffa04a", 4.6, [0, 3.0, z], 9, 1.5);
  }
  // 雪国側の道ばた
  kit.ground([90, 30], -0.05, kit.material("snow", { repeat: [14, 5], color: "#c3d1e8", roughness: 0.95, bump: 2 }), [0, -138]);
}
