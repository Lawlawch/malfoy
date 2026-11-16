# 立繪：修正透底並轉成 WebP（Lawch 用 Grok 去背後上傳的透明 PNG）
# 用法：python3 tools/fix_sprite.py <來源.png> <輸出.webp> [檢查圖.png]
#   1. 輪廓內縮 4px 以內、alpha > 100 的地方補成完全不透明（深色衣服內部的半透明）；輪廓外圈（髮絲邊緣）保持原樣
#   2. 轉成透明 WebP（品質 92）；不移位、不縮放、不調色
#   3. 有給檢查圖路徑時，輸出疊在亮粉紅、深色、白色底上的並排圖，方便看有沒有透色或破洞
# 內縮用 numpy 做，結果等同 scipy.ndimage.binary_erosion(a > 100, iterations=4)（十字形結構）。
# 不用 binary_fill_holes：會把頭髮和身體之間的縫隙也填滿。
import sys
import numpy as np
from PIL import Image


def erode(mask, n):
    m = mask.copy()
    for _ in range(n):
        p = np.pad(m, 1, constant_values=False)
        m = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return m


def fix(src, dst, preview=None):
    im = np.array(Image.open(src).convert("RGBA"))
    a = im[..., 3]
    inner = erode(a > 100, 4)
    changed = int(np.count_nonzero(inner & (a < 255)))
    im[..., 3] = np.where(inner, 255, a)
    out = Image.fromarray(im, "RGBA")
    out.save(dst, "WEBP", quality=92, method=6)
    if preview:
        w, h = out.size
        sheet = Image.new("RGB", (w * 3, h))
        for i, c in enumerate([(255, 0, 200), (24, 24, 32), (255, 255, 255)]):
            bg = Image.new("RGBA", (w, h), c + (255,))
            sheet.paste(Image.alpha_composite(bg, out).convert("RGB"), (i * w, 0))
        sheet.thumbnail((w * 3 // 2, h // 2))
        sheet.save(preview)
    return out.size, changed


if __name__ == "__main__":
    size, changed = fix(*sys.argv[1:4])
    print(f"{sys.argv[2]}：{size[0]}×{size[1]}，補成不透明 {changed} px")
