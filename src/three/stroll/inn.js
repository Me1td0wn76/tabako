import * as THREE from "three";
import { ENGAWA, engawaSet, gardenGround, pondDepth } from "../world/engawa.js";
import { seeded, some } from "../world/kit.js";
import { TAU, forest, ridges, stringLights } from "../world/parts.js";
import { addSpot, framedScroll, localArea, localPoint, nameboard } from "./common.js";

/*
 * 雪見の宿（旅館）。座標は「縁側に座る人」が原点の、いつもの縁側と同じ（-Z が庭。床が 0、地面が -0.5）。
 * 玄関は南（+Z）にあり、広間を抜けると縁側に出る。
 */

const YARD = -0.5;

export const INN = {
  id: "inn",
  name: "雪見の宿",
  x: [-50, 50],
  z: [-236, -122],
  models: [...new Set([...ENGAWA.models, "wagasa", "kotatsu", "ikebana", "bench", "busstop", "car", "npc_okami", "cat", "lantern"])],
  images: [...new Set([...ENGAWA.images, "tatami", "kawara", "wood_plank", "plaster", "concrete"])],
};

function innGround(x, z) {
  return gardenGround(x, z) + Math.max(0, Math.abs(x) - 15) * 0.22 + Math.max(0, z - 44) * 0.0;
}

export function buildInn(kit, api) {
  kit.frame([0, 0.5, -178], 0, () => {
    const random = seeded(71);
    /* ---- 雪の地面・林・山 ---- */
    const land = new THREE.PlaneGeometry(100, 108, 160, 170);
    land.rotateX(-Math.PI / 2);
    land.translate(0, 0, -4);
    const position = land.attributes.position;
    for (let i = 0; i < position.count; i += 1) position.setY(i, innGround(position.getX(i), position.getZ(i)));
    land.computeVertexNormals();
    kit.mesh(land, kit.material("snow", { repeat: [16, 17], color: "#c3d1e8", roughness: 0.95, bump: 2.2 })).userData.noCast = true;
    localArea(kit, api, { x: [-15, 15], z: [-11, 50], y: innGround, surface: "snow", only: (x, z) => pondDepth(x, z) < -0.02 });
    const house = (x, z) => Math.abs(x) < 9 && z > -14 && z < 12;
    forest(kit, { count: 260, x: [-60, 60], z: [-58, -26], y: YARD + 1, height: [7, 15], color: "#2a3a52", seed: 9, snow: "#7f93b4" });
    forest(kit, { count: 130, x: [-46, -17], z: [-26, 50], y: YARD + 0.6, height: [7, 14], color: "#2a3a52", seed: 19, snow: "#7f93b4", avoid: house });
    forest(kit, { count: 130, x: [17, 46], z: [-26, 50], y: YARD + 0.6, height: [7, 14], color: "#2a3a52", seed: 29, snow: "#7f93b4", avoid: house });
    ridges(kit, [{ z: -120, color: "#22344f", height: 34, seed: 4 }]);

    /* ---- 縁側と庭 ---- */
    addSpot(kit, api, { id: "engawa", name: "旅館の縁側", at: [0, 0, 0], yaw: 0, eye: ENGAWA.eye, table: ENGAWA.spot, place: "engawa", seat: { model: "zabuton", at: [0, 0, 0.1], height: 0.1 }, build: () => engawaSet(kit) });
    building(kit, api);
    approach(kit, api, random);
    footbath(kit, api);
    kit.particles({ count: 900, area: { x: [-18, 18], y: [YARD, 6.5], z: [8, 50] }, color: "#eef4ff", size: 0.02, fall: 0.5, sway: 0.25 });
    kit.particles({ count: 360, area: { x: [-20, -7], y: [YARD, 6.5], z: [-12, 10] }, color: "#eef4ff", size: 0.02, fall: 0.5, sway: 0.25 });
  });
}

/* ---------------- 建物 ---------------- */

function building(kit, api) {
  const dark = kit.material("wood_dark", { repeat: [1, 2], color: "#5f4836", roughness: 0.55 });
  const plaster = kit.material("plaster", { repeat: [2, 1], color: "#d8cbb0", roughness: 0.95 });
  const board = kit.material("wood_plank", { repeat: [4, 1.6], color: "#6a5442", roughness: 0.8, bump: 0.6 });
  localArea(kit, api, { x: [-5.9, 5.9], z: [-1.95, 8.4], y: 0, surface: "wood", indoor: true });
  // 床：広間は畳、玄関は板
  const mats = kit.material("tatami", { repeat: [6, 3], color: "#d8d0a8", roughness: 0.95 });
  mats.map.wrapS = mats.map.wrapT = THREE.RepeatWrapping;
  kit.ground([11.8, 5.8], 0.004, mats, [0, 3.4]);
  kit.ground([11.8, 2.2], 0.004, kit.material("wood_dark", { repeat: [4, 1], color: "#8a6a50", roughness: 0.4 }), [0, 7.4]);
  kit.ground([11.8, 8.4], 2.6, kit.material("wood_plank", { repeat: [4, 3], color: "#6a5442" }), [0, 4.2]).rotation.x = Math.PI / 2;
  // 外の壁
  for (const x of [-6.0, 6.0]) {
    kit.box([0.16, 2.8, 8.4], [x, 1.2, 4.3], plaster);
    kit.box([0.2, 1.1, 8.4], [x, 0.1, 4.3], board);
  }
  for (const x of [-3.7, 3.7]) {
    kit.box([4.6, 2.8, 0.16], [x, 1.2, 8.5], plaster);
    kit.box([4.6, 1.1, 0.2], [x, 0.1, 8.5], board);
  }
  kit.box([12, 0.5, 0.2], [0, 2.45, 8.5], dark).userData.pass = true;
  for (const x of [-6, -1.4, 1.4, 6]) kit.box([0.18, 3.2, 0.18], [x, 1.1, 8.5], dark);
  for (const x of [-6, 6]) kit.box([0.18, 3.2, 0.18], [x, 1.1, 0.3], dark);
  // 玄関のひさし・のれん・提灯
  kit.box([4.4, 0.12, 2.2], [0, 2.55, 9.4], dark, [0.14, 0, 0]).userData.pass = true;
  kit.box([4.4, 0.14, 2.2], [0, 2.68, 9.4], kit.material("snow", { repeat: [2, 1], color: "#dfe8f6" }), [0.14, 0, 0]).userData.pass = true;
  for (const x of [-2, 2]) kit.box([0.16, 3.0, 0.16], [x, 1.0, 10.2], dark);
  for (let i = -2; i <= 2; i += 1) {
    const cloth = kit.mesh(new THREE.PlaneGeometry(0.52, 0.8), new THREE.MeshStandardMaterial({ color: "#3a2a5c", side: THREE.DoubleSide, roughness: 1 }), [i * 0.54, 1.82, 8.56]);
    kit.onUpdate((delta, time, wind) => {
      cloth.rotation.x = Math.sin(time * 1.6 + i) * 0.06 + wind * 0.04;
    });
  }
  nameboard(kit, "雪見の宿", [0, 2.48, 8.66], 0, { width: 1.8, height: 0.42, back: "#2c2018", ink: "#f0dcb8", glow: 0.5 });
  for (const x of [-1.75, 1.75]) {
    kit.put("andon", [x, 0.0, 9.0], { height: 0.6, glow: 0.8, threshold: 0.6, tint: "#ffcf90" });
    kit.light("#ffbe78", 2.4, [x, 0.8, 9.3], 6, 1.5);
  }
  kit.box([3.0, 0.2, 1.4], [0, -0.4, 9.2], kit.solid("#5a5f66", { roughness: 0.9 }));
  kit.box([2.6, 0.2, 0.7], [0, -0.2, 8.9], kit.solid("#5a5f66", { roughness: 0.9 }));
  // 大屋根
  const tiles = kit.material("kawara", { repeat: [6, 3], color: "#7d838c", roughness: 0.7, bump: 1.4 });
  const snow = kit.material("snow", { repeat: [6, 2], color: "#dfe8f6", roughness: 1 });
  for (const [z, tilt] of [[6.9, 0.42], [1.9, -0.42]]) {
    kit.box([14, 0.16, 6.2], [0, 3.9, z], tiles, [tilt, 0, 0]).userData.pass = true;
    kit.box([13.8, 0.14, 5.6], [0, 4.02, z], snow, [tilt, 0, 0]).userData.pass = true;
  }
  kit.box([14.2, 0.4, 0.4], [0, 5.2, 4.4], tiles).userData.pass = true;
  for (const x of [-6, 6]) {
    const gable = new THREE.Shape();
    gable.moveTo(-4.6, 0);
    gable.lineTo(0, 2.1);
    gable.lineTo(4.6, 0);
    kit.mesh(new THREE.ShapeGeometry(gable), new THREE.MeshStandardMaterial({ color: "#c8bca4", side: THREE.DoubleSide, roughness: 1 }), [x, 2.75, 4.4], [0, Math.PI / 2, 0]);
  }
  // 広間と玄関の間の襖、縁側との間の障子
  const paper = new THREE.MeshStandardMaterial({ color: "#f2e8d4", emissive: "#ffcf90", emissiveIntensity: 0.24, side: THREE.DoubleSide, roughness: 1 });
  const screen = (x, z, w, h = 2.0) => {
    kit.mesh(new THREE.PlaneGeometry(w, h), paper, [x, h / 2, z]).userData.noCast = true;
    kit.box([w, 0.06, 0.04], [x, 0.03, z], dark).userData.pass = true;
    kit.box([w, 0.06, 0.04], [x, h, z], dark).userData.pass = true;
    for (const k of [-0.5, 0.5]) kit.box([0.05, h, 0.04], [x + w * k, h / 2, z], dark).userData.pass = true;
    for (let i = 1; i < 4; i += 1) kit.box([0.012, h, 0.02], [x + (i / 4 - 0.5) * w, h / 2, z], dark).userData.pass = true;
    for (let i = 1; i < 6; i += 1) kit.box([w, 0.012, 0.02], [x, (i / 6) * h, z], dark).userData.pass = true;
    kit.block([w, h, 0.08], [x, h / 2, z]);
  };
  for (const x of [-5.2, -3.7, -2.2, 2.2, 3.7, 5.2]) screen(x, 0.42, 1.46);
  for (const x of [-5.2, -3.7, -2.2, 2.2, 3.7, 5.2]) screen(x, 6.3, 1.46);
  kit.box([12, 0.6, 0.12], [0, 2.3, 0.42], dark).userData.pass = true;
  kit.box([12, 0.6, 0.12], [0, 2.3, 6.3], dark).userData.pass = true;
  // 広間の中
  kit.put("kotatsu", [-3.2, 0, 3.4], { height: 0.46 });
  for (const [x, z] of [[-4.3, 3.4], [-2.1, 3.4], [-3.2, 4.5]]) kit.put("zabuton", [x, 0, z], { height: 0.09 });
  kit.box([2.2, 0.16, 1.0], [4.8, 0.08, 3.2], dark);
  kit.put("ikebana", [5.2, 0.16, 3.0], { height: 0.7 });
  framedScroll(kit, [5.9, 1.35, 3.2], -Math.PI / 2);
  kit.put("andon", [3.4, 0, 5.4], { height: 0.6, glow: 0.8, threshold: 0.6, tint: "#ffcf90" });
  kit.put("andon", [-5.2, 0, 1.2], { height: 0.6, glow: 0.8, threshold: 0.6, tint: "#ffcf90" });
  kit.light("#ffc488", 4.5, [0, 2.2, 3.2], 8, 1.4);
  kit.light("#ffc488", 3, [0, 2.2, 7.2], 6, 1.4);
  kit.put("npc_okami", [2.6, 0, 7.4], { yaw: -0.5 });
  kit.put("cat", [-4.6, 0, 2.2], { yaw: 0.9, color: "#f0ece6" });
  // 靴箱
  kit.box([1.8, 0.9, 0.4], [-4.6, 0.45, 8.1], board);
  kit.put("geta", [-4.9, 0.9, 8.1], { height: 0.09 });
  kit.put("geta", [-4.4, 0.9, 8.1], { height: 0.09, yaw: 0.4 });
}

/* ---------------- 門と参道 ---------------- */

function approach(kit, api, random) {
  const dark = kit.material("wood_dark", { repeat: [1, 2], color: "#5f4836", roughness: 0.6 });
  // 飛び石と灯籠
  for (let i = 0; i < 13; i += 1) kit.put("stones", [(random() - 0.5) * 0.6, YARD - 0.05, 11.4 + i * 2.4], { height: 0.09, yaw: random() * TAU });
  [[-2.6, 14], [2.6, 18.5], [-2.6, 23], [2.6, 34], [-2.8, 38]].forEach(([x, z], i) => {
    kit.put("toro", [x, YARD, z], { yaw: i, height: 1.4, glow: 0.7, threshold: 0.85, tint: "#ffb860" });
    kit.light("#ffb866", 2.2, [x * 0.9, YARD + 1.1, z], 6, 1.5);
  });
  // 門
  for (const x of [-2.1, 2.1]) {
    kit.box([0.3, 3.0, 0.3], [x, YARD + 1.5, 28], dark);
    kit.box([0.24, 2.6, 0.24], [x, YARD + 1.3, 27], dark);
  }
  kit.box([6.2, 0.24, 2.2], [0, YARD + 3.1, 27.5], dark).userData.pass = true;
  for (const side of [-1, 1]) {
    kit.box([6.8, 0.14, 1.7], [0, YARD + 3.6, 27.5 + side * 0.7], kit.material("kawara", { repeat: [3, 1], color: "#7d838c", bump: 1 }), [side * 0.42, 0, 0]).userData.pass = true;
    kit.box([6.7, 0.12, 1.6], [0, YARD + 3.72, 27.5 + side * 0.7], kit.material("snow", { repeat: [3, 1], color: "#dfe8f6" }), [side * 0.42, 0, 0]).userData.pass = true;
  }
  nameboard(kit, "雪見の宿", [0, YARD + 2.75, 28.2], 0, { width: 1.8, height: 0.44, back: "#2c2018", ink: "#f0dcb8", glow: 0.5 });
  // 竹垣
  const bamboo = kit.solid("#a08a58", { roughness: 0.6 });
  const poles = [];
  for (let i = 0; i < 96; i += 1) for (const side of [-1, 1]) if (i < 48) poles.push({ position: [side * (2.6 + i * 0.24), YARD + 0.75, 27.6], color: new THREE.Color("#b09a66").offsetHSL(0, 0, (random() - 0.5) * 0.1) });
  kit.many(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), bamboo, poles);
  for (const side of [-1, 1]) {
    kit.block([11.6, 1.6, 0.16], [side * 8.3, YARD + 0.8, 27.6]);
    kit.box([11.6, 0.07, 0.2], [side * 8.3, YARD + 1.6, 27.6], kit.material("snow", { repeat: [4, 0.1], color: "#dfe8f6" })).userData.pass = true;
  }
  kit.scatter("snowbush", Array.from({ length: some(30) }, (_, i) => {
    const side = i % 2 ? -1 : 1;
    const x = side * (4.2 + random() * 9);
    const z = 12 + random() * 34;
    return Math.abs(z - 27.6) < 1.2 || (x > 2 && x < 9 && z > 19 && z < 27) ? { position: [side * 13.6, YARD, z], height: 0.9 } : { position: [x, innGround(x, z) - 0.05, z], height: 0.5 + random() * 0.5, yaw: random() * TAU };
  }));
  for (const [x, z, h] of [[-9, 16, 3.8], [9.4, 14, 4.2], [-11, 24, 4.4], [11, 32, 4.0], [-7.6, 35, 3.6], [-8.4, 10.6, 3.2], [8.6, 41, 4.2]]) kit.put("pine", [x, innGround(x, z) - 0.05, z], { yaw: random() * TAU, height: h });
  stringLights(kit, [-2.1, 2.2, 28], [-2.4, 1.6, 40], { sag: 0.3, count: 8, radius: 0.03 });
  stringLights(kit, [2.1, 2.2, 28], [2.4, 1.6, 40], { sag: 0.3, count: 8, radius: 0.03 });
  kit.put("busstop", [3.0, YARD, 44], { height: 2.5 });
  kit.put("car", [-6.4, YARD, 43], { yaw: 0.3, color: "#8a94a4" });
  kit.light("#ffd9a0", 4, [2.6, 2.0, 44], 8, 1.5);
  api.stop({ id: "inn", name: "雪見の宿", at: localPoint(kit, api, [3.0, YARD, 44]), to: { at: localPoint(kit, api, [0.8, YARD, 43]), yaw: 0 } });
  // 門前の茶屋
  addSpot(kit, api, {
    id: "teahouse",
    name: "門前の茶屋",
    at: [6.4, YARD - 0.04, 23.6],
    yaw: Math.PI / 2 - 0.3,
    eye: 1.06,
    table: { y: 0.66, item: [-0.2, -1.2], phone: [0.24, -1.3], chillTray: [-0.04, -1.26] },
    lamp: ["#ffc689", 3.6, [-1.4, 2.2, 7.2]],
    fill: ["#7f98d0", 0.45],
    surface: { image: "wood_dark", color: "#8a3a30", roughness: 0.7 },
    build: () => {
      const red = kit.solid("#a8281e", { roughness: 1 });
      kit.rbox([2.0, 0.1, 0.8], 0.02, [0, 0.42, 0.1], red);
      for (const x of [-0.85, 0.85]) kit.box([0.08, 0.4, 0.7], [x, 0.2, 0.1], dark);
      kit.rbox([1.0, 0.05, 0.62], 0.01, [0, 0.635, -1.3], red);
      for (const x of [-0.42, 0.42]) kit.box([0.06, 0.62, 0.5], [x, 0.31, -1.3], dark);
      kit.put("teaset", [0.28, 0.66, -1.4], { height: 0.13 });
      kit.put("wagasa", [1.5, 0, -0.2], { height: 2.5 });
      kit.put("hibachi", [-1.3, 0, -1.2], { height: 0.36, glow: 0.8, threshold: 0.6, tint: "#ff7a3a" });
      kit.light("#ff8a4a", 1.4, [-1.3, 0.6, -1.2], 4, 1.6);
      kit.put("andon", [1.2, 0, -1.9], { height: 0.56, glow: 0.8, threshold: 0.6, tint: "#ffcf90" });
      kit.light("#ffbe78", 2.0, [1.2, 0.8, -1.7], 5, 1.5);
    },
  });
}

/* ---------------- 足湯 ---------------- */

function footbath(kit, api) {
  const dark = kit.material("wood_dark", { repeat: [1, 2], color: "#5f4836", roughness: 0.6 });
  const stone = kit.solid("#6a7078", { roughness: 0.9 });
  kit.frame([-10.4, YARD - 0.04, 4.2], 0, () => {
    kit.box([3.4, 0.2, 2.6], [0, 0.04, 0], stone);
    for (const [w, d, x, z] of [[2.4, 0.2, 0, -0.75], [2.4, 0.2, 0, 0.75], [0.2, 1.7, -1.1, 0], [0.2, 1.7, 1.1, 0]]) kit.box([w, 0.34, d], [x, 0.28, z], stone);
    kit.water({ size: [2.0, 1.4], y: 0.36, position: [0, 0], deep: "#1a4450", shallow: "#7aa4ac", sparkle: "#e8f6ff", glitter: 0.1, scale: 2, lights: [[[0, 2.2, 0], "#ffb866"]] });
    kit.steam({ at: [0, 0.4, 0], spread: [1.6, 1.0], count: 12, size: 0.4, grow: 1.1, rise: 1.6, opacity: 0.12, speed: 0.16, color: "#dfe8f4" });
    for (const x of [-1.8, 1.8]) for (const z of [-1.4, 1.4]) kit.box([0.14, 2.6, 0.14], [x, 1.3, z], dark);
    for (const side of [-1, 1]) {
      kit.box([4.6, 0.12, 2.2], [0, 2.9, side * 0.95], kit.material("kawara", { repeat: [3, 1.4], color: "#7d838c", bump: 1 }), [side * 0.4, 0, 0]).userData.pass = true;
      kit.box([4.5, 0.12, 2.1], [0, 3.02, side * 0.95], kit.material("snow", { repeat: [3, 1], color: "#dfe8f6" }), [side * 0.4, 0, 0]).userData.pass = true;
    }
    kit.bulb([0.12], "#ffce90", 1.8, [0, 2.2, 0]);
    kit.light("#ffbe78", 3.6, [0, 2.1, 0], 7, 1.5);
    nameboard(kit, "足湯", [0, 2.5, 1.5], 0, { width: 1.0, height: 0.36, back: "#2c2018", ink: "#f0dcb8", glow: 0.5 });
    kit.put("pail", [1.5, 0.14, 1.0], { height: 0.24 });
    addSpot(kit, api, {
      id: "ashiyu",
      name: "足湯",
      at: [0, 0.14, 1.06],
      yaw: 0,
      eye: 0.98,
      table: { y: 0.56, item: [-0.2, -1.2], phone: [0.24, -1.3], chillTray: [0.42, -1.0] },
      lamp: ["#ffc689", 3.8, [-1.2, 2.2, 7.2]],
      fill: ["#7f98d0", 0.4],
      surface: { image: "wood_dark", color: "#b3a290", roughness: 0.6 },
      build: () => {
        kit.rbox([2.0, 0.06, 0.4], 0.02, [0, 0.36, 0.16], dark);
        kit.rbox([0.7, 0.04, 0.46], 0.01, [0.42, 0.54, -1.02], dark);
        for (const x of [0.12, 0.72]) kit.box([0.06, 0.2, 0.4], [x, 0.42, -1.02], dark).userData.pass = true;
      },
    });
  });
}
