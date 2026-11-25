import * as THREE from "three";
import { PLACES } from "../../places.js";
import { createAshtray } from "../props.js";
import { SCALE, glowing, seeded } from "../world/kit.js";

/*
 * 街歩きの土地づくりで、よく使う部品。
 */

const TRAY_SCALE = 1.15 / SCALE;

/*
 * 喫煙所。灰皿が目印になる。
 *   at / yaw  座る（立つ）所の足元と向き。yaw = 0 で北（-Z）を向く
 *   eye       目の高さ、table = 灰皿を置く所（座る所から見た座標）
 *   seat      座る物 { model, at, yaw, height }（煙草を吸っている間は隠す）
 *   place     光や机の質感を借りる、いつもの場所の名前
 */
export function addSpot(kit, api, { seat = null, place = null, build = null, smoke = true, ...spot }) {
  let tray = null;
  let seatMesh = null;
  let origin = null;
  let yaw = 0;
  kit.frame(spot.at, spot.yaw, (holder) => {
    origin = localPoint(kit, api, [0, 0, 0]);
    yaw = localYaw(kit, api);
    build?.();
    const [x, z] = spot.table.chillTray;
    tray = createAshtray();
    tray.scale.setScalar(TRAY_SCALE);
    tray.position.set(x, spot.table.y, z);
    holder.add(tray);
    if (smoke) kit.steam({ at: [x, spot.table.y + 0.05, z], spread: [0.03, 0.03], count: 4, size: 0.03, grow: 0.12, rise: 0.5, opacity: 0.16, speed: 0.2, color: "#d4d8de" });
    if (seat) seatMesh = kit.put(seat.model, seat.at, { yaw: seat.yaw ?? 0, height: seat.height ?? null });
  });
  const look = place ? PLACES[place] : null;
  api.spot({ lamp: look?.light.lamp, fill: look?.light.fill, surface: look?.surface, ...Object.fromEntries(Object.entries(spot).filter(([, value]) => value !== undefined)), at: origin, yaw, tray, seat: seatMesh });
}

// いま組み立てている所から、地図の座標へ
function toMap(kit, api) {
  kit.here.updateWorldMatrix(true, false);
  return api.root.matrixWorld.clone().invert().multiply(kit.here.matrixWorld);
}
export function localPoint(kit, api, position) {
  return new THREE.Vector3(...position).applyMatrix4(toMap(kit, api)).toArray();
}
export function localYaw(kit, api) {
  const m = toMap(kit, api).elements;
  return Math.atan2(-m[2], m[0]);
}
// 歩ける所を、いま組み立てている所の座標で決める（向きは 90 度きざみ）
export function localArea(kit, api, { x, z, y, only, ...rest }) {
  const matrix = toMap(kit, api);
  const inverse = matrix.clone().invert();
  const a = new THREE.Vector3(x[0], 0, z[0]).applyMatrix4(matrix);
  const b = new THREE.Vector3(x[1], 0, z[1]).applyMatrix4(matrix);
  const base = matrix.elements[13];
  const point = new THREE.Vector3();
  const local = (wx, wz) => point.set(wx, 0, wz).applyMatrix4(inverse);
  api.area({
    x: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
    z: [Math.min(a.z, b.z), Math.max(a.z, b.z)],
    y: typeof y === "function" ? (wx, wz) => y(local(wx, wz).x, point.z) + base : y + base,
    only: only ? (wx, wz) => only(local(wx, wz).x, point.z) : undefined,
    ...rest,
  });
}

// 掛け軸
export function framedScroll(kit, position, yaw) {
  kit.panel(0.5, 1.5, position, [0, yaw, 0], (ctx, w, h) => {
    ctx.fillStyle = "#6a5a3c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#efe6d0";
    ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.74);
    ctx.strokeStyle = "#2a2824";
    ctx.lineWidth = w * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.66);
    ctx.quadraticCurveTo(w * 0.42, h * 0.3, w * 0.56, h * 0.52);
    ctx.quadraticCurveTo(w * 0.7, h * 0.4, w * 0.82, h * 0.64);
    ctx.stroke();
    ctx.fillStyle = "#a83a2c";
    ctx.fillRect(w * 0.7, h * 0.76, w * 0.08, w * 0.08);
  }, { pixels: 256, side: THREE.DoubleSide });
}

// 立って吸うスタンド灰皿の、机の位置
export const STAND = { y: 1.13, item: [-0.2, -1.2], phone: [0.2, -1.3], chillTray: [-0.02, -1.28] };
// 座って吸う所の横に置いた、低めのスタンド灰皿
export const SEAT_STAND = { y: 0.72, item: [-0.2, -1.2], phone: [0.2, -1.3], chillTray: [-0.02, -1.26] };

// スタンド灰皿（円筒と受け皿）
export function standAshtray(kit, [x, z], height, { color = "#b9bec4", radius = 0.17 } = {}) {
  const steel = kit.solid(color, { metalness: 0.7, roughness: 0.35 });
  kit.cylinder(radius, radius, height - 0.06, [x, (height - 0.06) / 2, z], steel);
  kit.cylinder(radius + 0.04, radius + 0.02, 0.05, [x, height - 0.025, z], steel);
  kit.cylinder(radius + 0.05, radius + 0.07, 0.05, [x, 0.025, z], kit.solid("#26292d", { metalness: 0.5, roughness: 0.5 }));
  kit.pillar(radius + 0.06, height, [x, 0, z]);
}

// 窓の写真を貼った建物をまとめて建てる。list = [{ x, z, w, d, h, y }]
export function facades(kit, image, list, { tile = [16, 15], glow = 1, gain = 1.4, threshold = 0.4, seed = 1, solid = true } = {}) {
  const random = seeded(seed);
  const mat = glowing(kit.material(image, { color: new THREE.Color("#e4e6ec").multiplyScalar(gain), roughness: 0.85 }), glow / gain, threshold * Math.min(1.6, gain));
  const parts = list.map(({ x, z, w, d, h, y = 0 }) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;
    const normal = geometry.attributes.normal;
    const shift = [Math.floor(random() * 6) / 6, Math.floor(random() * 5) / 5];
    for (let i = 0; i < uv.count; i += 1) {
      if (Math.abs(normal.getY(i)) > 0.5) {
        uv.setXY(i, 0.01, 0.01);
        continue;
      }
      const span = Math.abs(normal.getX(i)) > 0.5 ? d : w;
      uv.setXY(i, shift[0] + (uv.getX(i) * span) / tile[0], shift[1] + (uv.getY(i) * h) / tile[1]);
    }
    if (solid) kit.block([w, h, d], [x, y + h / 2, z]);
    return { geometry, position: [x, y + h / 2, z] };
  });
  const roofs = list.flatMap(({ x, z, w, d, h, y = 0, flat = false }) => {
    if (flat) return [];
    const rail = (sx, sz, px, pz) => ({ geometry: new THREE.BoxGeometry(sx, 0.7, sz), position: [x + px, y + h + 0.35, z + pz] });
    const shed = { geometry: new THREE.BoxGeometry(w * 0.28, 2.3, d * 0.3), position: [x + (random() - 0.5) * w * 0.4, y + h + 1.15, z + (random() - 0.5) * d * 0.3] };
    return [rail(w, 0.2, 0, d / 2 - 0.1), rail(w, 0.2, 0, -d / 2 + 0.1), rail(0.2, d, w / 2 - 0.1, 0), rail(0.2, d, -w / 2 + 0.1, 0), shed];
  });
  kit.merged(mat, parts);
  if (roofs.length) kit.merged(kit.solid("#5a5560", { roughness: 0.95 }), roofs);
}

// 店先の写真を、建物の 1 階に貼る。list = [{ x, z, w, facing }]（facing = 向き。0 = 南、π = 北、π/2 = 東）
export function shopfronts(kit, image, list, { height = 3.5, glow = 0.75 } = {}) {
  const map = kit.material(image).map;
  const mat = new THREE.MeshStandardMaterial({ map, emissive: "#ffffff", emissiveMap: map, emissiveIntensity: glow, roughness: 0.7 });
  kit.merged(
    mat,
    list.map(({ x, z, w, facing = 0, y = 0 }) => {
      const geometry = new THREE.PlaneGeometry(w, height);
      const uv = geometry.attributes.uv;
      const times = Math.max(1, Math.round(w / 6));
      for (let i = 0; i < uv.count; i += 1) uv.setX(i, uv.getX(i) * times);
      return { geometry, position: [x, y + height / 2, z], rotation: [0, facing, 0] };
    }),
  );
  list.forEach(({ x, z, facing = 0 }) => kit.light("#ffd29a", 1.5, [x + Math.sin(facing) * 1.2, 2.1, z + Math.cos(facing) * 1.2], 6, 1.5));
}

// 縦の看板（ひとことだけ）
export function signboard(kit, text, [x, y, z], yaw, { width = 0.7, height = 2.4, back = "#b83a2c", ink = "#fff6e4", glow = 0.8, both = true } = {}) {
  const draw = (ctx, w, h) => {
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.lineWidth = w * 0.05;
    ctx.strokeRect(w * 0.06, w * 0.06, w * 0.88, h - w * 0.12);
    ctx.fillStyle = ink;
    const size = Math.min(w * 0.68, (h * 0.86) / text.length);
    ctx.font = `bold ${Math.round(size)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    [...text].forEach((letter, i) => ctx.fillText(letter, w / 2, h / 2 + (i - (text.length - 1) / 2) * size * 1.06));
  };
  kit.frame([x, y, z], yaw, () => {
    const board = kit.box([width + 0.06, height + 0.06, 0.1], [0, 0, 0], kit.solid("#1d2024"));
    board.userData.pass = true;
    kit.panel(width, height, [0, 0, 0.052], undefined, draw, { glow });
    if (both) kit.panel(width, height, [0, 0, -0.052], [0, Math.PI, 0], draw, { glow });
  });
}

// 横書きの看板
export function nameboard(kit, text, [x, y, z], yaw, { width = 3, height = 0.6, back = "#20303a", ink = "#f6efe0", glow = 0.7 } = {}) {
  kit.panel(width, height, [x, y, z], [0, yaw, 0], (ctx, w, h) => {
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.round(Math.min(h * 0.62, (w * 0.9) / text.length))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2);
  }, { glow, pixels: 512 });
}

// 電車（両数ぶんつなぐ）
export function train(kit, holder, cars, { color = "#c9cdd0", stripe = "#3a8a5c" } = {}) {
  const body = kit.solid(color, { metalness: 0.5, roughness: 0.4 });
  const band = kit.solid(stripe);
  const dark = kit.solid("#2a2d31", { roughness: 0.7 });
  for (let i = 0; i < cars; i += 1) {
    const x = i * 18;
    kit.rbox([17.4, 2.7, 2.7], 0.16, [x, 1.75, 0], body, undefined, holder);
    kit.box([17.2, 0.24, 2.74], [x, 1.0, 0], band, undefined, holder);
    kit.box([16.6, 0.4, 2.2], [x, 0.24, 0], dark, undefined, holder);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k += 1) kit.bulb([1.7, 0.8, 0.04], "#fff2d0", 1.0, [x - 6.6 + k * 2.6, 2.1, side * 1.36], undefined, holder);
      for (const k of [-4.6, 0, 4.6]) kit.box([1.0, 2.0, 0.03], [x + k, 1.5, side * 1.365], kit.solid("#aeb4b8", { metalness: 0.5, roughness: 0.4 }), undefined, holder);
    }
  }
  holder.traverse((object) => {
    object.userData.pass = true;
  });
  return holder;
}

// 小さな駅のホーム（線路は -Z 側。東西に長い）。入口の位置を返す
export function platform(kit, name, { length = 16, snow = false, stripe = "#3a8a5c" } = {}) {
  const concrete = kit.solid(snow ? "#c9d4e4" : "#a29e96", { roughness: 0.95 });
  kit.box([length, 0.9, 3.4], [0, 0.45, 0], concrete);
  kit.box([length, 0.02, 0.3], [0, 0.91, -1.4], kit.solid("#d8b23a"));
  for (let i = 0; i < 4; i += 1) kit.box([2.4, 0.22, 0.5], [length / 2 - 2.2, 0.11 + i * 0.22, 3.5 - i * 0.46], concrete);
  // 屋根と柱
  const post = kit.solid("#5a6066", { metalness: 0.4, roughness: 0.5 });
  for (const x of [-4.4, 0, 4.4]) kit.box([0.16, 2.6, 0.16], [x, 2.2, 0.9], post);
  kit.box([11, 0.14, 3.4], [0, 3.55, 0.2], kit.solid(snow ? "#dfe8f6" : "#6a6e74", { roughness: 0.9 })).userData.pass = true;
  kit.bulb([1.2, 0.06, 0.14], "#fff4dc", 1.6, [-2.4, 3.42, 0.2]);
  kit.bulb([1.2, 0.06, 0.14], "#fff4dc", 1.6, [2.4, 3.42, 0.2]);
  kit.light("#fff0d4", 4.6, [0, 3.2, 0.2], 10, 1.5);
  nameboard(kit, name, [0, 2.5, 0.8], 0, { width: 2.6, height: 0.7, back: "#f2efe6", ink: "#1f2a30", glow: 0.35 });
  // 線路と、停まっている電車
  for (const z of [-2.5, -3.9]) kit.box([70, 0.14, 0.1], [0, 0.1, z], kit.solid("#7d8084", { metalness: 0.7, roughness: 0.4 })).userData.pass = true;
  kit.many(new THREE.BoxGeometry(0.24, 0.1, 2.4), kit.solid("#4a4038", { roughness: 1 }), Array.from({ length: 90 }, (_, i) => ({ position: [-35 + i * 0.78, 0.03, -3.2] })));
  train(kit, kit.add(new THREE.Group(), [-9, 0.1, -3.2]), 2, { stripe });
  kit.block([38, 3, 2.8], [0, 1.6, -3.2]);
  return [0, 0.9, 0.6];
}

// ガードレール
export function guardrail(kit, a, b, { height = 0.8, color = "#d4d6d8" } = {}) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const mid = [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2];
  const mat = kit.solid(color, { metalness: 0.2, roughness: 0.5 });
  kit.frame(mid, yaw, () => {
    kit.rbox([length, 0.28, 0.06], 0.02, [0, height - 0.16, 0], mat);
    const posts = Math.max(2, Math.round(length / 2.4));
    kit.many(new THREE.CylinderGeometry(0.05, 0.05, height, 8), mat, Array.from({ length: posts + 1 }, (_, i) => ({ position: [-length / 2 + (length * i) / posts, height / 2, 0] })));
    kit.block([length, height, 0.12], [0, height / 2, 0]);
  });
}
