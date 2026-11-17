"""
Personajes de la Frutinovela dibujados como ilustración vectorial (SVG) estilo animación.

render(tipo, expr, boca, parpadeo, pose, ancho) -> imagen PIL RGBA

tipo:  fresa | mango | uva | pina | limon
expr:  feliz | triste | llanto | enojo | sorpresa | amor | chisme | nervioso
pose:  normal | cintura | drama | senalar | corazon | explicar | manos_cara
"""
import io
import math
import random
from functools import lru_cache

import cairosvg
from PIL import Image

VB_X, VB_Y, VB_W, VB_H = -60, 0, 720, 820
OSCURO = "#2a1a2a"


# ------------------------------------------------------------------ paletas
PERSONAJES = {
    "fresa": dict(cara=(300, 370), k=1.0, hombros=((118, 440), (482, 440)), caderas=((262, 610), (338, 610)),
                  extremidad="#b3162f", zapato="#e8384f", iris=("#7ad0ff", "#1f5fa8"), ceja="#5a1420",
                  parpado="#d42a44", femenina=True),
    "mango": dict(cara=(300, 360), k=1.0, hombros=((112, 430), (488, 430)), caderas=((245, 640), (355, 640)),
                  extremidad="#d9772a", zapato="#5b3418", iris=("#a8743d", "#4a2a10"), ceja="#3b200f",
                  parpado="#f39a2e", femenina=False),
    "uva": dict(cara=(300, 335), k=0.95, hombros=((135, 430), (465, 430)), caderas=((252, 650), (348, 650)),
                extremidad="#5b2287", zapato="#c2185b", iris=("#9be37a", "#2f7a2a"), ceja="#2a0d3a",
                parpado="#7a3aa8", femenina=True),
    "pina": dict(cara=(300, 385), k=0.95, hombros=((122, 450), (478, 450)), caderas=((245, 640), (355, 640)),
                 extremidad="#d99a1e", zapato="#f4f7fa", iris=("#6fd3c5", "#14736a"), ceja="#6a4a10",
                 parpado="#f1c232", femenina=True),
    "limon": dict(cara=(300, 400), k=0.9, hombros=((150, 450), (450, 450)), caderas=((255, 630), (345, 630)),
                  extremidad="#a8b82a", zapato="#2f8fd8", iris=("#ffd36b", "#a0601a"), ceja="#5a5a10",
                  parpado="#e4ec4a", femenina=False),
}


def _defs_comunes(p):
    li, os_ = p["iris"]
    return f"""
    <radialGradient id="esclera" cx="45%" cy="38%" r="65%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.75" stop-color="#f3f5f9"/><stop offset="1" stop-color="#cfd6e2"/>
    </radialGradient>
    <radialGradient id="iris" cx="50%" cy="60%" r="60%">
      <stop offset="0" stop-color="{li}"/><stop offset="1" stop-color="{os_}"/>
    </radialGradient>
    <radialGradient id="chapa" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ff6f8f" stop-opacity="0.7"/><stop offset="1" stop-color="#ff6f8f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="brillo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="guante" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d5dbe5"/>
    </radialGradient>
    <linearGradient id="lagrima" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe6ff" stop-opacity="0.95"/><stop offset="1" stop-color="#4fa8ff" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="sombra_cuerpo" cx="30%" cy="25%" r="95%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
    """


# ------------------------------------------------------------------ cuerpos
def _cuerpo_fresa():
    forma = "M300 165 C 430 150 525 225 518 345 C 512 480 405 610 300 662 C 195 610 88 480 82 345 C 75 225 170 150 300 165 Z"
    rnd = random.Random(3)
    semillas = []
    for y in range(205, 650, 46):
        for x in range(95, 510, 52):
            xx, yy = x + rnd.uniform(-10, 10) + (26 if (y // 46) % 2 else 0), y + rnd.uniform(-8, 8)
            # dentro de la fresa (aprox) y fuera de la zona de la cara
            ancho = 215 * (1 - max(0, yy - 360) / 330) ** .8 if yy > 360 else 215
            if abs(xx - 300) > ancho - 22:
                continue
            if ((xx - 300) / 175) ** 2 + ((yy - 395) / 140) ** 2 < 1:
                continue
            semillas.append(
                f'<ellipse cx="{xx:.0f}" cy="{yy + 2:.0f}" rx="7" ry="10" fill="#8a0f22" opacity="0.5"/>'
                f'<ellipse cx="{xx:.0f}" cy="{yy:.0f}" rx="5.5" ry="8.5" fill="url(#semilla)"/>')
    hojas = []
    for ang in (-150, -115, -80, -45, -10, -95, -65):
        a = math.radians(ang)
        tx, ty = 300 + 120 * math.cos(a) * 1.25, 175 + 60 * math.sin(a) + 40
        nx, ny = -math.sin(a) * 34, math.cos(a) * 18
        hojas.append(f'<path d="M300 182 Q {(300 + tx) / 2 + nx:.0f} {(182 + ty) / 2 + ny:.0f} {tx:.0f} {ty:.0f} '
                     f'Q {(300 + tx) / 2 - nx:.0f} {(182 + ty) / 2 - ny:.0f} 300 182 Z" fill="url(#hoja)" stroke="#1f6b2a" stroke-width="3"/>')
    defs = """
    <radialGradient id="piel" cx="36%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ff7a86"/><stop offset="0.45" stop-color="#e8283f"/><stop offset="1" stop-color="#9a0d22"/>
    </radialGradient>
    <linearGradient id="semilla" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset="1" stop-color="#e6b21e"/></linearGradient>
    <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd65a"/><stop offset="1" stop-color="#2f8a36"/></linearGradient>
    """
    cuerpo = f"""
    <path d="{forma}" fill="url(#piel)" stroke="#7d0a1b" stroke-width="5"/>
    <clipPath id="clipc"><path d="{forma}"/></clipPath>
    <g clip-path="url(#clipc)">{''.join(semillas)}
      <path d="{forma}" fill="url(#sombra_cuerpo)"/></g>
    <ellipse cx="205" cy="255" rx="70" ry="42" fill="url(#brillo)" transform="rotate(-25 205 255)"/>
    {''.join(hojas)}
    <path d="M300 185 Q 296 150 310 128" stroke="#3f7a26" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M318 150 q 30 -22 46 -4 q -24 4 -46 4 Z M318 150 q 26 18 40 2 q -20 -6 -40 -2Z" fill="#ff5d9e" stroke="#b0145a" stroke-width="3"/>
    <circle cx="318" cy="150" r="8" fill="#ff8ab8" stroke="#b0145a" stroke-width="3"/>
    """
    return defs, cuerpo


def _cuerpo_mango():
    forma = "M300 150 C 440 140 505 250 498 395 C 492 548 402 668 292 668 C 168 668 100 552 104 400 C 108 245 182 158 300 150 Z"
    defs = """
    <linearGradient id="piel" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff4a2a"/><stop offset="0.35" stop-color="#ff8f24"/><stop offset="0.7" stop-color="#ffc232"/><stop offset="1" stop-color="#9fcf3e"/>
    </linearGradient>
    <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be06a"/><stop offset="1" stop-color="#2b7d33"/></linearGradient>
    """
    cuerpo = f"""
    <path d="{forma}" fill="url(#piel)" stroke="#a8401a" stroke-width="5"/>
    <clipPath id="clipc"><path d="{forma}"/></clipPath>
    <g clip-path="url(#clipc)"><path d="{forma}" fill="url(#sombra_cuerpo)"/></g>
    <ellipse cx="200" cy="250" rx="75" ry="45" fill="url(#brillo)" transform="rotate(-30 200 250)"/>
    <path d="M298 156 Q 292 128 304 106" stroke="#5b3418" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M304 112 Q 360 60 430 92 Q 370 132 304 112 Z" fill="url(#hoja)" stroke="#1f6b2a" stroke-width="3"/>
    <path d="M310 110 Q 370 96 420 94" stroke="#1f6b2a" stroke-width="2.5" fill="none"/>
    <path d="M250 158 Q 268 120 300 128 Q 284 140 276 162 Z" fill="#3b200f" opacity="0.85"/>
    """
    return defs, cuerpo


def _cuerpo_uva():
    rnd = random.Random(5)
    bolas = [(300, 520, 70), (210, 470, 72), (390, 470, 72), (250, 590, 62), (350, 590, 62), (300, 650, 50),
             (165, 380, 66), (435, 380, 66), (205, 200, 70), (300, 175, 72), (395, 200, 70), (150, 280, 62), (450, 280, 62)]
    cuerpo_bolas = []
    for i, (x, y, r) in enumerate(bolas):
        cuerpo_bolas.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#bola)" stroke="#3a0f55" stroke-width="4"/>'
                            f'<ellipse cx="{x - r * .35:.0f}" cy="{y - r * .4:.0f}" rx="{r * .28:.0f}" ry="{r * .18:.0f}" fill="#fff" opacity="0.55" transform="rotate(-30 {x - r * .35:.0f} {y - r * .4:.0f})"/>')
    defs = """
    <radialGradient id="bola" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#c79af0"/><stop offset="0.5" stop-color="#7d36b5"/><stop offset="1" stop-color="#3d0f62"/>
    </radialGradient>
    <radialGradient id="piel" cx="40%" cy="32%" r="75%">
      <stop offset="0" stop-color="#c79af0"/><stop offset="0.55" stop-color="#8a42c2"/><stop offset="1" stop-color="#4a1672"/>
    </radialGradient>
    <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be06a"/><stop offset="1" stop-color="#2b7d33"/></linearGradient>
    <radialGradient id="perla" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d8cfe0"/></radialGradient>
    <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a0"/><stop offset="1" stop-color="#d49a1a"/></linearGradient>
    """
    perlas = "".join(
        f'<circle cx="{300 + 150 * math.sin(a):.0f}" cy="{455 + 40 * math.cos(a):.0f}" r="11" fill="url(#perla)" stroke="#9a8aa8" stroke-width="1.5"/>'
        for a in [i * 0.2 - 1.0 for i in range(11)])
    cuerpo = f"""
    {''.join(cuerpo_bolas)}
    <circle cx="300" cy="345" r="158" fill="url(#piel)" stroke="#3a0f55" stroke-width="5"/>
    <ellipse cx="225" cy="250" rx="55" ry="30" fill="url(#brillo)" transform="rotate(-30 225 250)"/>
    <path d="M300 110 Q 296 80 312 58" stroke="#5b3418" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M306 76 Q 250 20 180 52 Q 200 90 240 92 Q 272 96 306 76 Z" fill="url(#hoja)" stroke="#1f6b2a" stroke-width="3"/>
    <path d="M300 78 Q 240 62 196 56" stroke="#1f6b2a" stroke-width="2.5" fill="none"/>
    {perlas}
    <circle cx="146" cy="385" r="16" fill="none" stroke="url(#oro)" stroke-width="7"/>
    <circle cx="454" cy="385" r="16" fill="none" stroke="url(#oro)" stroke-width="7"/>
    <g transform="translate(0 -38) rotate(-8 300 200)">
      <rect x="205" y="178" width="80" height="42" rx="18" fill="#1d1d2b"/><rect x="315" y="178" width="80" height="42" rx="18" fill="#1d1d2b"/>
      <path d="M285 192 Q 300 184 315 192" stroke="#1d1d2b" stroke-width="7" fill="none"/>
      <rect x="215" y="184" width="26" height="9" rx="4" fill="#fff" opacity="0.35"/><rect x="325" y="184" width="26" height="9" rx="4" fill="#fff" opacity="0.35"/>
    </g>
    """
    return defs, cuerpo


def _cuerpo_pina():
    cx, cy, rx, ry = 300, 410, 195, 255
    escamas = []
    for j, y in enumerate(range(150, 700, 52)):
        for x in range(60, 560, 60):
            xx = x + (30 if j % 2 else 0)
            escamas.append(f'<path d="M{xx} {y - 30} L{xx + 30} {y} L{xx} {y + 30} L{xx - 30} {y} Z" fill="url(#escama)" stroke="#b77a14" stroke-width="3"/>'
                           f'<circle cx="{xx}" cy="{y}" r="4" fill="#8a5a0e" opacity="0.6"/>')
    hojas = []
    for (a, h, w) in [(-60, 150, 34), (-35, 190, 36), (-12, 225, 38), (12, 225, 38), (35, 190, 36), (60, 150, 34), (0, 250, 30)]:
        r = math.radians(a)
        tx, ty = 300 + h * math.sin(r), 170 - h * math.cos(r)
        hojas.append(f'<path d="M{300 - w} 172 Q {(300 + tx) / 2 - w * .3:.0f} {(172 + ty) / 2:.0f} {tx:.0f} {ty:.0f} '
                     f'Q {(300 + tx) / 2 + w * .3:.0f} {(172 + ty) / 2:.0f} {300 + w} 172 Z" fill="url(#hoja)" stroke="#1f6b2a" stroke-width="3"/>')
    defs = """
    <linearGradient id="escama" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#eaa81e"/></linearGradient>
    <linearGradient id="hoja" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2b7d33"/><stop offset="1" stop-color="#8be06a"/></linearGradient>
    <linearGradient id="bata" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4dde6"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#b8c4d0"/><stop offset="1" stop-color="#6d7a88"/></linearGradient>
    """
    forma = f"M{cx} {cy - ry} A {rx} {ry} 0 1 1 {cx - 0.1} {cy - ry} Z"
    cuerpo = f"""
    {''.join(hojas)}
    <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#f5c23a" stroke="#9a6410" stroke-width="5"/>
    <clipPath id="clipc"><ellipse cx="{cx}" cy="{cy}" rx="{rx - 2}" ry="{ry - 2}"/></clipPath>
    <g clip-path="url(#clipc)">{''.join(escamas)}
      <ellipse cx="300" cy="380" rx="150" ry="125" fill="#ffd95a" opacity="0.92"/>
      <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#sombra_cuerpo)"/>
      <path d="M40 545 L262 545 L300 610 L338 545 L560 545 L560 720 L40 720 Z" fill="url(#bata)" stroke="#aab6c2" stroke-width="3"/>
      <path d="M262 545 L300 640 L338 545" fill="none" stroke="#aab6c2" stroke-width="4"/>
      <circle cx="300" cy="660" r="6" fill="#aab6c2"/><circle cx="300" cy="700" r="6" fill="#aab6c2"/>
      <rect x="350" y="590" width="70" height="56" rx="8" fill="#eef3f7" stroke="#aab6c2" stroke-width="3"/>
      <rect x="392" y="574" width="8" height="40" rx="3" fill="#2f6fd8"/>
      <path d="M362 604 q8 -10 16 0 q8 -10 16 0 q0 14 -6 24 q-4 -8 -10 -8 q-6 0 -10 8 q-6 -10 -6 -24 Z" fill="#14a3b8"/>
    </g>
    <ellipse cx="215" cy="260" rx="60" ry="34" fill="url(#brillo)" transform="rotate(-30 215 260)"/>
    <path d="M190 540 Q 175 600 220 610 Q 250 615 255 585" stroke="#4a5562" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M410 540 Q 430 610 380 640" stroke="#4a5562" stroke-width="9" fill="none" stroke-linecap="round"/>
    <circle cx="378" cy="645" r="17" fill="url(#metal)" stroke="#4a5562" stroke-width="4"/>
    """
    return defs, cuerpo


def _cuerpo_limon():
    forma = "M300 200 C 420 195 480 290 478 420 C 476 550 410 640 300 645 C 190 640 124 550 122 420 C 120 290 180 205 300 200 Z"
    defs = """
    <radialGradient id="piel" cx="38%" cy="32%" r="80%">
      <stop offset="0" stop-color="#fbff9a"/><stop offset="0.5" stop-color="#e6ef3a"/><stop offset="1" stop-color="#8fa51c"/>
    </radialGradient>
    <linearGradient id="hoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be06a"/><stop offset="1" stop-color="#2b7d33"/></linearGradient>
    """
    cuerpo = f"""
    <path d="{forma}" fill="url(#piel)" stroke="#7d8a12" stroke-width="5"/>
    <clipPath id="clipc"><path d="{forma}"/></clipPath>
    <g clip-path="url(#clipc)"><path d="{forma}" fill="url(#sombra_cuerpo)"/></g>
    <ellipse cx="220" cy="290" rx="55" ry="32" fill="url(#brillo)" transform="rotate(-30 220 290)"/>
    <path d="M300 205 Q 300 180 296 168" stroke="#6b8a22" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M298 176 Q 340 130 392 156 Q 350 190 298 176 Z" fill="url(#hoja)" stroke="#1f6b2a" stroke-width="3"/>
    <path d="M200 212 Q 300 150 400 212 L 400 232 L 200 232 Z" fill="#2f8fd8" stroke="#1d5f99" stroke-width="3"/>
    <path d="M380 228 Q 450 230 470 246 Q 430 250 380 240 Z" fill="#2f8fd8" stroke="#1d5f99" stroke-width="3"/>
    """
    return defs, cuerpo


CUERPOS = {"fresa": _cuerpo_fresa, "mango": _cuerpo_mango, "uva": _cuerpo_uva, "pina": _cuerpo_pina, "limon": _cuerpo_limon}


# ------------------------------------------------------------------ cara
def _corazon(x, y, s, color):
    return (f'<path d="M{x} {y + s * .9} C {x - s * 1.4} {y - s * .1} {x - s * .7} {y - s * 1.1} {x} {y - s * .35} '
            f'C {x + s * .7} {y - s * 1.1} {x + s * 1.4} {y - s * .1} {x} {y + s * .9} Z" fill="{color}"/>')


def _cara(p, expr, boca, parpadeo):
    cx, cy = p["cara"]
    k = p["k"]
    fem = p["femenina"]
    out = []
    sorpresa = expr in ("sorpresa", "nervioso")
    dx, rx, ry = 66 * k, (50 if sorpresa else 46) * k, (60 if sorpresa else 54) * k
    ey = cy

    for lado in (-1, 1):
        ex = cx + lado * dx
        cid = f"ojo{'i' if lado < 0 else 'd'}"
        if parpadeo:
            out.append(f'<path d="M{ex - rx} {ey + 6 * k} Q {ex} {ey + ry * .55} {ex + rx} {ey + 6 * k}" stroke="{OSCURO}" stroke-width="{7 * k}" fill="none" stroke-linecap="round"/>')
        else:
            out.append(f'<clipPath id="{cid}"><ellipse cx="{ex}" cy="{ey}" rx="{rx}" ry="{ry}"/></clipPath>')
            out.append(f'<ellipse cx="{ex}" cy="{ey}" rx="{rx}" ry="{ry}" fill="url(#esclera)"/>')
            g = [f'<g clip-path="url(#{cid})">']
            px, py = 0, 6 * k
            if expr == "chisme":
                px = 16 * k
            elif expr in ("triste", "llanto"):
                py = -6 * k
            ir = (22 if sorpresa else 29) * k
            if expr == "amor":
                g.append(_corazon(ex + px, ey + py, 28 * k, "#e8264f"))
                g.append(f'<circle cx="{ex + px - 10 * k}" cy="{ey + py - 10 * k}" r="{6 * k}" fill="#fff"/>')
            else:
                g.append(f'<circle cx="{ex + px}" cy="{ey + py}" r="{ir}" fill="url(#iris)"/>')
                g.append(f'<circle cx="{ex + px}" cy="{ey + py}" r="{ir * .5}" fill="#120a12"/>')
                g.append(f'<circle cx="{ex + px - ir * .35}" cy="{ey + py - ir * .4}" r="{ir * .28}" fill="#fff"/>')
                g.append(f'<circle cx="{ex + px + ir * .35}" cy="{ey + py + ir * .3}" r="{ir * .13}" fill="#fff"/>')
            if expr == "llanto":
                g.append(f'<rect x="{ex - rx}" y="{ey + ry * .45}" width="{rx * 2}" height="{ry}" fill="#7fc8ff" opacity="0.55"/>')
            # párpados que expresan emoción
            lid = p["parpado"]
            ar, ab = ey - ry - 8, None
            if expr == "enojo":
                yo, yi = ey - ry * .55, ey - ry * .05
            elif expr in ("triste", "llanto"):
                yo, yi = ey - ry * .2, ey - ry * .65
            elif expr == "chisme":
                yo = yi = ey - ry * .22
            else:
                yo = yi = None
            if yo is not None:
                xo, xi = ex - lado * (rx + 4), ex + lado * (rx + 4)
                g.append(f'<path d="M{xo} {ar} L{xi} {ar} L{xi} {yi} L{xo} {yo} Z" fill="{lid}"/>')
                g.append(f'<path d="M{xi} {yi} L{xo} {yo}" stroke="{OSCURO}" stroke-width="{5 * k}"/>')
            if expr in ("feliz", "amor"):
                g.append(f'<path d="M{ex - rx - 4} {ey + ry * .62} Q {ex} {ey + ry * .2} {ex + rx + 4} {ey + ry * .62} L{ex + rx + 4} {ey + ry + 6} L{ex - rx - 4} {ey + ry + 6} Z" fill="{lid}"/>')
            g.append("</g>")
            out += g
            out.append(f'<ellipse cx="{ex}" cy="{ey}" rx="{rx}" ry="{ry}" fill="none" stroke="{OSCURO}" stroke-width="{5 * k}"/>')
        # pestañas
        if fem:
            for j, (ox, oy, lx, ly) in enumerate([(.55, -.82, .95, -1.25), (.8, -.6, 1.25, -.9), (.93, -.32, 1.38, -.48)]):
                out.append(f'<path d="M{ex + lado * rx * ox} {ey + ry * oy} Q {ex + lado * rx * (ox + .2)} {ey + ry * (oy - .35)} {ex + lado * rx * lx} {ey + ry * ly}" '
                           f'stroke="{OSCURO}" stroke-width="{6 * k}" fill="none" stroke-linecap="round"/>')
        # cejas
        by = ey - ry - 26 * k
        if expr in ("triste", "llanto", "nervioso"):
            a, b = (ex - lado * 34 * k, by + 12 * k), (ex + lado * 34 * k, by - 12 * k)
            a, b = (ex + lado * 34 * k, by + 14 * k), (ex - lado * 30 * k, by - 10 * k)
            ctrl = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6 * k)
        elif expr == "enojo":
            a, b = (ex + lado * 38 * k, by - 12 * k), (ex - lado * 30 * k, by + 16 * k)
            ctrl = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 4 * k)
        elif expr == "chisme" and lado > 0:
            a, b = (ex - 34 * k, by - 16 * k), (ex + 36 * k, by - 6 * k)
            ctrl = (ex, by - 34 * k)
        elif sorpresa:
            a, b = (ex - 34 * k, by - 10 * k), (ex + 34 * k, by - 10 * k)
            ctrl = (ex, by - 34 * k)
        else:
            a, b = (ex - 34 * k, by + 2 * k), (ex + 34 * k, by + 2 * k)
            ctrl = (ex, by - 16 * k)
        gw = (16 if not fem else 10) * k
        out.append(f'<path d="M{a[0]} {a[1]} Q {ctrl[0]} {ctrl[1]} {b[0]} {b[1]}" stroke="{p["ceja"]}" stroke-width="{gw}" fill="none" stroke-linecap="round"/>')

    # chapitas
    if expr in ("feliz", "amor", "chisme", "nervioso", "sorpresa"):
        for lado in (-1, 1):
            out.append(f'<ellipse cx="{cx + lado * 108 * k}" cy="{ey + 62 * k}" rx="{34 * k}" ry="{20 * k}" fill="url(#chapa)"/>')

    # lágrimas
    if expr == "llanto":
        for lado in (-1, 1):
            ex = cx + lado * dx
            out.append(f'<path d="M{ex + lado * 10 * k} {ey + ry * .8} Q {ex + lado * 26 * k} {ey + 110 * k} {ex + lado * 18 * k} {ey + 170 * k}" '
                       f'stroke="url(#lagrima)" stroke-width="{13 * k}" fill="none" stroke-linecap="round"/>')
            dxp, dyp = ex + lado * 18 * k, ey + 185 * k
            out.append(f'<path d="M{dxp} {dyp - 22 * k} Q {dxp + 14 * k} {dyp} {dxp} {dyp + 10 * k} Q {dxp - 14 * k} {dyp} {dxp} {dyp - 22 * k} Z" fill="url(#lagrima)"/>')

    # sudor
    if expr == "nervioso":
        sx, sy = cx + 150 * k, ey - 95 * k
        out.append(f'<path d="M{sx} {sy - 30 * k} Q {sx + 20 * k} {sy + 4 * k} {sx} {sy + 14 * k} Q {sx - 20 * k} {sy + 4 * k} {sx} {sy - 30 * k} Z" fill="url(#lagrima)" stroke="#3a8ad8" stroke-width="2"/>')

    # bigote del galán
    my = ey + 98 * k
    if p is PERSONAJES["mango"]:
        bx, byy = cx, ey + 82 * k
        for lado in (-1, 1):
            out.append(f'<path d="M{bx} {byy} C {bx + lado * 22 * k} {byy - 14 * k} {bx + lado * 62 * k} {byy - 10 * k} {bx + lado * 80 * k} {byy + 14 * k} '
                       f'C {bx + lado * 58 * k} {byy + 6 * k} {bx + lado * 28 * k} {byy + 16 * k} {bx} {byy + 10 * k} Z" fill="#4a2614"/>')
        my = ey + 112 * k

    # boca
    sw = 7 * k
    labio = "#d01e4a" if p is PERSONAJES["uva"] else OSCURO
    if boca:
        if expr in ("sorpresa", "llanto", "nervioso"):
            w, h = 30 * k, 46 * k
        else:
            w, h = 40 * k, 40 * k
        forma = (f"M{cx - w} {my - 4 * k} Q {cx} {my - 12 * k} {cx + w} {my - 4 * k} "
                 f"Q {cx + w * .9} {my + h} {cx} {my + h * 1.05} Q {cx - w * .9} {my + h} {cx - w} {my - 4 * k} Z")
        out.append('<clipPath id="bocaclip"><path d="%s"/></clipPath>' % forma)
        out.append(f'<path d="{forma}" fill="#5a0f22"/>')
        out.append(f'<g clip-path="url(#bocaclip)"><rect x="{cx - w}" y="{my - 14 * k}" width="{2 * w}" height="{16 * k}" rx="{5 * k}" fill="#fff"/>'
                   f'<ellipse cx="{cx}" cy="{my + h * .95}" rx="{w * .65}" ry="{h * .38}" fill="#f0607a"/></g>')
        out.append(f'<path d="{forma}" fill="none" stroke="{labio}" stroke-width="{sw * .8}" stroke-linejoin="round"/>')
    elif expr in ("feliz", "amor"):
        out.append(f'<path d="M{cx - 36 * k} {my - 6 * k} Q {cx} {my + 34 * k} {cx + 36 * k} {my - 6 * k} Q {cx} {my + 6 * k} {cx - 36 * k} {my - 6 * k} Z" fill="#5a0f22" stroke="{labio}" stroke-width="{sw * .8}" stroke-linejoin="round"/>')
        out.append(f'<path d="M{cx - 28 * k} {my - 1 * k} Q {cx} {my + 6 * k} {cx + 28 * k} {my - 1 * k} L {cx + 24 * k} {my + 6 * k} Q {cx} {my + 12 * k} {cx - 24 * k} {my + 6 * k} Z" fill="#fff"/>')
    elif expr == "sorpresa":
        out.append(f'<ellipse cx="{cx}" cy="{my + 8 * k}" rx="{14 * k}" ry="{18 * k}" fill="#5a0f22" stroke="{labio}" stroke-width="{sw * .8}"/>')
    elif expr in ("triste", "llanto"):
        out.append(f'<path d="M{cx - 30 * k} {my + 18 * k} Q {cx} {my - 8 * k} {cx + 30 * k} {my + 18 * k}" stroke="{labio}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>')
    elif expr == "enojo":
        out.append(f'<path d="M{cx - 32 * k} {my + 4 * k} L {cx + 32 * k} {my + 4 * k} L {cx + 26 * k} {my + 20 * k} L {cx - 26 * k} {my + 20 * k} Z" fill="#fff" stroke="{labio}" stroke-width="{sw * .8}" stroke-linejoin="round"/>')
        out.append(f'<path d="M{cx - 28 * k} {my + 12 * k} L {cx + 28 * k} {my + 12 * k}" stroke="#c8ccd6" stroke-width="{2.5 * k}"/>')
    elif expr == "nervioso":
        out.append(f'<path d="M{cx - 34 * k} {my + 6 * k} Q {cx - 17 * k} {my - 4 * k} {cx} {my + 6 * k} Q {cx + 17 * k} {my + 16 * k} {cx + 34 * k} {my + 6 * k}" stroke="{labio}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>')
    elif expr == "chisme":
        out.append(f'<path d="M{cx - 26 * k} {my + 8 * k} Q {cx + 6 * k} {my + 22 * k} {cx + 34 * k} {my - 6 * k}" stroke="{labio}" stroke-width="{sw * 1.2}" fill="none" stroke-linecap="round"/>')
    return "".join(out)


# ------------------------------------------------------------------ brazos y piernas
def _mano(x, y, tipo="abierta", ang=0):
    m = (f'<g transform="rotate({ang} {x} {y})">'
         f'<circle cx="{x}" cy="{y}" r="22" fill="url(#guante)" stroke="#9aa4b4" stroke-width="3"/>'
         f'<ellipse cx="{x - 16}" cy="{y - 10}" rx="9" ry="13" fill="url(#guante)" stroke="#9aa4b4" stroke-width="3" transform="rotate(-30 {x - 16} {y - 10})"/>')
    if tipo == "dedo":
        m += f'<rect x="{x + 12}" y="{y - 8}" width="34" height="15" rx="7" fill="url(#guante)" stroke="#9aa4b4" stroke-width="3"/>'
    return m + "</g>"


def _brazos(p, pose):
    (lx, ly), (rx_, ry_) = p["hombros"]
    cx, cy = p["cara"]
    col = p["extremidad"]
    out, manos = [], []

    def brazo(s, e, h, tipo="abierta", ang=0):
        out.append(f'<path d="M{s[0]} {s[1]} Q {e[0]} {e[1]} {h[0]} {h[1]}" stroke="{col}" stroke-width="17" fill="none" stroke-linecap="round"/>')
        manos.append(_mano(h[0], h[1], tipo, ang))

    for lado, (sx, sy) in ((-1, (lx, ly)), (1, (rx_, ry_))):
        if pose == "cintura" or (pose == "senalar" and lado < 0):
            brazo((sx, sy), (sx + lado * 75, sy + 55), (sx - lado * 2, sy + 135))
        elif pose == "drama" and lado > 0:
            brazo((sx, sy), (sx + 70, sy - 90), (cx + 95, cy - 120), ang=-40)
        elif pose == "senalar" and lado > 0:
            brazo((sx, sy), (sx + 70, sy - 10), (sx + 150, sy - 50), "dedo", ang=-20)
        elif pose == "corazon":
            brazo((sx, sy), (sx + lado * 30, sy + 90), (cx + lado * 26, cy + 200))
        elif pose == "explicar" and lado > 0:
            brazo((sx, sy), (sx + 70, sy + 40), (sx + 85, sy - 45), ang=-20)
        elif pose == "manos_cara":
            brazo((sx, sy), (sx + lado * 20, sy + 80), (cx + lado * 128, cy + 70))
        else:
            brazo((sx, sy), (sx + lado * 40, sy + 85), (sx + lado * 52, sy + 165))
    return "".join(out), "".join(manos)


def _piernas(p):
    out = []
    for lado, (hx, hy) in zip((-1, 1), p["caderas"]):
        fx, fy = hx + lado * 18, 770
        out.append(f'<path d="M{hx} {hy} Q {hx + lado * 6} {(hy + fy) / 2} {fx} {fy}" stroke="{p["extremidad"]}" stroke-width="17" fill="none" stroke-linecap="round"/>')
        out.append(f'<ellipse cx="{fx + lado * 16}" cy="{fy + 8}" rx="38" ry="20" fill="{p["zapato"]}" stroke="{OSCURO}" stroke-width="4"/>'
                   f'<ellipse cx="{fx + lado * 8}" cy="{fy}" rx="14" ry="6" fill="#fff" opacity="0.45"/>')
    return "".join(out)


# ------------------------------------------------------------------ render
def svg(tipo, expr="feliz", boca=False, parpadeo=False, pose="normal", silueta=False):
    p = PERSONAJES[tipo]
    defs_c, cuerpo = CUERPOS[tipo]()
    brazos, manos = _brazos(p, pose)
    cara = "" if silueta else _cara(p, expr, boca, parpadeo)
    contenido = f"{_piernas(p)}{cuerpo}{cara}{brazos}{manos}"
    if silueta:
        contenido = f'<g filter="none">{contenido}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB_X} {VB_Y} {VB_W} {VB_H}" width="{VB_W}" height="{VB_H}">'
            f'<defs>{_defs_comunes(p)}{defs_c}</defs>{contenido}</svg>')


@lru_cache(maxsize=256)
def render(tipo, expr="feliz", boca=False, parpadeo=False, pose="normal", ancho=600, silueta=False):
    png = cairosvg.svg2png(bytestring=svg(tipo, expr, boca, parpadeo, pose).encode(), output_width=ancho)
    img = Image.open(io.BytesIO(png)).convert("RGBA")
    if silueta:
        a = img.split()[3]
        img = Image.new("RGBA", img.size, (18, 10, 30, 255))
        img.putalpha(a)
    return img


def cara_en_pixeles(tipo, ancho):
    """Dónde queda la cara dentro de la imagen renderizada (para encuadres de primer plano)."""
    cx, cy = PERSONAJES[tipo]["cara"]
    esc = ancho / VB_W
    return (cx - VB_X) * esc, (cy - VB_Y) * esc


if __name__ == "__main__":
    import sys
    tipos = ["fresa", "mango", "uva", "pina", "limon"]
    filas = [("feliz", "normal"), ("llanto", "drama"), ("enojo", "cintura"), ("chisme", "senalar"), ("amor", "corazon"), ("nervioso", "manos_cara")]
    W1 = 300
    H1 = int(W1 * VB_H / VB_W)
    hoja = Image.new("RGBA", (W1 * len(tipos), H1 * len(filas)), (235, 225, 240, 255))
    for j, (e, po) in enumerate(filas):
        for i, t in enumerate(tipos):
            hoja.alpha_composite(render(t, e, j % 2 == 1, False, po, W1), (i * W1, j * H1))
    hoja.convert("RGB").save(sys.argv[1] if len(sys.argv) > 1 else "personajes.png")
