import { HARBOR, harborFar, harborSet } from "../world/harbor.js";
import { seeded } from "../world/kit.js";
import { TAU, can, powerPole, streetLamp } from "../world/parts.js";
import { SEAT_STAND, addSpot, guardrail, localArea, localPoint, nameboard, standAshtray } from "./common.js";

/*
 * 港（釣り場）。海は東にある。座標は「岸壁の釣り座」が原点の、いつもの港と同じ（-Z が海、+X が船着き場）。
 */

export const PORT = {
  id: "port",
  name: "港",
  x: [118, 250],
  z: [-64, 64],
  models: [...new Set([...HARBOR.models, "busstop", "npc_fisher", "cat", "vending", "bench", "standash", "stool", "bicycle", "car", "crates"])],
  images: [...new Set([...HARBOR.images, "steel", "wood_plank"])],
};

export function buildPort(kit, api) {
  kit.frame([160, 0, 0], -Math.PI / 2, () => {
    const random = seeded(53);
    kit.water({ size: [620, 480], y: -1.5, position: [0, -225], deep: "#123850", shallow: "#7f8c9a", sparkle: "#ffe4c4", glitter: 0.14, scale: 0.5, lights: [[[70, 16, -420], "#ffb878"], [[-14, 6, -60], "#5a4a3a"]] });
    harborFar(kit);
    /* ---- 陸 ---- */
    kit.ground([90, 36], -0.02, kit.material("asphalt", { repeat: [18, 7], color: "#b0aca6", roughness: 0.9, bump: 0.8 }), [0, 22.4]);
    const face = kit.material("brickwall", { repeat: [12, 0.5], color: "#8f8a82", bump: 1 });
    kit.box([46, 2.6, 0.4], [-38.8, -1.31, 4.6], face).userData.pass = true;
    kit.box([20, 2.6, 0.4], [31.6, -1.31, 4.6], face).userData.pass = true;
    guardrail(kit, [-60, 5.2], [-16.4, 5.2]);
    guardrail(kit, [22, 5.2], [44, 5.2]);
    localArea(kit, api, { x: [-28, 28], z: [4.4, 37], y: 0, surface: "road" });
    localArea(kit, api, { x: [-15.6, 10], z: [-3.0, 4.6], y: 0, surface: "road" });
    localArea(kit, api, { x: [10, 21.2], z: [-65, 4.6], y: 0, surface: "road" });

    /* ---- 釣り座 ---- */
    addSpot(kit, api, { id: "harbor", name: "岸壁の釣り座", at: [0, 0, 0], yaw: 0, eye: HARBOR.eye, table: HARBOR.spot, place: "harbor", seat: { model: "stool", at: [0, 0, 0.08], height: 0.4 }, build: () => harborSet(kit) });
    kit.put("npc_fisher", [-4.6, 0, -2.2], { yaw: Math.PI });

    /* ---- 灯台へ続く堤 ---- */
    const top = kit.material("quay", { repeat: [1, 14], color: "#b3ada2", bump: 1.2 });
    kit.box([3.4, 1.8, 47.5], [-14, -0.9, -26.4], top).userData.pass = true;
    localArea(kit, api, { x: [-15.5, -12.5], z: [-50.4, -2.8], y: 0, surface: "road" });
    for (let i = 0; i < 8; i += 1) kit.box([0.3, 0.22, 4.6], [-15.4, 0.1, -6 - i * 5.8], kit.solid("#b8a860", { roughness: 1 }));
    for (let i = 0; i < 5; i += 1) kit.box([3.4, 0.22, 0.7], [-14, 0.1 + i * 0.2, -50.2 - i * 0.6], top);
    kit.box([9, 1.4, 6.4], [-15.4, 0.28, -56.2], top).userData.pass = true;
    localArea(kit, api, { x: [-19.4, -11.2], z: [-59, -52.4], y: 0.98, surface: "road" });
    kit.scatter("tetrapod", Array.from({ length: 22 }, (_, i) => ({ position: [-17.4 - random() * 1.6, -1.6 + random() * 0.5, -7 - i * 2 - random()], yaw: random() * TAU, scale: 0.9 + random() * 0.3 })));
    addSpot(kit, api, {
      id: "lighthouse",
      name: "灯台の下",
      at: [-12.6, 0.98, -54.0],
      yaw: -0.35,
      eye: 1.0,
      table: { y: 0.56, item: [-0.2, -1.2], phone: [0.2, -1.3], chillTray: [-0.02, -1.26] },
      lamp: ["#ffcfa0", 2, [2.0, 2.2, 5.2]],
      fill: ["#a8c4ea", 0.4],
      surface: { image: "concrete", color: "#b6b1aa", roughness: 0.95 },
      seat: { model: "crates", at: [0, 0, 0.1], height: 0.4 },
      build: () => {
        kit.rbox([0.9, 0.56, 0.6], 0.04, [0, 0.28, -1.35], kit.material("concrete", { repeat: [0.6, 0.4], color: "#b0aaa0" }));
        kit.put("rope", [0.8, 0, -1.6], { height: 0.22 });
        can(kit, [0.3, 0.56, -1.5], { color: "#6d2a1e", band: "#d8b26a" });
      },
    });

    /* ---- 漁協・番屋前 ---- */
    addSpot(kit, api, {
      id: "fishery",
      name: "番屋の前",
      at: [13.4, 0, -12.6],
      yaw: Math.PI / 2,
      eye: 1.14,
      table: SEAT_STAND,
      lamp: ["#ffcfa0", 2.4, [1.6, 2.4, 6.8]],
      fill: ["#a8c4ea", 0.4],
      surface: { image: "wood_plank", color: "#9a8a78", roughness: 0.9 },
      seat: { model: "bench", at: [0, 0, 0.16], yaw: 0, height: 0.85 },
      build: () => standAshtray(kit, [0, -1.28], 0.72, { color: "#3a6a8c" }),
    });
    kit.put("cat", [11.8, 0, -9.6], { yaw: 0.8 });
    kit.put("cat", [12.6, 0, -10.2], { yaw: 2.6, color: "#c8c0b8" });
    kit.put("vending", [18.4, 0, -10.6], { yaw: -Math.PI / 2, glow: 0.4, threshold: 0.85, scale: 0.95, color: "#b8d0f0" });
    kit.put("bicycle", [17.6, 0, -6.4], { height: 1.04, yaw: 0.3 });

    /* ---- 港の町 ---- */
    nameboard(kit, "風見漁港", [-6, 2.5, 30], Math.PI, { width: 2.6, height: 0.7, back: "#1f4f86" });
    for (const x of [-7, -5]) kit.cylinder(0.06, 0.06, 2.7, [x, 1.35, 30], kit.solid("#5a6066"), undefined, undefined, 10);
    const houses = [[-24, 16, 0.2], [-25, 27, 1.6], [24, 14, -0.3], [25, 25, 1.7], [-13, 33, 3.1], [14, 34, 3.2]];
    kit.scatter("house", houses.map(([x, z, yaw]) => ({ position: [x, 0, z], yaw, scale: 0.9 })), { color: "#d0c4b8" });
    kit.put("shed", [-13, 0, 12], { height: 3.4, yaw: 0.3 });
    kit.put("shed", [13.5, 0, 15], { height: 3.6, yaw: -0.4, color: "#c8d0d8" });
    kit.put("truck", [8, 0, 11], { height: 1.75, yaw: 2.2 });
    kit.put("car", [-7, 0, 14], { yaw: 1.2, color: "#8a94a4" });
    for (const [x, z] of [[-3, 8], [4.6, 7.4], [-9, 7.2], [7.6, 6.8]]) kit.put(x > 0 ? "fishcrates" : "nets", [x, 0, z], { height: 0.7, yaw: random() * TAU });
    const poles = [[-16, 24], [0.5, 24.6], [18, 23]].map(([x, z]) => {
      kit.pillar(0.2, 6, [x, 0, z]);
      return powerPole(kit, x, z, 8.6);
    });
    kit.wires(poles, 4);
    streetLamp(kit, 4.6, 20, { height: 4.2, power: 2.4, reach: 9, color: "#ffe8c8", arm: -0.4 });
    streetLamp(kit, -5, 10, { height: 4.2, power: 2.4, reach: 9, color: "#ffe8c8", arm: 0.4 });
    kit.scatter("tree", [[-20, 22], [20, 32], [-21, 34], [27, 18]].map(([x, z]) => ({ position: [x, 0, z], yaw: random() * TAU, height: 5 + random() * 1.6 })), { color: "#9aa894" });
    kit.put("busstop", [4.2, 0, 28], { height: 2.5 });
    api.stop({ id: "port", name: "風見漁港", at: localPoint(kit, api, [4.2, 0, 28]), to: { at: localPoint(kit, api, [2.4, 0, 26.5]), yaw: -Math.PI / 2 } });
  });
}
