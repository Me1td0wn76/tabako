import * as THREE from "three";
import { EYE, LIGHT_MODE, SCALE, createKit } from "../world/kit.js";
import { createSolids, createWalker } from "./physics.js";
import { INN, buildInn } from "./inn.js";
import { LAKE, buildLake } from "./lake.js";
import { PORT, buildPort } from "./port.js";
import { ROADS, buildRoads } from "./roads.js";
import { TOWN, buildTown } from "./town.js";

/*
 * 「ぶらり喫煙の旅」の地図。4 つの土地（街・キャンプ地・港・旅館）を道でつないである。
 *   root  地図の根（実寸の SCALE 倍）。歩くときは動かさず、カメラが動く
 *   stance()  煙草を吸うときは、座る所の目の位置がいつもの視点に重なるように、地図のほうを動かす
 * 土地は近づいたら読み込み、離れたら隠す。灯りは近いものだけを使い回す。
 */

const REGIONS = [
  { ...TOWN, build: buildTown },
  { ...LAKE, build: buildLake },
  { ...PORT, build: buildPort },
  { ...INN, build: buildInn },
];

// 土地ごとの空と光。境目の道では、混ぜて移り変わる
const LOOKS = {
  town: {
    sky: { top: "#232a6a", horizon: "#c07a90", below: "#2a2238", glow: "#5a3424", cloud: "#6a4a80", sun: "#8a4630", stars: 0.2, milky: 0, clouds: 0.65, height: 0.4 },
    sunAt: [0.2, -0.03, 1],
    light: { sky: ["#8f97d4", "#4a4046", 1.25], moon: ["#e0a8b8", 1.2, [0.3, 0.5, 0.75]] },
    fog: ["#5a4262", 0.0034],
    reflect: 1.0,
    outdoor: 0.9,
  },
  lake: {
    sky: { top: "#040818", horizon: "#1a2c52", below: "#0a1020", glow: "#142238", cloud: "#18233c", sun: "#000000", stars: 1.2, milky: 1.2, clouds: 0, height: 0.5 },
    sunAt: [0, -0.03, 1],
    light: { sky: ["#7f9ad4", "#33302c", 1.1], moon: ["#9fb6ea", 1.5, [0.5, 0.8, 0.4]] },
    fog: ["#0c1424", 0.006],
    reflect: 1.1,
    outdoor: 0.7,
  },
  port: {
    sky: { top: "#5c92d6", horizon: "#eec8a6", below: "#5d7488", glow: "#4a2a1a", cloud: "#e8b8a0", sun: "#b8764a", stars: 0, milky: 0, clouds: 0.3, height: 0.3 },
    sunAt: [1, 0.03, 0.16],
    light: { sky: ["#b0c8ec", "#7a6658", 1.5], moon: ["#ffc498", 2.0, [0.8, 0.34, 0.45]] },
    fog: ["#a8806a", 0.0026],
    reflect: 0.8,
    outdoor: 1,
  },
  inn: {
    sky: { top: "#0b1430", horizon: "#31548c", below: "#1a2438", glow: "#22365a", cloud: "#2a3a58", sun: "#000000", stars: 0.1, milky: 0, clouds: 0.8, height: 0.32 },
    sunAt: [0, -0.03, 1],
    light: { sky: ["#8fa8dc", "#4a4a58", 1.0], moon: ["#a9c0f2", 1.3, [0.3, 0.8, -0.5]] },
    fog: ["#22324e", 0.014],
    reflect: 1.0,
    outdoor: 0.6,
  },
};
const LOOK_IDS = Object.keys(LOOKS);

const LIGHTS = LIGHT_MODE ? 4 : 8;
const VIEW = 26; // 土地の端からこの距離まで離れたら隠す
const LOAD = 62; // 読み込みはじめる距離
const SHADOW_STEP = 5; // これだけ歩いたら、影を描き直す

export function createStrollWorld({ scene, renderer, capture }) {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  root.visible = false;
  scene.add(root);

  const solids = createSolids();
  const areas = [];
  const spots = [];
  const portals = [];
  const stops = [];
  const walker = createWalker(solids, areas);
  const zones = []; // 近づいたときだけ表示するまとまり
  const emitters = [];
  const loaded = new Map(); // 土地 → Promise
  const ready = new Map(); // 土地 → kit
  let base = null; // 空・道（いつもある物）
  let stance = null;
  let time = 0;

  /* ---------------- 光 ---------------- */

  const hemi = new THREE.HemisphereLight("#fff", "#444", 1);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight("#fff", 1);
  root.add(moon, moon.target);
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 190 });
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.06;
  moon.shadow.radius = 2.5;
  moon.castShadow = !LIGHT_MODE;
  // 煙草を吸うときに、手元を照らす灯り（いつもの視点の座標）
  const handLamp = new THREE.PointLight("#ffd0a0", 0, 9, 1.6);
  const handFill = new THREE.DirectionalLight("#a0b0d0", 0);
  handFill.position.set(0.5, 0.4, -5);
  scene.add(handLamp, handFill);
  const ownLights = [hemi, handLamp, handFill];

  const pool = Array.from({ length: LIGHTS }, () => {
    const light = new THREE.PointLight("#fff", 0, 10, 1.6);
    root.add(light);
    return { light, emitter: null, level: 0 };
  });
  const distanceTo = (emitter) => Math.hypot(emitter.at.x - walker.body.x, emitter.at.y - walker.body.y - 1.2, emitter.at.z - walker.body.z);

  function updateLights(delta) {
    const list = [];
    for (const emitter of emitters) {
      if (!emitter.region.visible || emitter.zone?.visible === false) continue;
      const d = distanceTo(emitter);
      if (d > emitter.distance / SCALE + 16) continue;
      list.push([emitter.power / (d * d + 8), emitter]);
    }
    list.sort((a, b) => b[0] - a[0]);
    const wanted = new Set(list.slice(0, LIGHTS).map(([, emitter]) => emitter));
    for (const slot of pool) if (slot.emitter && wanted.has(slot.emitter)) wanted.delete(slot.emitter);
      else if (slot.emitter) slot.leaving = true;
    const waiting = [...wanted];
    for (const slot of pool) {
      if (slot.leaving) {
        slot.level = Math.max(0, slot.level - delta * 4);
        if (slot.level === 0) Object.assign(slot, { emitter: null, leaving: false });
      }
      if (!slot.emitter && waiting.length) {
        const emitter = waiting.shift();
        Object.assign(slot, { emitter, level: 0, leaving: false });
        slot.light.color.copy(emitter.color);
        slot.light.distance = emitter.distance;
        slot.light.decay = emitter.decay;
        slot.light.position.copy(emitter.at);
      }
      if (slot.emitter && !slot.leaving) slot.level = Math.min(1, slot.level + delta * 4);
      const flicker = slot.emitter?.flicker ? 1 + (Math.sin(time * 11) * 0.5 + Math.sin(time * 17.3 + 1) * 0.3) * slot.emitter.flicker : 1;
      slot.light.intensity = slot.emitter ? slot.emitter.power * slot.level * flicker : 0;
    }
  }

  /* ---------------- 空と霞 ---------------- */

  const weights = { town: 1, lake: 0, port: 0, inn: 0 };
  const smooth = THREE.MathUtils.smoothstep;
  function updateWeights() {
    const { x, z } = walker.body;
    weights.lake = smooth(-x, 88, 150);
    weights.port = smooth(x, 84, 136);
    weights.inn = smooth(-z, 84, 124);
    weights.town = Math.max(0, 1 - weights.lake - weights.port - weights.inn);
  }
  const color = new THREE.Color();
  const mix = new THREE.Color();
  const blend = (target, pick) => {
    mix.setRGB(0, 0, 0);
    for (const id of LOOK_IDS) if (weights[id]) mix.add(color.set(pick(LOOKS[id])).multiplyScalar(weights[id]));
    target.copy(mix);
  };
  const number = (pick) => LOOK_IDS.reduce((sum, id) => sum + weights[id] * pick(LOOKS[id]), 0);
  const direction = new THREE.Vector3();
  let dome = null;
  const fog = new THREE.Color();

  function updateLook() {
    const uniforms = dome.material.uniforms;
    blend(uniforms.uTop.value, (look) => look.sky.top);
    blend(uniforms.uHorizon.value, (look) => look.sky.horizon);
    blend(uniforms.uBelow.value, (look) => look.sky.below);
    blend(uniforms.uGlow.value, (look) => look.sky.glow);
    blend(uniforms.uCloud.value, (look) => look.sky.cloud);
    uniforms.uStars.value = number((look) => look.sky.stars);
    uniforms.uMilky.value = number((look) => look.sky.milky);
    uniforms.uClouds.value = number((look) => look.sky.clouds);
    uniforms.uHeight.value = number((look) => look.sky.height);
    const lead = dominant();
    uniforms.uSun.value.set(...LOOKS[lead].sunAt).normalize();
    uniforms.uSunColor.value.set(LOOKS[lead].sky.sun).multiplyScalar(Math.max(0, weights[lead] * 2 - 1));
    blend(hemi.color, (look) => look.light.sky[0]);
    blend(hemi.groundColor, (look) => look.light.sky[1]);
    hemi.intensity = number((look) => look.light.sky[2]) * (inTunnel() ? 0.35 : 1);
    blend(moon.color, (look) => look.light.moon[0]);
    moon.intensity = number((look) => look.light.moon[1]) * (inTunnel() ? 0 : 1);
    direction.set(0, 0, 0);
    for (const id of LOOK_IDS) direction.addScaledVector(tmp.set(...LOOKS[id].light.moon[2]).normalize(), weights[id]);
    moonDirection.copy(direction).normalize();
    blend(fog, (look) => look.fog[0]);
    scene.fog.color.copy(fog);
    scene.background.copy(fog);
    // 土地の境目では霞を濃くして、向こうの土地が消えるのを隠す
    const between = 1 - Math.abs(weights[lead] * 2 - 1);
    scene.fog.density = (number((look) => look.fog[1]) + between * 0.016) / SCALE;
    scene.environmentIntensity = number((look) => look.reflect) * (inTunnel() ? 0.4 : 1);
    place.outdoor = inTunnel() || indoors() ? 0 : number((look) => look.outdoor);
  }
  const tmp = new THREE.Vector3();
  const moonDirection = new THREE.Vector3(0, 1, 0);
  function dominant() {
    return LOOK_IDS.reduce((best, id) => (weights[id] > weights[best] ? id : best), "town");
  }
  const inTunnel = () => Math.abs(walker.body.x) < 4 && walker.body.z < -80 && walker.body.z > -126;
  const indoors = () => areas.some((area) => area.indoor && walker.body.x > area.x[0] && walker.body.x < area.x[1] && walker.body.z > area.z[0] && walker.body.z < area.z[1] && Math.abs((typeof area.y === "function" ? 0 : area.y) - walker.body.y) < 0.6);

  /* ---------------- 影 ---------------- */

  const shadowAt = new THREE.Vector3(1e9, 0, 0);
  function updateShadow(force = false) {
    if (!moon.castShadow) return;
    const { x, y, z } = walker.body;
    if (!force && shadowAt.distanceTo(tmp.set(x, y, z)) < SHADOW_STEP) return;
    shadowAt.set(x, y, z);
    // 影の升目にそろえて、歩いてもちらつかないようにする
    const snap = (value) => Math.round(value / 0.5) * 0.5;
    moon.target.position.set(snap(x), snap(y), snap(z));
    moon.position.copy(moon.target.position).addScaledVector(moonDirection, 40);
    renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- 土地 ---------------- */

  const place = { outdoor: 1, walking: true, surface: { image: "wood_plank", color: "#a08464", roughness: 0.8 } };
  const api = (region) => ({
    root,
    area: (area) => areas.push({ surface: "road", ...area, region: region.id }),
    spot: (spot) => spots.push({ ...spot, region: region.id, seat: spot.seat ?? null }),
    portal: (portal) => portals.push({ ...portal, region: region.id }),
    stop: (stop) => stops.push({ ...stop, region: region.id }),
    // 近くにいるときだけ表示するまとまり。test(body) が true の間だけ見える
    zone: (group, test) => zones.push({ group, test, region: region.id }),
  });

  function adopt(region, kit) {
    kit.shade();
    root.updateMatrixWorld(true);
    solids.collect(kit, root);
    const inverse = root.matrixWorld.clone().invert();
    kit.emitters.forEach((emitter) => {
      emitter.marker.getWorldPosition(tmp).applyMatrix4(inverse);
      const zone = zones.find(({ group }) => {
        let node = emitter.marker.parent;
        while (node && node !== group) node = node.parent;
        return node === group;
      });
      emitters.push({ ...emitter, at: tmp.clone(), region: kit.group, zone: zone?.group ?? null });
    });
  }

  function ensure(id) {
    if (!loaded.has(id)) {
      const region = REGIONS.find((entry) => entry.id === id);
      const promise = createKit({ models: region.models, images: region.images, parent: root }).then((kit) => {
        region.build(kit, api(region));
        adopt(region, kit);
        ready.set(id, kit);
        shadowAt.x = 1e9;
        return kit;
      });
      promise.catch(() => loaded.delete(id));
      loaded.set(id, promise);
    }
    return loaded.get(id);
  }

  async function prepare() {
    if (!base) {
      base = await createKit({ models: ROADS.models, images: ROADS.images, parent: root });
      dome = base.sky({ top: "#232a6a", horizon: "#c07a90", stars: 1, milky: 0.01, clouds: 0.5, moon: null, sun: [0, 0, 1] });
      buildRoads(base, api({ id: "roads" }));
      adopt({ id: "roads" }, base);
    }
    await ensure("town");
  }

  const outside = (region) => {
    const { x, z } = walker.body;
    return Math.hypot(Math.max(region.x[0] - x, 0, x - region.x[1]), Math.max(region.z[0] - z, 0, z - region.z[1]));
  };

  /* ---------------- 毎フレーム ---------------- */

  let lead = null;
  function update(delta, now, wind) {
    time = now;
    if (!root.visible) return;
    for (const region of REGIONS) {
      const d = outside(region);
      if (d < LOAD && !loaded.has(region.id)) ensure(region.id).catch(() => {});
      const kit = ready.get(region.id);
      if (!kit) continue;
      const visible = d < VIEW;
      if (visible !== kit.group.visible) {
        kit.group.visible = visible;
        shadowAt.x = 1e9;
      }
      if (visible) kit.update(delta, now, wind);
    }
    base.update(delta, now, wind);
    for (const zone of zones) {
      const visible = zone.test(walker.body);
      if (visible !== zone.group.visible) {
        zone.group.visible = visible;
        shadowAt.x = 1e9;
      }
    }
    updateWeights();
    updateLook();
    updateLights(delta);
    dome.position.set(walker.body.x, walker.body.y + 1.5, walker.body.z);
    if (!stance) updateShadow();
    // 土地が変わったら、写り込みを撮り直す
    if (!stance && lead !== dominant()) {
      lead = dominant();
      capture(tmp.set(walker.body.x, walker.body.y + 1.6, walker.body.z).multiplyScalar(SCALE).clone());
    }
  }

  // 煙草を吸う姿勢：座る所の目の位置を、いつもの視点に重ねる
  const eyeAt = new THREE.Vector3();
  function setStance(spot) {
    stance = spot;
    place.walking = !spot;
    if (spot) {
      eyeAt.set(spot.at[0], spot.at[1] + spot.eye, spot.at[2]);
      root.quaternion.setFromAxisAngle(up, -spot.yaw);
      root.position.copy(EYE).sub(eyeAt.multiplyScalar(SCALE).applyQuaternion(root.quaternion));
      place.surface = spot.surface ?? place.surface;
      const lamp = spot.lamp ?? ["#ffd0a0", 3.4, [1.2, 2.4, 7.2]];
      handLamp.color.set(lamp[0]);
      handLamp.intensity = lamp[1];
      handLamp.position.set(...lamp[2]);
      handFill.color.set(spot.fill?.[0] ?? "#8c9cc8");
      handFill.intensity = spot.fill?.[1] ?? 0.4;
      if (spot.seat) spot.seat.visible = false;
      if (spot.tray) spot.tray.visible = false;
    } else {
      root.quaternion.identity();
      root.position.set(0, 0, 0);
      handLamp.intensity = 0;
      handFill.intensity = 0;
      spots.forEach((entry) => {
        if (entry.seat) entry.seat.visible = true;
        if (entry.tray) entry.tray.visible = true;
      });
      shadowAt.x = 1e9;
    }
    root.updateMatrixWorld(true);
    updateShadow(true);
  }
  const up = new THREE.Vector3(0, 1, 0);

  function setVisible(visible) {
    root.visible = visible;
    ownLights.forEach((light) => {
      light.visible = visible;
    });
    if (!visible) setStance(null);
    else {
      lead = null;
      shadowAt.x = 1e9;
    }
  }
  setVisible(false);

  return {
    root,
    group: root,
    place,
    walker,
    spots,
    portals,
    stops,
    regions: REGIONS,
    prepare,
    ensure,
    update,
    setStance,
    setVisible,
    release() {},
    get stance() {
      return stance;
    },
    // いまの場所（いつもの視点の座標での、机の上の位置）
    get spot() {
      const spot = stance ?? spots[0];
      const at = (x, z, y) => new THREE.Vector3(x, y - spot.eye, z).multiplyScalar(SCALE).add(EYE);
      const { y, tray, chillTray, item, phone } = spot.table;
      return { item: at(item[0], item[1], y), phone: at(phone[0], phone[1], y), tray: { challenge: at(...(tray ?? chillTray), y), chill: at(...chillTray, y) } };
    },
    get region() {
      return dominant();
    },
    cars: () => ready.get("town")?.cars,
  };
}
