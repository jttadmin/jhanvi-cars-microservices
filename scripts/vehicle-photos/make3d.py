"""Stronger 3D look for cut-out vehicle photos.

- studio lighting: glossy highlight sweep, ambient occlusion low on the body, rim light on top edges
- deeper contact + ground shadows, floor reflection
- optional glossy showroom podium (turntable) under the vehicle

usage: make3d_v2.py CUT_DIR OUT_DIR [--podium]
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
PODIUM = "--podium" in sys.argv
CW, CH = 480, 320


def tyre_crop(im):
    im = im.crop(im.getbbox())
    a = im.getchannel("A")
    w, h = im.size
    for yy in range(h - 1, 0, -1):
        if sum(1 for v in a.crop((0, yy, w, yy + 1)).tobytes() if v > 200) > w * 0.02:
            im = im.crop((0, 0, w, yy + 1))
            break
    im.putalpha(im.getchannel("A").point(lambda v: 0 if v < 40 else v))
    return im


def light(im):
    """Studio lighting baked into the vehicle."""
    a = im.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.14)
    rgb = ImageEnhance.Color(rgb).enhance(1.15)
    w, h = rgb.size

    # ambient occlusion: darken the lower body (vertical gradient, multiply)
    ao = Image.linear_gradient("L").resize((w, h))                       # 0 top -> 255 bottom
    ao = ao.point(lambda v: 255 - int(max(0, v - 140) / 115 * 70))        # bottom ~27% darker
    rgb = ImageChops.multiply(rgb, Image.merge("RGB", (ao, ao, ao)))

    # glossy highlight sweep: diagonal soft band, screen-blended, only on the vehicle
    sweep = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(sweep)
    band = int(w * 0.16)
    for i, alpha in ((0, 120), (int(band * 1.6), 55)):
        x0 = int(w * 0.22) + i
        d.polygon([(x0, 0), (x0 + band, 0), (x0 + band - int(h * 0.55), h), (x0 - int(h * 0.55), h)], fill=alpha)
    sweep = sweep.filter(ImageFilter.GaussianBlur(w * 0.04))
    top_bias = Image.linear_gradient("L").resize((w, h)).point(lambda v: 255 - int(v * 0.85))
    sweep = ImageChops.multiply(sweep, top_bias)
    rgb = ImageChops.screen(rgb, Image.merge("RGB", (sweep, sweep, sweep)))

    # rim light: thin bright edge along the top of the silhouette
    shifted = Image.new("L", (w, h), 0); shifted.paste(a, (0, 3))
    rim = ImageChops.subtract(a, shifted).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: int(v * 0.6))
    rgb = ImageChops.screen(rgb, Image.merge("RGB", (rim, rim, rim)))

    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
    out = rgb.convert("RGBA"); out.putalpha(a)
    return out


def soft_ellipse(w, h, color, blur):
    pad = int(blur * 3) + 2
    layer = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((pad, pad, pad + w, pad + h), fill=color)
    return (layer.filter(ImageFilter.GaussianBlur(blur)) if blur else layer), pad


def podium(canvas, cx, top_y, w):
    """Glossy showroom turntable: top disc with a soft sheen, a darker side band, a shadow."""
    h = int(w * 0.2)                     # ellipse height (perspective)
    side = int(h * 0.32)                 # side band thickness
    sh, p = soft_ellipse(int(w * 1.08), int(h * 1.1), (0, 0, 0, 90), 14)
    canvas.alpha_composite(sh, (cx - sh.width // 2, top_y + side + h // 2 - sh.height // 2 + 6))

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, x1 = cx - w // 2, cx + w // 2
    # side band (cylinder wall)
    d.ellipse((x0, top_y + side, x1, top_y + side + h), fill=(170, 176, 184, 255))
    d.rectangle((x0, top_y + h // 2, x1, top_y + side + h // 2), fill=(170, 176, 184, 255))
    # top face
    d.ellipse((x0, top_y, x1, top_y + h), fill=(236, 239, 243, 255))
    canvas.alpha_composite(layer)

    # sheen on the top face + darker wall gradient
    sheen = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(sheen).ellipse((x0 + w * 0.12, top_y + h * 0.12, x1 - w * 0.3, top_y + h * 0.6), fill=150)
    sheen = sheen.filter(ImageFilter.GaussianBlur(w * 0.05))
    white = Image.new("RGBA", canvas.size, (255, 255, 255, 0)); white.putalpha(sheen)
    canvas.alpha_composite(white)
    # thin bright edge on the rim
    edge = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).ellipse((x0, top_y, x1, top_y + h), outline=(255, 255, 255, 200), width=2)
    canvas.alpha_composite(edge.filter(ImageFilter.GaussianBlur(0.6)))
    return top_y + h // 2               # floor level for the vehicle (center of the disc)


def process(name):
    im = light(tyre_crop(Image.open(f"{SRC}/{name}.png").convert("RGBA")))
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    if PODIUM:
        scale = min((CW - 70) / im.width, (CH * 0.66) / im.height)
    else:
        scale = min((CW - 40) / im.width, (CH * 0.78) / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x = (CW - im.width) // 2

    if PODIUM:
        pw = int(im.width * 1.06)
        base_y = podium(canvas, CW // 2, int(CH * 0.66), pw) + 8
    else:
        base_y = int(CH * 0.86)

    # floor reflection (not on the podium: its top is matte-glossy, keep it subtle)
    refl = im.transpose(Image.FLIP_TOP_BOTTOM)
    fade = Image.linear_gradient("L").resize(refl.size)
    strength = 0.10 if PODIUM else 0.18
    fade = ImageChops.invert(fade).point(lambda v: int(max(0, v - 160) / 95 * 255 * strength))
    refl.putalpha(ImageChops.multiply(refl.getchannel("A"), fade))
    canvas.alpha_composite(refl, (x, base_y - 2))

    # ground shadows: broad soft + tight dark contact under the tyres
    broad, bp = soft_ellipse(int(im.width * 0.98), 42, (0, 0, 0, 120), 12)
    canvas.alpha_composite(broad, ((CW - broad.width) // 2, base_y - 36 - bp))
    tight, tp = soft_ellipse(int(im.width * 0.86), 14, (0, 0, 0, 200), 4)
    canvas.alpha_composite(tight, ((CW - tight.width) // 2, base_y - 12 - tp))

    canvas.alpha_composite(im, (x, base_y - im.height))
    suffix = "podium" if PODIUM else "studio"
    canvas.save(f"{OUT}/{name}-{suffix}.webp", "WEBP", quality=90, method=6)
    canvas.save(f"{OUT}/{name}-{suffix}.png")
    print(name, suffix, "ok")


for n in ["auto", "economy", "comfort", "comfort-plus"]:
    process(n)
