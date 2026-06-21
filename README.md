# verdysynth

Instrumento de audio vectorial para navegador. Genera formas de onda XY y las convierte en señal de audio estéreo, simulando un osciloscopio CRT en modo XY.

## Modos

- **CHAR GEN** — convierte texto en trayectoria de haz
- **LIGHT PEN** — trazos vectoriales dibujados a mano
- **MIX** — combina texto y dibujo
- **WAVE GEN** — generador de ondas Lissajous, cuadrada, sierra y triángulo

## Controles

- **SND** — activa el motor de audio (WebAudio API)
- **DRONE OSC** — oscilador continuo con tipos sine, saw, square, triangle, FM, AM
- **ARPEGIO** — recorre notas de una escala sobre el drone, controlado por BPM
- **AUTO** — muta parámetros automáticamente al ritmo del BPM configurado
- **FX** — reverb y delay

## Uso

```bash
npm install
npm run dev
```

## Deploy

GitHub Actions construye y publica en GitHub Pages en cada push a `main`.
## License

MIT License — © 2026 [Vladimiro Bellini](https://github.com/vlasvlasvlas). Free to use and modify, attribution required.
