"""Give cut-out vehicle photos a 3D studio look: clean edges, ground shadow, floor reflection."""
import sys
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

SRC, OUT = sys.argv[1], sys.argv[2]
CW, CH = 480, 320            # output canvas (3:2), transparent

def process(name):
    im = Image.open(f"{SRC}/{name}.png").convert("RGBA")
    im = im.crop(im.getbbox())
    A = im.getchannel("A")
    w, h = im.size
    tyre_line = h
    for yy in range(h - 1, 0, -1):
        row = list(A.crop((0, yy, w, yy + 1)).tobytes())
        if sum(1 for v in row if v > 200) > w * 0.02:
            tyre_line = yy + 1
            break
    im = im.crop((0, 0, w, tyre_line))
    # remove faint semi-transparent leftovers (old photo floor shadow)
    im.putalpha(im.getchannel("A").point(lambda v: 0 if v < 40 else v))

    # tighten edges by 1px and soften, removes the faint white halo
    a = im.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(a)

    # a touch more contrast, color and crispness
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    rgb = ImageEnhance.Color(rgb).enhance(1.12)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    im = Image.merge("RGBA", (*rgb.split(), im.getchannel("A")))

    # fit into the frame, leaving room for the shadow + reflection
    scale = min((CW - 40) / im.width, (CH * 0.78) / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x = (CW - im.width) // 2
    base_y = int(CH * 0.86)          # where the tyres touch the floor
    y = base_y - im.height

    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    # 1) floor reflection: flipped, faded vehicle
    refl = im.transpose(Image.FLIP_TOP_BOTTOM)
    fade = Image.linear_gradient("L").resize(refl.size)            # 0 top -> 255 bottom
    fade = ImageChops.invert(fade).point(lambda v: int(max(0, v - 150) / 105 * 255 * 0.12))  # ~12% at the floor, gone by 40%
    ra = ImageChops.multiply(refl.getchannel("A"), fade)
    refl.putalpha(ra)
    canvas.alpha_composite(refl, (x, base_y - 2))

    # 2) ground shadow: broad soft ellipse + tight contact shadow under the tyres
    from PIL import ImageDraw
    def ellipse_shadow(w, h, alpha, blur):
        pad = int(blur * 3)
        layer = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse((pad, pad, pad + w, pad + h), fill=(0, 0, 0, alpha))
        return layer.filter(ImageFilter.GaussianBlur(blur)), pad
    broad, bp = ellipse_shadow(int(im.width * 0.98), 40, 105, 12)
    canvas.alpha_composite(broad, ((CW - broad.width) // 2, base_y - 34 - bp))
    tight, tp = ellipse_shadow(int(im.width * 0.84), 14, 160, 4)
    canvas.alpha_composite(tight, ((CW - tight.width) // 2, base_y - 12 - tp))

    # 3) the vehicle itself
    canvas.alpha_composite(im, (x, y))
    canvas.save(f"{OUT}/{name}-3d.webp", "WEBP", quality=90, method=6)
    canvas.save(f"{OUT}/{name}-3d.png")
    print(name, "ok")

for n in ["auto", "economy", "comfort", "comfort-plus"]:
    process(n)
