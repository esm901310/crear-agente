"""
Escenarios de la Frutinovela (SVG 1080x1920): sala de telenovela, clínica dental y portada.
fondo(lugar) -> imagen PIL RGBA (ligeramente desenfocada para dar profundidad).
"""
import io
import math
import random
from functools import lru_cache

import cairosvg
from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
PISO = 1250  # donde empieza el piso


def _palmera(x, y, s, color):
    hojas = "".join(
        f'<path d="M{x} {y} Q {x + s * math.cos(a) * .6} {y + s * math.sin(a) * .6 - s * .25} {x + s * math.cos(a)} {y + s * math.sin(a)}" '
        f'stroke="{color}" stroke-width="{s * .09}" fill="none" stroke-linecap="round"/>'
        for a in [math.radians(d) for d in (-170, -140, -110, -70, -40, -10)])
    return (f'<path d="M{x - s * .05} {y + s * 2.2} Q {x - s * .25} {y + s} {x} {y}" stroke="{color}" stroke-width="{s * .1}" fill="none"/>' + hojas)


def _sala():
    rnd = random.Random(1)
    papel = "".join(
        f'<path d="M{x} {y - 14} L{x + 9} {y} L{x} {y + 14} L{x - 9} {y} Z" fill="#fff" opacity="0.10"/>'
        for y in range(40, PISO - 120, 70) for x in range(30 + (35 if (y // 70) % 2 else 0), W, 70))
    tablas = "".join(f'<line x1="0" y1="{PISO + d}" x2="{W}" y2="{PISO + d}" stroke="#4a2414" stroke-width="3" opacity="0.5"/>'
                     for d in [int(18 * i ** 1.45) for i in range(1, 14)])
    vetas = "".join(f'<line x1="{x}" y1="{PISO}" x2="{x + (x - W / 2) * 1.6}" y2="{H}" stroke="#4a2414" stroke-width="2" opacity="0.35"/>'
                    for x in range(-200, W + 200, 120))
    pliegues_i = "".join(f'<rect x="{x}" y="230" width="22" height="1010" fill="#000" opacity="{0.08 + (i % 2) * 0.12}"/>' for i, x in enumerate(range(40, 250, 34)))
    pliegues_d = "".join(f'<rect x="{x}" y="230" width="22" height="1010" fill="#000" opacity="{0.08 + (i % 2) * 0.12}"/>' for i, x in enumerate(range(840, 1060, 34)))
    return f"""
    <defs>
      <linearGradient id="pared" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7cfae"/><stop offset="1" stop-color="#d98d7c"/></linearGradient>
      <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5b3c8c"/><stop offset="0.45" stop-color="#ff7d7d"/><stop offset="0.8" stop-color="#ffc36b"/></linearGradient>
      <radialGradient id="sol" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c8"/><stop offset="0.5" stop-color="#ffd36b"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient>
      <linearGradient id="cortina" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a0b2a"/><stop offset="0.5" stop-color="#c0193f"/><stop offset="1" stop-color="#7a0b2a"/></linearGradient>
      <linearGradient id="madera" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c5a38"/><stop offset="1" stop-color="#5e2f1c"/></linearGradient>
      <linearGradient id="sofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e2a4a"/><stop offset="1" stop-color="#561330"/></linearGradient>
      <radialGradient id="luz" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c0" stop-opacity="0.8"/><stop offset="1" stop-color="#fff2c0" stop-opacity="0"/></radialGradient>
      <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
    </defs>
    <rect width="{W}" height="{PISO}" fill="url(#pared)"/>{papel}
    <rect y="{PISO - 230}" width="{W}" height="230" fill="#b86e5e"/>
    <rect y="{PISO - 240}" width="{W}" height="14" fill="#8a4a3c"/>
    {''.join(f'<rect x="{x}" y="{PISO - 205}" width="160" height="180" rx="8" fill="none" stroke="#8a4a3c" stroke-width="5"/>' for x in range(30, W, 210))}
    <!-- ventana al atardecer de San Pedro Sula -->
    <rect x="250" y="300" width="580" height="620" rx="10" fill="url(#cielo)"/>
    <circle cx="560" cy="700" r="170" fill="url(#sol)"/>
    <path d="M250 800 Q 330 690 420 760 Q 520 640 620 740 Q 720 660 830 770 L830 920 L250 920 Z" fill="#7a4a8a"/>
    <path d="M250 860 Q 360 800 470 850 Q 600 790 830 860 L830 920 L250 920 Z" fill="#4a2a5a"/>
    {_palmera(330, 760, 90, "#2a1630")}{_palmera(760, 740, 110, "#2a1630")}
    <rect x="250" y="300" width="580" height="620" rx="10" fill="none" stroke="#fff6ea" stroke-width="22"/>
    <rect x="530" y="300" width="18" height="620" fill="#fff6ea"/><rect x="250" y="600" width="580" height="16" fill="#fff6ea"/>
    <rect x="225" y="915" width="630" height="26" rx="6" fill="#fff6ea"/>
    <!-- cortinas de terciopelo -->
    <path d="M30 230 L270 230 Q 250 700 300 1000 Q 220 1080 260 1240 L30 1240 Z" fill="url(#cortina)"/>{pliegues_i}
    <path d="M1050 230 L810 230 Q 830 700 780 1000 Q 860 1080 820 1240 L1050 1240 Z" fill="url(#cortina)"/>{pliegues_d}
    <path d="M268 1000 Q 300 1010 312 990" stroke="url(#oro)" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M812 1000 Q 780 1010 768 990" stroke="url(#oro)" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M10 200 L1070 200 L1070 270 Q 950 320 820 270 Q 680 330 540 270 Q 400 330 260 270 Q 130 320 10 270 Z" fill="#9a1236"/>
    <rect x="0" y="186" width="{W}" height="22" rx="10" fill="url(#oro)"/>
    <!-- cuadro y lámpara -->
    <rect x="70" y="40" width="0" height="0"/>
    <circle cx="960" cy="1000" r="200" fill="url(#luz)"/>
    <path d="M920 900 L1000 900 L1030 980 L890 980 Z" fill="#f6e3b0" stroke="#b08a40" stroke-width="4"/>
    <rect x="955" y="980" width="10" height="200" fill="#6b4a20"/><ellipse cx="960" cy="1185" rx="45" ry="12" fill="#6b4a20"/>
    <!-- sofá -->
    <rect x="300" y="1050" width="480" height="150" rx="40" fill="url(#sofa)"/>
    <rect x="270" y="1100" width="80" height="130" rx="30" fill="#6e1a3a"/><rect x="730" y="1100" width="80" height="130" rx="30" fill="#6e1a3a"/>
    <rect x="320" y="1150" width="440" height="80" rx="20" fill="#7a1f42"/>
    <!-- planta -->
    {''.join(f'<ellipse cx="{120 + 70 * math.cos(a)}" cy="{1040 + 60 * math.sin(a)}" rx="60" ry="20" fill="#3f8a3a" transform="rotate({math.degrees(a)} {120 + 70 * math.cos(a)} {1040 + 60 * math.sin(a)})"/>' for a in [math.radians(d) for d in range(-180, 10, 30)])}
    <path d="M70 1100 L170 1100 L155 1220 L85 1220 Z" fill="#c76b3a"/>
    <!-- piso de madera y alfombra -->
    <rect y="{PISO}" width="{W}" height="{H - PISO}" fill="url(#madera)"/>{tablas}{vetas}
    <ellipse cx="540" cy="{PISO + 190}" rx="520" ry="150" fill="#8e1e3a"/>
    <ellipse cx="540" cy="{PISO + 190}" rx="470" ry="122" fill="none" stroke="#e8b84a" stroke-width="8" stroke-dasharray="26 14"/>
    """


def _clinica():
    azulejos = "".join(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="#c9dde0" stroke-width="3"/>' for y in range(800, PISO, 75)) + \
               "".join(f'<line x1="{x}" y1="800" x2="{x}" y2="{PISO}" stroke="#c9dde0" stroke-width="3"/>' for x in range(0, W, 75))
    losas = "".join(f'<line x1="0" y1="{PISO + d}" x2="{W}" y2="{PISO + d}" stroke="#9fb3bb" stroke-width="3" opacity="0.6"/>'
                    for d in [int(20 * i ** 1.45) for i in range(1, 13)]) + \
            "".join(f'<line x1="{x}" y1="{PISO}" x2="{x + (x - W / 2) * 1.8}" y2="{H}" stroke="#9fb3bb" stroke-width="3" opacity="0.6"/>' for x in range(-300, W + 300, 150))
    edificios = "".join(f'<rect x="{x}" y="{700 - h}" width="{w}" height="{h + 100}" fill="#8fb6c8"/>'
                        + "".join(f'<rect x="{x + 10 + c * 22}" y="{710 - h + r * 30}" width="12" height="16" fill="#e8f6ff"/>' for r in range(int(h / 30)) for c in range(int((w - 14) / 22)))
                        for x, w, h in [(90, 80, 140), (180, 60, 200), (250, 90, 120), (350, 70, 170)])
    return f"""
    <defs>
      <linearGradient id="pared" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fbfb"/><stop offset="1" stop-color="#cde9ec"/></linearGradient>
      <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8f0"/><stop offset="1" stop-color="#d8f1ff"/></linearGradient>
      <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3edf0"/><stop offset="1" stop-color="#b3c6cd"/></linearGradient>
      <linearGradient id="sillon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fd0d8"/><stop offset="1" stop-color="#0b8a9a"/></linearGradient>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8eef3"/><stop offset="1" stop-color="#93a2b0"/></linearGradient>
      <radialGradient id="luz" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="{W}" height="{PISO}" fill="url(#pared)"/>
    <rect y="800" width="{W}" height="{PISO - 800}" fill="#e9f5f6"/>{azulejos}
    <rect y="790" width="{W}" height="14" fill="#14a3b8"/>
    <!-- ventana con vista a la ciudad y al Merendón -->
    <rect x="60" y="300" width="400" height="420" rx="14" fill="url(#cielo)"/>
    <path d="M60 600 Q 150 470 260 560 Q 350 480 460 580 L460 720 L60 720 Z" fill="#5fa36a"/>
    <path d="M60 650 Q 200 590 320 640 Q 400 610 460 650 L460 720 L60 720 Z" fill="#3f7f4a"/>
    <clipPath id="vent"><rect x="60" y="300" width="400" height="420" rx="14"/></clipPath>
    <g clip-path="url(#vent)">{edificios}</g>
    <rect x="60" y="300" width="400" height="420" rx="14" fill="none" stroke="#ffffff" stroke-width="20"/>
    <rect x="252" y="300" width="16" height="420" fill="#fff"/>
    <!-- póster -->
    <rect x="560" y="310" width="200" height="270" rx="16" fill="#ffffff" stroke="#14a3b8" stroke-width="8"/>
    <path d="M620 380 q20 -24 40 0 q20 -24 40 0 q0 40 -16 70 q-10 -22 -24 -22 q-14 0 -24 22 q-16 -30 -16 -70 Z" fill="#14a3b8"/>
    <rect x="590" y="490" width="140" height="18" rx="9" fill="#ffc94a"/><rect x="610" y="525" width="100" height="14" rx="7" fill="#bfe3e8"/>
    <!-- lámpara dental -->
    <circle cx="880" cy="430" r="220" fill="url(#luz)"/>
    <path d="M1080 250 L940 330 L900 420" stroke="url(#metal)" stroke-width="22" fill="none" stroke-linecap="round"/>
    <ellipse cx="880" cy="440" rx="90" ry="44" fill="#dfe8ee" stroke="#8a9aa8" stroke-width="6"/>
    <ellipse cx="880" cy="452" rx="62" ry="22" fill="#fffbe0"/>
    <!-- sillón dental -->
    <path d="M820 760 Q 860 700 930 720 L1000 980 Q 1010 1020 970 1030 L880 1030 Z" fill="url(#sillon)"/>
    <rect x="700" y="990" width="380" height="80" rx="38" fill="url(#sillon)"/>
    <rect x="860" y="1060" width="40" height="140" fill="url(#metal)"/><ellipse cx="880" cy="1205" rx="120" ry="24" fill="#93a2b0"/>
    <!-- mueble con instrumentos -->
    <rect x="560" y="960" width="210" height="240" rx="14" fill="#ffffff" stroke="#b9d3d8" stroke-width="5"/>
    {''.join(f'<rect x="575" y="{975 + i * 75}" width="180" height="62" rx="8" fill="#f2f8f9" stroke="#b9d3d8" stroke-width="3"/><rect x="645" y="{1000 + i * 75}" width="40" height="10" rx="5" fill="#14a3b8"/>' for i in range(3))}
    <rect x="590" y="930" width="12" height="34" rx="5" fill="#8a9aa8"/><rect x="615" y="925" width="12" height="40" rx="5" fill="#14a3b8"/><rect x="640" y="932" width="12" height="32" rx="5" fill="#8a9aa8"/>
    <!-- planta -->
    {''.join(f'<ellipse cx="{120 + 60 * math.cos(a)}" cy="{1050 + 55 * math.sin(a)}" rx="55" ry="18" fill="#45a35a" transform="rotate({math.degrees(a)} {120 + 60 * math.cos(a)} {1050 + 55 * math.sin(a)})"/>' for a in [math.radians(d) for d in range(-180, 10, 30)])}
    <rect x="80" y="1100" width="85" height="110" rx="10" fill="#ffffff" stroke="#b9d3d8" stroke-width="4"/>
    <rect y="{PISO}" width="{W}" height="{H - PISO}" fill="url(#piso)"/>{losas}
    """


def _portada():
    rnd = random.Random(9)
    rayos = "".join(f'<path d="M540 -100 L{540 + 1400 * math.cos(a - .06)} {-100 + 1400 * math.sin(a - .06)} L{540 + 1400 * math.cos(a + .06)} {-100 + 1400 * math.sin(a + .06)} Z" fill="#ffffff" opacity="0.06"/>'
                    for a in [math.radians(d) for d in range(20, 170, 14)])
    petalos = "".join(f'<ellipse cx="{rnd.randint(0, W)}" cy="{rnd.randint(0, H)}" rx="{rnd.randint(10, 18)}" ry="{rnd.randint(6, 10)}" fill="#ff3d6e" opacity="{rnd.uniform(.5, .9):.2f}" '
                      f'transform="rotate({rnd.randint(0, 180)} {0} {0})"/>' for _ in range(0))
    petalos = ""
    for _ in range(26):
        x, y, r = rnd.randint(0, W), rnd.randint(0, H), rnd.randint(0, 180)
        petalos += f'<ellipse cx="{x}" cy="{y}" rx="{rnd.randint(10, 18)}" ry="{rnd.randint(6, 10)}" fill="#ff3d6e" opacity="{rnd.uniform(.5, .9):.2f}" transform="rotate({r} {x} {y})"/>'
    brillos = "".join(f'<circle cx="{rnd.randint(0, W)}" cy="{rnd.randint(0, H)}" r="{rnd.uniform(2, 6):.1f}" fill="#ffe6ff" opacity="{rnd.uniform(.4, 1):.2f}"/>' for _ in range(70))
    return f"""
    <defs>
      <radialGradient id="foco" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#c2307a"/><stop offset="0.45" stop-color="#5a1460"/><stop offset="1" stop-color="#14051f"/></radialGradient>
    </defs>
    <rect width="{W}" height="{H}" fill="url(#foco)"/>{rayos}{brillos}{petalos}
    <ellipse cx="540" cy="1330" rx="460" ry="60" fill="#000" opacity="0.35"/>
    """


ESCENARIOS = {"casa": _sala, "clinica": _clinica, "portada": _portada, "final": _portada}


@lru_cache(maxsize=8)
def fondo(lugar):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{ESCENARIOS[lugar]()}</svg>'
    img = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert("RGBA")
    if lugar in ("casa", "clinica"):
        img = img.filter(ImageFilter.GaussianBlur(2.2))  # profundidad de campo
    # viñeta
    v = Image.new("L", (W, H), 0)
    ImageDraw.Draw(v).ellipse([-W * .35, -H * .2, W * 1.35, H * 1.2], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(160))
    oscuro = Image.new("RGBA", (W, H), (10, 0, 20, 150))
    oscuro.putalpha(Image.eval(v, lambda a: int((255 - a) * 0.6)))
    img.alpha_composite(oscuro)
    return img


if __name__ == "__main__":
    import sys
    hoja = Image.new("RGB", (360 * 3, 640))
    for i, l in enumerate(["casa", "clinica", "portada"]):
        hoja.paste(fondo(l).convert("RGB").resize((360, 640)), (360 * i, 0))
    hoja.save(sys.argv[1])
