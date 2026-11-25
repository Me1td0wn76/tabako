import * as THREE from "three";

/*
 * 街歩きの当たり判定と歩行。座標は地図の m（地図の根から見た座標）。
 *   当たり判定は「向きのある箱」と「円柱」だけ。低い箱（STEP 以下）には登れるので、縁石や階段も箱で作れる。
 *   歩ける所は areas（長方形＋地面の高さ）で決まり、その外へは出られない。
 */

const STEP = 0.5; // 登れる段差
const BODY = 1.55; // 体の高さ（これより上の物には当たらない）
const RADIUS = 0.27;
const DROP = 1.1; // 降りられる段差
const CELL = 4;

// 当たらない物（小物・上に吊るした物）
const PASS = new Set([
  "sandals", "geta", "mug", "kettle", "cup", "sugar", "menu", "water", "flowers", "laundry", "lamp", "rope", "fern", "stones", "zabuton", "gull", "teaset", "pail", "jars", "siphon", "grinder",
  "register", "lantern", "chochin", "record", "showcase", "clock", "cat", "buoy", "ikebana", "wagasa", "andon",
]);
// 幹だけに当たる物（半径 m）
const TRUNKS = { tree: 0.2, conifer: 0.32, pine: 0.34, palm: 0.3, potplant: 0.22, bamboo: 0.55, snowbush: 0.55, bush: 0.5, clockpole: 0.2, signal: 0.22, busstop: 0.14, standash: 0.2, cone: 0.18, tetrapod: 0.9, rock: 0.45, lighthouse: 2.1 };

export function createSolids() {
  const cells = new Map();
  const key = (cx, cz) => cx * 4096 + cz;
  const query = [];

  function insert(solid, reach) {
    for (let cx = Math.floor((solid.x - reach) / CELL); cx <= Math.floor((solid.x + reach) / CELL); cx += 1) {
      for (let cz = Math.floor((solid.z - reach) / CELL); cz <= Math.floor((solid.z + reach) / CELL); cz += 1) {
        const id = key(cx, cz);
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push(solid);
      }
    }
  }

  function addBox(x, y0, y1, z, hx, hz, yaw) {
    if (y1 - y0 < 0.02) return;
    insert({ x, z, hx, hz, c: Math.cos(yaw), s: Math.sin(yaw), y0, y1 }, Math.hypot(hx, hz) + RADIUS);
  }
  function addCircle(x, y0, y1, z, r) {
    insert({ x, z, r, y0, y1 }, r + RADIUS);
  }

  // ある組み立て（kit）の物から、当たり判定を集める
  const matrix = new THREE.Matrix4();
  const inverse = new THREE.Matrix4();
  const instance = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const axis = new THREE.Vector3();
  function collect(kit, root) {
    root.updateMatrixWorld(true);
    inverse.copy(root.matrixWorld).invert();
    const modelSolid = (name, geometry, world) => {
      if (PASS.has(name)) return;
      const box = geometry.boundingBox;
      const scale = axis.setFromMatrixColumn(world, 1).length();
      if (TRUNKS[name]) {
        point.setFromMatrixPosition(world);
        const grow = ["rock", "bush", "snowbush"].includes(name) ? scale * box.max.x * 0.8 : name === "tetrapod" || name === "lighthouse" ? TRUNKS[name] * scale : TRUNKS[name];
        if (name === "rock" && box.max.y * scale < 0.28) return;
        addCircle(point.x, point.y - 0.5, point.y + box.max.y * scale, point.z, grow);
        return;
      }
      if ((box.max.y - box.min.y) * scale < 0.34) return;
      fromBounds(box.min, box.max, world, 0.94);
    };
    kit.group.traverse((object) => {
      if (!object.isMesh || object.userData.pass) return;
      const { model, size } = object.userData;
      if (!model && !size) return;
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      if (object.isInstancedMesh) {
        if (!model) return;
        for (let i = 0; i < object.count; i += 1) {
          object.getMatrixAt(i, instance);
          modelSolid(model, object.geometry, instance.premultiply(matrix));
        }
        return;
      }
      if (model) modelSolid(model, object.geometry, matrix);
      else {
        object.geometry.computeBoundingBox();
        fromBounds(object.geometry.boundingBox.min, object.geometry.boundingBox.max, matrix, 1);
      }
    });
    kit.solids.forEach(({ parent, position, yaw = 0, half, radius, height }) => {
      matrix.multiplyMatrices(inverse, parent.matrixWorld);
      point.set(...position).applyMatrix4(matrix);
      if (radius) {
        addCircle(point.x, point.y, point.y + height, point.z, radius);
        return;
      }
      axis.setFromMatrixColumn(matrix, 0);
      addBox(point.x, point.y - half[1], point.y + half[1], point.z, half[0], half[2], yaw + Math.atan2(-axis.z, axis.x));
    });
  }

  const corner = new THREE.Vector3();
  function fromBounds(min, max, world, shrink) {
    const tilted = Math.abs(world.elements[1]) + Math.abs(world.elements[9]) > 0.06 * Math.hypot(world.elements[4], world.elements[5], world.elements[6]);
    if (tilted) {
      // 傾いた物は、傾きごと入る箱にする
      const low = new THREE.Vector3(Infinity, Infinity, Infinity);
      const high = low.clone().negate();
      for (let i = 0; i < 8; i += 1) {
        corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(world);
        low.min(corner);
        high.max(corner);
      }
      addBox((low.x + high.x) / 2, low.y, high.y, (low.z + high.z) / 2, ((high.x - low.x) / 2) * shrink, ((high.z - low.z) / 2) * shrink, 0);
      return;
    }
    axis.setFromMatrixColumn(world, 0);
    const sx = axis.length();
    const yaw = Math.atan2(-axis.z, axis.x);
    const sy = corner.setFromMatrixColumn(world, 1).length();
    const sz = corner.setFromMatrixColumn(world, 2).length();
    point.addVectors(min, max).multiplyScalar(0.5).applyMatrix4(world);
    const hy = ((max.y - min.y) / 2) * sy;
    addBox(point.x, point.y - hy, point.y + hy, point.z, ((max.x - min.x) / 2) * sx * shrink, ((max.z - min.z) / 2) * sz * shrink, yaw);
  }

  function near(x, z) {
    return cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? query;
  }

  return { addBox, addCircle, collect, near };
}

// 箱の座標へ
const local = { x: 0, z: 0 };
function toLocal(solid, x, z) {
  const dx = x - solid.x;
  const dz = z - solid.z;
  local.x = dx * solid.c - dz * solid.s;
  local.z = dx * solid.s + dz * solid.c;
  return local;
}

export function createWalker(solids, areas) {
  const body = { x: 0, y: 0, z: 0, vy: 0, surface: "road", moved: 0 };
  const found = { y: -Infinity, surface: "road" };

  // その場所の地面。feet より STEP 高い所までは登れる
  function ground(x, z, feet) {
    found.y = -Infinity;
    for (const area of areas) {
      if (x < area.x[0] || x > area.x[1] || z < area.z[0] || z > area.z[1]) continue;
      if (area.only && !area.only(x, z)) continue;
      const y = typeof area.y === "function" ? area.y(x, z) : area.y;
      if (y <= feet + STEP && y > found.y) {
        found.y = y;
        found.surface = area.surface;
      }
    }
    if (found.y === -Infinity) return found;
    for (const solid of solids.near(x, z)) {
      if (solid.y1 > feet + STEP || solid.y1 <= found.y) continue;
      if (solid.r) {
        if (Math.hypot(x - solid.x, z - solid.z) > solid.r) continue;
      } else {
        toLocal(solid, x, z);
        if (Math.abs(local.x) > solid.hx || Math.abs(local.z) > solid.hz) continue;
      }
      found.y = solid.y1;
    }
    return found;
  }

  // 壁や物から押し出す
  function pushOut(position, feet) {
    for (let pass = 0; pass < 3; pass += 1) {
      let hit = false;
      for (const solid of solids.near(position.x, position.z)) {
        if (solid.y1 <= feet + STEP || solid.y0 >= feet + BODY) continue;
        if (solid.r) {
          const dx = position.x - solid.x;
          const dz = position.z - solid.z;
          const distance = Math.hypot(dx, dz);
          const reach = solid.r + RADIUS;
          if (distance >= reach || distance < 1e-5) continue;
          position.x += (dx / distance) * (reach - distance);
          position.z += (dz / distance) * (reach - distance);
          hit = true;
          continue;
        }
        toLocal(solid, position.x, position.z);
        const cx = THREE.MathUtils.clamp(local.x, -solid.hx, solid.hx);
        const cz = THREE.MathUtils.clamp(local.z, -solid.hz, solid.hz);
        let px = local.x - cx;
        let pz = local.z - cz;
        let distance = Math.hypot(px, pz);
        let push;
        if (distance < 1e-5) {
          // 中に入りこんだら、いちばん近い面から出す
          const ox = solid.hx - Math.abs(local.x);
          const oz = solid.hz - Math.abs(local.z);
          if (ox < oz) [px, pz, push] = [Math.sign(local.x) || 1, 0, ox + RADIUS];
          else [px, pz, push] = [0, Math.sign(local.z) || 1, oz + RADIUS];
          distance = 1;
        } else {
          if (distance >= RADIUS) continue;
          push = RADIUS - distance;
        }
        px = (px / distance) * push;
        pz = (pz / distance) * push;
        position.x += px * solid.c + pz * solid.s;
        position.z += -px * solid.s + pz * solid.c;
        hit = true;
      }
      if (!hit) break;
    }
  }

  const next = { x: 0, z: 0 };
  function canStand(x, z) {
    const { y } = ground(x, z, body.y);
    return y > body.y - DROP;
  }

  // 1 フレームぶん動く（速度は m/秒）
  function move(vx, vz, delta) {
    const distance = Math.hypot(vx, vz) * delta;
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    const fromX = body.x;
    const fromZ = body.z;
    for (let i = 0; i < steps; i += 1) {
      const dx = (vx * delta) / steps;
      const dz = (vz * delta) / steps;
      for (const [mx, mz] of [[dx, dz], [dx, 0], [0, dz]]) {
        if (!mx && !mz) continue;
        next.x = body.x + mx;
        next.z = body.z + mz;
        pushOut(next, body.y);
        if (!canStand(next.x, next.z)) continue;
        body.x = next.x;
        body.z = next.z;
        break;
      }
    }
    body.moved = Math.hypot(body.x - fromX, body.z - fromZ);
    // 上り下り
    const floor = ground(body.x, body.z, body.y);
    body.surface = floor.surface;
    if (floor.y === -Infinity) return;
    if (floor.y >= body.y) {
      body.y += (floor.y - body.y) * Math.min(1, delta * 14);
      body.vy = 0;
    } else {
      body.vy -= 14 * delta;
      body.y = Math.max(floor.y, body.y + body.vy * delta);
      if (body.y === floor.y) body.vy = 0;
    }
  }

  function place(x, y, z) {
    Object.assign(body, { x, y, z, vy: 0, moved: 0 });
  }

  return { body, move, place, ground };
}
