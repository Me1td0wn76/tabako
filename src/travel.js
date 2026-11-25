/*
 * 移動中（読み込み中）の画面。車窓の景色を流しながら、進み具合を見せる。
 *   show({ vehicle, to, title })  vehicle = train | bus | home（旅の支度）
 */

const THEMES = {
  town: { sky: ["#1d2358", "#b8708c"], far: "#3a2f5c", mid: "city", midColor: "#1c1a34", light: "#ffd08a", ground: "#14131f", stars: 0.25 },
  port: { sky: ["#6ea6dc", "#f0c8a4"], far: "#8a8ea4", mid: "sea", midColor: "#4c7a96", light: "#fff2d8", ground: "#5c6a58", stars: 0 },
  lake: { sky: ["#050a1e", "#1f3564"], far: "#131f3a", mid: "forest", midColor: "#0c1620", light: "#ffc27a", ground: "#0a0f12", stars: 1 },
  inn: { sky: ["#0c1634", "#3a5c94"], far: "#4a5f88", mid: "snow", midColor: "#20304c", light: "#ffd09a", ground: "#c4d2e8", stars: 0.2, snow: true },
};

const TIPS = [
  "灰皿のある所が喫煙所。見つけたら E で一服できる。",
  "火のつけ方は、その場で選べる。ライター、箱マッチ、紙マッチ。",
  "M で地図。見つけた喫煙所と、一服した喫煙所がわかる。",
  "SHIFT を押しながら歩くと、少し急ぐ。",
  "吸い終わったら、灰皿でもみ消す。ポイ捨てはしない。",
  "街の喫煙所は、ビルの屋上や路地の奥にもある。",
  "遠くへは電車で。湖のキャンプ場へはバスで。",
];

const hash = (n) => {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
};

export function createTravel(container) {
  const root = document.createElement("div");
  root.className = "travel";
  root.hidden = true;
  root.innerHTML = `
    <canvas aria-hidden="true"></canvas>
    <div class="travel-text" role="status">
      <small></small>
      <strong></strong>
      <span class="travel-track"><i></i></span>
      <span class="travel-state"></span>
      <p class="travel-tip"></p>
    </div>`;
  container.append(root);
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const $ = (selector) => root.querySelector(selector);
  let view = null;
  let frame = 0;
  let started = 0;
  let shown = 0; // 表示している進み具合
  let goal = 0;

  function show({ vehicle, to, title }) {
    view = { vehicle, theme: THEMES[to] };
    started = performance.now();
    shown = 0;
    goal = 0;
    root.hidden = false;
    root.classList.remove("is-leaving");
    $("small").textContent = { train: "電車で移動中", bus: "バスで移動中", home: "旅の支度" }[vehicle];
    $("strong").textContent = title;
    $(".travel-state").textContent = "地図をひらいています";
    $(".travel-tip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    cancelAnimationFrame(frame);
    draw();
  }

  function progress(value, text) {
    goal = Math.max(goal, value);
    if (text) $(".travel-state").textContent = text;
  }

  // 最低でも少しは車窓を見せてから、消す
  async function hide(minimum = 0) {
    goal = 1;
    const wait = Math.max(0, minimum - (performance.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait + 180));
    root.classList.add("is-leaving");
    await new Promise((resolve) => setTimeout(resolve, 420));
    root.hidden = true;
    cancelAnimationFrame(frame);
    view = null;
  }

  function cancel() {
    root.hidden = true;
    cancelAnimationFrame(frame);
    view = null;
  }

  /* ---------------- 絵 ---------------- */

  function draw() {
    if (!view) return;
    frame = requestAnimationFrame(draw);
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    const W = Math.round(root.clientWidth * ratio);
    const H = Math.round(root.clientHeight * ratio);
    if (!W || !H) return;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const t = (performance.now() - started) / 1000;
    shown += (goal - shown) * 0.12;
    $(".travel-track i").style.transform = `scaleX(${Math.max(0.02, shown)})`;
    const { theme, vehicle } = view;
    const speed = vehicle === "home" ? 0 : Math.min(1, t / 1.2) * H * (vehicle === "train" ? 1.5 : 0.95);
    const travelled = vehicle === "home" ? 0 : speed * Math.max(0, t - 0.4);
    // 窓
    const frameBox = vehicle === "home" ? { x: 0, y: 0, w: W, h: H } : { x: W * 0.06, y: H * 0.09, w: W * 0.88, h: H * 0.58 };
    ctx.fillStyle = vehicle === "bus" ? "#20302a" : "#1b2026";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    if (vehicle === "home") ctx.rect(0, 0, W, H);
    else ctx.roundRect(frameBox.x, frameBox.y, frameBox.w, frameBox.h, H * 0.03);
    ctx.clip();
    scenery(theme, frameBox, travelled, t, H);
    ctx.restore();
    if (vehicle !== "home") cabin(frameBox, W, H, t, vehicle);
  }

  function scenery(theme, box, offset, t, H) {
    const horizon = box.y + box.h * 0.68;
    const sky = ctx.createLinearGradient(0, box.y, 0, horizon);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    if (theme.stars) {
      ctx.fillStyle = `rgba(255,255,255,${theme.stars})`;
      for (let i = 0; i < 90; i += 1) ctx.fillRect(box.x + hash(i) * box.w, box.y + hash(i + 200) * box.h * 0.5, 1 + hash(i + 90) * 1.6, 1 + hash(i + 90) * 1.6);
    }
    // 遠くの山
    ctx.fillStyle = theme.far;
    ctx.beginPath();
    ctx.moveTo(box.x, horizon);
    for (let x = 0; x <= box.w; x += 8) {
      const k = (x + offset * 0.06) / H;
      ctx.lineTo(box.x + x, horizon - H * (0.07 + 0.045 * Math.sin(k * 3.1) + 0.03 * Math.sin(k * 7.7 + 1)));
    }
    ctx.lineTo(box.x + box.w, horizon);
    ctx.fill();
    // 中くらいの景色
    const cell = H * (theme.mid === "city" ? 0.13 : 0.07);
    const shift = offset * 0.32;
    if (theme.mid === "sea") {
      ctx.fillStyle = theme.midColor;
      ctx.fillRect(box.x, horizon - H * 0.03, box.w, H * 0.4);
      ctx.fillStyle = "rgba(255,240,215,0.5)";
      for (let i = 0; i < 70; i += 1) ctx.fillRect(box.x + ((hash(i) * box.w * 1.3 - shift * (0.3 + hash(i + 7) * 0.7)) % box.w + box.w) % box.w, horizon - H * 0.02 + hash(i + 40) * H * 0.2, 6 + hash(i + 3) * 18, 1.5);
      ctx.fillStyle = "#f2efe8";
      const boat = ((box.w * 1.2 - shift * 0.5) % (box.w * 1.5) + box.w * 1.5) % (box.w * 1.5) - box.w * 0.2;
      ctx.fillRect(box.x + boat, horizon + H * 0.03, H * 0.09, H * 0.016);
      ctx.fillRect(box.x + boat + H * 0.03, horizon + H * 0.006, H * 0.03, H * 0.026);
    } else {
      const first = Math.floor(shift / cell) - 1;
      for (let i = first; i < first + box.w / cell + 3; i += 1) {
        const x = box.x + i * cell - shift;
        const r = hash(i + 11);
        ctx.fillStyle = theme.midColor;
        if (theme.mid === "city") {
          const h = H * (0.06 + r * 0.2);
          ctx.fillRect(x, horizon - h, cell * 0.92, h + H * 0.02);
          ctx.fillStyle = theme.light;
          for (let k = 0; k < 8; k += 1) if (hash(i * 9 + k) > 0.5) ctx.fillRect(x + cell * (0.12 + (k % 3) * 0.28), horizon - h + H * 0.014 + Math.floor(k / 3) * H * 0.028, cell * 0.14, H * 0.012);
        } else {
          const h = H * (0.1 + r * 0.14);
          ctx.beginPath();
          ctx.moveTo(x, horizon + H * 0.01);
          ctx.lineTo(x + cell * 0.55, horizon - h);
          ctx.lineTo(x + cell * 1.1, horizon + H * 0.01);
          ctx.fill();
          if (theme.snow) {
            ctx.fillStyle = "rgba(225,235,250,0.8)";
            ctx.beginPath();
            ctx.moveTo(x + cell * 0.3, horizon - h * 0.45);
            ctx.lineTo(x + cell * 0.55, horizon - h);
            ctx.lineTo(x + cell * 0.8, horizon - h * 0.45);
            ctx.fill();
          }
          if (hash(i + 77) > 0.86) {
            ctx.fillStyle = theme.light;
            ctx.fillRect(x + cell * 0.5, horizon - H * 0.016, H * 0.012, H * 0.012);
          }
        }
      }
    }
    // 手前の地面と、過ぎていく電柱
    ctx.fillStyle = theme.ground;
    ctx.fillRect(box.x, horizon + H * 0.06, box.w, box.h);
    if (offset > 0) {
      const gap = H * 0.9;
      const fast = offset * 1.5;
      for (let i = Math.floor(fast / gap); i < fast / gap + box.w / gap + 1; i += 1) {
        const x = box.x + i * gap - fast;
        ctx.fillStyle = "rgba(20,22,28,0.92)";
        ctx.fillRect(x, box.y, H * 0.018, box.h);
        ctx.fillRect(x - H * 0.04, box.y + box.h * 0.1, H * 0.1, H * 0.008);
      }
      ctx.strokeStyle = "rgba(20,22,28,0.8)";
      ctx.lineWidth = Math.max(1, H * 0.003);
      for (const y of [0.1, 0.16]) {
        ctx.beginPath();
        for (let x = 0; x <= box.w; x += 12) ctx.lineTo(box.x + x, box.y + box.h * y + Math.sin((((x + fast) % gap) / gap) * Math.PI) * H * 0.03);
        ctx.stroke();
      }
    }
    if (theme.snow) {
      ctx.fillStyle = "rgba(240,246,255,0.85)";
      for (let i = 0; i < 130; i += 1) {
        const s = 1 + hash(i + 5) * 3;
        ctx.fillRect(box.x + ((hash(i) * box.w - offset * (0.3 + hash(i + 3) * 0.6)) % box.w + box.w) % box.w, box.y + ((hash(i + 50) * box.h + t * H * (0.08 + hash(i + 9) * 0.1)) % box.h), s, s);
      }
    }
  }

  // 窓枠・座席・つり革
  function cabin(box, W, H, t, vehicle) {
    const sway = Math.sin(t * 2.1) * H * 0.003;
    ctx.strokeStyle = vehicle === "bus" ? "#31473c" : "#8e949a";
    ctx.lineWidth = H * 0.022;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, H * 0.03);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, box.y);
    ctx.lineTo(W / 2, box.y + box.h);
    ctx.stroke();
    const seat = vehicle === "bus" ? "#27506a" : "#6c2a34";
    for (let i = -1; i < 6; i += 1) {
      ctx.fillStyle = seat;
      ctx.beginPath();
      ctx.roundRect(W * (0.02 + i * 0.2) + sway, H * 0.8, W * 0.17, H * 0.3, H * 0.03);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(220,224,228,0.65)";
    ctx.lineWidth = H * 0.008;
    for (let i = 0; i < 7; i += 1) {
      const x = W * (0.1 + i * 0.135);
      const swing = Math.sin(t * 2.4 + i) * H * 0.012;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + swing, H * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + swing * 1.2, H * 0.125, H * 0.022, 0, 7);
      ctx.stroke();
    }
  }

  return {
    show,
    progress,
    hide,
    cancel,
    get active() {
      return view !== null;
    },
  };
}
