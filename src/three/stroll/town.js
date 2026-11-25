import * as THREE from "three";
import { BALCONY, balconySet } from "../world/balcony.js";
import { seeded, some, wet } from "../world/kit.js";
import { KISSATEN, kissatenSet } from "../world/kissaten.js";
import { KONBINI, konbiniSet } from "../world/konbini.js";
import { ROOFTOP, rooftopSet } from "../world/rooftop.js";
import { TAU, antenna, can, cottages, powerPole, streetLamp, stringLights } from "../world/parts.js";
import { SEAT_STAND, STAND, addSpot, facades, guardrail, nameboard, shopfronts, signboard, standAshtray, train } from "./common.js";

/*
 * 都会。東西の大通り（z = 0）と南北の通り（x = 0）を中心に、
 *   北西：コンビニ　北東：駅前とオフィスビル　南西：純喫茶・公園・路地裏　南東：商店と自宅
 */

const HOME = { at: [18, 6, 50.6], yaw: Math.PI };
const KONBINI_AT = { at: [-27, 0, -9], yaw: 0 };
const KISSATEN_AT = { at: [-11.5, 0.02, 9.6], yaw: Math.PI };
const ROOF = { at: [23, 30, -13.6], yaw: 0 };

/* ---------------- 道 ---------------- */

function streets(kit) {
  kit.ground([200, 162], 0, wet(kit.material("asphalt", { repeat: [30, 24], color: "#b6b8be", roughness: 0.8, bump: 1 }), { scale: 0.4, amount: 0.34, dark: 0.35 }), [0, -20]);
  const paving = kit.material("paving", { repeat: [1, 1], color: "#b9b6b4", roughness: 0.9, bump: 0.6 });
  const slabs = [];
  const slab = (x0, x1, z0, z1) => {
    const [w, d] = [x1 - x0, z1 - z0];
    const geometry = new THREE.BoxGeometry(w, 0.12, d);
    const uv = geometry.attributes.uv;
    const normal = geometry.attributes.normal;
    for (let i = 0; i < uv.count; i += 1) if (normal.getY(i) > 0.5) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * d) / 3);
    slabs.push({ geometry, position: [(x0 + x1) / 2, 0.06, (z0 + z1) / 2] });
    kit.block([w, 0.12, d], [(x0 + x1) / 2, 0.06, (z0 + z1) / 2]);
  };
  // 大通りの歩道
  for (const [x0, x1] of [[-64, -38.5], [-33.5, -5.5], [5.5, 64]]) slab(x0, x1, 4.2, 7.2);
  for (const [x0, x1] of [[-64, -46.5], [-11.8, -5.5], [5.5, 64]]) slab(x0, x1, -7.2, -4.2);
  // 南北の通りの歩道
  for (const [x0, x1] of [[-5.5, -3.6], [3.6, 5.5]]) {
    slab(x0, x1, 7.2, 36);
    slab(x0, x1, 41, 58);
    slab(x0, x1, -31.8, -7.2);
    slab(x0, x1, -62, -36.2);
  }
  slab(40, 62, -30.6, -7.2); // 駅前広場
  slab(9.6, 36.4, -9.6, -7.2);
  kit.merged(paving, slabs);
  const curb = kit.solid("#8e8c8a", { roughness: 0.95 });
  kit.merged(curb, [[-51, 4.1, 25, 0.2], [-19.5, 4.1, 28, 0.2], [34.7, 4.1, 58.5, 0.2], [-55, -4.1, 17.5, 0.2], [-8.6, -4.1, 6.3, 0.2], [34.7, -4.1, 58.5, 0.2]].map(([x, z, w, d]) => ({ geometry: new THREE.BoxGeometry(w, 0.16, d), position: [x, 0.08, z] })));
  // 白線・横断歩道
  const lines = [];
  const line = (x, z, w, d) => lines.push({ geometry: new THREE.BoxGeometry(w, 0.012, d), position: [x, 0.008, z] });
  for (let x = -62; x < 62; x += 5) if (Math.abs(x + 1.2) > 9) line(x + 1.2, 0, 2.6, 0.14);
  for (let z = -60; z < 56; z += 4.4) if (Math.abs(z) > 11) line(0, z, 0.12, 2.2);
  for (let i = 0; i < 8; i += 1) {
    const at = -3.5 + i;
    line(-6.6, at, 2.6, 0.5);
    line(6.6, at, 2.6, 0.5);
    if (Math.abs(at) < 3.4) {
      line(at, -6.0, 0.5, 2.6);
      line(at, 6.0, 0.5, 2.6);
    }
  }
  line(-9, 2, 0.4, 3.6);
  line(9, -2, 0.4, 3.6);
  kit.merged(kit.material(null, { color: "#c4c6c8", roughness: 0.8 }), lines).userData.flat = true;
  kit.many(new THREE.CylinderGeometry(0.34, 0.34, 0.014, 24), kit.solid("#3c3e42", { metalness: 0.5, roughness: 0.6 }), [[-20, 1.6], [14, -2], [34, 2.2], [1.4, 24], [-1.2, -24], [-36, 18], [48, -1]].map(([x, z]) => ({ position: [x, 0.008, z] })));
}

/* ---------------- 建物 ---------------- */

function blocks(kit) {
  const random = seeded(3);
  const B = (x0, x1, z0, z1, h) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h });
  facades(kit, "facade3", [B(-25.4, -18, 7.4, 18, 10.5), B(13.6, 21, 7.4, 18, 13.5), B(31.4, 40, 7.4, 16.8, 16.5), B(-62, -48, -20, -7.4, 16.5), B(-32, -22, 21, 35.5, 9), B(7, 18, 20, 34, 9), B(50, 62, 18, 34, 15), B(-60, -46, 41, 57, 12), B(31, 44, 43, 57, 12)], { tile: [16, 15], glow: 0.9, gain: 1.15, threshold: 0.62, seed: 2 });
  facades(kit, "facade4", [B(-33, -26, 7.4, 17.4, 8.4), B(6.2, 13, 7.4, 17.6, 9.2), B(21.6, 30.6, 7.4, 17, 8.2), B(-11.6, -6.2, -18, -7.4, 8), B(-20, -7, 21, 35.5, 12), B(20, 33, 20, 34, 11.5), B(-32, -20, 43, 57, 8.5), B(47, 62, 43, 57, 14), { ...B(-15.6, -8.6, 7.4, 18.9, 6.4), y: 2.95 }], { tile: [18, 15], glow: 0.75, gain: 2.4, seed: 5 });
  facades(kit, "facade", [B(41, 50, 7.4, 17, 11), B(36, 48, 18.4, 34, 9), B(-18, -7, 43, 57, 10.5)], { tile: [24, 24], glow: 1.1, gain: 1.7, seed: 7 });
  facades(kit, "facade2", [B(51, 62, 7.4, 17, 21), { x: 23, z: -20.1, w: 26.6, d: 21.4, h: 29.9, flat: true }], { tile: [24, 24], glow: 1.1, gain: 1.3, seed: 9 });
  // 店先
  const S = (x0, x1, z, facing) => ({ x: (x0 + x1) / 2, z, w: x1 - x0 - 0.3, facing });
  shopfronts(kit, "shopa", [S(-33, -26, 7.36, Math.PI), S(-11.6, -6.2, -7.36, 0), { x: -33.96, z: 46.5, w: 6, facing: -Math.PI / 2 }, { x: -33.96, z: 53.4, w: 6, facing: -Math.PI / 2 }]);
  shopfronts(kit, "shopb", [S(-25.4, -18, 7.36, Math.PI), S(41, 50, 7.36, Math.PI)]);
  shopfronts(kit, "shopc", [S(13.6, 21, 7.36, Math.PI)]);
  shopfronts(kit, "shopd", [S(6.2, 13, 7.36, Math.PI)]);
  shopfronts(kit, "shutter", [S(21.6, 30.6, 7.36, Math.PI), S(31.4, 40, 7.36, Math.PI), { x: -6.96, z: 28, w: 12, facing: Math.PI / 2 }, { x: 6.96, z: 27, w: 12, facing: -Math.PI / 2 }, { x: -6.96, z: 50, w: 12, facing: Math.PI / 2 }], { glow: 0.12 });
  signboard(kit, "居酒屋", [-26.4, 4.6, 6.9], Math.PI / 2, { back: "#16324a" });
  signboard(kit, "パン", [-18.4, 4.8, 6.9], Math.PI / 2, { back: "#c0762a", height: 1.7 });
  signboard(kit, "らーめん", [12.6, 4.9, 6.9], Math.PI / 2, { back: "#d8a21e", ink: "#7a1c10", height: 2.8 });
  signboard(kit, "花", [20.6, 4.6, 6.9], Math.PI / 2, { back: "#2c6a48", height: 1.1, width: 0.9 });
  signboard(kit, "貸物件", [30.2, 4.6, 6.9], Math.PI / 2, { back: "#5a5e62", glow: 0.2 });
  signboard(kit, "喫茶", [-8.9, 4.3, 6.9], Math.PI / 2, { back: "#4a2416", ink: "#ffd9a0", height: 1.8 });
  signboard(kit, "酒場", [-6.5, 4.4, -6.9], Math.PI / 2, { back: "#7a1f18", height: 1.8 });
  signboard(kit, "歯科", [50.6, 6.4, 6.9], Math.PI / 2, { back: "#2f6f9c", height: 1.8 });
  // 裏通りの家並み
  const houses = [];
  for (let i = 0; i < 9; i += 1) houses.push({ position: [-57 + i * 8.4, 0, -42 - random() * 1.4], yaw: Math.floor(random() * 2) * Math.PI, scale: 0.92 + random() * 0.08 });
  kit.scatter("house", houses, { glow: 1.0, threshold: 0.74, tint: "#ffd29a" });
  const fenceMat = kit.material("concrete", { repeat: [20, 0.5], color: "#8a8680" });
  kit.box([60, 1.1, 0.16], [-31, 0.55, -36.6], fenceMat);
  kit.box([48, 1.1, 0.16], [30, 0.55, -36.6], fenceMat);
  cottages(kit, Array.from({ length: 5 }, (_, i) => ({ position: [12 + i * 9, 0, -42.5], yaw: i % 2 ? Math.PI / 2 : 0, scale: 0.9 })), { walls: ["#9a949c", "#857f88", "#a59c94"], lit: 0.6, seed: 4 });
  for (let i = 0; i < 5; i += 1) kit.block([8, 6, 7], [12 + i * 9, 3, -42.5]);
}

/* ---------------- 電柱・街灯・並木・小物 ---------------- */

function lamps(kit) {
  for (const [z, list] of [[-6.7, [-56, -30, -14, 16, 34, 52]], [6.7, [-58, -44, -22, -4.6, 8, 26, 44, 58]]]) {
    for (const x of list) {
      streetLamp(kit, x, z, { height: 5.2, power: 13, reach: 15, color: "#ffd9a0", arm: z < 0 ? 0.5 : -0.5 });
      kit.pillar(0.08, 5, [x, 0, z]);
    }
  }
  for (const [x, z] of [[-4.6, 22], [4.6, 33], [-4.6, 46], [4.6, 55], [-4.6, -18], [4.6, -28], [-36, 24], [-36, 38], [-20, -33.5], [8, -33.5], [30, -33.5], [22, 39.6], [44, 38.4], [-20, 39.4]]) {
    streetLamp(kit, x, z, { height: 4.4, power: 9, reach: 12, color: "#ffe2b8", arm: x < 0 ? 0.5 : -0.5 });
    kit.pillar(0.08, 4, [x, 0, z]);
  }
  const main = [-60, -34.6, -10, 12, 36, 60].map((x) => powerPole(kit, x, 7.0, 9.6));
  kit.wires(main, 5);
  const side = [[-5.0, 12], [-5.0, 34], [-5.0, 56]].map(([x, z]) => powerPole(kit, x, z, 9.2));
  kit.wires(side, 4);
  kit.wires([main[2], side[0]], 3);
  const back = [-58, -34, -10, 14, 38].map((x) => powerPole(kit, x, -32.4, 9));
  kit.wires(back, 4);
  for (const x of [-60, -34.6, -10, 12, 36, 60]) kit.pillar(0.2, 6, [x, 0, 7.0]);
  for (const z of [12, 34, 56]) kit.pillar(0.2, 6, [-5, 0, z]);
  for (const x of [-58, -34, -10, 14, 38]) kit.pillar(0.2, 6, [x, 0, -32.4]);
}

function furniture(kit) {
  const random = seeded(4);
  kit.scatter("tree", [[-50, 6.2], [-29, 6.2], [-21.6, 6.2], [17.4, 6.2], [35.6, 6.2], [46, 6.2], [55, 6.2], [-53, -6.2], [40, -6.2], [46, -6.2], [28, -8.6], [17, -8.6], [44, -26], [60, -26], [52, -27]].map(([x, z]) => ({ position: [x, 0.1, z], yaw: random() * TAU, height: 4.2 + random() * 1.2 })), { color: "#8b957f" });
  for (const [x, z] of [[-7.2, -4.8], [7.2, 4.8], [-4.8, 7.2], [4.8, -7.2]]) {
    const yaw = Math.abs(x) > Math.abs(z) ? (x < 0 ? Math.PI / 2 : -Math.PI / 2) : z > 0 ? Math.PI : 0;
    kit.put("signal", [x, 0.12, z], { height: 3.5, yaw, glow: 0.6, threshold: 0.5 });
  }
  kit.put("mailbox", [5.0, 0.12, 8.6], { yaw: -0.4 });
  kit.put("phonebooth", [-31.8, 0.12, 5.0], { yaw: 0, glow: 0.3, threshold: 0.6 });
  kit.light("#e8f2ff", 1.6, [-31.8, 2.0, 4.4], 4, 1.6);
  kit.put("vending", [-17.6, 0.12, 6.8], { yaw: Math.PI, glow: 0.5, threshold: 0.85, scale: 0.95 });
  kit.put("vending", [30.8, 0.12, 6.8], { yaw: Math.PI, glow: 0.5, threshold: 0.85, scale: 0.95 });
  kit.put("vending", [6.4, 0.12, -30.6], { yaw: -Math.PI / 2, glow: 0.5, threshold: 0.85, scale: 0.95 });
  for (const [x, z] of [[-17.6, 5.6], [30.8, 5.6], [5.4, -30.6]]) kit.light("#f4f0e4", 1.4, [x, 1.4, z], 4.5, 1.7);
  for (const [x, z, yaw] of [[-24, 6.5, 2.9], [-27.4, 6.6, 3.3], [12.2, 6.6, 3.0], [42.6, 6.6, 3.2]]) kit.put("aboard", [x, 0.12, z - 0.4], { yaw });
  kit.scatter("bicycle", [[-21.8, 6.7, 0.1], [-20.4, 6.7, -0.08], [24, 6.7, 0.06], [25.6, 6.7, 0.02], [27.2, 6.7, -0.05], [41.2, -9.4, 1.5], [41.2, -10.3, 1.6], [41.2, -11.2, 1.5], [41.2, -12.1, 1.62], [41.2, -13, 1.55]].map(([x, z, yaw]) => ({ position: [x, 0.12, z], yaw, height: 1.04 })));
  kit.put("scooter", [9.4, 0.12, 6.6], { height: 1.1, yaw: 1.4 });
  kit.put("car", [-2.4, 0, 30], { yaw: 0, color: "#c8ccd4" });
  kit.put("car", [2.3, 0, -46], { yaw: Math.PI, color: "#8a3a34" });
  kit.put("truck", [-2.3, 0, -20], { yaw: 0.04, height: 1.75 });
  kit.put("car", [-50, 0, -34], { yaw: Math.PI / 2, color: "#5c6a7c" });
  kit.put("car", [32, 0, 38], { yaw: Math.PI / 2, color: "#d8c8a8" });
  for (const [x, z, yaw] of [[-8.2, 8.0, 0], [10, 6.9, 0], [-32.4, 36.4, 0.4], [34.6, 35, 0], [52.8, 6.9, 0]]) kit.put("bins", [x, 0.1, z - 0.6], { yaw, scale: 0.9 });
  kit.put("cat", [-12.4, 0, -30.4], { yaw: 2.2 });
  kit.put("cat", [-41.6, 0, 47.6], { yaw: 0.6, color: "#d8c0a0" });
  // 通りにいる人
  kit.put("npc_shopper", [24.8, 0.12, 5.3], { yaw: 2.4 });
  kit.put("npc_suit", [45.2, 0.12, -9.6], { yaw: 0.6 });
}

/* ---------------- 高架と電車 ---------------- */

function railway(kit) {
  const concrete = kit.material("concrete", { repeat: [30, 0.6], color: "#7f7d7c" });
  kit.box([170, 1.0, 5.2], [0, 6.4, -54], concrete).userData.pass = true;
  for (const z of [-56.5, -51.5]) kit.box([170, 0.9, 0.2], [0, 7.3, z], concrete).userData.pass = true;
  const pillars = [];
  for (let x = -71.5; x <= 78; x += 13) pillars.push({ geometry: new THREE.BoxGeometry(1.2, 6, 3.6), position: [x, 3, -54] });
  kit.merged(concrete, pillars);
  pillars.forEach(({ position }) => kit.block([1.2, 6, 3.6], position));
  const running = train(kit, kit.add(new THREE.Group(), [0, 6.8, -54]), 4);
  kit.onUpdate((delta, time) => {
    const t = (time + 8) % 34;
    running.position.x = -190 + t * 24;
    running.visible = t < 17;
  });
}

/* ---------------- 自宅 ---------------- */

function home(kit, api) {
  const wall = { glow: 0.9, gain: 1.15, threshold: 0.62, tile: [16, 15], seed: 12 };
  const B = (x0, x1, z0, z1, y, h) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h, y, flat: true });
  // 部屋のぶんをくり抜いて建てる
  facades(kit, "facade3", [B(8, 28, 43.5, 50.5, 0, 5.9), B(8, 15.4, 43.5, 50.5, 5.9, 3.4), B(20.6, 28, 43.5, 50.5, 5.9, 3.4), B(15.4, 20.6, 43.5, 45.9, 5.9, 3.4)], wall);
  const roof = kit.material("concrete", { repeat: [6, 2], color: "#7a766f" });
  kit.box([20.4, 0.3, 9.0], [18, 9.35, 47.6], roof).userData.pass = true;
  // 入口
  kit.box([2.4, 2.5, 0.2], [18, 1.25, 43.42], kit.solid("#3a4248", { metalness: 0.4, roughness: 0.5 }));
  kit.bulb([1.9, 2.0, 0.04], "#ffe2b0", 0.7, [18, 1.1, 43.31]);
  nameboard(kit, "コーポ風見", [18, 2.75, 43.3], Math.PI, { width: 2.6, height: 0.5, back: "#4a4a46", ink: "#f0e8d8", glow: 0.3 });
  kit.box([3.2, 0.14, 1.4], [18, 3.0, 42.9], roof).userData.pass = true;
  kit.light("#ffe0b0", 4, [18, 2.6, 42.4], 8, 1.5);
  kit.put("bicycle", [11, 0, 42.6], { height: 1.04, yaw: 0.1 });
  kit.put("bicycle", [12.4, 0, 42.7], { height: 1.04, yaw: -0.1, color: "#c0c8e0" });
  kit.put("potplant", [20, 0, 43.0], { height: 0.9 });
  kit.put("potplant", [16, 0, 43.0], { height: 0.8, yaw: 2 });
  api.portal({ id: "home-in", at: [18, 0, 42.6], label: "階段を上がって、自分の部屋へ", sound: "door", to: { at: [18, 6, 47.0], yaw: Math.PI } });
  api.portal({ id: "home-out", at: [18, 6, 46.4], label: "部屋を出る", sound: "door", to: { at: [18, 0, 41.8], yaw: 0 } });

  // 部屋
  const inside = kit.cluster(() => {
    const paint = kit.solid("#d8d0c2", { roughness: 0.95 });
    const floor = kit.material("wood_plank", { repeat: [3, 3], color: "#b08a62", roughness: 0.6 });
    kit.ground([5.2, 4.7], 6.0, floor, [18, 48.2]);
    kit.ground([5.2, 4.7], 8.7, paint, [18, 48.2]).rotation.x = Math.PI / 2;
    kit.box([0.1, 2.7, 4.7], [15.42, 7.35, 48.2], paint);
    kit.box([0.1, 2.7, 4.7], [20.58, 7.35, 48.2], paint);
    kit.box([5.2, 2.7, 0.1], [18, 7.35, 45.95], paint);
    // 玄関の扉
    kit.box([0.9, 2.0, 0.06], [18, 7.0, 46.02], kit.solid("#5a4a3c", { roughness: 0.5 }));
    kit.mesh(new THREE.SphereGeometry(0.04, 12, 8), kit.solid("#c8ccd0", { metalness: 0.8, roughness: 0.3 }), [18.34, 6.95, 46.08]);
    // 窓の枠（ベランダ側。左半分は開いている）
    const frame = kit.solid("#8d9296", { metalness: 0.5, roughness: 0.4 });
    for (const x of [15.5, 17.9, 20.5]) kit.box([0.06, 2.2, 0.06], [x, 7.1, 50.5], frame).userData.pass = true;
    kit.box([5.1, 0.5, 0.1], [18, 8.45, 50.5], paint).userData.pass = true;
    const pane = kit.mesh(new THREE.PlaneGeometry(2.4, 2.1), new THREE.MeshStandardMaterial({ color: "#bcd0e0", transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), [16.75, 7.1, 50.5]);
    pane.userData.pass = true;
    kit.block([2.4, 2.1, 0.1], [16.75, 7.1, 50.5]);
    for (const x of [15.7, 20.35]) kit.rbox([0.3, 2.1, 0.12], 0.05, [x, 7.1, 50.3], kit.solid("#6f7f8c", { roughness: 1 }));
    kit.put("bed", [16.4, 6, 48.4], { yaw: Math.PI / 2, height: 0.86 });
    kit.put("desk", [19.9, 6, 48.8], { yaw: -Math.PI / 2, height: 1.15 });
    kit.put("bookshelf", [19.8, 6, 46.5], { yaw: 0, height: 1.2 });
    kit.put("minifridge", [16.0, 6, 46.5], { yaw: 0, height: 1.5 });
    kit.put("potplant", [20.2, 6, 50.0], { height: 0.6 });
    kit.rbox([1.5, 0.02, 1.2], 0.01, [18.2, 6.015, 48.2], kit.solid("#4a5a6a", { roughness: 1 }));
    kit.bulb([0.5, 0.08, 0.5], "#fff0d8", 0.7, [17, 8.62, 47.4]);
    kit.light("#ffe0b4", 2.0, [17.4, 7.6, 47.6], 7, 1.4);
  });
  api.zone(inside, (body) => body.y > 4 && body.z > 40);
  api.area({ x: [15.5, 20.5], z: [46.0, 50.55], y: 6, surface: "wood", indoor: true });
  api.area({ x: [13.7, 22.3], z: [50.5, 52.1], y: 6, surface: "road" });
  addSpot(kit, api, { id: "home", name: "自宅のベランダ", ...HOME, eye: BALCONY.eye, table: BALCONY.spot, place: "balcony", build: () => balconySet(kit, { walk: true }) });
  kit.block([0.1, 2.6, 1.7], [13.6, 7.3, 51.3]);
  kit.block([0.1, 2.6, 1.7], [22.4, 7.3, 51.3]);
  kit.block([9, 1.3, 0.1], [18, 6.6, 52.16]);
  kit.box([20, 0.18, 1.8], [18, 5.9, 51.4], roof).userData.pass = true;
  for (const y of [0, 3]) {
    kit.box([20, 0.16, 1.7], [18, y + 2.9, 51.35], roof).userData.pass = true;
    kit.box([20, 1.0, 0.1], [18, y + 3.4, 52.15], kit.solid("#a8a49c", { roughness: 0.9 })).userData.pass = true;
  }
}

/* ---------------- オフィスビルと屋上 ---------------- */

function office(kit, api) {
  // 1 階の入口
  kit.bulb([7.4, 3.0, 0.06], "#f4f0e0", 0.55, [23, 1.62, -9.36]);
  kit.box([8, 0.3, 1.6], [23, 3.4, -8.7], kit.solid("#50565c", { metalness: 0.4, roughness: 0.5 })).userData.pass = true;
  for (const x of [-3.7, -1.85, 0, 1.85, 3.7]) kit.box([0.1, 3.0, 0.1], [23 + x, 1.62, -9.32], kit.solid("#3a4046", { metalness: 0.6, roughness: 0.4 })).userData.pass = true;
  nameboard(kit, "風見ビルディング", [23, 4.0, -9.3], 0, { width: 5.4, height: 0.7, back: "#2a3036" });
  kit.light("#fff2d8", 5, [23, 2.8, -8.0], 9, 1.5);
  kit.put("potplant", [18.6, 0.12, -8.8], { height: 1.2 });
  kit.put("potplant", [27.4, 0.12, -8.8], { height: 1.2, yaw: 1 });
  api.portal({ id: "roof-up", at: [23, 0, -8.6], label: "エレベーターで屋上へ", sound: "elevator", to: { at: [29.6, 30, -23.8], yaw: Math.PI / 2 } });
  api.portal({ id: "roof-down", at: [30.4, 30, -23.8], label: "エレベーターで 1 階へ", sound: "elevator", to: { at: [23, 0, -7.8], yaw: Math.PI } });
  const roof = kit.cluster(() => {
    addSpot(kit, api, { id: "roof", name: "ビルの屋上", ...ROOF, eye: ROOFTOP.eye, table: ROOFTOP.spot, place: "rooftop", seat: { model: "pipechair", at: [0, 0, 0.1], yaw: Math.PI, height: 0.8 }, build: () => rooftopSet(kit) });
    const edge = kit.material("brickwall", { repeat: [9, 0.5], color: "#83888f" });
    kit.box([26.4, 0.8, 0.3], [23, 30.4, -9.5], edge);
    kit.frame([23, 30.8, -9.5], 0, () => kit.fence(26, 1.5, [0, 0, 0], 0));
    for (const [x0, x1, z] of [[10, 36, -30.4]]) kit.block([x1 - x0, 3, 0.3], [(x0 + x1) / 2, 31.5, z]);
    kit.block([0.3, 3, 21], [10.1, 31.5, -20]);
    kit.block([0.3, 3, 21], [35.9, 31.5, -20]);
    kit.block([26, 3, 0.3], [23, 31.5, -9.5]);
  });
  api.zone(roof, (body) => body.y > 15);
  api.area({ x: [10, 36], z: [-30.4, -9.6], y: 30, surface: "road" });
}

/* ---------------- 純喫茶 ---------------- */

function coffee(kit, api) {
  const shell = kit.material("brickwall", { repeat: [3, 0.8], color: "#8a6a50" });
  const trim = kit.solid("#3a2213", { roughness: 0.5 });
  // 外側の壁（扉と窓を残す）
  kit.box([0.2, 3, 11.4], [-15.5, 1.5, 13.1], shell);
  kit.box([0.2, 3, 11.4], [-8.7, 1.5, 13.1], shell);
  kit.box([7, 3, 0.2], [-12.1, 1.5, 18.8], shell);
  kit.box([0.9, 3, 0.16], [-15.0, 1.5, 7.5], shell);
  kit.box([4.5, 1.0, 0.16], [-11.15, 0.5, 7.5], shell);
  kit.box([4.5, 0.6, 0.16], [-11.15, 2.7, 7.5], shell);
  kit.box([1.3, 0.6, 0.16], [-13.95, 2.7, 7.5], shell).userData.pass = true;
  for (const x of [-13.35, -11.9, -10.4, -8.95]) kit.box([0.08, 1.5, 0.1], [x, 1.7, 7.48], trim).userData.pass = true;
  kit.block([4.6, 3, 0.16], [-11.1, 1.5, 7.5]);
  for (const x of [-14.6, -13.3]) kit.box([0.1, 2.4, 0.2], [x, 1.2, 7.5], trim).userData.pass = true;
  // 開けはなした扉
  const door = kit.box([0.06, 2.3, 1.1], [-14.56, 1.16, 7.0], kit.solid("#5a3420", { roughness: 0.45 }));
  door.userData.pass = true;
  nameboard(kit, "純喫茶　ゆらぎ", [-12.1, 3.2, 7.3], Math.PI, { width: 4.6, height: 0.6, back: "#3a2013", ink: "#ffd9a0" });
  kit.light("#ffcf90", 2.6, [-13.6, 2.4, 6.4], 6, 1.5);
  kit.put("potplant", [-9.2, 0.12, 6.9], { height: 0.9 });
  kit.put("aboard", [-12.6, 0.12, 6.5], { yaw: 3.3 });
  const room = kit.cluster(() => {
    addSpot(kit, api, { id: "kissaten", name: "純喫茶 ゆらぎ", ...KISSATEN_AT, eye: KISSATEN.eye, table: KISSATEN.spot, place: "kissaten", seat: { model: "chair", at: [0, 0, 0.1], yaw: Math.PI, height: 0.85 }, build: () => kissatenSet(kit, { compact: true }) });
  });
  api.zone(room, (body) => body.y < 5 && Math.hypot(body.x + 12, body.z - 11) < 19);
  api.area({ x: [-15.4, -8.8], z: [7.6, 18.6], y: 0.02, surface: "wood", indoor: true });
}

/* ---------------- 駅前 ---------------- */

function station(kit, api) {
  const body = kit.solid("#b9b2a6", { roughness: 0.9 });
  kit.box([22, 7.5, 10], [51, 3.75, -36], body);
  kit.box([23, 0.5, 11.4], [51, 7.7, -35.6], kit.solid("#4a5058", { roughness: 0.7 })).userData.pass = true;
  kit.bulb([13, 3.0, 0.06], "#fff0d0", 0.7, [51, 1.75, -30.96]);
  for (let i = 0; i < 8; i += 1) kit.box([0.16, 3.2, 0.2], [44.4 + i * 1.9, 1.7, -30.9], kit.solid("#3a4046", { metalness: 0.5, roughness: 0.4 })).userData.pass = true;
  kit.box([16, 0.24, 2.6], [51, 3.7, -29.8], kit.solid("#50565c", { roughness: 0.6 })).userData.pass = true;
  nameboard(kit, "風見駅", [51, 5.4, -30.9], 0, { width: 6, height: 1.2, back: "#1f5a44" });
  kit.light("#fff2d8", 8, [51, 3.2, -28.4], 13, 1.4);
  kit.light("#ffe8c8", 5, [44, 3.2, -28.4], 9, 1.5);
  kit.put("clockpole", [47, 0.12, -17], { height: 3.6, glow: 0.4, threshold: 0.8 });
  kit.put("bench", [44, 0.12, -21], { yaw: 0.2 });
  kit.put("bench", [56, 0.12, -22], { yaw: -0.2 });
  kit.put("taxi", [58.6, 0, -2.6], { yaw: Math.PI / 2 });
  kit.put("taxi", [52.6, 0, -2.5], { yaw: Math.PI / 2 });
  kit.put("busstop", [46.4, 0.12, -5.2], { height: 2.5 });
  kit.put("bus", [42.6, 0, -2.7], { yaw: Math.PI / 2, height: 2.9 });
  kit.put("npc_shopper", [47.8, 0.12, -6.0], { yaw: 2.9, color: "#e0d0d8" });
  kit.scatter("bush", [[40.6, -18], [40.6, -19.2], [40.6, -20.4], [61.4, -10], [61.4, -11.2], [61.4, -12.4], [61.4, -13.6], [61.4, -14.8]].map(([x, z], i) => ({ position: [x, 0.1, z], yaw: i, height: 0.9 })), { color: "#9aa890" });
  api.stop({ kind: "bus", at: [46.4, 0.12, -6.4] });
  api.stop({ kind: "train", at: [51, 0.12, -30.0] });
  // 喫煙所：ガラスの仕切りとスタンド灰皿
  addSpot(kit, api, {
    id: "station",
    name: "駅前の喫煙所",
    at: [56.5, 0.12, -13.4],
    yaw: 0,
    eye: 1.55,
    table: STAND,
    lamp: ["#fff0dc", 5.5, [-1.4, 2.5, 7.7]],
    fill: ["#c6b8d4", 0.4],
    surface: { image: "steel", color: "#9aa0a6", roughness: 0.42, metalness: 0.6 },
    build: () => {
      standAshtray(kit, [0, -1.3], 1.13, { radius: 0.2 });
      standAshtray(kit, [1.7, -1.0], 0.9);
      const glass = new THREE.MeshStandardMaterial({ color: "#b8d0d8", transparent: true, opacity: 0.28, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
      const frame = kit.solid("#5a6066", { metalness: 0.5, roughness: 0.4 });
      const panelAt = (x, z, yaw, w) => {
        kit.mesh(new THREE.PlaneGeometry(w, 1.5), glass, [x, 1.05, z], [0, yaw, 0]);
        for (const y of [0.3, 1.8]) kit.mesh(new THREE.BoxGeometry(w, 0.05, 0.05), frame, [x, y, z], [0, yaw, 0]);
        for (const k of [-0.5, 0.5]) kit.cylinder(0.03, 0.03, 1.8, [x + Math.cos(yaw) * w * k, 0.9, z - Math.sin(yaw) * w * k], frame, undefined, undefined, 10);
        kit.block([w, 1.8, 0.08], [x, 0.9, z], yaw);
      };
      panelAt(-2.4, -1.0, Math.PI / 2, 3);
      panelAt(-0.6, -2.9, 0, 2.6);
      panelAt(2.9, -2.9, 0, 1.6);
      panelAt(3.6, -1.2, Math.PI / 2, 3.2);
      kit.put("npc_smoker", [2.4, 0, -1.6], { yaw: -0.9 });
      nameboard(kit, "喫煙所", [-0.6, 2.0, -2.88], 0, { width: 0.8, height: 0.26, back: "#1d6b5c", glow: 0.25 });
      kit.light("#fff0d8", 2.6, [0.4, 2.4, -1.4], 6, 1.5);
      kit.bulb([0.5, 0.06, 0.16], "#fff2dc", 1.8, [0.4, 2.5, -1.4]);
      can(kit, [1.8, 0.9, -1.0], { color: "#23384a", band: "#e0a64a" });
    },
  });
}

/* ---------------- 公園 ---------------- */

function park(kit, api) {
  const random = seeded(6);
  const lawn = kit.material("grassland", { repeat: [5, 7], color: "#7f8f78", roughness: 1, bump: 1 });
  kit.ground([20, 27], 0.03, lawn, [-50, 22.5]);
  const path = kit.material("paving", { repeat: [1, 7], color: "#a8a49c" });
  kit.ground([2.4, 27], 0.045, path, [-50, 22.5]);
  kit.ground([20, 2.4], 0.045, path, [-50, 20]);
  const hedge = [];
  for (let i = 0; i < 19; i += 1) if (Math.abs(i - 9.5) > 1.4) hedge.push([-59.6 + i * 1.05, 9.2]);
  for (let i = 0; i < 25; i += 1) hedge.push([-60.2, 9.6 + i * 1.08], ...(Math.abs(i - 10) > 1.4 ? [[-39.8, 9.6 + i * 1.08]] : []));
  for (let i = 0; i < 19; i += 1) hedge.push([-59.6 + i * 1.05, 36.6]);
  kit.scatter("bush", hedge.map(([x, z]) => ({ position: [x, 0, z], yaw: random() * TAU, height: 0.85 + random() * 0.15 })), { color: "#8f9d84" });
  kit.scatter("tree", [[-57, 13], [-43.4, 12.6], [-57.4, 30], [-43, 33], [-56, 34], [-46, 28], [-58, 24], [-42.4, 24.6]].map(([x, z]) => ({ position: [x, 0, z], yaw: random() * TAU, height: 5 + random() * 1.8 })), { color: "#8f9a86" });
  kit.put("swing", [-55, 0, 16], { yaw: 0.4 });
  kit.put("slide", [-45, 0, 16], { yaw: -0.6 });
  kit.put("clockpole", [-47.6, 0, 22.4], { height: 3.2, glow: 0.4, threshold: 0.8 });
  kit.put("bench", [-45, 0, 23.6], { yaw: -Math.PI / 2 });
  kit.rbox([3.4, 0.3, 3.4], 0.06, [-55.4, 0.14, 31], kit.solid("#8a8478"));
  kit.ground([3.0, 3.0], 0.3, kit.solid("#c8b48c", { roughness: 1 }), [-55.4, 31]);
  streetLamp(kit, -51.8, 27.4, { height: 3.4, power: 6, reach: 10, color: "#ffe6c0", arm: 0.4 });
  streetLamp(kit, -48.4, 13.4, { height: 3.4, power: 5, reach: 9, color: "#ffe6c0", arm: -0.4 });
  kit.grass({ count: 900, x: [-60, -40], z: [9.4, 36.4], y: 0.03, height: [0.06, 0.18], color: ["#4a5a34", "#7a8a52"], seed: 11, avoid: (x, z) => Math.abs(x + 50) < 1.4 || Math.abs(z - 20) < 1.4 });
  kit.put("cat", [-46.6, 0, 25.6], { yaw: -1.2, color: "#b8b0a8" });
  addSpot(kit, api, {
    id: "park",
    name: "公園のベンチ",
    at: [-52.6, 0.03, 24.6],
    yaw: -Math.PI / 4 + 0.2,
    eye: 1.14,
    table: SEAT_STAND,
    lamp: ["#ffe2b8", 4.2, [1.4, 2.6, 7.4]],
    fill: ["#8c80b0", 0.45],
    surface: { image: "wood_plank", color: "#8a7a66", roughness: 0.85 },
    seat: { model: "bench", at: [0, 0, 0.16], yaw: 0, height: 0.85 },
    build: () => {
      standAshtray(kit, [0, -1.28], 0.72, { color: "#a83a2c" });
      can(kit, [0.5, 0.0, -1.4], { color: "#1f2a22", band: "#c9a24a" });
    },
  });
}

/* ---------------- 路地裏の屋台 ---------------- */

function alley(kit, api) {
  const warm = "#ffb060";
  kit.put("yatai", [-39, 0, 52.6], { yaw: 0.2, height: 2.6, glow: 0.25, threshold: 0.7 });
  kit.light(warm, 4.4, [-38.8, 2.0, 51.2], 7, 1.5);
  kit.steam({ at: [-39, 1.4, 52.2], spread: [0.8, 0.4], count: 10, size: 0.3, grow: 0.9, rise: 1.8, opacity: 0.09, speed: 0.2 });
  stringLights(kit, [-44.6, 3.2, 43], [-33.8, 3.2, 47], { sag: 0.4, count: 10 });
  stringLights(kit, [-44.6, 3.2, 50], [-33.8, 3.2, 45], { sag: 0.4, count: 10 });
  for (const [x, y, z] of [[-34.3, 2.4, 45], [-34.3, 2.4, 48.6], [-34.3, 2.4, 52], [-34.3, 2.4, 55.6], [-38.0, 2.5, 51.2], [-40.2, 2.5, 51.6], [-35.6, 3.0, 8.0], [-36.6, 3.0, 8.0]]) {
    kit.put("chochin", [x, y - 0.35, z], { height: 0.6, glow: 0.8, threshold: 0.3, tint: "#ff8a5a" });
  }
  kit.light("#ff7a4a", 2.4, [-35.2, 2.2, 47], 6, 1.6);
  kit.light("#ff7a4a", 2.4, [-35.2, 2.2, 54], 6, 1.6);
  kit.light("#ff7a4a", 1.8, [-36, 2.4, 8.4], 5, 1.6);
  kit.put("crates", [-42.8, 0, 54.6], { height: 0.62, yaw: 0.3 });
  kit.put("crates", [-43.6, 0, 53.4], { height: 0.62, yaw: 1.3, color: "#ff9a80" });
  kit.put("crates", [-34.8, 0, 50.2], { height: 0.62, yaw: 0.1, color: "#9ab8e8" });
  kit.put("bins", [-44.2, 0, 45], { yaw: 1.6, scale: 0.9 });
  kit.put("aboard", [-37.2, 0, 43.4], { yaw: 0.4 });
  signboard(kit, "屋台", [-36.6, 1.9, 51.6], 0.2, { width: 0.4, height: 0.9, glow: 0.4 });
  addSpot(kit, api, {
    id: "alley",
    name: "路地裏の屋台",
    at: [-41.6, 0, 48.2],
    yaw: Math.PI + 0.75,
    eye: 1.14,
    table: { y: 0.74, item: [-0.2, -1.2], phone: [0.2, -1.3], chillTray: [-0.04, -1.24] },
    lamp: ["#ff9a5a", 5, [-1.2, 2.2, 6.6]],
    fill: ["#a05a5a", 0.4],
    surface: { image: "wood_plank", color: "#b98f64", roughness: 0.7 },
    seat: { model: "stool", at: [0, 0, 0.05], height: 0.46 },
    build: () => {
      kit.put("crates", [0, 0, -1.3], { height: 0.7, yaw: 0.06 });
      kit.rbox([0.95, 0.035, 0.72], 0.01, [0, 0.722, -1.3], kit.material("wood_plank", { repeat: [0.8, 0.5], color: "#c59a6c", roughness: 0.6 }));
      can(kit, [0.32, 0.74, -1.5], { color: "#c8a23a", band: "#f2ead0", height: 0.12, radius: 0.033 });
      can(kit, [-0.34, 0.74, -1.52], { color: "#2a2d33", band: "#b9bec4" });
    },
  });
}

/* ---------------- 走る車 ---------------- */

function traffic(kit) {
  const cars = [];
  for (const [lane, dir, start, speed, color] of [[-2.0, -1, 30, 7, "#e8e8ec"], [-2.0, -1, -40, 7, "#4a5a7c"], [2.0, 1, 10, 6.4, "#9c3a34"], [2.0, 1, -60, 6.4, "#d8d0c0"]]) {
    const holder = kit.add(new THREE.Group(), [start, 0, lane]);
    const car = kit.put("car", [0, 0, 0], { yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, color, parent: holder });
    car.userData.pass = true;
    for (const side of [-0.55, 0.55]) {
      kit.bulb([0.1], "#fff0cc", 2.4, [dir * 1.95, 0.62, side], undefined, holder);
      kit.bulb([0.08], "#ff3a2c", 1.6, [-dir * 1.95, 0.72, side], undefined, holder);
    }
    cars.push({ holder, dir, speed, velocity: speed });
  }
  kit.onUpdate((delta) => {
    cars.forEach((car) => {
      car.holder.position.x += car.velocity * car.dir * delta;
      if (Math.abs(car.holder.position.x) > 100) car.holder.position.x = -100 * car.dir;
    });
  });
  kit.cars = cars;
}

/* ---------------- 街の外 ---------------- */

function outskirts(kit) {
  const random = seeded(8);
  // 南の端：ガードレールと植え込み、その先の家並みと高層ビル
  guardrail(kit, [-64, 58.6], [64, 58.6]);
  kit.scatter("bush", Array.from({ length: some(60) }, (_, i) => ({ position: [-63 + i * 2.1, 0, 60 + random()], yaw: random() * TAU, height: 1 + random() * 0.4 })), { color: "#8f9d84" });
  // 南は一段低い町：擁壁と、屋根の並び
  kit.box([200, 9, 0.6], [0, -4.56, 61.2], kit.material("brickwall", { repeat: [24, 1], color: "#7f7c78" })).userData.pass = true;
  kit.ground([420, 340], -9, kit.material("asphalt", { repeat: [50, 40], color: "#34343f" }), [0, 228]);
  const rows = [];
  for (let i = 0; i < 84; i += 1) rows.push({ position: [-110 + (i % 21) * 11 + random() * 2, -9, 76 + Math.floor(i / 21) * 13 + random() * 3], yaw: Math.floor(random() * 4) * (Math.PI / 2), scale: 0.95 + random() * 0.25 });
  cottages(kit, rows, { walls: ["#7d7684", "#675f70", "#8a7f86"], lit: 0.55, seed: 3 });
  const ring = (x, z) => Math.abs(z) < 26 || (Math.abs(x) < 24 && z < 0);
  kit.towers({ count: 60, area: { x: [-150, 150], z: [124, 190] }, base: -9, height: [8, 24], width: [10, 16], image: "facade", seed: 7, glow: 0.95, gain: 1.8, kinds: 4 });
  kit.towers({ count: 60, area: { x: [-260, 260], z: [210, 360] }, base: -9, height: [14, 58], width: [14, 26], image: "facade2", seed: 23, glow: 1.0, gain: 1.4, kinds: 4 });
  kit.towers({ count: 40, area: { x: [-190, 190], z: [-200, -70] }, base: 0, height: [8, 26], width: [10, 18], image: "facade", seed: 17, glow: 1.0, gain: 1.7, avoid: ring, kinds: 4 });
  kit.towers({ count: 24, area: { x: [-150, -84], z: [30, 58] }, base: 0, height: [8, 24], width: [10, 16], image: "facade", seed: 19, glow: 1.0, gain: 1.7, kinds: 3 });
  kit.towers({ count: 24, area: { x: [84, 150], z: [34, 58] }, base: 0, height: [8, 24], width: [10, 16], image: "facade", seed: 29, glow: 1.0, gain: 1.7, kinds: 3 });
  kit.towers({ count: 20, area: { x: [80, 150], z: [-120, -34] }, base: 0, height: [8, 30], width: [10, 16], image: "facade", seed: 31, glow: 1.0, gain: 1.7, kinds: 3 });
  kit.towers({ count: 20, area: { x: [-150, -80], z: [-120, -34] }, base: 0, height: [8, 24], width: [10, 16], image: "facade", seed: 37, glow: 1.0, gain: 1.7, kinds: 3 });
  // 通りの端：この先は電車かバスで
  for (const side of [-1, 1]) {
    guardrail(kit, [side * 62.4, -7.4], [side * 62.4, 7.4]);
    nameboard(kit, "この先、電車・バスをご利用ください", [side * 62.2, 1.5, 0], side > 0 ? -Math.PI / 2 : Math.PI / 2, { width: 4.4, height: 0.5, back: "#f0c23a", ink: "#20242a", glow: 0.25 });
  }
  guardrail(kit, [-6.2, -59.6], [6.2, -59.6]);
  nameboard(kit, "この先、電車・バスをご利用ください", [0, 1.5, -59.4], 0, { width: 4.4, height: 0.5, back: "#f0c23a", ink: "#20242a", glow: 0.25 });
  // 街の端を、家と塀でふさぐ
  const wall = kit.material("concrete", { repeat: [20, 0.5], color: "#86827c" });
  for (const x of [-63.4, 63.4]) {
    kit.box([0.2, 1.6, 50], [x, 0.8, 33], wall);
    kit.box([0.2, 1.6, 54], [x, 0.8, -35], wall);
  }
  for (const z of [-60.6]) {
    kit.box([58, 1.6, 0.2], [-34.6, 0.8, z], wall);
    kit.box([58, 1.6, 0.2], [34.6, 0.8, z], wall);
  }
  kit.scatter("tree", [[-58, -46], [-40, -58], [-22, -58], [20, -58], [42, -57], [58, -46], [-60, 39], [60, 39], [28, 57], [-4.8, 57.4]].map(([x, z]) => ({ position: [x, 0, z], yaw: random() * TAU, height: 5 + random() * 2 })), { color: "#8f9a86" });
  kit.dots(Array.from({ length: 120 }, () => [-170 + random() * 340, -5 + random() * 4, 72 + random() * 200]), "#ffc078", 1.1);
  antenna(kit, [-28, 9, 28], { height: 2.4 });
  antenna(kit, [14, 9, 27], { height: 2.4, yaw: 1 });
}

/* ---------------- 部品（着いた所のまわりから順に組み立てる） ---------------- */

const unique = (...lists) => [...new Set(lists.flat())];

export const TOWN = {
  id: "town",
  name: "都会",
  start: { at: [18.6, 6, 47.6], yaw: Math.PI }, // 旅の始まりは自分の部屋
  train: { name: "風見駅", at: [51, 0.12, -28.6], yaw: Math.PI },
  bus: { name: "風見駅前", at: [47.4, 0.12, -8.4], yaw: 0 },
  parts: [
    {
      core: true,
      models: ["house", "bush", "tree"],
      images: ["asphalt", "paving", "concrete", "brickwall", "facade", "facade2", "facade3", "facade4", "shopa", "shopb", "shopc", "shopd", "shutter"],
      build(kit, api) {
        api.area({ x: [-62, 62], z: [-59.4, 58], y: 0, surface: "road" });
        streets(kit);
        blocks(kit);
        lamps(kit);
        outskirts(kit);
      },
    },
    {
      core: true,
      models: unique(BALCONY.models, ["bed", "desk", "bookshelf", "minifridge", "bicycle"]),
      images: unique(BALCONY.images, ["facade3"]),
      build: home,
    },
    {
      models: ["tree", "signal", "mailbox", "phonebooth", "vending", "aboard", "bicycle", "scooter", "car", "truck", "bins", "cat", "npc_shopper", "npc_suit"],
      images: ["concrete"],
      build(kit) {
        furniture(kit);
        railway(kit);
        traffic(kit);
      },
    },
    {
      near: { x: 0, z: 14, r: 90 },
      models: KISSATEN.models.concat("potplant", "aboard"),
      images: unique(KISSATEN.images, ["brickwall"]),
      build: coffee,
    },
    {
      near: { x: -27, z: -14, r: 78 },
      models: KONBINI.models,
      images: KONBINI.images,
      build(kit, api) {
        addSpot(kit, api, { id: "konbini", name: "コンビニ前", ...KONBINI_AT, eye: KONBINI.eye, table: KONBINI.spot, place: "konbini", lamp: ["#fff0dc", 3.6, [-1.0, 2.5, 7.9]], build: () => konbiniSet(kit) });
      },
    },
    {
      near: { x: 51, z: -20, r: 84 },
      models: ["clockpole", "bench", "taxi", "busstop", "bus", "npc_shopper", "npc_smoker", "bush"],
      images: [],
      build: station,
    },
    {
      near: { x: -38, z: 50, r: 70 },
      models: ["yatai", "chochin", "crates", "bins", "aboard", "stool"],
      images: ["wood_plank"],
      build: alley,
    },
    {
      near: { x: -50, z: 22, r: 66 },
      models: ["bush", "tree", "swing", "slide", "clockpole", "bench", "cat"],
      images: ["grassland", "paving"],
      build: park,
    },
    { models: unique(ROOFTOP.models, ["potplant"]), images: ROOFTOP.images, build: office },
  ],
};
