import "./styles.css";

const canvas = document.querySelector("#scope");
const ctx = canvas.getContext("2d", { alpha: false });
const liveTextBar = document.querySelector("#liveTextBar");
const liveTextInput = document.querySelector("#liveTextInput");
const audioButton = document.querySelector("#audioButton");
const clearButton = document.querySelector("#clearButton");
const randomButton = document.querySelector("#randomButton");
const configToggle = document.querySelector("#configToggle");
const helpToggle = document.querySelector("#helpToggle");
const helpClose = document.querySelector("#helpClose");
const configPanel = document.querySelector("#configPanel");
const helpPanel = document.querySelector("#helpPanel");
const gridToggle = document.querySelector("#gridToggle");
const gridToggle2 = document.querySelector("#gridToggle2");
const masterVolume = document.querySelector("#masterVolume");
const dronePower = document.querySelector("#dronePower");
const droneType = document.querySelector("#droneType");
const droneNote = document.querySelector("#droneNote");
const droneControls = {
  level: document.querySelector("#droneLevel"),
  color: document.querySelector("#droneColor"),
  mod: document.querySelector("#droneMod"),
};
const autoMutate = document.querySelector("#autoMutate");
const autoSeconds = document.querySelector("#autoSeconds");
const textImport = document.querySelector("#textImport");
const scrollToggle = document.querySelector("#scrollToggle");
const scrollSeconds = document.querySelector("#scrollSeconds");
const arpPower = document.querySelector("#arpPower");
const arpScale = document.querySelector("#arpScale");
const arpMode = document.querySelector("#arpMode");
const arpOctaves = document.querySelector("#arpOctaves");
const waveSection = document.querySelector("#waveSection");
const waveType = document.querySelector("#waveType");
const waveFreqX = document.querySelector("#waveFreqX");
const waveFreqY = document.querySelector("#waveFreqY");
const wavePhase = document.querySelector("#wavePhase");
const waveHarmonics = document.querySelector("#waveHarmonics");
const fxControls = {
  reverbSend: document.querySelector("#fxReverbSend"),
  reverbSize: document.querySelector("#fxReverbSize"),
  delaySend: document.querySelector("#fxDelaySend"),
  delayTime: document.querySelector("#fxDelayTime"),
  delayFeed: document.querySelector("#fxDelayFeed"),
};
const modeInputs = [...document.querySelectorAll("input[name='mode']")];
const controls = {
  rate: document.querySelector("#rate"),
  gain: document.querySelector("#gain"),
  decay: document.querySelector("#decay"),
  focus: document.querySelector("#focus"),
  warp: document.querySelector("#warp"),
  jitter: document.querySelector("#jitter"),
  drift: document.querySelector("#drift"),
  feedback: document.querySelector("#feedback"),
};

const WAVE_RATIOS = [
  [1, 1], [1, 2], [1, 3], [2, 3], [3, 4], [3, 5],
  [4, 5], [5, 6], [5, 7], [7, 8], [2, 5], [3, 7], [4, 7], [5, 8],
];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const state = {
  mode: "text",
  textPoints: [],
  textRaster: [],
  drawStrokes: [],
  currentStroke: null,
  pointerDown: false,
  pointer: null,
  audioContext: null,
  worklet: null,
  masterGain: null,
  compressor: null,
  drone: null,
  fx: {},
  audioOn: false,
  gridOn: true,
  lastSent: 0,
  lastMutation: performance.now(),
  tick: 0,
  beamIndex: 0,
  cachedVisualPoints: [],
  wavePoints: [],
  importedLines: [],
  importIndex: 0,
  importScrollTimer: null,
  scrollOn: false,
  arpIndex: 0,
  arpDirection: 1,
};

const textCanvas = document.createElement("canvas");
textCanvas.width = 440;
textCanvas.height = 260;
const textCtx = textCanvas.getContext("2d", { willReadFrequently: true });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function controlValue(id, scale = 1) {
  return Number(controls[id].value) * scale;
}

function activeMode() {
  return modeInputs.find((input) => input.checked)?.value || "text";
}

function normalizePoint(x, y, width = canvas.width, height = canvas.height) {
  return {
    x: clamp((x / width) * 2 - 1, -1, 1),
    y: clamp((y / height) * -2 + 1, -1, 1),
  };
}

function denormalizePoint(point) {
  return {
    x: (point.x * 0.5 + 0.5) * canvas.width,
    y: (-point.y * 0.5 + 0.5) * canvas.height,
  };
}

function buildNoteDropdown() {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  for (let octave = 1; octave <= 5; octave++) {
    for (let n = 0; n < 12; n++) {
      const midi = 24 + (octave - 1) * 12 + n;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const opt = document.createElement("option");
      opt.value = freq.toFixed(2);
      opt.textContent = noteNames[n] + octave;
      if (noteNames[n] === "A" && octave === 1) opt.selected = true;
      droneNote.appendChild(opt);
    }
  }
}

function createImpulseResponse(audioContext, duration, decay) {
  const sr = audioContext.sampleRate;
  const length = Math.floor(sr * duration);
  const buffer = audioContext.createBuffer(2, length, sr);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function waveSample(type, t, harmonics) {
  if (type === "lissajous") return Math.sin(t);
  if (type === "square") {
    let v = 0;
    for (let h = 1; h <= harmonics * 2 - 1; h += 2) v += Math.sin(h * t) / h;
    return clamp((4 / Math.PI) * v, -1, 1);
  }
  if (type === "saw") {
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += (h % 2 === 0 ? -1 : 1) * Math.sin(h * t) / h;
    return clamp((2 / Math.PI) * v, -1, 1);
  }
  if (type === "triangle") {
    let v = 0;
    for (let h = 0; h < harmonics; h++) {
      const n = 2 * h + 1;
      v += (h % 2 === 0 ? 1 : -1) * Math.sin(n * t) / (n * n);
    }
    return clamp((8 / (Math.PI * Math.PI)) * v, -1, 1);
  }
  return Math.sin(t);
}

function rebuildWavePoints() {
  const type = waveType.value;
  const freqX = Math.max(1, Number(waveFreqX.value));
  const freqY = Math.max(1, Number(waveFreqY.value));
  const phase = Number(wavePhase.value) * (Math.PI / 180);
  const harmonics = clamp(Number(waveHarmonics.value), 1, 12);
  const N = 512;
  const points = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = waveSample(type, freqX * t + phase, harmonics);
    const y = waveSample(type, freqY * t, harmonics);
    points.push({ x, y, move: i === 0 });
  }
  state.wavePoints = points;
  state.beamIndex = 0;
  sendPoints(true);
}

function mutateWave() {
  state.lastMutation = performance.now();
  const ratio = WAVE_RATIOS[Math.floor(Math.random() * WAVE_RATIOS.length)];
  waveFreqX.value = ratio[0];
  waveFreqY.value = ratio[1];
  wavePhase.value = Math.floor(Math.random() * 360);
  waveHarmonics.value = Math.floor(1 + Math.random() * 8);
  const types = ["lissajous", "square", "saw", "triangle"];
  waveType.value = types[Math.floor(Math.random() * types.length)];
  controls.warp.value = Math.floor(Math.random() * 38);
  controls.jitter.value = Math.floor(Math.random() * 20);
  controls.drift.value = Math.floor(2 + Math.random() * 36);
  rebuildWavePoints();
  sendParams();
}

function rebuildTextPoints() {
  const lines = liveTextInput.value.toUpperCase().split(/\s*\/\s*|\n/).slice(0, 5);
  textCtx.setTransform(1, 0, 0, 1, 0, 0);
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  textCtx.fillStyle = "#fff";
  textCtx.textAlign = "center";
  textCtx.textBaseline = "middle";
  textCtx.font = "900 58px 'Arial Narrow', 'Helvetica Neue Condensed', 'Courier New', monospace";

  const lineHeight = 56;
  const startY = textCanvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  textCtx.translate(textCanvas.width / 2, 0);
  textCtx.scale(0.82, 1);
  lines.forEach((line, index) => {
    textCtx.fillText(line || " ", 0, startY + index * lineHeight);
  });
  textCtx.setTransform(1, 0, 0, 1, 0, 0);

  const pixels = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
  const points = [];
  const raster = [];
  const step = 4;

  for (let y = 4; y < textCanvas.height - 4; y += step) {
    const row = [];
    for (let x = 4; x < textCanvas.width - 4; x += step) {
      const alpha = pixels[(y * textCanvas.width + x) * 4 + 3];
      if (alpha < 88) continue;
      raster.push({
        x: (x / textCanvas.width) * 1.46 - 0.73,
        y: (y / textCanvas.height) * -1.04 + 0.52,
        a: alpha / 255,
      });
      const left = pixels[(y * textCanvas.width + x - step) * 4 + 3];
      const right = pixels[(y * textCanvas.width + x + step) * 4 + 3];
      const top = pixels[((y - step) * textCanvas.width + x) * 4 + 3];
      const bottom = pixels[((y + step) * textCanvas.width + x) * 4 + 3];
      if (left < 88 || right < 88 || top < 88 || bottom < 88) {
        row.push({
          x: (x / textCanvas.width) * 1.46 - 0.73,
          y: (y / textCanvas.height) * -1.04 + 0.52,
          move: row.length === 0,
        });
      }
    }
    if (y % (step * 2) === 0) row.reverse();
    points.push(...row);
  }

  state.textPoints = points.slice(0, 1800);
  state.textRaster = raster.slice(0, 5200);
  state.beamIndex = 0;
  sendPoints(true);
}

function syncTextFromLive() {
  rebuildTextPoints();
}

function startScrollTimer() {
  clearInterval(state.importScrollTimer);
  if (!state.scrollOn || !state.importedLines.length) return;
  const ms = Math.max(500, Number(scrollSeconds.value) * 1000);
  state.importScrollTimer = setInterval(() => {
    liveTextInput.value = state.importedLines[state.importIndex] ?? "";
    state.importIndex = (state.importIndex + 1) % state.importedLines.length;
    syncTextFromLive();
  }, ms);
}

function drawPointsFromStrokes() {
  return state.drawStrokes.flatMap((stroke) =>
    stroke.map((point, index) => ({
      ...point,
      move: index === 0,
    })),
  );
}

function sourcePoints() {
  const drawPoints = drawPointsFromStrokes();
  if (state.mode === "text") return state.textPoints;
  if (state.mode === "draw") return drawPoints.length ? drawPoints : state.textPoints.slice(0, 2);
  if (state.mode === "wave") return state.wavePoints.length ? state.wavePoints : [{ x: 0, y: 0, move: true }];
  return [...state.textPoints, ...drawPoints];
}

function modulatedPoints() {
  const warp = controlValue("warp", 0.0032);
  const jitter = controlValue("jitter", 0.00045);
  const drift = controlValue("drift", 0.00055);
  const source = sourcePoints();
  if (source.length < 2) {
    return [
      { x: -0.5, y: 0, move: true },
      { x: 0.5, y: 0 },
    ];
  }

  return source.map((point, index) => {
    const t = index * 0.061 + state.tick;
    const slow = state.tick * 0.21;
    return {
      x: clamp(
        point.x +
          Math.sin(t * 1.4 + point.y * 4) * warp +
          Math.sin(slow + index * 0.013) * drift +
          (Math.random() - 0.5) * jitter,
        -1,
        1,
      ),
      y: clamp(
        point.y +
          Math.cos(t * 1.1 + point.x * 4) * warp +
          Math.cos(slow * 0.8 + index * 0.011) * drift +
          (Math.random() - 0.5) * jitter,
        -1,
        1,
      ),
      move: point.move,
    };
  });
}

function packAudioPoints(points) {
  const audible = points.slice(0, 2200);
  const packed = new Float32Array(audible.length * 2);
  audible.forEach((point, index) => {
    packed[index * 2] = Number.isFinite(point.x) ? point.x : 0;
    packed[index * 2 + 1] = Number.isFinite(point.y) ? point.y : 0;
  });
  return packed;
}

function sendPoints(force = false) {
  if (!state.worklet) return;
  const now = performance.now();
  if (!force && now - state.lastSent < 55) return;
  state.lastSent = now;
  const packed = packAudioPoints(state.cachedVisualPoints.length ? state.cachedVisualPoints : modulatedPoints());
  state.worklet.port.postMessage({ type: "points", points: packed }, [packed.buffer]);
}

function sendParams() {
  if (!state.worklet) return;
  state.worklet.port.postMessage({
    type: "params",
    rate: controlValue("rate") * 90,
    gain: controlValue("gain", 0.01),
    smooth: 0.35 + controlValue("focus", 0.006),
  });
}

function droneValue(id, scale = 1) {
  return Number(droneControls[id].value) * scale;
}

function disposeDrone() {
  if (!state.drone) return;
  const now = state.audioContext.currentTime;
  state.drone.output.gain.cancelScheduledValues(now);
  state.drone.output.gain.linearRampToValueAtTime(0, now + 0.04);
  const drone = state.drone;
  window.setTimeout(() => {
    drone.nodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        node.disconnect();
      } catch {
        // already gone
      }
    });
  }, 80);
  state.drone = null;
}

function createDroneGraph() {
  if (!state.audioContext || !state.compressor) return;
  disposeDrone();

  const audioContext = state.audioContext;
  const now = audioContext.currentTime;
  const carrier = audioContext.createOscillator();
  const modulator = audioContext.createOscillator();
  const modGain = audioContext.createGain();
  const amp = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const output = audioContext.createGain();
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  const nodes = [carrier, modulator, modGain, amp, filter, output, lfo, lfoGain];

  carrier.type = ["sine", "sawtooth", "square", "triangle"].includes(droneType.value) ? droneType.value : "sine";
  modulator.type = "sine";
  lfo.type = "triangle";
  filter.type = "lowpass";
  output.gain.value = 0;
  amp.gain.value = 1;

  carrier.connect(amp).connect(filter).connect(output).connect(state.masterGain);
  lfo.connect(lfoGain);

  if (droneType.value === "fm") {
    modulator.connect(modGain).connect(carrier.frequency);
  } else if (droneType.value === "am") {
    amp.gain.value = 0.75;
    modulator.connect(modGain).connect(amp.gain);
  } else {
    lfoGain.connect(filter.frequency);
  }

  carrier.start(now);
  modulator.start(now);
  lfo.start(now);
  state.drone = { carrier, modulator, modGain, amp, filter, output, lfo, lfoGain, nodes };
  updateDroneParams(true);
}

function updateDroneParams(force = false) {
  if (!state.drone || !state.audioContext) return;
  const now = state.audioContext.currentTime;
  const ramp = force ? 0.01 : 0.08;
  const frequency = Number(droneNote.value);
  const level = dronePower.checked ? droneValue("level", 0.0042) : 0;
  const color = droneValue("color", 1);
  const mod = droneValue("mod", 1);
  const filterHz = 180 + color * 42;
  const modHz = 0.08 + mod * 0.085;

  state.drone.carrier.frequency.linearRampToValueAtTime(frequency, now + ramp);
  state.drone.modulator.frequency.linearRampToValueAtTime(
    droneType.value === "am" ? modHz : frequency * (0.5 + mod * 0.018),
    now + ramp,
  );
  state.drone.modGain.gain.linearRampToValueAtTime(
    droneType.value === "fm" ? mod * 1.8 : droneType.value === "am" ? mod * 0.0035 : 0,
    now + ramp,
  );
  state.drone.filter.frequency.linearRampToValueAtTime(filterHz, now + ramp);
  state.drone.filter.Q.linearRampToValueAtTime(0.5 + mod * 0.035, now + ramp);
  state.drone.lfo.frequency.linearRampToValueAtTime(modHz, now + ramp);
  state.drone.lfoGain.gain.linearRampToValueAtTime(color * 5, now + ramp);
  state.drone.output.gain.linearRampToValueAtTime(level, now + ramp);
}

function ensureDroneState() {
  if (!state.audioContext) return;
  if (dronePower.checked && !state.drone) createDroneGraph();
  else if (!dronePower.checked) disposeDrone();
  else updateDroneParams();
}

function updateFX() {
  if (!state.audioContext || !state.fx.reverbSend) return;
  const now = state.audioContext.currentTime;
  state.fx.reverbSend.gain.linearRampToValueAtTime(Number(fxControls.reverbSend.value) * 0.008, now + 0.05);
  state.fx.delaySend.gain.linearRampToValueAtTime(Number(fxControls.delaySend.value) * 0.008, now + 0.05);
  state.fx.delayNode.delayTime.linearRampToValueAtTime(
    0.05 + Number(fxControls.delayTime.value) * 0.0145,
    now + 0.05,
  );
  state.fx.delayFeedback.gain.linearRampToValueAtTime(Number(fxControls.delayFeed.value) * 0.0089, now + 0.05);
}

let reverbRebuildTimer = null;
let arpTimer = null;

function stopArpTimer() {
  clearInterval(arpTimer);
  arpTimer = null;
}

async function startArpTimer() {
  stopArpTimer();
  if (!arpPower.checked) return;
  if (!state.audioContext) await startAudio();
  if (!state.drone) {
    dronePower.checked = true;
    createDroneGraph();
  }
  const ms = 60000 / clamp(Number(autoSeconds.value) || 120, 20, 400);
  arpStep();
  arpTimer = setInterval(() => arpStep(), ms);
}
function updateReverbSize() {
  if (!state.audioContext || !state.fx.convolver) return;
  clearTimeout(reverbRebuildTimer);
  reverbRebuildTimer = setTimeout(() => {
    const size = Number(fxControls.reverbSize.value) / 100;
    state.fx.convolver.buffer = createImpulseResponse(state.audioContext, 0.4 + size * 4.6, 0.8 + size * 3.2);
  }, 300);
}

function arpStep() {
  if (!state.audioContext) return;
  if (!state.drone) {
    dronePower.checked = true;
    createDroneGraph();
    return;
  }
  const scale = SCALES[arpScale.value] || SCALES.major;
  const octaves = clamp(Number(arpOctaves.value) || 2, 1, 4);
  const rootFreq = Number(droneNote.value);
  const totalNotes = scale.length * octaves;
  const scaleDegree = state.arpIndex % scale.length;
  const octave = Math.floor(state.arpIndex / scale.length);
  const freq = rootFreq * Math.pow(2, (scale[scaleDegree] + octave * 12) / 12);

  const now = state.audioContext.currentTime;
  state.drone.carrier.frequency.cancelScheduledValues(now);
  state.drone.carrier.frequency.linearRampToValueAtTime(freq, now + 0.02);
  if (droneType.value === "fm") {
    const mod = Number(droneControls.mod.value);
    state.drone.modulator.frequency.cancelScheduledValues(now);
    state.drone.modulator.frequency.linearRampToValueAtTime(freq * (0.5 + mod * 0.018), now + 0.02);
  }

  if (arpMode.value === "up") {
    state.arpIndex = (state.arpIndex + 1) % totalNotes;
  } else if (arpMode.value === "down") {
    state.arpIndex = (state.arpIndex - 1 + totalNotes) % totalNotes;
  } else if (arpMode.value === "updown") {
    state.arpIndex += state.arpDirection;
    if (state.arpIndex >= totalNotes - 1) state.arpDirection = -1;
    else if (state.arpIndex <= 0) state.arpDirection = 1;
    state.arpIndex = clamp(state.arpIndex, 0, totalNotes - 1);
  } else {
    state.arpIndex = Math.floor(Math.random() * totalNotes);
  }
}

async function startAudio() {
  if (!state.audioContext) {
    const audioContext = new AudioContext({ latencyHint: "interactive" });
    await audioContext.audioWorklet.addModule(new URL("./audio-worklet.js", import.meta.url).href);
    const worklet = new AudioWorkletNode(audioContext, "xy-oscillator", {
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const masterGain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    masterGain.gain.value = 0;
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 10;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;
    worklet.connect(masterGain).connect(compressor).connect(audioContext.destination);

    // Reverb send
    const reverbSend = audioContext.createGain();
    const reverbWet = audioContext.createGain();
    const convolver = audioContext.createConvolver();
    reverbSend.gain.value = 0;
    reverbWet.gain.value = 0.85;
    convolver.buffer = createImpulseResponse(audioContext, 2.8, 2.2);
    masterGain.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(compressor);

    // Delay send with filtered feedback loop
    const delaySend = audioContext.createGain();
    const delayNode = audioContext.createDelay(2.0);
    const delayFeedback = audioContext.createGain();
    const delayFilter = audioContext.createBiquadFilter();
    const delayOut = audioContext.createGain();
    delaySend.gain.value = 0;
    delayNode.delayTime.value = 0.375;
    delayFeedback.gain.value = 0.38;
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 3800;
    delayOut.gain.value = 0.75;
    masterGain.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayFilter.connect(delayOut);
    delayOut.connect(compressor);

    worklet.onprocessorerror = () => {
      audioButton.textContent = "! SND";
      audioButton.classList.remove("active");
      state.audioOn = false;
    };
    state.audioContext = audioContext;
    state.worklet = worklet;
    state.masterGain = masterGain;
    state.compressor = compressor;
    state.fx = { reverbSend, reverbWet, convolver, delaySend, delayNode, delayFeedback, delayFilter, delayOut };
  }

  await state.audioContext.resume();
  state.audioOn = true;
  const now = state.audioContext.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.linearRampToValueAtTime(Number(masterVolume.value) * 0.006, now + 0.06);
  audioButton.setAttribute("aria-label", "Apagar sonido");
  audioButton.setAttribute("aria-pressed", "true");
  audioButton.textContent = "● SND";
  audioButton.classList.add("active");
  sendParams();
  sendPoints(true);
  ensureDroneState();
}

function stopAudio() {
  if (!state.audioContext || !state.masterGain) return;
  const now = state.audioContext.currentTime;
  state.audioOn = false;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.linearRampToValueAtTime(0, now + 0.04);
  audioButton.setAttribute("aria-label", "Prender sonido");
  audioButton.setAttribute("aria-pressed", "false");
  audioButton.textContent = "○ SND";
  audioButton.classList.remove("active");
}

function updateMasterVolume() {
  if (!state.audioContext || !state.masterGain || !state.audioOn) return;
  const now = state.audioContext.currentTime;
  state.masterGain.gain.cancelScheduledValues(now);
  state.masterGain.gain.linearRampToValueAtTime(Number(masterVolume.value) * 0.006, now + 0.04);
}

function toggleGrid() {
  state.gridOn = !state.gridOn;
  const label = state.gridOn ? "Apagar grilla" : "Prender grilla";
  gridToggle.setAttribute("aria-label", label);
  gridToggle.setAttribute("aria-pressed", String(state.gridOn));
  gridToggle.classList.toggle("active", state.gridOn);
  gridToggle2.setAttribute("aria-label", label);
  gridToggle2.setAttribute("aria-pressed", String(state.gridOn));
  gridToggle2.classList.toggle("active", state.gridOn);
  gridToggle2.textContent = state.gridOn ? "GRILLA ON" : "GRILLA OFF";
}

async function toggleAudio() {
  if (state.audioOn) stopAudio();
  else await startAudio();
}

function drawGrid() {
  ctx.save();
  const left = 92;
  const top = 72;
  const width = canvas.width - left * 2;
  const height = canvas.height - top * 2;
  ctx.strokeStyle = "rgba(176, 196, 169, 0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 50; x += 1) {
    const px = left + (x / 50) * width;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, top + height);
    ctx.stroke();
  }
  for (let y = 0; y <= 40; y += 1) {
    const py = top + (y / 40) * height;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left + width, py);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(176, 196, 169, 0.19)";
  for (let x = 0; x <= 10; x += 1) {
    const px = left + (x / 10) * width;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, top + height);
    ctx.stroke();
  }
  for (let y = 0; y <= 8; y += 1) {
    const py = top + (y / 8) * height;
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left + width, py);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(208, 225, 196, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left + width / 2, top);
  ctx.lineTo(left + width / 2, top + height);
  ctx.moveTo(left, top + height / 2);
  ctx.lineTo(left + width, top + height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawBeamStep(points) {
  if (points.length < 2) return;
  const rate = controlValue("rate");
  const steps = clamp(Math.floor(rate / 110), 1, 18);
  const focus = controlValue("focus", 0.01);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let step = 0; step < steps; step += 1) {
    const previousIndex = state.beamIndex % points.length;
    state.beamIndex = (state.beamIndex + 1) % points.length;
    const currentIndex = state.beamIndex % points.length;
    const previous = points[previousIndex];
    const current = points[currentIndex];
    if (!previous || !current || current.move) continue;
    const a = denormalizePoint(previous);
    const b = denormalizePoint(current);
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const dwell = clamp(1 - distance / 220, 0.2, 1);
    ctx.shadowColor = "rgba(95, 235, 105, 0.65)";
    ctx.shadowBlur = 3 + focus * 8 * dwell;
    ctx.strokeStyle = `rgba(62, 220, 82, ${0.36 + dwell * 0.28})`;
    ctx.lineWidth = 2.2 - focus * 0.9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.shadowBlur = 1;
    ctx.strokeStyle = `rgba(226, 255, 210, ${0.42 + dwell * 0.36})`;
    ctx.lineWidth = 0.55 + focus * 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTextRaster() {
  if (!state.textRaster.length || state.mode === "draw") return;
  const warp = controlValue("warp", 0.003);
  const jitter = controlValue("jitter", 0.00055);
  const drift = controlValue("drift", 0.0005);
  const focus = controlValue("focus", 0.01);
  const slow = state.tick * 0.22;

  ctx.save();
  ctx.lineCap = "square";
  ctx.shadowColor = "rgba(95, 235, 105, 0.45)";
  ctx.shadowBlur = 2 + focus * 8;
  ctx.strokeStyle = "rgba(65, 225, 86, 0.54)";
  ctx.lineWidth = 2.2 - focus * 0.8;

  for (let index = 0; index < state.textRaster.length; index += 1) {
    const point = state.textRaster[index];
    const wobble = Math.sin(index * 0.037 + slow + point.y * 6) * warp + Math.sin(slow + index * 0.011) * drift;
    const x = clamp(point.x + wobble + (Math.random() - 0.5) * jitter, -1, 1);
    const y = clamp(point.y + Math.cos(index * 0.029 + slow) * warp * 0.55, -1, 1);
    const screen = denormalizePoint({ x, y });
    const length = 2.8 + point.a * 3.6;
    ctx.globalAlpha = 0.22 + point.a * 0.46;
    ctx.beginPath();
    ctx.moveTo(screen.x - length, screen.y);
    ctx.lineTo(screen.x + length, screen.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.9;
  ctx.shadowBlur = 1;
  ctx.strokeStyle = "rgba(225, 255, 210, 0.62)";
  ctx.lineWidth = 0.8;
  for (let index = 0; index < state.textRaster.length; index += 5) {
    const point = state.textRaster[index];
    const screen = denormalizePoint(point);
    ctx.beginPath();
    ctx.moveTo(screen.x - 1.2, screen.y);
    ctx.lineTo(screen.x + 1.2, screen.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCursor() {
  if (!state.pointer || state.mode === "text") return;
  const screen = denormalizePoint(state.pointer);
  ctx.save();
  ctx.fillStyle = "rgba(232, 255, 218, 0.92)";
  ctx.shadowColor = "rgba(105, 255, 125, 0.9)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, state.pointerDown ? 5 : 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function maybeAutoMutate() {
  if (!autoMutate.checked) return;
  const interval = 60000 / clamp(Number(autoSeconds.value) || 120, 20, 400);
  if (performance.now() - state.lastMutation < interval) return;
  state.lastMutation = performance.now();
  mutateControls();
}

function render() {
  state.tick += 0.012;
  maybeAutoMutate();
  ctx.fillStyle = `rgba(2, 6, 4, ${controlValue("decay", 0.008)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = controlValue("feedback", 0.004);
  ctx.filter = "blur(0.7px)";
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  if (state.gridOn) drawGrid();
  state.cachedVisualPoints = modulatedPoints();
  if (state.mode === "text" || state.mode === "mix") drawTextRaster();
  if (state.mode !== "text") drawBeamStep(state.cachedVisualPoints);
  drawCursor();
  sendPoints();
  requestAnimationFrame(render);
}

function canvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function updateMode() {
  state.mode = activeMode();
  liveTextBar.classList.toggle("hidden", state.mode === "draw" || state.mode === "wave");
  waveSection.classList.toggle("hidden", state.mode !== "wave");
  canvas.classList.toggle("draw-mode", state.mode !== "text");
  state.beamIndex = 0;
  if (state.mode === "wave" && !state.wavePoints.length) rebuildWavePoints();
  sendPoints(true);
}

function mutateControls() {
  if (state.mode === "wave") { mutateWave(); return; }
  state.lastMutation = performance.now();
  state.beamIndex = 0;
  controls.rate.value = Math.floor(180 + Math.random() * 1260);
  controls.warp.value = Math.floor(Math.random() * 46);
  controls.jitter.value = Math.floor(Math.random() * 24);
  controls.drift.value = Math.floor(4 + Math.random() * 44);
  controls.feedback.value = Math.floor(45 + Math.random() * 38);
  controls.focus.value = Math.floor(44 + Math.random() * 48);
  sendParams();
  sendPoints(true);
}

function setConfigOpen(open) {
  configPanel.classList.toggle("open", open);
  configPanel.setAttribute("aria-hidden", String(!open));
  configToggle.setAttribute("aria-expanded", String(open));
}

function setHelpOpen(open) {
  helpPanel.classList.toggle("open", open);
  helpPanel.setAttribute("aria-hidden", String(!open));
  helpToggle.setAttribute("aria-expanded", String(open));
}

// --- Event listeners ---

canvas.addEventListener("pointerdown", (event) => {
  if (state.mode === "text") return;
  state.pointerDown = true;
  canvas.setPointerCapture(event.pointerId);
  const position = canvasPosition(event);
  const point = normalizePoint(position.x, position.y);
  state.pointer = point;
  state.currentStroke = [point];
  state.drawStrokes.push(state.currentStroke);
  if (state.drawStrokes.length > 24) state.drawStrokes.shift();
  sendPoints(true);
});

canvas.addEventListener("pointermove", (event) => {
  const position = canvasPosition(event);
  const point = normalizePoint(position.x, position.y);
  state.pointer = point;
  if (!state.pointerDown || !state.currentStroke || state.mode === "text") return;
  const last = state.currentStroke[state.currentStroke.length - 1];
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.007) {
    state.currentStroke.push(point);
    if (state.currentStroke.length > 900) state.currentStroke.shift();
    sendPoints(true);
  }
});

function finishStroke() {
  state.pointerDown = false;
  state.currentStroke = null;
}

canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);
canvas.addEventListener("lostpointercapture", finishStroke);

liveTextInput.addEventListener("input", syncTextFromLive);
audioButton.addEventListener("click", toggleAudio);
clearButton.addEventListener("click", () => {
  state.drawStrokes = [];
  state.currentStroke = null;
  state.beamIndex = 0;
  sendPoints(true);
});
randomButton.addEventListener("click", mutateControls);
configToggle.addEventListener("click", () => setConfigOpen(!configPanel.classList.contains("open")));
gridToggle.addEventListener("click", toggleGrid);
gridToggle2.addEventListener("click", toggleGrid);
masterVolume.addEventListener("input", updateMasterVolume);
helpToggle.addEventListener("click", () => setHelpOpen(!helpPanel.classList.contains("open")));
helpClose.addEventListener("click", () => setHelpOpen(false));
helpPanel.addEventListener("click", (event) => {
  if (event.target === helpPanel) setHelpOpen(false);
});
modeInputs.forEach((input) => input.addEventListener("change", updateMode));

dronePower.addEventListener("change", async () => {
  if (dronePower.checked && !state.audioContext) await startAudio();
  ensureDroneState();
});
droneType.addEventListener("change", () => {
  if (state.drone) createDroneGraph();
});
droneNote.addEventListener("change", updateDroneParams);
Object.values(droneControls).forEach((control) => {
  control.addEventListener("input", updateDroneParams);
});

arpPower.addEventListener("change", async () => {
  state.arpIndex = 0;
  state.arpDirection = 1;
  if (arpPower.checked) {
    await startArpTimer();
  } else {
    stopArpTimer();
  }
});

textImport.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state.importedLines = text
    .split(/\r?\n/)
    .map((l) => l.trim().toUpperCase())
    .filter((l) => l.length > 0);
  state.importIndex = 0;
  textImport.value = "";
  if (state.importedLines.length) {
    liveTextInput.value = state.importedLines[0];
    syncTextFromLive();
    if (state.scrollOn) startScrollTimer();
  }
});

scrollToggle.addEventListener("click", () => {
  state.scrollOn = !state.scrollOn;
  scrollToggle.setAttribute("aria-pressed", String(state.scrollOn));
  scrollToggle.textContent = state.scrollOn ? "■" : "▶";
  scrollToggle.classList.toggle("active", state.scrollOn);
  startScrollTimer();
});

scrollSeconds.addEventListener("change", () => {
  if (state.scrollOn) startScrollTimer();
});

autoMutate.addEventListener("change", () => {
  state.lastMutation = performance.now();
});
autoSeconds.addEventListener("change", () => {
  autoSeconds.value = clamp(Number(autoSeconds.value) || 120, 20, 400);
  state.lastMutation = performance.now();
  if (arpPower.checked) startArpTimer();
});

Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => {
    sendParams();
    sendPoints(true);
  });
});

[waveType, waveFreqX, waveFreqY, wavePhase, waveHarmonics].forEach((control) => {
  control.addEventListener("input", rebuildWavePoints);
  control.addEventListener("change", rebuildWavePoints);
});

Object.values(fxControls).forEach((control) => {
  control.addEventListener("input", () => {
    if (control === fxControls.reverbSize) updateReverbSize();
    else updateFX();
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setHelpOpen(false);
    setConfigOpen(false);
    return;
  }
  if (event.target === liveTextInput) return;
  if (event.key.toLowerCase() === "m" && state.masterGain && state.audioContext) {
    if (state.audioOn) stopAudio();
    else startAudio();
  }
  if (event.key === " ") {
    event.preventDefault();
    if (state.masterGain && state.audioContext) {
      const now = state.audioContext.currentTime;
      state.masterGain.gain.cancelScheduledValues(now);
      state.masterGain.gain.linearRampToValueAtTime(0, now + 0.025);
    }
  }
});

// --- Init ---
ctx.fillStyle = "#020604";
ctx.fillRect(0, 0, canvas.width, canvas.height);
buildNoteDropdown();
updateMode();
rebuildTextPoints();
render();
