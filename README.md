# verdysynth

Instrumento de audio vectorial para navegador. Genera recorridos X-Y, los dibuja como un osciloscopio CRT y entrega la mezcla final en mono.

## Modos

- **CHAR GEN** — convierte texto en trayectoria de haz
- **WAVE GEN** — dibuja curvas X-Y generadas por osciladores: Lissajous, cuadrada, sierra y triángulo. `FREQ X` y `FREQ Y` definen la relación horizontal/vertical, `FASE` desplaza el cruce entre ejes y `ARMÓNICOS` agrega esquinas o complejidad al trazo.

## Controles

- **SND** — activa el motor de audio (WebAudio API)
- **VOL GENERAL** — único volumen continuo de salida
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
