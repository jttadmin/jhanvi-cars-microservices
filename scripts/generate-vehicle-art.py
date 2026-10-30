"""Generate original 3D-style vehicle illustrations for Jhanvi Cars (SVG)."""
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1])


def defs(body, glass=("#3a4654", "#1b232c", "#0d1217")):
    b0, b1, b2, b3 = body
    g0, g1, g2 = glass
    return f"""  <defs>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#000" stop-opacity=".38"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{b0}"/>
      <stop offset=".38" stop-color="{b1}"/>
      <stop offset=".62" stop-color="{b2}"/>
      <stop offset="1" stop-color="{b3}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".45" stop-color="#fff" stop-opacity=".35"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{g0}"/>
      <stop offset=".55" stop-color="{g1}"/>
      <stop offset="1" stop-color="{g2}"/>
    </linearGradient>
    <radialGradient id="tire" cx="50%" cy="45%" r="55%">
      <stop offset=".6" stop-color="#2b2b2b"/>
      <stop offset="1" stop-color="#0b0b0b"/>
    </radialGradient>
    <radialGradient id="rim" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".5" stop-color="#c3c9cf"/>
      <stop offset="1" stop-color="#6c747c"/>
    </radialGradient>
    <linearGradient id="lamp" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff7d6"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
"""


def wheel(cx, cy, r=24, spokes=5):
    import math
    rim = r * 0.58
    lines = []
    for i in range(spokes):
        a = -math.pi / 2 + i * 2 * math.pi / spokes
        x1, y1 = cx + math.cos(a) * rim * 0.78, cy + math.sin(a) * rim * 0.78
        x2, y2 = cx + math.cos(a) * rim * 0.38, cy + math.sin(a) * rim * 0.38
        lines.append(f'<path d="M{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f}"/>')
    return f"""  <g>
    <circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#tire)"/>
    <circle cx="{cx}" cy="{cy}" r="{rim:.1f}" fill="url(#rim)"/>
    <g stroke="#7d858d" stroke-width="2.4" stroke-linecap="round">{''.join(lines)}</g>
    <circle cx="{cx}" cy="{cy}" r="{r * 0.17:.1f}" fill="#9aa2aa"/>
  </g>
"""


def far_wheel(cx, cy, r):
    return ""


def arch(cx, cy, r):
    return f'  <path d="M{cx - r} {cy} A{r} {r} 0 0 1 {cx + r} {cy} Z" fill="#1d2228"/>\n'


def svg(label, body_defs, content):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="{label}">
  <!-- Original artwork for Jhanvi Cars. Generated, not traced from any photo or brand. -->
{body_defs}{content}</svg>
"""


# ---------------------------------------------------------------- Comfort (sedan)
comfort = svg("Comfort sedan", defs(("#e9edf2", "#b9c2cc", "#8d98a5", "#4e5965")), f"""
  <ellipse cx="166" cy="166" rx="138" ry="12" fill="url(#shadow)"/>
{far_wheel(110, 146, 18)}{far_wheel(282, 146, 18)}
  <path d="M28 138 C28 121 38 111 58 108 L98 103 C112 80 132 69 162 68 L206 68 C226 68 242 80 258 98 L284 104 C300 107 306 118 306 132 L306 140 C306 147 301 151 294 151 L40 151 C33 151 28 146 28 138 Z" fill="url(#body)"/>
  <path d="M120 74 C140 69 190 67 222 74" fill="none" stroke="url(#sheen)" stroke-width="3" stroke-linecap="round"/>
  <path d="M108 102 C120 84 136 76 162 75 L200 75 C220 75 234 86 247 101 Z" fill="url(#glass)"/>
  <rect x="171" y="74" width="6" height="29" fill="#9aa4ae"/>
  <path d="M128 100 L150 77 L162 76 L140 101 Z" fill="#fff" opacity=".14"/>
  <path d="M190 100 L208 77 L216 78 L199 101 Z" fill="#fff" opacity=".1"/>
  <path d="M46 118 C120 111 220 111 296 116" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M56 142 L290 142" stroke="#3c4550" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
  <path d="M174 104 L176 141" stroke="#5b6672" stroke-width="1.6"/>
  <path d="M112 106 C111 120 112 132 116 141" fill="none" stroke="#5b6672" stroke-width="1.6"/>
  <rect x="146" y="113" width="14" height="4" rx="2" fill="#5b6672"/>
  <rect x="200" y="113" width="14" height="4" rx="2" fill="#5b6672"/>
  <path d="M244 100 C246 95 252 94 256 96 L256 103 L246 104 Z" fill="#8d98a5"/>
  <path d="M288 110 C296 111 302 115 304 121 L290 121 C287 118 286 113 288 110 Z" fill="url(#lamp)"/>
  <path d="M30 116 L44 113 L44 122 L30 124 Z" fill="#d6332b"/>
  <path d="M296 133 L306 133" stroke="#2c333b" stroke-width="3" stroke-linecap="round"/>
{arch(84, 151, 30)}{arch(256, 151, 30)}{wheel(84, 152)}{wheel(256, 152)}""")

# ---------------------------------------------------------------- Economy (hatchback, pearl white)
economy = svg("Economy hatchback", defs(("#ffffff", "#f1f3f5", "#d3d8de", "#8f98a2")), f"""
  <ellipse cx="166" cy="166" rx="118" ry="12" fill="url(#shadow)"/>
  <path d="M54 140 C54 120 56 102 66 88 C74 76 86 68 106 67 L176 66 C192 66 206 74 222 92 L254 100 C270 103 278 114 278 128 L278 140 C278 147 273 151 266 151 L64 151 C58 151 54 147 54 140 Z" fill="url(#body)"/>
  <path d="M90 70 C116 66 160 65 188 70" fill="none" stroke="url(#sheen)" stroke-width="3" stroke-linecap="round"/>
  <path d="M78 100 C80 88 88 75 106 74 L174 74 C188 74 200 84 212 99 Z" fill="url(#glass)"/>
  <rect x="140" y="73" width="6" height="29" fill="#cfd5db"/>
  <path d="M94 99 L116 76 L127 76 L105 100 Z" fill="#fff" opacity=".14"/>
  <path d="M168 99 L184 77 L191 78 L177 100 Z" fill="#fff" opacity=".1"/>
  <path d="M60 116 C120 109 200 109 270 114" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M72 142 L262 142" stroke="#6d7781" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
  <path d="M143 103 L145 141" stroke="#a7b0b9" stroke-width="1.6"/>
  <path d="M212 101 C215 116 215 130 213 141" fill="none" stroke="#a7b0b9" stroke-width="1.6"/>
  <rect x="118" y="111" width="12" height="4" rx="2" fill="#a7b0b9"/>
  <rect x="184" y="111" width="12" height="4" rx="2" fill="#a7b0b9"/>
  <path d="M208 97 C210 92 216 91 220 93 L220 100 L210 101 Z" fill="#c9d0d7"/>
  <path d="M262 108 C270 109 275 113 277 119 L264 119 C261 116 260 111 262 108 Z" fill="url(#lamp)"/>
  <path d="M55 100 L64 98 L64 114 L55 115 Z" fill="#d6332b"/>
  <path d="M268 132 L278 132" stroke="#59626c" stroke-width="3" stroke-linecap="round"/>
{arch(96, 151, 28)}{arch(236, 151, 28)}{wheel(96, 152, 22)}{wheel(236, 152, 22)}""")

# ---------------------------------------------------------------- Comfort Plus (SUV, black)
comfort_plus = svg("Comfort Plus SUV", defs(("#626b75", "#2b3138", "#171b20", "#050608"), glass=("#5a6674", "#222a33", "#0b0f13")), f"""
  <ellipse cx="168" cy="168" rx="134" ry="13" fill="url(#shadow)"/>
  <path d="M36 134 L36 104 C36 94 42 88 52 86 L72 84 C82 60 94 50 118 50 L206 50 C222 50 234 58 248 80 L280 88 C294 91 300 102 300 116 L300 134 C300 140 296 144 290 144 L46 144 C40 144 36 140 36 134 Z" fill="url(#body)" stroke="#ffffff" stroke-opacity=".12"/>
  <path d="M104 45 L216 45" stroke="#0a0c0e" stroke-width="4" stroke-linecap="round"/>
  <path d="M114 45 L114 50 M206 45 L206 50" stroke="#0a0c0e" stroke-width="3"/>
  <path d="M104 55 C132 51 186 51 220 55" fill="none" stroke="url(#sheen)" stroke-width="3" stroke-linecap="round"/>
  <path d="M80 84 C88 64 98 57 118 57 L202 57 C216 57 226 66 238 82 Z" fill="url(#glass)"/>
  <rect x="134" y="56" width="6" height="30" fill="#3a424b"/>
  <rect x="186" y="56" width="6" height="30" fill="#3a424b"/>
  <path d="M96 82 L117 59 L127 59 L106 83 Z" fill="#fff" opacity=".16"/>
  <path d="M200 82 L216 60 L223 61 L209 83 Z" fill="#fff" opacity=".12"/>
  <path d="M48 102 C120 95 220 95 292 100" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M60 134 L278 134" stroke="#000" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
  <path d="M137 87 L139 132" stroke="#4a525b" stroke-width="1.6"/>
  <path d="M189 87 L191 132" stroke="#4a525b" stroke-width="1.6"/>
  <rect x="112" y="98" width="13" height="4" rx="2" fill="#8a939c"/>
  <rect x="164" y="98" width="13" height="4" rx="2" fill="#8a939c"/>
  <path d="M236 82 C238 76 245 75 250 77 L250 85 L238 86 Z" fill="#2b3138"/>
  <path d="M282 94 C290 95 296 99 298 106 L284 106 C281 102 280 97 282 94 Z" fill="url(#lamp)"/>
  <path d="M38 96 L50 94 L50 108 L38 110 Z" fill="#d6332b"/>
  <path d="M286 120 L300 120 M286 126 L300 126" stroke="#5f6770" stroke-width="2" stroke-linecap="round"/>
{arch(90, 144, 34)}{arch(250, 144, 34)}{wheel(90, 150, 27, 6)}{wheel(250, 150, 27, 6)}""")

# ---------------------------------------------------------------- Auto rickshaw (green + yellow)
auto_defs = defs(("#4fd08a", "#22a35f", "#178048", "#0b4f2b"), glass=("#d7ecf6", "#9cc2d4", "#6a90a2")).replace(
    "  </defs>",
    """    <linearGradient id="hood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe680"/>
      <stop offset=".45" stop-color="#ffc727"/>
      <stop offset="1" stop-color="#d99a00"/>
    </linearGradient>
    <linearGradient id="cabin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2f35"/>
      <stop offset="1" stop-color="#121417"/>
    </linearGradient>
  </defs>""")
auto = svg("Auto rickshaw", auto_defs, f"""
  <ellipse cx="164" cy="166" rx="116" ry="11" fill="url(#shadow)"/>
  <!-- rounded canopy: sweeps down at the back, over the driver at the front -->
  <path d="M50 114 C44 82 52 54 78 44 C92 38 110 37 136 37 L204 37 C222 37 234 45 240 58 L248 76 L186 76 L186 114 Z" fill="url(#hood)"/>
  <path d="M70 50 C98 41 160 40 214 44" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" stroke-linecap="round"/>
  <!-- open passenger side with bench seat and grab rail -->
  <path d="M68 68 C68 60 74 55 82 55 L172 55 C178 55 182 59 182 65 L182 114 L68 114 Z" fill="url(#cabin)"/>
  <path d="M88 86 C88 80 92 77 98 77 L162 77 C168 77 172 80 172 86 L172 112 L88 112 Z" fill="#3b4148"/>
  <path d="M92 94 L168 94" stroke="#505861" stroke-width="2"/>
  <path d="M74 66 L176 66" stroke="#6b737c" stroke-width="2.5" stroke-linecap="round"/>
  <!-- windscreen -->
  <path d="M190 76 L238 76 C242 76 245 78 247 82 L260 112 L190 112 Z" fill="url(#glass)"/>
  <path d="M200 110 L222 78 L230 78 L208 110 Z" fill="#fff" opacity=".4"/>
  <path d="M186 76 L248 76" stroke="#a87400" stroke-width="2.5"/>
  <!-- green tub, rounded at the rear, sloping nose at the front -->
  <path d="M46 114 L258 114 C270 114 278 122 276 134 L270 146 C268 150 264 152 258 152 L64 152 C52 152 46 145 46 134 Z" fill="url(#body)"/>
  <path d="M50 126 L274 126" stroke="#ffc727" stroke-width="5"/>
  <path d="M50 120 L274 120" stroke="#fff" stroke-opacity=".35" stroke-width="1.6"/>
  <path d="M186 76 L186 150" stroke="#0e5a32" stroke-width="2"/>
  <!-- headlight on the nose, tail lamp at the back -->
  <ellipse cx="270" cy="118" rx="4" ry="5" fill="url(#lamp)" stroke="#0b4f2b" stroke-width="1.5"/>
  <rect x="48" y="130" width="8" height="10" rx="2" fill="#d6332b"/>
  <!-- front mudguard -->
  <path d="M226 150 C226 136 236 128 248 128 C260 128 270 136 270 150" fill="none" stroke="#0b4f2b" stroke-width="5" stroke-linecap="round"/>
{arch(100, 152, 26)}{wheel(100, 152, 20)}{wheel(248, 152, 18)}""")

for name, data in [("comfort", comfort), ("economy", economy), ("comfort-plus", comfort_plus), ("auto", auto)]:
    (OUT / f"{name}.svg").write_text(data)
    print("wrote", name)
