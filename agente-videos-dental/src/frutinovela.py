"""
Fabrica una FRUTINOVELA (telenovela de frutas) vertical 1080x1920 a partir de un guion JSON.

Cada personaje tiene su propia voz, sus caras (feliz, triste, llanto, enojo,
sorpresa, amor, chisme) y mueve la boca cuando habla. Las líneas con
"drama": true llevan acorde dramático de telenovela y zoom.

Uso:
  python frutinovela.py guiones/frutinovela-01.json salida/frutinovela-01.mp4
"""
import asyncio
import json
import math
import os
import subprocess
import sys
import tempfile

import edge_tts
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FPS = 30
PAUSA = 0.25
RETRASO_DRAMA = 0.7  # la voz entra después del "¡tan tan taaan!"

F_BLACK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
F_BOLD = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
F_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
if not os.path.exists(F_BLACK):
    F_BLACK = F_BOLD

NEGRO = (30, 20, 30)
BLANCO = (255, 255, 255)
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")


# ============================================================ voz
async def _voz(texto, p, ruta):
    com = edge_tts.Communicate(texto, p["voz"], rate=p.get("rate", "+0%"), pitch=p.get("pitch", "+0Hz"),
                               boundary="WordBoundary", proxy=PROXY)
    palabras = []
    with open(ruta, "wb") as f:
        async for t in com.stream():
            if t["type"] == "audio":
                f.write(t["data"])
            elif t["type"] == "WordBoundary":
                palabras.append({"texto": t["text"], "inicio": t["offset"] / 1e7,
                                 "fin": (t["offset"] + t["duration"]) / 1e7})
    return palabras


def duracion(ruta):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "default=nw=1:nk=1", ruta]))


def acorde_dramatico(ruta):
    """'¡Tan, tan, taaan!' — tres golpes de un acorde menor con eco."""
    def golpe(a, largo, freqs, vol):
        ondas = "+".join(f"sin(2*PI*{f}*t)" for f in freqs)
        return f"(gte(t,{a})*exp(-(t-{a})*3/{largo})*({ondas})*{vol})"
    expr = "+".join([
        golpe(0.00, 0.30, [110, 220, 261.6, 329.6], 0.10),
        golpe(0.28, 0.30, [110, 220, 261.6, 329.6], 0.10),
        golpe(0.56, 2.20, [103.8, 207.6, 246.9, 311.1, 415.3], 0.09),
    ])
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                    f"aevalsrc='{expr}':s=24000:d=2.6", "-af", "aecho=0.8:0.6:60:0.3,volume=1.4", ruta], check=True)


# ============================================================ caras
def corazon(d, cx, cy, s, color):
    d.ellipse([cx - s, cy - s * .6, cx, cy + s * .3], fill=color)
    d.ellipse([cx, cy - s * .6, cx + s, cy + s * .3], fill=color)
    d.polygon([(cx - s * .97, cy - s * .05), (cx + s * .97, cy - s * .05), (cx, cy + s * 1.0)], fill=color)


def cara(d, cx, cy, s, expr, boca_abierta, femenina, bigote=False):
    ex = s * .30
    ey = cy - s * .08
    er = s * (.19 if expr == "sorpresa" else .16)
    # ojos
    for lado in (-1, 1):
        x = cx + lado * ex
        d.ellipse([x - er, ey - er * 1.1, x + er, ey + er * 1.1], fill=BLANCO, outline=NEGRO, width=max(3, int(s * .02)))
        if expr == "amor":
            corazon(d, x, ey - er * .1, er * .7, (230, 30, 70))
        else:
            dx = er * .35 if expr == "chisme" else 0
            pr = er * (.45 if expr == "sorpresa" else .55)
            d.ellipse([x - pr + dx, ey - pr, x + pr + dx, ey + pr], fill=NEGRO)
            d.ellipse([x - pr * .35 + dx + pr * .3, ey - pr * .7, x + pr * .15 + dx + pr * .3, ey - pr * .2], fill=BLANCO)
        if femenina:
            for k in (-.5, 0, .5):
                x0 = x + lado * er * (.55 + k * .5)
                d.line([(x0, ey - er * 1.0), (x0 + lado * er * .3, ey - er * 1.55)], fill=NEGRO, width=max(3, int(s * .025)))
        # cejas
        yb = ey - er * 1.75
        if expr in ("triste", "llanto"):
            p1, p2 = (x - lado * er * .9, yb), (x + lado * er * .9, yb + er * .5)
            p1, p2 = (x + lado * er * .9, yb + er * .45), (x - lado * er * .9, yb - er * .1)
        elif expr == "enojo":
            p1, p2 = (x + lado * er * .9, yb - er * .25), (x - lado * er * .9, yb + er * .5)
        elif expr == "chisme" and lado == 1:
            p1, p2 = (x - er * .9, yb - er * .3), (x + er * .9, yb - er * .5)
        elif expr == "sorpresa":
            p1, p2 = (x - er * .9, yb - er * .35), (x + er * .9, yb - er * .35)
        else:
            p1, p2 = (x - er * .9, yb), (x + er * .9, yb)
        grosor = int(s * (.07 if bigote else .045))
        d.line([p1, p2], fill=NEGRO, width=grosor)
    # lágrimas
    if expr == "llanto":
        for lado in (-1, 1):
            x = cx + lado * ex
            for j, yy in enumerate((ey + er * 1.4, ey + er * 2.6)):
                r = er * (.32 - j * .06)
                d.ellipse([x - r, yy - r, x + r, yy + r * 1.2], fill=(90, 170, 255))
                d.polygon([(x - r * .9, yy - r * .2), (x + r * .9, yy - r * .2), (x, yy - r * 2)], fill=(90, 170, 255))
    # chapitas
    if expr in ("amor", "feliz", "chisme"):
        for lado in (-1, 1):
            x = cx + lado * s * .48
            d.ellipse([x - s * .11, ey + er * 1.2, x + s * .11, ey + er * 1.2 + s * .1], fill=(255, 120, 140))
    # bigote de galán
    my = cy + s * .28
    if bigote:
        for lado in (-1, 1):
            d.ellipse([cx + (lado < 0) * -s * .22, my - s * .1, cx + (lado > 0) * s * .22, my], fill=(80, 40, 20))
        my += s * .05
    # boca
    lw = max(4, int(s * .035))
    if boca_abierta:
        bw = s * (.20 if expr == "sorpresa" else .24)
        bh = s * (.22 if expr in ("sorpresa", "llanto", "enojo") else .17)
        d.ellipse([cx - bw, my - bh * .4, cx + bw, my + bh], fill=(110, 20, 40), outline=NEGRO, width=lw)
        d.ellipse([cx - bw * .55, my + bh * .35, cx + bw * .55, my + bh * .95], fill=(240, 100, 120))
    elif expr == "sorpresa":
        d.ellipse([cx - s * .07, my - s * .04, cx + s * .07, my + s * .12], fill=(110, 20, 40), outline=NEGRO, width=lw)
    elif expr in ("triste", "llanto", "enojo"):
        d.arc([cx - s * .2, my + s * .02, cx + s * .2, my + s * .3], 200, 340, fill=NEGRO, width=lw)
    elif expr == "chisme":
        d.arc([cx - s * .12, my - s * .15, cx + s * .26, my + s * .1], 20, 140, fill=NEGRO, width=lw)
    else:
        d.arc([cx - s * .2, my - s * .18, cx + s * .2, my + s * .1], 20, 160, fill=NEGRO, width=lw)


# ============================================================ frutas
def recortar(capa_detalle, mascara):
    """Deja el detalle solo donde está el cuerpo de la fruta."""
    vacio = Image.new("RGBA", capa_detalle.size, (0, 0, 0, 0))
    return Image.composite(capa_detalle, vacio, mascara)


def fruta(tipo, expr, boca, s=200, silueta=False):
    T = int(s * 3.2)
    img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = T / 2, T / 2 + s * .15
    mask = Image.new("L", (T, T), 0)
    dm = ImageDraw.Draw(mask)
    det = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    dd = ImageDraw.Draw(det)
    contorno = max(5, int(s * .035))
    fy = cy  # centro de la cara

    if tipo == "fresa":
        cuerpo = (225, 35, 60)
        for dr in (d, dm):
            c = cuerpo if dr is d else 255
            dr.ellipse([cx - s, cy - s * .95, cx + s, cy + s * .45], fill=c)
            dr.polygon([(cx - s * .96, cy - s * .15), (cx + s * .96, cy - s * .15), (cx + s * .12, cy + s * 1.15),
                        (cx - s * .12, cy + s * 1.15)], fill=c)
            dr.ellipse([cx - s * .2, cy + s * .95, cx + s * .2, cy + s * 1.25], fill=c)
        for (a, b) in [(-.8, -.5), (.8, -.5), (-.85, .1), (.85, .1), (-.55, .55), (.55, .55), (-.25, .9), (.25, .9),
                       (0, .7), (-.6, -.75), (.6, -.75)]:
            x, y = cx + a * s, cy + b * s
            dd.ellipse([x - s * .04, y - s * .06, x + s * .04, y + s * .06], fill=(255, 225, 90))
        # hojas
        hojas = []
        for i in range(10):
            ang = math.pi * 2 * i / 10 - math.pi / 2
            r = s * (.55 if i % 2 == 0 else .2)
            hojas.append((cx + r * math.cos(ang) * 1.3, cy - s * .92 + r * math.sin(ang) * .55))
        fy = cy - s * .1
    elif tipo == "mango":
        cuerpo = (255, 170, 40)
        for dr in (d, dm):
            c = cuerpo if dr is d else 255
            dr.ellipse([cx - s * .88, cy - s * 1.05, cx + s * .88, cy + s * 1.05], fill=c)
        dd.ellipse([cx - s * .2, cy - s * 1.3, cx + s * 1.2, cy - s * .1], fill=(245, 95, 55, 200))
        det = det.filter(ImageFilter.GaussianBlur(s * .15))
        dd = ImageDraw.Draw(det)
        fy = cy - s * .05
    elif tipo == "uva":
        cuerpo = (125, 50, 165)
        bolitas = [(0, -.2, .68)]
        for (a, b) in [(-.75, -.75), (0, -.95), (.75, -.75), (-.95, 0), (.95, 0), (-.65, .65), (.65, .65), (0, .85),
                       (-.35, 1.2), (.35, 1.2)]:
            bolitas.append((a, b, .36))
        for (a, b, r) in bolitas:
            x, y = cx + a * s, cy + b * s
            for dr in (d, dm):
                dr.ellipse([x - r * s, y - r * s, x + r * s, y + r * s], fill=cuerpo if dr is d else 255,
                           outline=(85, 25, 120) if dr is d else 255, width=contorno if dr is d else 0)
            if r < .5:
                dd.ellipse([x - r * s * .5, y - r * s * .6, x - r * s * .1, y - r * s * .2], fill=(190, 130, 220))
        fy = cy - s * .2
    elif tipo == "pina":
        cuerpo = (250, 200, 50)
        corona = []
        for i, (a, h) in enumerate([(-.5, .8), (-.25, 1.15), (0, 1.35), (.25, 1.15), (.5, .8)]):
            corona.append([(cx + a * s - s * .18, cy - s * .75), (cx + a * s * 1.4, cy - s * .75 - h * s),
                           (cx + a * s + s * .18, cy - s * .75)])
        for pts in corona:
            d.polygon(pts, fill=(60, 160, 70), outline=(30, 100, 40))
        for dr in (d, dm):
            c = cuerpo if dr is d else 255
            dr.ellipse([cx - s * .82, cy - s * .9, cx + s * .82, cy + s * 1.05], fill=c)
        for k in range(-6, 7):
            x = cx + k * s * .28
            dd.line([(x - s * 1.2, cy - s * 1.2), (x + s * 1.2, cy + s * 1.2)], fill=(215, 150, 30), width=int(s * .03))
            dd.line([(x + s * 1.2, cy - s * 1.2), (x - s * 1.2, cy + s * 1.2)], fill=(215, 150, 30), width=int(s * .03))
        # bata de doctora
        dd.polygon([(cx - s * 1.2, cy + s * .55), (cx - s * .15, cy + s * .55), (cx, cy + s * .9),
                    (cx + s * .15, cy + s * .55), (cx + s * 1.2, cy + s * .55), (cx + s * 1.2, cy + s * 1.3),
                    (cx - s * 1.2, cy + s * 1.3)], fill=BLANCO)
        dd.line([(cx - s * .15, cy + s * .55), (cx, cy + s * .9), (cx + s * .15, cy + s * .55)], fill=(180, 190, 200), width=int(s * .03))
        # pin de diente en la bata
        px, py = cx - s * .45, cy + s * .8
        dd.ellipse([px - s * .1, py - s * .1, px + s * .1, py + s * .1], fill=(0, 150, 170))
        fy = cy - s * .05

    img.alpha_composite(recortar(det, mask))
    d = ImageDraw.Draw(img)
    # contorno general
    borde = mask.filter(ImageFilter.MaxFilter(int(contorno) * 2 + 1))
    sombra = Image.new("RGBA", (T, T), NEGRO + (255,))
    fondo_borde = Image.composite(sombra, Image.new("RGBA", (T, T), (0, 0, 0, 0)), borde)
    fondo_borde.alpha_composite(img)
    img = fondo_borde
    d = ImageDraw.Draw(img)

    if tipo == "fresa":
        d.polygon(hojas, fill=(60, 170, 70), outline=(30, 100, 40))
    elif tipo == "mango":
        d.rounded_rectangle([cx - s * .05, cy - s * 1.25, cx + s * .07, cy - s * .98], radius=6, fill=(110, 70, 30))
        d.ellipse([cx + s * .05, cy - s * 1.35, cx + s * .6, cy - s * 1.08], fill=(70, 170, 70), outline=(30, 100, 40), width=4)
    elif tipo == "uva":
        d.rounded_rectangle([cx - s * .05, cy - s * 1.5, cx + s * .07, cy - s * 1.2], radius=6, fill=(110, 70, 30))
        d.ellipse([cx - s * .65, cy - s * 1.55, cx - s * .05, cy - s * 1.25], fill=(70, 170, 70), outline=(30, 100, 40), width=4)
        # aretes de chismosa
        for lado in (-1, 1):
            d.ellipse([cx + lado * s * .62 - s * .06, cy + s * .02, cx + lado * s * .62 + s * .06, cy + s * .14],
                      fill=(255, 215, 80), outline=NEGRO, width=3)

    if silueta:
        a = img.split()[3]
        img = Image.new("RGBA", (T, T), (15, 10, 25, 255))
        img.putalpha(a)
        return img

    femenina = tipo in ("fresa", "uva", "pina")
    cara(d, cx, fy, s * (.95 if tipo != "uva" else .85), expr, boca, femenina, bigote=(tipo == "mango"))
    if tipo == "pina":  # espejo de dentista en la frente
        d.ellipse([cx - s * .18, fy - s * .78, cx + s * .18, fy - s * .48], fill=(220, 230, 240), outline=(120, 130, 140), width=5)
        d.line([(cx - s * .7, fy - s * .55), (cx - s * .18, fy - s * .63)], fill=(60, 60, 70), width=int(s * .05))
        d.line([(cx + s * .18, fy - s * .63), (cx + s * .7, fy - s * .55)], fill=(60, 60, 70), width=int(s * .05))
    return img


# ============================================================ escenas
def degradado(arriba, abajo):
    g = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        g.putpixel((0, y), tuple(int(arriba[i] * (1 - t) + abajo[i] * t) for i in range(3)))
    return g.resize((W, H), Image.BILINEAR).convert("RGBA")


def texto_sombra(d, xy, txt, f, color, sombra=(0, 0, 0, 140), off=5, anchor="mm"):
    d.text((xy[0] + off, xy[1] + off), txt, font=f, fill=sombra, anchor=anchor)
    d.text(xy, txt, font=f, fill=color, anchor=anchor)


def escenario(lugar_id, lugar, guion):
    img = degradado(lugar["arriba"], lugar["abajo"])
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    if lugar_id == "casa":
        # ventana y cortinas de telenovela
        d.rounded_rectangle([140, 330, 940, 820], radius=30, fill=(255, 240, 220, 120))
        d.line([(540, 330), (540, 820)], fill=(255, 255, 255, 160), width=12)
        d.line([(140, 575), (940, 575)], fill=(255, 255, 255, 160), width=12)
        for x0, x1 in ((80, 300), (780, 1000)):
            d.polygon([(x0, 290), (x1, 290), (x1 - 60, 900), (x0, 900)] if x0 < 500 else
                      [(x0, 290), (x1, 290), (x1, 900), (x0 + 60, 900)], fill=(150, 20, 60))
        d.rectangle([60, 270, 1020, 300], fill=(110, 60, 30))
        d.rectangle([0, 1330, W, H], fill=(120, 60, 50, 90))
    elif lugar_id == "clinica":
        d.rectangle([0, 1330, W, H], fill=(230, 245, 250, 110))
        # sillón dental estilizado y cruz
        d.rounded_rectangle([700, 360, 960, 620], radius=40, fill=(255, 255, 255, 170))
        d.rectangle([805, 400, 855, 580], fill=(0, 150, 170))
        d.rectangle([740, 465, 920, 515], fill=(0, 150, 170))
    img.alpha_composite(capa)
    d = ImageDraw.Draw(img)
    if lugar["nombre"]:
        f = ImageFont.truetype(F_SEMI, 38)
        tw = d.textlength(lugar["nombre"], font=f)
        d.rounded_rectangle([(W - tw) / 2 - 34, 160, (W + tw) / 2 + 34, 240], radius=40, fill=(255, 255, 255, 235))
        d.text((W / 2, 200), lugar["nombre"], font=f, fill=(40, 30, 50), anchor="mm")
    return img


def portada(img, guion, final=False):
    d = ImageDraw.Draw(img)
    # destellos
    for (x, y, r) in [(160, 300, 10), (920, 420, 14), (840, 200, 8), (230, 760, 9), (980, 880, 7), (100, 1000, 12)]:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 220, 255, 200))
    if not final:
        texto_sombra(d, (W / 2, 470), guion["serie"], ImageFont.truetype(F_BLACK, 130), (255, 215, 80), off=8)
        corazon(d, W / 2, 640, 70, (230, 30, 70))
        texto_sombra(d, (W / 2, 820), guion["titulo"], ImageFont.truetype(F_BOLD, 108), BLANCO)
        texto_sombra(d, (W / 2, 950), guion["capitulo"], ImageFont.truetype(F_SEMI, 56), (255, 190, 220))
    else:
        texto_sombra(d, (W / 2, 380), "¿CONTINUARÁ...?", ImageFont.truetype(F_BLACK, 110), (255, 215, 80), off=8)
        d.rounded_rectangle([110, 560, 970, 900], radius=50, fill=(255, 255, 255, 240))
        d.text((W / 2, 650), "Agende su limpieza", font=ImageFont.truetype(F_BOLD, 74), fill=(10, 100, 140), anchor="mm")
        d.text((W / 2, 750), "y revisión dental", font=ImageFont.truetype(F_BOLD, 74), fill=(10, 100, 140), anchor="mm")
        d.text((W / 2, 845), "Col. Moderna · San Pedro Sula", font=ImageFont.truetype(F_SEMI, 46), fill=(60, 60, 80), anchor="mm")
    # elenco abajo
    for i, t in enumerate(["fresa", "mango", "uva", "pina"]):
        caritas = {"fresa": "llanto", "mango": "amor", "uva": "chisme", "pina": "feliz"}
        fr = fruta(t, caritas[t] if not final else ("feliz" if t != "uva" else "chisme"), False, s=95)
        img.alpha_composite(fr, (int(135 + i * 270 - fr.width / 2 + 0), int(1140 - fr.height / 2)))


POSICIONES = {1: [540], 2: [300, 780], 3: [210, 540, 870]}


def dibujar(linea, guion, boca, cache_fondos):
    lugar_id = linea["lugar"]
    if lugar_id not in cache_fondos:
        cache_fondos[lugar_id] = escenario(lugar_id, guion["lugares"][lugar_id], guion)
    img = cache_fondos[lugar_id].copy()
    if lugar_id in ("portada", "final"):
        portada(img, guion, final=(lugar_id == "final"))
        return img
    quienes = linea["en_escena"]
    xs = POSICIONES[len(quienes)]
    s_base = {1: 250, 2: 215, 3: 165}[len(quienes)]
    d = ImageDraw.Draw(img)
    for q, x in zip(quienes, xs):
        habla = (q == linea["quien"])
        s = int(s_base * (1.08 if habla else .95))
        expr = linea.get("caras", {}).get(q, "feliz")
        fr = fruta(guion["personajes"][q]["fruta"], expr, boca and habla, s=s, silueta=linea.get("silueta", False))
        piso = 1290
        sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sombra).ellipse([x - s * .8, piso - s * .12, x + s * .8, piso + s * .12], fill=(0, 0, 0, 70))
        img.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(8)))
        if habla and not linea.get("silueta"):
            brillo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(brillo).ellipse([x - s * 1.25, piso - s * 2.9, x + s * 1.25, piso - s * .2], fill=(255, 255, 255, 90))
            img.alpha_composite(brillo.filter(ImageFilter.GaussianBlur(40)))
        img.alpha_composite(fr, (int(x - fr.width / 2), int(piso - fr.height * .5 - s * 1.2)))
        d = ImageDraw.Draw(img)
    return img


# ============================================================ subtítulos
def t_ass(t):
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def escribir_ass(eventos_lineas, ruta):
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter ExtraBold,74,&H00FFFFFF,&H00FFFFFF,&H00201020,&H78000000,1,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1
Style: Nombre,Inter ExtraBold,50,&H00FFFFFF,&H00FFFFFF,&H00201020,&H78000000,1,0,0,0,100,100,2,0,1,6,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    out = []
    for (ini_linea, fin_linea, nombre, color, palabras, cursiva) in eventos_lineas:
        if nombre:
            out.append(f"Dialogue: 0,{t_ass(ini_linea)},{t_ass(fin_linea)},Nombre,,0,0,0,,"
                       f"{{\\pos({W // 2},1440)\\c{color}}}{nombre.upper()}")
        grupos = [palabras[i:i + 3] for i in range(0, len(palabras), 3)]
        ev = []
        for g in grupos:
            for j, p in enumerate(g):
                partes = [("{\\c&H50D8FF&}" + q["texto"].upper() + "{\\c&HFFFFFF&}") if k == j else q["texto"].upper()
                          for k, q in enumerate(g)]
                ev.append((p["inicio"], p["fin"], " ".join(partes)))
        for i, (a, b, txt) in enumerate(ev):
            b = min(b + .25, ev[i + 1][0]) if i + 1 < len(ev) else min(b + .25, fin_linea)
            estilo = "{\\i1}" if cursiva else ""
            out.append(f"Dialogue: 0,{t_ass(a)},{t_ass(b)},Sub,,0,0,0,,{{\\pos({W // 2},1540)}}{estilo}{txt}")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(cab + "\n".join(out) + "\n")


# ============================================================ todo junto
def boca_timeline(palabras, dur):
    """Lista de (abierta?, duración): la boca aletea mientras suena cada palabra."""
    segs, t = [], 0.0
    for p in palabras:
        if p["inicio"] > t:
            segs.append((False, p["inicio"] - t)); t = p["inicio"]
        abierta = True
        while t < p["fin"] - 0.02:
            paso = min(0.11, p["fin"] - t)
            segs.append((abierta, paso)); t += paso; abierta = not abierta
    if dur > t:
        segs.append((False, dur - t))
    return segs


def fabricar(ruta_guion, ruta_salida):
    guion = json.load(open(ruta_guion, encoding="utf-8"))
    os.makedirs(os.path.dirname(os.path.abspath(ruta_salida)), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="fruti_")
    sting = os.path.join(tmp, "sting.wav")
    acorde_dramatico(sting)
    fondos, clips, audios, subs = {}, [], [], []
    t0 = 0.0

    for n, ln in enumerate(guion["lineas"]):
        per = guion["personajes"][ln["quien"]]
        mp3 = os.path.join(tmp, f"v{n}.mp3")
        palabras = asyncio.run(_voz(ln["texto"], per, mp3))
        drama = ln.get("drama", False)
        retraso = RETRASO_DRAMA if drama else 0.0
        dur = duracion(mp3) + retraso + PAUSA
        if drama:
            dur = max(dur, 2.6)
        wav = os.path.join(tmp, f"a{n}.wav")
        if drama:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-i", sting, "-filter_complex",
                            f"[0:a]aresample=24000,adelay={int(retraso * 1000)}:all=1[v];[1:a]volume=0.8[s];"
                            f"[v][s]amix=inputs=2:duration=longest:normalize=0,apad=whole_dur={dur}[a]",
                            "-map", "[a]", "-ar", "24000", "-ac", "1", wav], check=True)
        else:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-af", f"aresample=24000,apad=whole_dur={dur}",
                            "-ar", "24000", "-ac", "1", wav], check=True)
        audios.append(wav)
        palabras = [{**p, "inicio": p["inicio"] + retraso, "fin": p["fin"] + retraso} for p in palabras]

        # imágenes: boca cerrada / abierta
        habla_en_escena = ln["quien"] in ln["en_escena"] and not ln.get("silueta")
        img_c = os.path.join(tmp, f"i{n}c.png")
        dibujar(ln, guion, False, fondos).convert("RGB").save(img_c)
        if habla_en_escena:
            img_a = os.path.join(tmp, f"i{n}a.png")
            dibujar(ln, guion, True, fondos).convert("RGB").save(img_a)
            segs = boca_timeline(palabras, dur)
        else:
            img_a, segs = img_c, [(False, dur)]
        lista = os.path.join(tmp, f"l{n}.txt")
        with open(lista, "w") as f:
            for abierta, sd in segs:
                f.write(f"file '{img_a if abierta else img_c}'\nduration {sd:.4f}\n")
            f.write(f"file '{img_c}'\n")
        frames = int(round(dur * FPS))
        vf = f"fps={FPS},format=yuv420p"
        if drama:
            vf = (f"fps={FPS},scale={W * 2}:{H * 2},zoompan=z='if(lte(on,24),1+0.10*on/24,1.10)':"
                  f"x='iw/2-(iw/zoom/2)':y='ih*0.45-(ih/zoom*0.45)':d=1:s={W}x{H}:fps={FPS},format=yuv420p")
        clip = os.path.join(tmp, f"c{n}.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-vf", vf,
                        "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", clip], check=True)
        clips.append(clip)

        nombre = "" if ln["quien"] == "narrador" else per["nombre"]
        subs.append((t0, t0 + dur, nombre, per.get("color", "&HFFFFFF&"),
                     [{**p, "inicio": p["inicio"] + t0, "fin": p["fin"] + t0} for p in palabras],
                     ln["quien"] == "narrador"))
        t0 += frames / FPS
        print(f"  línea {n + 1}/{len(guion['lineas'])} ({per['nombre']}) lista — {dur:.1f} s")

    # audio completo
    voz = os.path.join(tmp, "voz.wav")
    ent = sum([["-i", a] for a in audios], [])
    subprocess.run(["ffmpeg", "-y", "-v", "error", *ent, "-filter_complex",
                    "".join(f"[{i}:a]" for i in range(len(audios))) + f"concat=n={len(audios)}:v=0:a=1[a]",
                    "-map", "[a]", voz], check=True)
    lista = os.path.join(tmp, "clips.txt")
    with open(lista, "w") as f:
        f.writelines(f"file '{c}'\n" for c in clips)
    ass = os.path.join(tmp, "subs.ass")
    escribir_ass(subs, ass)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-i", voz,
                    "-vf", f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", ruta_salida], check=True)
    print(f"✅ Frutinovela lista: {ruta_salida} ({t0:.1f} s)")


if __name__ == "__main__":
    fabricar(sys.argv[1], sys.argv[2])
