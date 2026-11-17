# 🧑‍💼 Tu Asistente Personal

Un asistente que vive dentro de Claude Code, en esta carpeta, y te ayuda a crear
**lo que quieras o se te ocurra**: apps, agentes que corren solos en internet,
documentos, planes, ideas, o simplemente resolver dudas.

## Cómo usarlo

Abre una terminal en esta carpeta y escribe:

```bash
claude --agent asistente-personal
```

Así toda la conversación es con tu asistente. También puedes, dentro de una
conversación normal de Claude Code, decir: *"usa mi asistente personal para…"*.

## Qué hace

- **Te recuerda**: lee y actualiza `asistente/memoria.md` (quién eres, tus
  proyectos y pendientes) para no preguntarte lo mismo dos veces.
- **Aterriza tus ideas** con pocas preguntas, una a la vez.
- **Elige el camino**: si es una app usa el equipo de `/crear-app`; si es algo que
  corra solo usa `/crear-agente`; si es un texto, plan o idea, lo hace él mismo y
  lo guarda en `asistente/creaciones/`.
- **IA gratis**: lo que construyas usa por defecto Workers AI de Cloudflare.

## Archivos

| Archivo | Para qué |
|---|---|
| `.claude/agents/asistente-personal.md` | Las instrucciones del asistente |
| `asistente/memoria.md` | Lo que el asistente sabe de ti (puedes editarlo) |
| `asistente/creaciones/` | Documentos e ideas que crea para ti |
