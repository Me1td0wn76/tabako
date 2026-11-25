import * as THREE from "three";
import { SCALE } from "./three/world/kit.js";
import { createStrollWorld } from "./three/stroll/world.js";

/*
 * ぶらり喫煙の旅。一人称で地図を歩き、灰皿のある所で一服する。
 *   歩く → 灰皿のそばで「一服する」→ 火のつけ方を選ぶ → 腰を下ろす（点火からは main.js）→ 立ち上がる
 */

const WALK = 3.1; // m/秒
const RUN = 6.2;
const EYE_HEIGHT = 1.56;
const REACH = { spot: 2.5, portal: 1.9, stop: 2.3 };
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
    <div class="stroll-stamps" aria-label="一服した喫煙所"><b>0</b> / ${spotCount} <small>喫煙所</small></div>
    <button class="stroll-prompt" type="button" hidden><kbd>E</kbd><span></span></button>
    <div class="stroll-buttons only-touch"><button type="button" data-stroll="map">地図</button></div>
    <div class="stroll-menu" role="dialog" aria-modal="true" hidden><div class="stroll-panel"><p class="eyebrow"></p><h3></h3><div class="stroll-cards"></div><button class="ghost-button stroll-cancel" type="button">やめる <kbd>Esc</kbd></button></div></div>
    <div class="stroll-map" role="dialog" aria-label="地図" hidden><div class="stroll-panel"><p class="eyebrow">MAP</p><h3>喫煙所めぐり</h3><canvas width="900" height="560"></canvas><p class="stroll-legend"><i class="done"></i>一服した　<i class="seen"></i>見つけた　<span>灰皿のある所で吸えます</span></p><button class="ghost-button stroll-cancel" type="button">閉じる <kbd>M</kbd></button></div></div>
    <div class="stroll-fade" aria-hidden="true"></div>`;
  container.append(root);
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

  async function enter() {
    world ??= createStrollWorld({ scene, renderer, capture: (eye) => environment.capture(eye, { blur: false }) });
    await world.prepare();
    environment.setExternal(world);
    world.setVisible(true);
    active = true;
    mode = "walk";
    region = null;
    root.hidden = false;
    renderStamps();
    world.walker.place(18, 6, 48.6);
    yaw = Math.PI;
    pitch = -0.06;
    applyCamera(0);
    fadeFrom();
  }

  function leave() {
    if (!active) return;
    active = false;
    closeMenu();
    root.hidden = true;
    world.setVisible(false);
    moveTo = null;
    target = null;
  }

  function fadeFrom() {
    fade.classList.add("is-dark");
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove("is-dark")));
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
    for (const stop of world.stops) consider(stop, "stop", stop.at, "バスに乗る");
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
    } else if (kind === "stop") openBus(entry);
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

  function openBus(stop) {
    const cards = world.stops.filter((entry) => entry.id !== stop.id).map((entry) => ({ id: entry.id, label: entry.name, entry }));
    // まだ行っていない土地へも、バスで行ける
    for (const id of ["town", "lake", "port", "inn"]) {
      if (id !== stop.id && !cards.some((card) => card.id === id)) cards.push({ id, label: REGION_NAMES[id], entry: null });
    }
    openMenu("バス停", "どこへ行く？", cards, (card) => {
      mode = "sit";
      sfx.bus();
      fade.classList.add("is-dark");
      const arrive = () => {
        if (!active) return;
        const entry = world.stops.find((item) => item.id === card.id);
        if (entry) {
          world.walker.place(...entry.to.at);
          yaw = entry.to.yaw;
          pitch = 0;
        }
        mode = "walk";
        setTimeout(() => fade.classList.remove("is-dark"), 250);
      };
      Promise.all([world.ensure(card.id), new Promise((resolve) => setTimeout(resolve, 1500))]).then(arrive, () => {
        toast("バスが来なかった。もう一度試して", "danger");
        mode = "walk";
        fade.classList.remove("is-dark");
      });
    });
  }

  /* ---------------- 地図 ---------------- */

  const MAP = { x: [-240, 236], z: [-232, 72] };
  const ROADS_ON_MAP = [[-64, 0, 64, 0, 7], [-182, 0, -64, 0, 4], [64, 0, 158, 0, 4], [0, -62, 0, 58, 5], [0, -138, 0, -62, 4], [0, -166, 0, -138, 3], [-60, -34, 38, -34, 3], [-36, 7, -36, 56, 3], [-34, 39, 62, 39, 3], [146, -14, 208, -14, 3], [158, 16, 224, 16, 5]];
  const AREAS_ON_MAP = [["#3a3550", -66, -62, 132, 122, "都会"], ["#22352c", -206, -26, 56, 52, "湖のキャンプ場"], ["#1f3c58", 124, -30, 40, 60, "風見漁港"], ["#3c4a64", -18, -190, 36, 60, "雪見の宿"]];

  function openMap() {
    if (mode !== "walk") return;
    mode = "menu";
    unlockPointer();
    map.hidden = false;
    renderPrompt();
    drawMap();
  }

  function drawMap() {
    const canvas = map.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const scale = Math.min(canvas.width / (MAP.x[1] - MAP.x[0]), canvas.height / (MAP.z[1] - MAP.z[0]));
    const px = (x) => (x - MAP.x[0]) * scale + (canvas.width - (MAP.x[1] - MAP.x[0]) * scale) / 2;
    const pz = (z) => (z - MAP.z[0]) * scale;
    ctx.fillStyle = "#101a20";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#12304a";
    ctx.fillRect(px(163), 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, px(-199), canvas.height);
    ctx.textAlign = "center";
    for (const [color, x, z, w, h, label] of AREAS_ON_MAP) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px(x), pz(z), w * scale, h * scale, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "600 15px sans-serif";
      ctx.fillText(label, px(x + w / 2), pz(z) - 7);
    }
    ctx.strokeStyle = "rgba(225,232,238,0.42)";
    for (const [x0, z0, x1, z1, w] of ROADS_ON_MAP) {
      ctx.lineWidth = Math.max(2, w * scale * 0.8);
      ctx.beginPath();
      ctx.moveTo(px(x0), pz(z0));
      ctx.lineTo(px(x1), pz(z1));
      ctx.stroke();
    }
    for (const stop of world.stops) {
      ctx.fillStyle = "#8fd0ff";
      ctx.fillRect(px(stop.at[0]) - 4, pz(stop.at[2]) - 4, 8, 8);
    }
    ctx.font = "12px sans-serif";
    for (const spot of world.spots) {
      if (!seen.has(spot.id)) continue;
      const done = visited.has(spot.id);
      ctx.fillStyle = done ? "#ffb35a" : "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(px(spot.at[0]), pz(spot.at[2]), done ? 7 : 5, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#f4f0e6";
      ctx.fillText(spot.name, px(spot.at[0]), pz(spot.at[2]) - 11);
    }
    const { x, z } = world.walker.body;
    ctx.save();
    ctx.translate(px(x), pz(z));
    ctx.rotate(-yaw);
    ctx.fillStyle = "#c4e49a";
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
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
    if (mode !== "walk") return;
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
