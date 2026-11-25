"""車の正面に出てしまった、実在のメーカーに似たマークや文字を塗りつぶす（GLB の中の画像だけを差し替える）。

  python unbadge.py   （ComfyUI の Python で実行。compress.mjs をかけたあとの GLB に使う）

PATCHES の位置は、いまのモデルの展開図（640x640）での (x0, y0, x1, y1)。
モデルを作り直すと展開図も変わるので、位置を測り直すこと。
"""
import io
import json
import os
import struct

from PIL import Image, ImageFilter

SCENE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "assets", "scene")
PATCHES = {
    "truck": [(150, 198, 168, 215)],
    "car": [(480, 308, 500, 350)],
}


def paint(im, box):
    """まわりの色で、なめらかに埋める。"""
    x0, y0, x1, y1 = box
    out = im.copy()
    src = im.load()
    dst = out.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            # 四辺の色を、近いほど強く混ぜる
            total = [0.0, 0.0, 0.0]
            weight = 0.0
            for px, py, d in ((x0 - 1, y, x - x0 + 1), (x1, y, x1 - x), (x, y0 - 1, y - y0 + 1), (x, y1, y1 - y)):
                w = 1.0 / (d * d)
                weight += w
                for c in range(3):
                    total[c] += src[px, py][c] * w
            dst[x, y] = tuple(round(v / weight) for v in total)
    soft = out.filter(ImageFilter.GaussianBlur(1.4))
    out.paste(soft.crop((x0 - 1, y0 - 1, x1 + 1, y1 + 1)), (x0 - 1, y0 - 1))
    return out


def replace_image(path, patches):
    data = open(path, "rb").read()
    json_length = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20 : 20 + json_length])
    start = 20 + json_length + 8
    view = doc["bufferViews"][doc["images"][0]["bufferView"]]
    offset = start + view.get("byteOffset", 0)
    im = Image.open(io.BytesIO(data[offset : offset + view["byteLength"]])).convert("RGB")
    for box in patches:
        im = paint(im, box)
    # 元の場所に収まる大きさで書き戻す（ほかのデータの位置は動かさない）
    for quality in range(90, 40, -2):
        buffer = io.BytesIO()
        im.save(buffer, "WEBP", quality=quality, method=6)
        new = buffer.getvalue()
        if len(new) <= view["byteLength"]:
            break
    old = view["byteLength"]
    view["byteLength"] = len(new)
    head = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    assert len(head) <= json_length
    out = bytearray(data)
    out[20 : 20 + json_length] = head.ljust(json_length, b" ")
    out[offset : offset + old] = new.ljust(old, b"\0")
    open(path, "wb").write(out)
    print(os.path.basename(path), im.size, f"q{quality}", old, "->", len(new))


for name, boxes in PATCHES.items():
    replace_image(os.path.join(SCENE, name + ".glb"), boxes)
