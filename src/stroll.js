import * as THREE from "three";
import { SCALE } from "./three/world/kit.js";
import { createTravel } from "./travel.js";

/*
 * ぶらり喫煙の旅。一人称で地図を歩き、灰皿のある所で一服する。
 *   歩く → 灰皿のそばで「一服する」→ 火のつけ方を選ぶ → 腰を下ろす（点火からは main.js）→ 立ち上がる
 * 土地から土地へは電車かバスで移る。移動の間（読み込みの間）は、車窓の画面を出す。
 */

const WALK = 3.1; // m/秒
const RUN = 6.2;
const EYE_HEIGHT = 1.56;
const REACH = { spot: 2.5, portal: 1.9, stop: 2.6 };
const LOOK_SPEED = 0.0021;
const TOUCH_LOOK = 0.0052;
const STORAGE = "windproof-stroll-visited";
const SIT_TIME = 0.75;
const SIT_PITCH = -Math.atan2(0.4, 8.2); // いつもの視点の、少し下を向いた角度

const TOOL_CARDS = [
  { id: "lighter", label: "ライター", note: "擦り下ろして、レバーを押す" },
  { id: "boxMatch", label: "箱マッチ", note: "光る所を、短く擦る" },
  { id: "paperMatch", label: "紙マッチ", note: "両手で持って、軽く擦る" },
];

// 一服したときの、ひとりごと
const LINES = {
  home: "……うん。やっぱり、ここの夕焼けはいいな。",
  konbini: "店の灯りって、なんでこう落ち着くんだろうな。",
  roof: "風が強いな。街が、ぜんぶ下にある。",
  kissaten: "コーヒーの匂いと煙。時間が止まってるみたいだ。",
  station: "みんな、急いでるなぁ。",
  park: "子どもの頃は、このブランコも大きかったのに。",
  alley: "だしの匂いがしてきた。……あとで寄るか。",
  camp: "火のそばで、火をつける。ぜいたくだ。",
  pier: "星が、水にも映ってる。",
  picnic: "木の匂いがする。空気がうまいと、煙もうまい。",
  harbor: "釣れても釣れなくても、まあ、いいか。",
  lighthouse: "海の果てって、どこまで行っても見えないもんだな。",
  fishery: "猫が、魚を待ってる。おれは火を待ってる。",
  engawa: "雪の音がする。……いや、音がしないのか。",
  ashiyu: "足が溶けそうだ。もう動けん。",
  teahouse: "トンネルを抜けたら、別の世界だったな。",
};

const REGION_NAMES = { town: "都会", lake: "湖のキャンプ場", port: "風見漁港", inn: "雪見の宿" };
// 乗り物の行き先。線路は街・港・旅館、バスは街と湖をつなぐ
const LINES_OUT = { train: ["town", "port", "inn"], bus: ["town", "lake"] };
const STATION = { town: "風見駅", port: "風見漁港駅", inn: "雪見温泉駅", lake: "湖のキャンプ場" };
const SPOTS_IN = { town: 7, lake: 3, port: 3, inn: 3 }; // 土地ごとの喫煙所の数
const RIDE_TIME = 3400; // 車窓を見せる、短くてもこれだけ（ミリ秒）
// 喫煙所の名前と土地（地図の一覧用）
const SPOT_NAMES = {
  home: "自宅のベランダ", konbini: "コンビニ前", kissaten: "純喫茶 ゆらぎ", station: "駅前の喫煙所", park: "公園のベンチ", alley: "路地裏の屋台", roof: "ビルの屋上",
  camp: "焚き火の前", pier: "湖の桟橋", picnic: "林のピクニック台",
  harbor: "岸壁の釣り座", lighthouse: "灯台の下", fishery: "番屋の前",
  engawa: "旅館の縁側", ashiyu: "足湯", teahouse: "門前の茶屋",
};
const REGION_OF = Object.fromEntries(
  Object.entries({ town: ["home", "konbini", "kissaten", "station", "park", "alley", "roof"], lake: ["camp", "pier", "picnic"], port: ["harbor", "lighthouse", "fishery"], inn: ["engawa", "ashiyu", "teahouse"] }).flatMap(([region, list]) => list.map((id) => [id, region])),
);
const AMBIENCE = { town: "city", lake: "camp", port: "harbor", inn: "engawa" };

export function createStroll({ scene, camera, renderer, environment, container, touch, sfx, keys, toast, lockPointer, unlockPointer, onSmoke, onLeaveSeat, spotCount = 16 }) {
  let world = null;
  let active = false;
  let mode = "walk"; // walk | menu | sit（座る・立つ途中）| seated
  let yaw = 0;
  let pitch = 0;
  let bob = 0;
  let stepLeft = 0;
  let target = null;
  let before = null; // 座る前の位置
  let moveTo = null; // 座る・立つ動き
  let region = null;
  let placeLabel = "";
  const visited = new Set(readVisited());
  const look = { x: 0, y: 0 };
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const fromQuat = new THREE.Quaternion();
  const toQuat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  /* ---------------- 画面 ---------------- */

  const root = document.createElement("div");
  root.className = "stroll-ui";
  root.hidden = true;
  root.innerHTML = `
    <span class="stroll-dot" aria-hidden="true"></span>
    <div class="stroll-place" aria-live="polite"><small></small><strong></strong></div>
    <span class="stroll-stream" hidden>読み込み中…</span>
    <div class="stroll-stamps" aria-label="一服した喫煙所"><b>0</b> / ${spotCount} <small>喫煙所</small></div>
    <button class="stroll-prompt" type="button" hidden><kbd>E</kbd><span></span></button>
    <div class="stroll-buttons only-touch"><button type="button" data-stroll="map">地図</button></div>
    <div class="stroll-menu" role="dialog" aria-modal="true" hidden><div class="stroll-panel"><p class="eyebrow"></p><h3></h3><div class="stroll-cards"></div><button class="ghost-button stroll-cancel" type="button">やめる <kbd>Esc</kbd></button></div></div>
    <div class="stroll-map" role="dialog" aria-label="地図" hidden><div class="stroll-panel"><p class="eyebrow">MAP</p><h3>喫煙所めぐり</h3><div class="stroll-map-body"><canvas width="760" height="560"></canvas><ul class="stroll-list"></ul></div><p class="stroll-legend"><i class="done"></i>一服した　<i class="seen"></i>見つけた　<span>灰皿のある所で吸えます</span></p><button class="ghost-button stroll-cancel" type="button">閉じる <kbd>M</kbd></button></div></div>
    <div class="stroll-fade" aria-hidden="true"></div>`;
  container.append(root);
  const travel = createTravel(document.body);
  const $ = (selector) => root.querySelector(selector);
  const prompt = $(".stroll-prompt");
  const promptText = prompt.querySelector("span");
  const menu = $(".stroll-menu");
  const map = $(".stroll-map");
  const fade = $(".stroll-fade");
  prompt.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    interact();
  });
  menu.querySelector(".stroll-cancel").addEventListener("click", closeMenu);
  map.querySelector(".stroll-cancel").addEventListener("click", closeMenu);
  $("[data-stroll=map]").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openMap();
  });

  function readVisited() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) ?? "[]");
    } catch {
      return [];
    }
  }
  const seen = new Set(visited);

  function renderStamps() {
    $(".stroll-stamps b").textContent = String(visited.size);
  }

  /* ---------------- 出入り ---------------- */

  // 地図の本体は、旅に出るときに初めて読み込む
  async function ensureWorld() {
    if (!world) {
      const { createStrollWorld } = await import("./three/stroll/world.js");
      world ??= createStrollWorld({ scene, camera, renderer, capture: (eye) => environment.capture(eye, { blur: false }) });
    }
    return world;
  }

  // タイトル画面にいる間に、街の素材を静かに取っておく
  let prefetching = false;
  async function prefetch() {
    if (prefetching || active || navigator.connection?.saveData) return;
    prefetching = true;
    await ensureWorld();
    await world.prefetch("town", () => !active);
  }

  async function enter() {
    travel.show({ vehicle: "home", to: "town", title: "ぶらり喫煙の旅" });
    try {
      await ensureWorld();
      const opened = await openRegion("town", world.regions.town.start);
      if (!opened) return false;
    } catch (error) {
      travel.cancel();
      throw error;
    }
    root.hidden = false;
    renderStamps();
    await travel.hide(1400);
    return true;
  }

  // 土地を開いて、そこに立つ
  async function openRegion(id, start) {
    mode = "sit";
    active = true;
    region = null;
    environment.setExternal(world);
    world.setVisible(true);
    const opened = await world.open(id, travel.progress);
    if (!opened || !active) return false;
    world.walker.place(...start.at);
    yaw = start.yaw;
    pitch = -0.04;
    applyCamera(0);
    world.arrive();
    mode = "walk";
    return true;
  }

  function leave() {
    if (!active) return;
    active = false;
    travel.cancel();
    closeMenu();
    root.hidden = true;
    root.classList.remove("is-seated");
    world.close();
    world.setVisible(false);
    moveTo = null;
    target = null;
  }

  function fadeThrough(action) {
    mode = "sit";
    fade.classList.add("is-dark");
    setTimeout(() => {
      if (!active) return;
      action();
      fade.classList.remove("is-dark");
    }, 320);
  }

  /* ---------------- 歩く ---------------- */

  function applyCamera(lift) {
    const { x, y, z } = world.walker.body;
    camera.position.set(x, y + EYE_HEIGHT + lift, z).multiplyScalar(SCALE);
    camera.quaternion.setFromEuler(euler.set(pitch, yaw, 0));
    camera.updateMatrixWorld(true);
  }

  function walk(delta) {
    const held = (code) => Number(keys.has(code));
    let forward = held("KeyW") - held("KeyS") + held("ArrowUp") - held("ArrowDown") - touch.stickY;
    let strafe = held("KeyD") - held("KeyA") + held("ArrowRight") - held("ArrowLeft") + touch.stickX;
    const length = Math.hypot(forward, strafe);
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }
    const running = keys.has("Shift") || (touch.active && length > 0.94);
    const speed = running ? RUN : WALK;
    yaw -= look.x;
    pitch = THREE.MathUtils.clamp(pitch - look.y, -1.25, 1.25);
    look.x = 0;
    look.y = 0;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const vx = (-sin * forward + cos * strafe) * speed;
    const vz = (-cos * forward - sin * strafe) * speed;
    const { body, move } = world.walker;
    move(vx, vz, delta);
    bob += body.moved * (running ? 1.9 : 2.3);
    stepLeft -= body.moved;
    if (body.moved > 0.001 && stepLeft <= 0) {
      stepLeft = running ? 1.35 : 0.82;
      sfx.step(body.surface, running);
    }
    applyCamera(Math.sin(bob * 2) * 0.018 * Math.min(1, length));
  }

  // 手の届く所にある、いちばん近い物
  const facing = { x: 0, z: 0 };
  function findTarget() {
    const { x, y, z } = world.walker.body;
    facing.x = -Math.sin(yaw);
    facing.z = -Math.cos(yaw);
    let best = null;
    let score = Infinity;
    const consider = (entry, kind, at, label) => {
      const dx = at[0] - x;
      const dz = at[2] - z;
      const distance = Math.hypot(dx, dz);
      if (distance > REACH[kind] || Math.abs(at[1] - y) > 1.4) return;
      const ahead = distance < 0.7 ? 1 : (dx * facing.x + dz * facing.z) / distance;
      if (ahead < 0.15) return;
      const value = distance - ahead * 0.8 - (kind === "spot" ? 0.4 : 0);
      if (value < score) {
        score = value;
        best = { entry, kind, label };
      }
    };
    for (const spot of world.spots) {
      const [tx, tz] = spot.table.chillTray;
      const sin = Math.sin(spot.yaw);
      const cos = Math.cos(spot.yaw);
      const tray = [spot.at[0] + cos * tx + sin * tz, spot.at[1], spot.at[2] - sin * tx + cos * tz];
      spot.trayAt = tray;
      consider(spot, "spot", spot.at, `${spot.name}で一服する`);
      consider(spot, "spot", tray, `${spot.name}で一服する`);
      if (!seen.has(spot.id) && Math.hypot(spot.at[0] - x, spot.at[2] - z) < 11 && Math.abs(spot.at[1] - y) < 3) {
        seen.add(spot.id);
        if (!visited.has(spot.id)) toast(`灰皿を見つけた：${spot.name}`, "info");
      }
    }
    for (const portal of world.portals) consider(portal, "portal", portal.at, portal.label);
    for (const stop of world.stops) consider(stop, "stop", stop.at, stop.kind === "train" ? "電車に乗る" : "バスに乗る");
    return best;
  }

  function renderPrompt() {
    prompt.hidden = !target || mode !== "walk";
    if (target) promptText.textContent = target.label;
  }

  function renderPlace() {
    const name = world.region;
    if (name !== region) {
      region = name;
      sfx.setAmbience(AMBIENCE[name]);
      const label = $(".stroll-place");
      label.querySelector("small").textContent = "ぶらり喫煙の旅";
      label.querySelector("strong").textContent = REGION_NAMES[name];
      label.classList.remove("is-shown");
      void label.offsetWidth;
      label.classList.add("is-shown");
    }
    placeLabel = REGION_NAMES[name];
    const stream = $(".stroll-stream");
    stream.hidden = world.pending === 0;
  }

  /* ---------------- 調べる・メニュー ---------------- */

  function interact() {
    if (mode !== "walk" || !target) return;
    const { entry, kind } = target;
    if (kind === "portal") {
      sfx[entry.sound === "elevator" ? "elevator" : "door"]?.();
      fadeThrough(() => {
        world.walker.place(...entry.to.at);
        yaw = entry.to.yaw;
        pitch = 0;
        mode = "walk";
      });
    } else if (kind === "stop") openLines(entry);
    else openTools(entry);
  }

  function openMenu(kicker, title, cards, choose) {
    mode = "menu";
    unlockPointer();
    menu.querySelector(".eyebrow").textContent = kicker;
    menu.querySelector("h3").textContent = title;
    const list = menu.querySelector(".stroll-cards");
    list.replaceChildren(
      ...cards.map((card, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stroll-card";
        button.dataset.card = card.id;
        button.innerHTML = `<kbd>${index + 1}</kbd><strong>${card.label}</strong><small>${card.note ?? ""}</small>`;
        button.addEventListener("click", () => {
          closeMenu({ relock: true });
          choose(card);
        });
        return button;
      }),
    );
    menu.hidden = false;
    renderPrompt();
  }

  function closeMenu({ relock = false } = {}) {
    const open = !menu.hidden || !map.hidden;
    menu.hidden = true;
    map.hidden = true;
    if (mode === "menu") mode = world?.stance ? "seated" : "walk";
    if (open && (relock || !touch.active) && active) lockPointer();
  }

  function openTools(spot) {
    openMenu("火のつけ方を選ぶ", `${spot.name}で一服`, TOOL_CARDS, (card) => {
      sitDown(spot, () => onSmoke(spot, card.id));
    });
  }

  // 行き先を選んで、乗る
  function openLines(stop) {
    const here = world.region;
    const cards = LINES_OUT[stop.kind].filter((id) => id !== here).map((id) => ({ id, label: stop.kind === "train" ? STATION[id] : REGION_NAMES[id], note: `${REGION_NAMES[id]}　一服 ${countIn(id)} / ${SPOTS_IN[id]}` }));
    openMenu(stop.kind === "train" ? "電車" : "バス", "どこへ行く？", cards, (card) => ride(stop.kind, card.id));
  }

  async function ride(vehicle, id) {
    mode = "sit";
    renderPrompt();
    sfx.setAmbience(null);
    sfx[vehicle === "train" ? "train" : "bus"]();
    travel.show({ vehicle, to: id, title: vehicle === "train" ? `次は　${STATION[id]}` : `次は　${REGION_NAMES[id]}` });
    const from = world.region;
    try {
      const arrival = world.regions[id][vehicle];
      if (!(await openRegion(id, arrival))) return;
    } catch (error) {
      console.error(error);
      toast("乗り物が止まってしまった。元の場所へ戻ります", "danger");
      if (!(await openRegion(from, world.regions[from].train ?? world.regions[from].bus ?? world.regions[from].start))) return;
    }
    await travel.hide(RIDE_TIME);
  }

  const countIn = (id) => [...visited].filter((spot) => REGION_OF[spot] === id).length;

  /* ---------------- 地図 ---------------- */

  function openMap() {
    if (mode !== "walk") return;
    mode = "menu";
    unlockPointer();
    map.hidden = false;
    renderPrompt();
    map.querySelector("h3").textContent = `${REGION_NAMES[world.region]}の地図`;
    drawMap();
    // 喫煙所の一覧（まだ見つけていない所は伏せておく）
    const list = map.querySelector(".stroll-list");
    list.replaceChildren(
      ...Object.keys(REGION_NAMES).map((id) => {
        const item = document.createElement("li");
        const names = Object.keys(REGION_OF).filter((spot) => REGION_OF[spot] === id);
        item.innerHTML = `<b>${REGION_NAMES[id]} <small>${countIn(id)} / ${SPOTS_IN[id]}</small></b>`;
        names.forEach((spot) => {
          const row = document.createElement("span");
          row.className = visited.has(spot) ? "done" : seen.has(spot) ? "seen" : "";
          row.textContent = visited.has(spot) || seen.has(spot) ? SPOT_NAMES[spot] : "？？？";
          item.append(row);
        });
        return item;
      }),
    );
  }

  // いまいる土地の地図：歩ける所と、見つけた喫煙所
  function drawMap() {
    const canvas = map.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const flat = world.areas.filter((area) => !area.indoor && !(typeof area.y === "number" && area.y > 15));
    const box = { x0: Math.min(...flat.map((a) => a.x[0])), x1: Math.max(...flat.map((a) => a.x[1])), z0: Math.min(...flat.map((a) => a.z[0])), z1: Math.max(...flat.map((a) => a.z[1])) };
    const pad = 46;
    const scale = Math.min((canvas.width - pad * 2) / (box.x1 - box.x0), (canvas.height - pad * 2) / (box.z1 - box.z0));
    const px = (x) => canvas.width / 2 + (x - (box.x0 + box.x1) / 2) * scale;
    const pz = (z) => canvas.height / 2 + (z - (box.z0 + box.z1) / 2) * scale;
    const colors = { town: ["#131620", "#3a3854"], lake: ["#0c1a2c", "#2c3a30"], port: ["#17384e", "#7a7a76"], inn: ["#22304a", "#8fa2c0"] }[world.region];
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const area of flat) {
      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.roundRect(px(area.x[0]), pz(area.z[0]), (area.x[1] - area.x[0]) * scale, (area.z[1] - area.z[0]) * scale, 6);
      ctx.fill();
    }
    // 建物や大きな物
    ctx.fillStyle = "rgba(10,12,18,0.42)";
    for (const solid of world.walls()) {
      ctx.save();
      ctx.translate(px(solid.x), pz(solid.z));
      ctx.rotate(-Math.atan2(solid.s, solid.c));
      ctx.fillRect(-solid.hx * scale, -solid.hz * scale, solid.hx * 2 * scale, solid.hz * 2 * scale);
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.font = "600 13px sans-serif";
    for (const stop of world.stops) {
      ctx.fillStyle = "#8fd0ff";
      ctx.fillRect(px(stop.at[0]) - 5, pz(stop.at[2]) - 5, 10, 10);
      ctx.fillText(stop.kind === "train" ? "駅" : "バス停", px(stop.at[0]), pz(stop.at[2]) - 9);
    }
    for (const spot of world.spots) {
      if (!seen.has(spot.id)) continue;
      const done = visited.has(spot.id);
      ctx.fillStyle = done ? "#ffb35a" : "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(px(spot.at[0]), pz(spot.at[2]), done ? 8 : 6, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#f6f2e8";
      ctx.fillText(spot.name, px(spot.at[0]), pz(spot.at[2]) - 12);
    }
    const { x, z } = world.walker.body;
    ctx.save();
    ctx.translate(px(x), pz(z));
    ctx.rotate(-yaw);
    ctx.fillStyle = "#c4e49a";
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 9);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 座る・立つ ---------------- */

  function tween(position, quaternion, done) {
    from.copy(camera.position);
    fromQuat.copy(camera.quaternion);
    to.copy(position);
    toQuat.copy(quaternion);
    moveTo = { t: 0, done };
    mode = "sit";
  }

  const seatPosition = new THREE.Vector3();
  const seatQuat = new THREE.Quaternion();
  function sitDown(spot, done) {
    const { body } = world.walker;
    before = { x: body.x, y: body.y, z: body.z, yaw, pitch };
    seatPosition.set(spot.at[0], spot.at[1] + spot.eye, spot.at[2]).multiplyScalar(SCALE);
    seatQuat.setFromEuler(euler.set(SIT_PITCH, spot.yaw, 0));
    renderPrompt();
    tween(seatPosition, seatQuat, () => {
      // 地図のほうを動かして、座った目の位置をいつもの視点に重ねる
      world.setStance(spot);
      environment.capture();
      mode = "seated";
      root.classList.add("is-seated");
      done();
    });
  }

  function standUp() {
    if (!world?.stance) return;
    const spot = world.stance;
    world.setStance(null);
    root.classList.remove("is-seated");
    camera.position.set(spot.at[0], spot.at[1] + spot.eye, spot.at[2]).multiplyScalar(SCALE);
    camera.quaternion.setFromEuler(euler.set(SIT_PITCH, spot.yaw, 0));
    environment.capture(camera.position.clone(), { blur: false });
    world.walker.place(before.x, before.y, before.z);
    yaw = spot.yaw;
    pitch = 0;
    to.set(before.x, before.y + EYE_HEIGHT, before.z).multiplyScalar(SCALE);
    tween(to.clone(), seatQuat.setFromEuler(euler.set(0, yaw, 0)), () => {
      mode = "walk";
    });
  }

  // 一服できた（火がついた）とき
  function stamp(spot) {
    const first = !visited.has(spot.id);
    visited.add(spot.id);
    seen.add(spot.id);
    try {
      localStorage.setItem(STORAGE, JSON.stringify([...visited]));
    } catch {
      // 保存できなくても続けられる
    }
    renderStamps();
    if (first) toast(visited.size >= spotCount ? "すべての喫煙所で一服した！" : `${spot.name}で一服（${visited.size} / ${spotCount}）`, "good");
    return LINES[spot.id] ?? "……ふぅ。";
  }

  // 吸い終わったあと
  function afterSmoke() {
    const spot = world.stance;
    if (!spot) return;
    openMenu("一服", "もう一本？", [...TOOL_CARDS.map((card) => ({ ...card, label: `${card.label}でもう一本` })), { id: "stand", label: "立ち上がる", note: "また歩く" }], (card) => {
      if (card.id === "stand") onLeaveSeat();
      else onSmoke(spot, card.id);
    });
  }

  /* ---------------- 入力・毎フレーム ---------------- */

  function onKey(code) {
    if (travel.active) return true;
    if (!menu.hidden || !map.hidden) {
      if (code === "Escape" || (code === "KeyM" && !map.hidden)) {
        if (!menu.hidden && mode === "menu" && world.stance) return true; // 吸い終わりの選択は、どれかを選ぶ
        closeMenu();
        return true;
      }
      const index = Number(code.replace(/^(Digit|Numpad)/, "")) - 1;
      if (!menu.hidden && index >= 0) menu.querySelectorAll(".stroll-card")[index]?.click();
      return true;
    }
    if (mode !== "walk") return false;
    if (code === "KeyE" || code === "Enter") interact();
    else if (code === "KeyM") openMap();
    else return false;
    return true;
  }

  function addLook(dx, dy, isTouch) {
    if (mode !== "walk" || travel.active) return;
    const speed = isTouch ? TOUCH_LOOK : LOOK_SPEED;
    look.x += dx * speed;
    look.y += dy * speed;
  }

  function update(delta) {
    if (moveTo) {
      moveTo.t = Math.min(1, moveTo.t + delta / SIT_TIME);
      const t = moveTo.t * moveTo.t * (3 - 2 * moveTo.t);
      camera.position.lerpVectors(from, to, t);
      camera.quaternion.slerpQuaternions(fromQuat, toQuat, t);
      camera.updateMatrixWorld(true);
      if (moveTo.t >= 1) {
        const { done } = moveTo;
        moveTo = null;
        done();
      }
      return;
    }
    if (mode === "walk") {
      walk(delta);
      target = findTarget();
      renderPrompt();
      renderPlace();
      slowCars();
    }
  }

  // 車は、前に人がいたら止まる
  function slowCars() {
    const cars = world.cars();
    if (!cars) return;
    const { x, z } = world.walker.body;
    for (const car of cars) {
      const ahead = (x - car.holder.position.x) * car.dir;
      const blocked = Math.abs(z - car.holder.position.z) < 1.9 && ahead > -2.6 && ahead < 8;
      car.velocity += ((blocked ? 0 : car.speed) - car.velocity) * 0.08;
    }
  }

  return {
    enter,
    leave,
    prefetch,
    update,
    onKey,
    addLook,
    interact,
    sitDown,
    standUp,
    stamp,
    afterSmoke,
    openMap,
    closeMenu,
    get active() {
      return active;
    },
    get mode() {
      return mode;
    },
    get menuOpen() {
      return !menu.hidden || !map.hidden;
    },
    // 移動（読み込み）中
    get travelling() {
      return travel.active;
    },
    ride,
    get label() {
      return placeLabel;
    },
    get world() {
      return world;
    },
    get target() {
      return target;
    },
    // 動作確認用
    warp(x, y, z, toYaw = yaw, toPitch = 0) {
      world.walker.place(x, y, z);
      yaw = toYaw;
      pitch = toPitch;
      mode = "walk";
    },
    get visited() {
      return visited;
    },
  };
}
