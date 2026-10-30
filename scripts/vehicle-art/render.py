import os, sys, threading, functools, http.server, socketserver, io
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT, OUT = sys.argv[1], sys.argv[2]
NAMES = sys.argv[3:] or ["auto", "economy", "comfort", "comfort-plus"]

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a: None
httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None,
                           args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 960, "height": 640})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    for n in NAMES:
        pg.goto(f"http://127.0.0.1:{port}/scene.html?v={n}")
        pg.wait_for_function("window.__done === true", timeout=60000)
        png = pg.locator("canvas").screenshot(omit_background=True)
        im = Image.open(io.BytesIO(png)).convert("RGBA")
        bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        im = im.crop(bbox)
        # pad to a 3:2 canvas so all vehicles share the same frame
        w, h = im.size
        cw = max(w + 24, int((h + 24) * 1.5)); ch = int(cw / 1.5)
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(im, ((cw - w) // 2, ch - h - 8), im)
        canvas = canvas.resize((480, 320), Image.LANCZOS)
        canvas.save(f"{OUT}/{n}.webp", "WEBP", quality=90, method=6)
        print(n, "ok", bbox)
    if errs: print("ERRORS:", errs[:5])
    b.close()
httpd.shutdown()
