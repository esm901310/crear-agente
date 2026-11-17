"""
Fabrica un video vertical (1080x1920) a partir de un guion en JSON.

Pasos:
  1. Genera la voz de cada escena (voces de Microsoft con acento hondureño).
  2. Dibuja una imagen por escena (fondo, icono y título).
  3. Le da movimiento a cada imagen (zoom suave).
  4. Une todo con la voz y subtítulos palabra por palabra.

Uso:
  python fabricar_video.py guiones/muestra-01.json salida/muestra-01.mp4
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
PAUSA = 0.30  # segundos de silencio entre escenas

FUENTE_BOLD = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
FUENTE_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

# Paleta "clínica": turquesa + azul profundo + blanco
COLOR_A = (0, 150, 170)
COLOR_B = (8, 52, 92)
BLANCO = (255, 255, 255)
ACENTO = (255, 214, 92)


# ---------------------------------------------------------------- voz
async def _voz(texto, voz, ruta_mp3):
    com = edge_tts.Communicate(texto, voz, rate="+6%", boundary="WordBoundary",
                              proxy=os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy"))
    palabras = []
    with open(ruta_mp3, "wb") as f:
        async for trozo in com.stream():
            if trozo["type"] == "audio":
                f.write(trozo["data"])
            elif trozo["type"] == "WordBoundary":
                palabras.append({
                    "texto": trozo["text"],
                    "inicio": trozo["offset"] / 1e7,
                    "fin": (trozo["offset"] + trozo["duration"]) / 1e7,
                })
    return palabras


def duracion(ruta):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", ruta])
    return float(out)


# ---------------------------------------------------------------- iconos
def icono(d, tipo, cx, cy, r):
    """Dibuja un icono sencillo en blanco centrado en (cx, cy)."""
    b = COLOR_B
    lw = max(10, r // 9)
    if tipo == "diente":
        d.rounded_rectangle([cx - r * .8, cy - r * .9, cx + r * .8, cy + r * .15], radius=r * .5, fill=b)
        d.ellipse([cx - r * .72, cy - r * .35, cx - r * .06, cy + r * .95], fill=b)
        d.ellipse([cx + r * .06, cy - r * .35, cx + r * .72, cy + r * .95], fill=b)
        d.polygon([(cx - r * .12, cy + r * .95), (cx + r * .12, cy + r * .95), (cx, cy + r * .45)], fill=BLANCO)
        d.ellipse([cx - r * .52, cy - r * .66, cx - r * .24, cy - r * .38], fill=(120, 200, 215))
        # brillo
        for (sx, sy, s) in [(cx + r * 1.05, cy - r * .9, r * .22), (cx - r * 1.05, cy - r * .3, r * .14)]:
            estrella(d, sx, sy, s, ACENTO)
    elif tipo == "gota":
        d.ellipse([cx - r * .7, cy - r * .2, cx + r * .7, cy + r * 1.0], fill=(235, 80, 90))
        d.polygon([(cx - r * .66, cy + r * .25), (cx + r * .66, cy + r * .25), (cx, cy - r * 1.0)], fill=(235, 80, 90))
        d.ellipse([cx - r * .38, cy + r * .2, cx - r * .12, cy + r * .55], fill=(255, 170, 175))
    elif tipo == "alerta":
        d.polygon([(cx, cy - r), (cx + r * 1.05, cy + r * .85), (cx - r * 1.05, cy + r * .85)], fill=ACENTO)
        d.rounded_rectangle([cx - lw * .7, cy - r * .35, cx + lw * .7, cy + r * .35], radius=lw, fill=COLOR_B)
        d.ellipse([cx - lw, cy + r * .48, cx + lw, cy + r * .48 + lw * 2], fill=COLOR_B)
    elif tipo == "calendario":
        d.rounded_rectangle([cx - r, cy - r * .75, cx + r, cy + r * .95], radius=r * .18, fill=b)
        d.rounded_rectangle([cx - r, cy - r * .75, cx + r, cy - r * .3], radius=r * .18, fill=ACENTO)
        d.rectangle([cx - r, cy - r * .45, cx + r, cy - r * .3], fill=ACENTO)
        for x in (cx - r * .5, cx + r * .5):
            d.rounded_rectangle([x - lw * .6, cy - r * 1.0, x + lw * .6, cy - r * .55], radius=lw, fill=b)
        f = ImageFont.truetype(FUENTE_BOLD, int(r * .95))
        d.text((cx, cy + r * .35), "6", font=f, fill=BLANCO, anchor="mm")
    elif tipo == "escudo":
        pts = [(cx, cy - r), (cx + r * .9, cy - r * .6), (cx + r * .8, cy + r * .3),
               (cx, cy + r), (cx - r * .8, cy + r * .3), (cx - r * .9, cy - r * .6)]
        d.polygon(pts, fill=b)
        d.line([(cx - r * .4, cy), (cx - r * .08, cy + r * .32), (cx + r * .45, cy - r * .3)],
               fill=BLANCO, width=lw * 2, joint="curve")
    elif tipo == "ubicacion":
        d.ellipse([cx - r * .8, cy - r * 1.0, cx + r * .8, cy + r * .6], fill=b)
        d.polygon([(cx - r * .7, cy - r * .05), (cx + r * .7, cy - r * .05), (cx, cy + r * 1.1)], fill=b)
        d.ellipse([cx - r * .32, cy - r * .52, cx + r * .32, cy + r * .12], fill=BLANCO)


def estrella(d, cx, cy, s, color):
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        rad = s if i % 2 == 0 else s * .3
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    d.polygon(pts, fill=color)


# ---------------------------------------------------------------- escenas
def degradado():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        c = tuple(int(COLOR_A[i] * (1 - t) + COLOR_B[i] * t) for i in range(3))
        for x in range(W):
            px[x, y] = c
    return img


def partir(texto, fuente, ancho_max, d):
    lineas, actual = [], ""
    for p in texto.split():
        prueba = (actual + " " + p).strip()
        if d.textlength(prueba, font=fuente) <= ancho_max:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    lineas.append(actual)
    return lineas


def dibujar_escena(fondo, esc, guion, n, total, ruta):
    img = fondo.copy()
    # círculos decorativos difuminados
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    dc.ellipse([-260, -200, 520, 580], fill=(255, 255, 255, 38))
    dc.ellipse([620, 1300, 1400, 2080], fill=(255, 255, 255, 26))
    capa = capa.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img.convert("RGBA"), capa)
    d = ImageDraw.Draw(img)

    # etiqueta de la clínica (arriba)
    f_tag = ImageFont.truetype(FUENTE_SEMI, 38)
    tag = f"🦷 {guion['clinica']}  ·  {guion['zona']}".replace("🦷 ", "")
    tw = d.textlength(tag, font=f_tag)
    d.rounded_rectangle([(W - tw) / 2 - 34, 170, (W + tw) / 2 + 34, 250], radius=40, fill=(255, 255, 255, 235))
    d.text((W / 2, 210), tag, font=f_tag, fill=COLOR_B, anchor="mm")

    # círculo + icono
    cy = 640
    d.ellipse([W / 2 - 230, cy - 230, W / 2 + 230, cy + 230], fill=BLANCO)
    icono(d, esc["icono"], W / 2, cy, 150)

    # título
    f_tit = ImageFont.truetype(FUENTE_BOLD, 92)
    lineas = partir(esc["titulo"], f_tit, W - 160, d)
    y = 1000
    for ln in lineas:
        d.text((W / 2 + 4, y + 5), ln, font=f_tit, fill=(0, 0, 0, 90), anchor="mm")
        d.text((W / 2, y), ln, font=f_tit, fill=BLANCO, anchor="mm")
        y += 108

    # puntitos de avance
    for i in range(total):
        x = W / 2 + (i - (total - 1) / 2) * 36
        r = 9 if i == n else 6
        col = ACENTO if i == n else (255, 255, 255, 140)
        d.ellipse([x - r, 1780 - r, x + r, 1780 + r], fill=col)

    img.convert("RGB").save(ruta, quality=95)


# ---------------------------------------------------------------- subtítulos
def tiempo_ass(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def escribir_ass(palabras, ruta):
    """Subtítulos estilo TikTok: grupos de 3 palabras, la palabra que suena en amarillo."""
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter ExtraBold,78,&H00FFFFFF,&H00FFFFFF,&H00202020,&H64000000,1,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lineas = []
    grupos = [palabras[i:i + 3] for i in range(0, len(palabras), 3)]
    eventos = []
    for g in grupos:
        for j, p in enumerate(g):
            partes = []
            for k, q in enumerate(g):
                txt = q["texto"].upper()
                partes.append("{\\c&H5CD6FF&}" + txt + "{\\c&HFFFFFF&}" if k == j else txt)
            eventos.append((p["inicio"], p["fin"], " ".join(partes)))
    for i, (ini, fin, txt) in enumerate(eventos):
        fin = fin + 0.25
        if i + 1 < len(eventos):
            fin = min(fin, eventos[i + 1][0])
        texto = "{\\pos(%d,1390)}" % (W // 2) + txt
        lineas.append(f"Dialogue: 0,{tiempo_ass(ini)},{tiempo_ass(fin)},Sub,,0,0,0,,{texto}")
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(cab + "\n".join(lineas) + "\n")


# ---------------------------------------------------------------- todo junto
def fabricar(ruta_guion, ruta_salida):
    with open(ruta_guion, encoding="utf-8") as f:
        guion = json.load(f)
    os.makedirs(os.path.dirname(os.path.abspath(ruta_salida)), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="video_")
    fondo = degradado()
    escenas = guion["escenas"]

    todas_palabras, clips, audios = [], [], []
    t = 0.0
    for n, esc in enumerate(escenas):
        mp3 = os.path.join(tmp, f"voz{n}.mp3")
        palabras = asyncio.run(_voz(esc["texto"], guion.get("voz", "es-HN-KarlaNeural"), mp3))
        dur = duracion(mp3) + PAUSA
        for p in palabras:
            todas_palabras.append({**p, "inicio": p["inicio"] + t, "fin": p["fin"] + t})
        audios.append((mp3, dur))

        png = os.path.join(tmp, f"esc{n}.png")
        dibujar_escena(fondo, esc, guion, n, len(escenas), png)
        clip = os.path.join(tmp, f"clip{n}.mp4")
        frames = int(round(dur * FPS))
        zoom = f"zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS}"
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", png,
            "-vf", f"scale={W*2}:{H*2},{zoom},format=yuv420p",
            "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", clip
        ], check=True)
        clips.append(clip)
        t += dur
        print(f"  escena {n + 1}/{len(escenas)} lista ({dur:.1f} s)")

    # voz completa con pausas
    voz = os.path.join(tmp, "voz.m4a")
    entradas, filtros = [], []
    for i, (mp3, dur) in enumerate(audios):
        entradas += ["-i", mp3]
        filtros.append(f"[{i}:a]apad=whole_dur={dur}[a{i}]")
    filtros.append("".join(f"[a{i}]" for i in range(len(audios))) + f"concat=n={len(audios)}:v=0:a=1[a]")
    subprocess.run(["ffmpeg", "-y", "-v", "error", *entradas, "-filter_complex", ";".join(filtros),
                    "-map", "[a]", "-c:a", "aac", "-b:a", "160k", voz], check=True)

    lista = os.path.join(tmp, "lista.txt")
    with open(lista, "w") as f:
        f.writelines(f"file '{c}'\n" for c in clips)
    ass = os.path.join(tmp, "subs.ass")
    escribir_ass(todas_palabras, ass)

    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-i", voz,
        "-vf", f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-shortest", "-movflags", "+faststart", ruta_salida
    ], check=True)
    print(f"✅ Video listo: {ruta_salida} ({t:.1f} s)")


if __name__ == "__main__":
    fabricar(sys.argv[1], sys.argv[2])
