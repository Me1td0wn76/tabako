import * as THREE from "three";
import { EYE, LIGHT_MODE, SCALE, assetUrls, createKit, preloadAssets } from "../world/kit.js";
import { createSolids, createWalker } from "./physics.js";
import { INN } from "./inn.js";
import { LAKE } from "./lake.js";
import { PORT } from "./port.js";
import { TOWN } from "./town.js";

/*
 * 「ぶらり喫煙の旅」の地図。土地（街・キャンプ地・港・旅館）は 1 つずつ開く。
 *   root      地図の根（実寸の SCALE 倍）。歩くときは動かさず、カメラが動く
 *   stance()  煙草を吸うときは、座る所の目の位置がいつもの視点に重なるように、地図のほうを動かす
 * 土地は「部品」に分けてある。着いた所のまわり（core）だけ先に組み立て、残りは歩いている間に裏で足していく。
 * ほかの土地の素材は、手が空いたときに少しずつ取っておく。
 */

const REGIONS = { town: TOWN, lake: LAKE, port: PORT, inn: INN };

// 土地ごとの空と光
const LOOKS = {
  town: {
    sky: { top: "#232a6a", horizon: "#c07a90", below: "#2a2238", glow: "#5a3424", cloud: "#6a4a80", sun: "#8a4630", stars: 0.2, milky: 0, clouds: 0.65, height: 0.4 },
    sunAt: [0.2, -0.03, 1],
    light: { sky: ["#9aa2dc", "#5c5258", 1.75], moon: ["#e8b0bc", 1.5, [0.3, 0.5, 0.75]] },
    fog: ["#5a4262", 0.0034],
    reflect: 1.0,
    outdoor: 0.9,
  },
  lake: {
    sky: { top: "#040818", horizon: "#1a2c52", below: "#0a1020", glow: "#142238", cloud: "#18233c", sun: "#000000", stars: 1.2, milky: 1.2, clouds: 0, height: 0.5 },
    sunAt: [0, -0.03, 1],
    light: { sky: ["#8aa4dc", "#48443e", 2.5], moon: ["#a8bef0", 2.3, [0.5, 0.8, 0.4]] },
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

const LIGHTS = LIGHT_MODE ? 4 : 8;
const SHADOW_STEP = 5; // これだけ歩いたら、影を描き直す

// 画面の動きを止めないための、ひと息
export const breathe = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
const idle = () => new Promise((resolve) => (window.requestIdleCallback ? window.requestIdleCallback(resolve, { timeout: 1200 }) : setTimeout(resolve, 120)));

export function createStrollWorld({ scene, camera, renderer, capture }) {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  root.visible = false;
  scene.add(root);

  // いま開いている土地
  let region = null; // "town" など
  let ticket = 0; // 開き直したら、前の読み込みは捨てる
  let solids = createSolids();
  const areas = [];
  const spots = [];
  const portals = [];
  const stops = [];
  const zones = [];
  const emitters = [];
  let parts = []; // { kit, near }
  let pending = 0; // 裏で読み込み中の部品の数
  const walker = createWalker(() => solids, areas);
  const atlas = new Map(); // これまでに見た喫煙所（地図用）
  let dome = null;
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

  // 灯りは近いものだけを使い回す（数を変えないので、描画の準備をやり直さなくてすむ）
  const pool = Array.from({ length: LIGHTS }, () => {
    const light = new THREE.PointLight("#fff", 0, 10, 1.6);
    root.add(light);
    return { light, emitter: null, level: 0, leaving: false };
  });

  function updateLights(delta) {
    const list = [];
    const { x, y, z } = walker.body;
    for (const emitter of emitters) {
      if (!emitter.group.visible || emitter.zone?.visible === false) continue;
      const d = Math.hypot(emitter.at.x - x, emitter.at.y - y - 1.2, emitter.at.z - z);
      if (d > emitter.distance / SCALE + 16) continue;
      list.push([emitter.power / (d * d + 8), emitter]);
    }
    list.sort((a, b) => b[0] - a[0]);
    const wanted = new Set(list.slice(0, LIGHTS).map(([, emitter]) => emitter));
    for (const slot of pool) {
      if (!slot.emitter) continue;
      if (wanted.has(slot.emitter)) {
        wanted.delete(slot.emitter);
        slot.leaving = false;
      } else slot.leaving = true;
    }
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

  const place = { outdoor: 1, walking: true, surface: { image: "wood_plank", color: "#a08464", roughness: 0.8 } };
  const tmp = new THREE.Vector3();
  const moonDirection = new THREE.Vector3(0, 1, 0);

  function applyLook() {
    const look = LOOKS[region];
    const uniforms = dome.material.uniforms;
    uniforms.uTop.value.set(look.sky.top);
    uniforms.uHorizon.value.set(look.sky.horizon);
    uniforms.uBelow.value.set(look.sky.below);
    uniforms.uGlow.value.set(look.sky.glow);
    uniforms.uCloud.value.set(look.sky.cloud);
    uniforms.uSunColor.value.set(look.sky.sun);
    uniforms.uStars.value = look.sky.stars;
    uniforms.uMilky.value = look.sky.milky;
    uniforms.uClouds.value = look.sky.clouds;
    uniforms.uHeight.value = look.sky.height;
    uniforms.uSun.value.set(...look.sunAt).normalize();
    hemi.color.set(look.light.sky[0]);
    hemi.groundColor.set(look.light.sky[1]);
    hemi.intensity = look.light.sky[2];
    moon.color.set(look.light.moon[0]);
    moon.intensity = look.light.moon[1];
    moonDirection.set(...look.light.moon[2]).normalize();
    scene.fog.color.set(look.fog[0]);
    scene.background.set(look.fog[0]);
    scene.fog.density = look.fog[1] / SCALE;
    scene.environmentIntensity = look.reflect;
  }
  const indoors = () => areas.some((area) => area.indoor && walker.body.x > area.x[0] && walker.body.x < area.x[1] && walker.body.z > area.z[0] && walker.body.z < area.z[1] && Math.abs(area.y - walker.body.y) < 0.8);

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

  /* ---------------- 土地を開く ---------------- */

  const api = {
    root,
    area: (area) => areas.push({ surface: "road", ...area }),
    spot: (spot) => {
      const entry = { ...spot, region, seat: spot.seat ?? null };
      spots.push(entry);
      atlas.set(entry.id, { id: entry.id, name: entry.name, region });
    },
    portal: (portal) => portals.push(portal),
    stop: (stop) => stops.push(stop),
    // 近くにいるときだけ表示するまとまり。test(body) が true の間だけ見える
    zone: (group, test) => zones.push({ group, test }),
  };

  // 部品を地図に加える
  function adopt(part, kit) {
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
      emitters.push({ ...emitter, at: tmp.clone(), group: kit.group, zone: zone?.group ?? null });
    });
    parts.push({ kit, near: part.near ?? null });
    shadowAt.x = 1e9;
  }

  // 描く準備（シェーダーと画像の転送）を、少しずつ済ませる
  async function warm(kit) {
    const textures = new Set();
    kit.group.traverse((object) => {
      const mat = object.material;
      if (mat) for (const key of ["map", "bumpMap", "emissiveMap"]) if (mat[key]) textures.add(mat[key]);
    });
    let count = 0;
    for (const texture of textures) {
      renderer.initTexture(texture);
      count += 1;
      if (count % 4 === 0) await breathe();
    }
    await renderer.compileAsync?.(kit.group, camera, scene).catch(() => {});
  }

  async function loadPart(part, mine, onStep) {
    const kit = await createKit({ models: part.models, images: part.images, parent: root, onStep });
    if (mine !== ticket) {
      kit.group.removeFromParent();
      kit.release();
      return null;
    }
    kit.group.visible = false;
    await breathe();
    part.build(kit, api);
    adopt(part, kit);
    await breathe();
    await warm(kit);
    if (mine !== ticket) return null;
    kit.group.visible = true;
    shadowAt.x = 1e9;
    return kit;
  }

  function close() {
    ticket += 1;
    setStance(null);
    parts.forEach(({ kit }) => {
      kit.group.removeFromParent();
      kit.release();
    });
    parts = [];
    for (const list of [areas, spots, portals, stops, zones, emitters]) list.length = 0;
    pool.forEach((slot) => Object.assign(slot, { emitter: null, level: 0, leaving: false }));
    pool.forEach(({ light }) => {
      light.intensity = 0;
    });
    solids = createSolids();
    pending = 0;
    region = null;
  }

  // 土地を開く。core が組み上がったら返る。onProgress(0〜1, 今していること)
  async function open(id, onProgress = () => {}) {
    close();
    const mine = ticket;
    region = id;
    const definition = REGIONS[id];
    const core = definition.parts.filter((part) => part.core);
    const rest = definition.parts.filter((part) => !part.core);
    if (!dome) {
      const base = await createKit({ models: [], images: [], parent: root });
      dome = base.sky({ top: "#232a6a", horizon: "#c07a90", stars: 1, milky: 0.01, clouds: 0.5, sun: [0, 0, 1] });
      base.keep = true;
      skyKit = base;
    }
    applyLook();
    const total = core.reduce((sum, part) => sum + part.models.length + part.images.length, 0);
    let done = 0;
    for (const [index, part] of core.entries()) {
      await loadPart(part, mine, () => {
        done += 1;
        onProgress(Math.min(0.96, (done / Math.max(1, total)) * 0.9 + (index / core.length) * 0.06), "道をつくっています");
      });
      if (mine !== ticket) return false;
      await breathe();
    }
    onProgress(1, "まもなく到着します");
    pending = rest.length;
    streamRest(rest, mine);
    return true;
  }
  let skyKit = null;

  // 残りの部品を、歩いている間に 1 つずつ足す。終わったら、ほかの土地の素材も取っておく
  async function streamRest(rest, mine) {
    for (const part of rest) {
      await idle();
      if (mine !== ticket) return;
      try {
        await loadPart(part, mine);
      } catch (error) {
        console.error(error);
      }
      if (mine !== ticket) return;
      pending -= 1;
    }
    const saving = navigator.connection?.saveData;
    if (saving || LIGHT_MODE) return;
    for (const other of Object.keys(REGIONS)) {
      if (other === region) continue;
      await prefetch(other, () => mine === ticket);
    }
  }

  // 素材のファイルだけを、少しずつ取っておく（ブラウザーのキャッシュに入る）
  const fetched = new Set();
  async function prefetch(id, alive = () => true) {
    for (const part of REGIONS[id].parts) {
      for (const url of assetUrls(part.models, part.images)) {
        if (fetched.has(url)) continue;
        await idle();
        if (!alive()) return;
        fetched.add(url);
        await preloadAssets(url);
      }
    }
  }

  /* ---------------- 毎フレーム ---------------- */

  function update(delta, now, wind) {
    time = now;
    if (!root.visible || !region || !dome) return;
    skyKit.update(delta, now, wind);
    const { x, y, z } = walker.body;
    for (const { kit, near } of parts) {
      if (near) {
        const visible = Math.hypot(x - near.x, z - near.z) < near.r;
        if (visible !== kit.group.visible) {
          kit.group.visible = visible;
          shadowAt.x = 1e9;
        }
      }
      if (kit.group.visible) kit.update(delta, now, wind);
    }
    for (const zone of zones) {
      const visible = zone.test(walker.body);
      if (visible !== zone.group.visible) {
        zone.group.visible = visible;
        shadowAt.x = 1e9;
      }
    }
    updateLights(delta);
    place.outdoor = indoors() ? 0 : LOOKS[region].outdoor;
    dome.position.set(x, y + 1.5, z);
    if (!stance) updateShadow();
  }

  // 着いたとき：写り込みを撮る
  function arrive() {
    applyLook();
    capture(tmp.set(walker.body.x, walker.body.y + 1.6, walker.body.z).multiplyScalar(SCALE).clone());
    shadowAt.x = 1e9;
  }

  // 煙草を吸う姿勢：座る所の目の位置を、いつもの視点に重ねる
  const eyeAt = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
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
    if (region) updateShadow(true);
  }

  function setVisible(visible) {
    root.visible = visible;
    ownLights.forEach((light) => {
      light.visible = visible;
    });
    shadowAt.x = 1e9;
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
    areas,
    atlas,
    regions: REGIONS,
    open,
    close,
    prefetch,
    arrive,
    update,
    setStance,
    setVisible,
    release() {},
    get stance() {
      return stance;
    },
    get pending() {
      return pending;
    },
    // いまの場所（いつもの視点の座標での、机の上の位置）
    get spot() {
      const spot = stance ?? { eye: 1.5, table: { y: 1, item: [0, -1.2], phone: [0.2, -1.2], chillTray: [0, -1.2] } };
      const at = (x, z, y) => new THREE.Vector3(x, y - spot.eye, z).multiplyScalar(SCALE).add(EYE);
      const { y, tray, chillTray, item, phone } = spot.table;
      return { item: at(item[0], item[1], y), phone: at(phone[0], phone[1], y), tray: { challenge: at(...(tray ?? chillTray), y), chill: at(...chillTray, y) } };
    },
    get region() {
      return region;
    },
    cars: () => parts.find(({ kit }) => kit.cars)?.kit.cars,
  };
}
