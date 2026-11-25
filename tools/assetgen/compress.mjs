/*
 * モデルと画像を、公開用に軽くする（上書き）。何度かけても大丈夫なように、済んだファイルは飛ばす。
 *
 *   mkdir 作業用 && cd 作業用 && npm init -y
 *   npm install @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
 *   node <このファイル> <src/assets のパス>
 *
 * scene/  … 場所に置く物。位置を量子化して meshopt で圧縮し、質感は WebP にする（kit.js が読むときに元へ戻す）
 * models/ … 手・人・道具。骨や当たり判定に使うので位置はそのまま。法線・UV だけ量子化して meshopt で圧縮
 * images/ … JPEG を WebP に置き換える
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// 道具は、実行したフォルダの node_modules から読む
const need = createRequire(path.join(process.cwd(), "package.json"));
const load = (name) => import(pathToFileURL(need.resolve(name)).href);
const { NodeIO, VertexLayout } = await load("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTMeshoptCompression } = await load("@gltf-transform/extensions");
const { dedup, prune, quantize, reorder, simplify, textureCompress, weld } = await load("@gltf-transform/functions");
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await load("meshoptimizer");
const sharp = (await load("sharp")).default;

const ASSETS = process.argv[2];
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
io.setVertexLayout(VertexLayout.SEPARATE);

// 葉や岩：面ごとに平らに塗れば十分なので、法線を捨てて頂点を減らす（読み込むと平らな陰影になる）
const FLAT = new Set(["pine", "bamboo", "conifer", "fern", "snowbush", "ikebana", "flowers", "potplant", "logs", "firewood", "rock", "tetrapod", "nets", "crates", "bush", "tree"]);

const size = (file) => fs.statSync(file).size;
const triangles = (doc) => doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, p) => sum + (p.getIndices()?.getCount() ?? 0) / 3, 0);

async function models(folder, scene) {
  let before = 0;
  let after = 0;
  for (const name of fs.readdirSync(path.join(ASSETS, folder)).filter((file) => file.endsWith(".glb"))) {
    const file = path.join(ASSETS, folder, name);
    const doc = await io.read(file);
    before += size(file);
    if (!doc.getRoot().listExtensionsUsed().some((extension) => extension.extensionName === "EXT_meshopt_compression")) {
      doc.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
      await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: "webp", quality: scene ? 68 : 80, effort: 6, resize: scene ? [640, 640] : [1024, 1024] }));
      if (scene) {
        if (FLAT.has(path.basename(name, ".glb"))) {
          for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) p.setAttribute("NORMAL", null);
          await doc.transform(prune(), weld());
        }
        const count = triangles(doc);
        if (count > 7000) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 7000 / count, error: 0.01 }));
        await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 12, quantizeNormal: 8, quantizeTexcoord: 11, quantizeColor: 8 }));
      } else {
        await doc.transform(quantize({ pattern: /^(NORMAL|TEXCOORD_\d|JOINTS_\d|WEIGHTS_\d)$/, patternTargets: /^NORMAL$/, quantizeNormal: 8, quantizeTexcoord: 12, quantizeWeight: 8 }));
      }
      doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
      await io.write(file, doc);
    }
    after += size(file);
  }
  console.log(folder, (before / 1e6).toFixed(1), "→", (after / 1e6).toFixed(1), "MB");
}

async function images() {
  const folder = path.join(ASSETS, "images");
  let before = 0;
  let after = 0;
  for (const name of fs.readdirSync(folder).filter((file) => file.endsWith(".jpg"))) {
    const file = path.join(folder, name);
    const out = file.replace(/\.jpg$/, ".webp");
    await sharp(file).webp({ quality: name.endsWith("_n.jpg") ? 84 : 74, effort: 6 }).toFile(out);
    before += size(file);
    after += size(out);
    fs.unlinkSync(file);
  }
  if (before) console.log("images", (before / 1e6).toFixed(1), "→", (after / 1e6).toFixed(1), "MB");
}

await models("scene", true);
await models("models", false);
await images();
