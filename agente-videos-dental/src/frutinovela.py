"""
Fabrica una FRUTINOVELA (telenovela de frutas) vertical 1080x1920 a partir de un guion JSON.

Cada personaje tiene su propia voz, sus caras (feliz, triste, llanto, enojo,
sorpresa, amor, chisme) y mueve la boca cuando habla. Las líneas con
"drama": true llevan acorde dramático de telenovela y zoom.

Uso (desde la carpeta src):
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


# ============================================================ composición de escenas
import escenarios
import personajes

PISO_PJ = 1330          # donde pisan los personajes
PIE = 0.965             # fracción de la imagen del personaje donde están los pies
POSICIONES = {1: [540], 2: [300, 790], 3: [215, 545, 875]}
ANCHOS = {1: 860, 2: 660, 3: 500}


def texto_sombra(d, xy, txt, f, color, borde=(60, 10, 40), off=6):
    d.text((xy[0] + off, xy[1] + off), txt, font=f, fill=(0, 0, 0, 150), anchor="mm")
    d.text(xy, txt, font=f, fill=color, anchor="mm", stroke_width=6, stroke_fill=borde)


def elenco(img, caras):
    tipos = ["fresa", "mango", "uva", "pina"]
    for i, t in enumerate(tipos):
        e, po = caras[t]
        fr = personajes.render(t, e, False, False, po, 330)
        x = 150 + i * 260
        img.alpha_composite(fr, (int(x - fr.width / 2), int(PISO_PJ - fr.height * PIE)))


def tarjeta(img, guion, final):
    d = ImageDraw.Draw(img)
    if not final:
        texto_sombra(d, (W / 2, 330), guion["serie"], ImageFont.truetype(F_BLACK, 132), (255, 214, 90))
        texto_sombra(d, (W / 2, 520), guion["titulo"], ImageFont.truetype(F_BLACK, 112), BLANCO)
        d.text((W / 2, 640), guion["capitulo"], font=ImageFont.truetype(F_SEMI, 46), fill=(255, 200, 230), anchor="mm")
        elenco(img, {"fresa": ("llanto", "drama"), "mango": ("amor", "corazon"), "uva": ("chisme", "senalar"), "pina": ("feliz", "explicar")})
    else:
        texto_sombra(d, (W / 2, 300), "¿CONTINUARÁ...?", ImageFont.truetype(F_BLACK, 112), (255, 214, 90))
        capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dc = ImageDraw.Draw(capa)
        dc.rounded_rectangle([100, 430, 980, 780], radius=50, fill=(255, 255, 255, 245))
        img.alpha_composite(capa)
        d = ImageDraw.Draw(img)
        d.text((W / 2, 520), "Agende su limpieza", font=ImageFont.truetype(F_BOLD, 74), fill=(10, 100, 140), anchor="mm")
        d.text((W / 2, 615), "y revisión dental", font=ImageFont.truetype(F_BOLD, 74), fill=(10, 100, 140), anchor="mm")
        d.text((W / 2, 715), "Col. Moderna · San Pedro Sula", font=ImageFont.truetype(F_SEMI, 46), fill=(70, 70, 90), anchor="mm")
        elenco(img, {"fresa": ("feliz", "corazon"), "mango": ("nervioso", "manos_cara"), "uva": ("chisme", "normal"), "pina": ("feliz", "explicar")})


def etiqueta_lugar(img, nombre):
    if not nombre:
        return
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    f = ImageFont.truetype(F_SEMI, 38)
    tw = d.textlength(nombre, font=f)
    d.rounded_rectangle([(W - tw) / 2 - 34, 150, (W + tw) / 2 + 34, 230], radius=40, fill=(255, 255, 255, 230))
    d.text((W / 2, 190), nombre, font=f, fill=(40, 30, 50), anchor="mm")
    img.alpha_composite(capa)


def componer(ln, guion, boca, parpadeo):
    lugar = ln["lugar"]
    img = escenarios.fondo(lugar).copy()
    if lugar in ("portada", "final"):
        tarjeta(img, guion, lugar == "final")
        return img
    reparto = list(ln["en_escena"].items())
    n = len(reparto)
    orden = sorted(range(n), key=lambda i: reparto[i][0] == ln["quien"])  # quien habla, al frente
    cara_hablante = None
    for i in orden:
        q, (expr, pose) = reparto[i]
        habla = q == ln["quien"]
        ancho = int(ANCHOS[n] * (1.0 if habla else 0.9))
        sil = ln.get("silueta", False)
        fr = personajes.render(guion["personajes"][q]["fruta"], expr, boca and habla, parpadeo and not sil, pose, ancho, sil)
        x = POSICIONES[n][i]
        y = PISO_PJ - fr.height * PIE - (10 if (habla and boca) else 0)
        sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sombra).ellipse([x - ancho * .3, PISO_PJ - 22, x + ancho * .3, PISO_PJ + 22], fill=(0, 0, 0, 90))
        img.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(10)))
        img.alpha_composite(fr, (int(x - fr.width / 2), int(y)))
        if habla:
            fx, fy = personajes.cara_en_pixeles(guion["personajes"][q]["fruta"], ancho)
            cara_hablante = (x - fr.width / 2 + fx, y + fy)
    if ln.get("plano") == "cerca" and cara_hablante:
        z = 1.45
        cw, ch = W / z, H / z
        cx = min(max(cara_hablante[0], cw / 2), W - cw / 2)
        cy = min(max(cara_hablante[1] + ch * .12, ch / 2), H - ch / 2)
        img = img.crop((int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))).resize((W, H), Image.LANCZOS)
    etiqueta_lugar(img, guion["lugares"][lugar]["nombre"])
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
def estados(palabras, dur):
    """Por cada cuadro: (boca abierta?, parpadeo?). Devuelve segmentos [(estado, duración)]."""
    n = int(round(dur * FPS))
    out = []
    for i in range(n):
        t = i / FPS
        boca = False
        for p in palabras:
            if p["inicio"] <= t < p["fin"]:
                boca = int((t - p["inicio"]) / 0.11) % 2 == 0
                break
        parp = (t % 3.1) > 2.98
        est = (boca, parp)
        if out and out[-1][0] == est:
            out[-1][1] += 1
        else:
            out.append([est, 1])
    return [(e, c / FPS) for e, c in out]


def fabricar(ruta_guion, ruta_salida):
    guion = json.load(open(ruta_guion, encoding="utf-8"))
    os.makedirs(os.path.dirname(os.path.abspath(ruta_salida)), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="fruti_")
    sting = os.path.join(tmp, "sting.wav")
    acorde_dramatico(sting)
    clips, audios, subs = [], [], []
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
        frames = int(round(dur * FPS))
        dur = frames / FPS
        wav = os.path.join(tmp, f"a{n}.wav")
        if drama:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-i", sting, "-filter_complex",
                            f"[0:a]aresample=24000,adelay={int(retraso * 1000)}:all=1[v];[1:a]volume=0.8[s];"
                            f"[v][s]amix=inputs=2:duration=longest:normalize=0,apad=whole_dur={dur},atrim=0:{dur}[a]",
                            "-map", "[a]", "-ar", "24000", "-ac", "1", wav], check=True)
        else:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-af", f"aresample=24000,apad=whole_dur={dur},atrim=0:{dur}",
                            "-ar", "24000", "-ac", "1", wav], check=True)
        audios.append(wav)
        palabras = [{**p, "inicio": p["inicio"] + retraso, "fin": p["fin"] + retraso} for p in palabras]

        habla_visible = ln["quien"] in ln["en_escena"] and not ln.get("silueta")
        segs = estados(palabras if habla_visible else [], dur)
        imgs = {}
        lista = os.path.join(tmp, f"l{n}.txt")
        with open(lista, "w") as f:
            for (boca, parp), sd in segs:
                clave = (boca, parp)
                if clave not in imgs:
                    ruta = os.path.join(tmp, f"i{n}_{int(boca)}{int(parp)}.png")
                    componer(ln, guion, boca, parp).convert("RGB").save(ruta)
                    imgs[clave] = ruta
                f.write(f"file '{imgs[clave]}'\nduration {sd:.4f}\n")
            f.write(f"file '{imgs[segs[-1][0]]}'\n")
        if drama and ln["lugar"] not in ("portada", "final"):
            z = "if(lte(on,20),1+0.12*on/20,1.12+0.0006*(on-20))"
        else:
            z = f"1+0.05*on/{frames}"
        vf = (f"fps={FPS},scale={W * 2}:{H * 2}:flags=bicubic,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih*0.42-(ih/zoom*0.42)':"
              f"d=1:s={W}x{H}:fps={FPS},format=yuv420p")
        clip = os.path.join(tmp, f"c{n}.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-vf", vf,
                        "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", clip], check=True)
        clips.append(clip)

        nombre = "" if ln["quien"] == "narrador" else per["nombre"]
        subs.append((t0, t0 + dur, nombre, per.get("color", "&HFFFFFF&"),
                     [{**p, "inicio": p["inicio"] + t0, "fin": p["fin"] + t0} for p in palabras],
                     ln["quien"] == "narrador"))
        t0 += dur
        print(f"  línea {n + 1}/{len(guion['lineas'])} ({per['nombre']}) lista — {dur:.1f} s")

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
                    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", ruta_salida], check=True)
    print(f"✅ Frutinovela lista: {ruta_salida} ({t0:.1f} s)")


if __name__ == "__main__":
    fabricar(sys.argv[1], sys.argv[2])
