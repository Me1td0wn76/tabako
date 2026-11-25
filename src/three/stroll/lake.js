import * as THREE from "three";
import { CAMP, campGround, campSet } from "../world/camp.js";
import { seeded } from "../world/kit.js";
import { TAU, can, forest, ridges, streetLamp, trunk } from "../world/parts.js";
import { addSpot, localArea, localPoint, nameboard } from "./common.js";

/*
 * キャンプ地。湖は西にある。座標は「焚き火の前に座る人」が原点の、いつものキャンプ場と同じ（-Z が湖）。
 */

export const LAKE = {
  id: "lake",
  name: "湖のキャンプ場",
  x: [-232, -128],
  z: [-56, 56],
  models: [...new Set([...CAMP.models, "picnic", "rowboat", "bbq", "car", "busstop", "stool", "tree", "bins", "cat", "npc_camper"])],
  images: [...new Set([...CAMP.images, "concrete", "asphalt"])],
};

export function buildLake(kit, api) {
  kit.frame([-185, 0, 0], Math.PI / 2, () => {
    const random = seeded(23);
    /* ---- 地面・湖・森 ---- */
    const land = new THREE.PlaneGeometry(112, 92, 140, 116);
    land.rotateX(-Math.PI / 2);
    land.translate(0, 0, 6);
    const position = land.attributes.position;
    for (let i = 0; i < position.count; i += 1) position.setY(i, campGround(position.getX(i), position.getZ(i)));
    land.computeVertexNormals();
    kit.mesh(land, kit.material("forest", { repeat: [30, 25], color: "#9a9086", bump: 2 })).userData.noCast = true;
    kit.water({ size: [300, 150], y: -0.42, position: [0, -88], deep: "#071022", shallow: "#34568f", sparkle: "#9fb6e0", glitter: 0.14, scale: 0.6, lights: [[[-0.9, 0.9, -3.1], "#ff8a3a"], [[2.6, 1.2, -5.2], "#ffb868"]] });
    ridges(kit, [{ z: -230, color: "#1b2a4a", height: 46, seed: 3 }, { z: -200, color: "#121f38", height: 28, seed: 8 }]);
    forest(kit, { count: 260, x: [-200, 200], z: [-190, -164], y: -0.6, height: [9, 20], color: "#0f1a22", seed: 3 });
    const clearing = (x, z) => Math.abs(x) < 6 && z > 20;
    for (const [side, seed] of [[-1, 5], [1, 6]]) forest(kit, { count: 170, x: side < 0 ? [-62, -23] : [23, 62], z: [-42, 48], y: 1.4, height: [9, 17], color: "#142019", seed, avoid: clearing });
    forest(kit, { count: 70, x: [-24, -7], z: [36, 52], y: 0.2, height: [8, 14], color: "#142019", seed: 15 });
    forest(kit, { count: 70, x: [7, 24], z: [36, 52], y: 0.2, height: [8, 14], color: "#142019", seed: 16 });
    localArea(kit, api, { x: [-22, 22], z: [-12.4, 35], y: campGround, surface: "dirt" });
    const bark = kit.material("bark", { repeat: [2, 5], color: "#8a7666", bump: 3 });
    [[-12, -2], [-16, 7], [-9, 15], [-19, 17], [11, 3], [17, -4], [19, 12], [14, 22], [-15, 27], [8, 28], [-6, 22], [20, 28]].forEach(([x, z], i) => {
      const y = campGround(x, z);
      trunk(kit, x, z, { radius: 0.22 + random() * 0.1, height: 11 + random() * 4, mat: bark, seed: 20 + i, y: y - 0.1 });
      kit.pillar(0.34, 4, [x, y, z]);
    });
    kit.scatter("conifer", Array.from({ length: 22 }, (_, i) => {
      const side = i % 2 ? -1 : 1;
      const x = side * (13 + random() * 9);
      const z = -6 + random() * 38;
      return { position: [x, campGround(x, z) - 0.1, z], yaw: random() * TAU, scale: 0.8 + random() * 0.6 };
    }), { color: "#465446" });
    kit.grass({ count: 1600, x: [-20, 20], z: [-11, 32], y: 0, height: [0.08, 0.24], color: ["#333f22", "#5c6638"], seed: 31, avoid: (x, z) => Math.abs(x) < 7 || Math.abs(x) > 9 + 4 });
    kit.pebbles({ count: 300, x: [-8, 8], z: [-1, 32], size: [0.012, 0.06], color: ["#4a443c", "#7d766a"], seed: 18 });
    kit.ground([4.4, 26], 0.03, kit.material("asphalt", { repeat: [1, 7], color: "#6d685f", roughness: 1 }), [0, 26]);

    /* ---- 焚き火 ---- */
    addSpot(kit, api, { id: "camp", name: "焚き火の前", at: [0, 0, 0], yaw: 0, eye: CAMP.eye, table: CAMP.spot, place: "camp", seat: { model: "campchair", at: [0, 0, 0.12], yaw: Math.PI, height: 0.8 }, build: () => campSet(kit) });

    /* ---- 桟橋の先 ---- */
    localArea(kit, api, { x: [1.78, 3.02], z: [-18.0, -11.2], y: -0.06, surface: "wood" });
    addSpot(kit, api, {
      id: "pier",
      name: "湖の桟橋",
      at: [2.4, -0.025, -16.2],
      yaw: 0,
      eye: 0.98,
      table: { y: 0.54, item: [-0.2, -1.2], phone: [0.2, -1.3], chillTray: [-0.02, -1.24] },
      lamp: ["#ffcf98", 3.2, [1.2, 2.0, 7.2]],
      fill: ["#5f7cc0", 0.5],
      surface: { image: "wood_plank", color: "#8a7a66", roughness: 0.9 },
      build: () => {
        kit.rbox([0.62, 0.52, 0.5], 0.02, [0, 0.27, -1.28], kit.material("wood_plank", { repeat: [0.6, 0.5], color: "#8a7660", roughness: 0.9, bump: 0.6 }));
        kit.put("lantern", [0.4, 0, -0.9], { height: 0.28, glow: 1.2, threshold: 0.6, tint: "#ffcf90" });
        kit.light("#ffc27a", 1.4, [0.4, 0.5, -0.9], 4, 1.6);
        can(kit, [0.22, 0.54, -1.4], { color: "#23384a", band: "#e0a64a" });
      },
    });
    kit.put("rowboat", [4.6, -0.42, -14.6], { height: 0.7, yaw: 0.3 });
    kit.put("rowboat", [-1.8, -0.2, -12.2], { height: 0.66, yaw: 1.2 });

    /* ---- となりのサイト・炊事場・管理棟 ---- */
    const at = (x, z, dy = 0) => [x, campGround(x, z) + dy, z];
    kit.put("tent", at(-10.5, -5.0), { yaw: 0.7, height: 1.7, glow: 0.6, threshold: 0.5, tint: "#9ad0ff", color: "#b8d8ff" });
    kit.light("#a8d0ff", 1.8, at(-9.6, -4.2, 0.7), 5, 1.6);
    kit.put("bbq", at(-7.8, -2.2), { height: 0.95, yaw: 0.4, glow: 0.2, threshold: 0.7 });
    kit.steam({ at: at(-7.8, -2.2, 1.0), spread: [0.3, 0.3], count: 6, size: 0.2, grow: 0.8, rise: 1.6, opacity: 0.07, speed: 0.2, color: "#b0a8a0" });
    kit.put("npc_camper", at(-8.6, -1.2), { yaw: 2.4 });
    kit.put("campchair", at(-9.6, -1.0), { yaw: 1.6 });
    kit.put("cooler", at(-10.6, -2.2), { height: 0.42, yaw: 0.3 });
    kit.put("lantern", at(-9.0, -3.0), { height: 0.3, glow: 1.2, threshold: 0.6, tint: "#ffcf90" });
    kit.light("#ffc27a", 1.6, at(-9.0, -3.0, 0.5), 4.5, 1.6);
    kit.put("tent", at(9.6, 5.5), { yaw: -1.1, height: 1.6, glow: 0.4, threshold: 0.5, tint: "#ffb868", color: "#ffd8b0" });
    kit.put("firewood", at(7.2, 7.6), { height: 0.6, yaw: 0.3 });
    kit.put("stump", at(6.6, 3.6), { height: 0.7, yaw: 2 });
    cabin(kit, at(13.5, 16));
    nameboard(kit, "湖のキャンプ場", [3.4, 1.7, 31], 0.2, { width: 2.4, height: 0.7, back: "#4a3420" });
    for (const x of [2.5, 4.3]) kit.cylinder(0.06, 0.06, 1.9, [x, 0.95, 31], kit.solid("#5a4432"), undefined, undefined, 10);
    kit.put("car", at(-4.2, 25), { yaw: 0.2, color: "#7c8a5c" });
    kit.put("car", at(-4.4, 20.5), { yaw: 0.1, color: "#c8ccd4" });
    kit.put("busstop", at(3.6, 27.4), { height: 2.5 });
    kit.put("bins", at(4.6, 24), { yaw: -0.4 });
    streetLamp(kit, 4.6, 29.4, { height: 4, power: 7, reach: 11, color: "#ffe2b8", arm: -0.4 });
    streetLamp(kit, -5.4, 16, { height: 3.4, power: 5, reach: 9, color: "#ffd9a0", arm: 0.4 });
    streetLamp(kit, 5.4, 12, { height: 3.4, power: 5, reach: 9, color: "#ffd9a0", arm: -0.4 });
    api.stop({ id: "lake", name: "湖のキャンプ場", at: localPoint(kit, api, at(3.6, 27.4)), to: { at: localPoint(kit, api, at(1.8, 26)), yaw: Math.PI / 2 } });

    /* ---- ピクニック台 ---- */
    addSpot(kit, api, {
      id: "picnic",
      name: "林のピクニック台",
      at: at(-12.6, 8.4),
      yaw: 0.5,
      eye: 1.14,
      table: { y: 0.74, item: [-0.2, -1.2], phone: [0.24, -1.3], chillTray: [-0.02, -1.26] },
      lamp: ["#ffcf98", 4, [1.2, 2.4, 7.2]],
      fill: ["#5f7cc0", 0.4],
      surface: { image: "wood_plank", color: "#8a7660", roughness: 0.85 },
      seat: { model: "logseat", at: [0, 0, 0.1], yaw: 0, height: 0.46 },
      build: () => {
        kit.put("picnic", [0, 0, -1.5], { height: 0.74, yaw: Math.PI / 2 });
        kit.put("lantern", [0.5, 0.74, -1.6], { height: 0.26, glow: 1.2, threshold: 0.6, tint: "#ffcf90" });
        kit.light("#ffc27a", 2.0, [0.5, 1.0, -1.5], 5, 1.6);
        kit.put("mug", [-0.4, 0.74, -1.6], { height: 0.1 });
      },
    });
  });
}

// 丸太の管理棟
function cabin(kit, position) {
  kit.frame(position, -0.5, () => {
    const log = kit.material("bark", { repeat: [1, 3], color: "#b08a68", bump: 2 });
    const parts = [];
    for (let i = 0; i < 9; i += 1) {
      const y = 0.16 + i * 0.3;
      for (const z of [-2.2, 2.2]) if (i > 6 || z < 0) parts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.16, 6.4, 10), position: [0, y, z], rotation: [0, 0, Math.PI / 2] });
      for (const x of [-3, 3]) parts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.16, 4.8, 10), position: [x, y + 0.15, 0], rotation: [Math.PI / 2, 0, 0] });
      if (i <= 6) for (const x of [-2.05, 2.05]) parts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10), position: [x, y, 2.2], rotation: [0, 0, Math.PI / 2] });
    }
    kit.merged(log, parts);
    kit.block([6.4, 3, 4.8], [0, 1.5, 0]);
    kit.box([6.0, 2.7, 4.2], [0, 1.35, -0.05], kit.solid("#3a2a1e")).userData.pass = true;
    const roof = kit.solid("#3c3026", { roughness: 1 });
    for (const side of [-1, 1]) kit.box([7.4, 0.14, 3.5], [0, 3.55, side * 1.5], roof, [side * 0.5, 0, 0]).userData.pass = true;
    kit.bulb([1.0, 1.9, 0.04], "#ffd8a0", 0.8, [0, 1.1, 2.1]);
    kit.box([8, 0.16, 1.6], [0, 0.02, 3.0], kit.material("wood_plank", { repeat: [4, 0.6], color: "#8a7660" }));
    nameboard(kit, "管理棟", [0, 2.55, 2.4], 0, { width: 1.6, height: 0.5, back: "#4a3420" });
    kit.light("#ffd098", 4, [0, 2.2, 3.4], 8, 1.5);
    kit.put("bins", [2.8, 0.1, 3.0], { scale: 0.8 });
    kit.put("firewood", [-2.6, 0.1, 3.0], { height: 0.6 });
  });
}
