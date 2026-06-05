class XYOscillatorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.points = new Float32Array([0, 0]);
    this.phase = 0;
    this.rate = 520;
    this.targetRate = 520;
    this.gain = 0.28;
    this.targetGain = 0.28;
    this.smooth = 0.75;
    this.targetSmooth = 0.75;
    this.slewX = 0;
    this.slewY = 0;
    this.prevLeft = 0;
    this.prevRight = 0;
    this.dcLeft = 0;
    this.dcRight = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data.type === "points") {
        this.points = new Float32Array(data.points);
        this.phase = Math.min(this.phase, Math.max(0, this.points.length / 2 - 1));
      }
      if (data.type === "params") {
        this.targetRate = Number.isFinite(data.rate) ? Math.max(20, Math.min(120000, data.rate)) : this.targetRate;
        this.targetGain = Number.isFinite(data.gain) ? Math.max(0, Math.min(0.9, data.gain)) : this.targetGain;
        this.targetSmooth = Number.isFinite(data.smooth) ? Math.max(0.08, Math.min(0.96, data.smooth)) : this.targetSmooth;
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const count = Math.max(1, this.points.length / 2);

    for (let index = 0; index < left.length; index += 1) {
      this.rate += (this.targetRate - this.rate) * 0.0009;
      this.gain += (this.targetGain - this.gain) * 0.0012;
      this.smooth += (this.targetSmooth - this.smooth) * 0.0008;
      const increment = this.rate / sampleRate;
      const base = Math.floor(this.phase) % count;
      const next = (base + 1) % count;
      const blend = this.phase - Math.floor(this.phase);
      const baseOffset = base * 2;
      const nextOffset = next * 2;
      const targetX = this.points[baseOffset] + (this.points[nextOffset] - this.points[baseOffset]) * blend;
      const targetY = this.points[baseOffset + 1] + (this.points[nextOffset + 1] - this.points[baseOffset + 1]) * blend;

      const slew = 1 - this.smooth;
      this.slewX += (targetX - this.slewX) * slew;
      this.slewY += (targetY - this.slewY) * slew;
      const rawLeft = this.slewX * this.gain;
      const rawRight = this.slewY * this.gain;
      const hpLeft = rawLeft - this.prevLeft + 0.995 * this.dcLeft;
      const hpRight = rawRight - this.prevRight + 0.995 * this.dcRight;
      this.prevLeft = rawLeft;
      this.prevRight = rawRight;
      this.dcLeft = hpLeft;
      this.dcRight = hpRight;
      left[index] = Math.tanh(hpLeft * 1.25) * 0.82;
      right[index] = Math.tanh(hpRight * 1.25) * 0.82;

      this.phase += increment;
      if (this.phase >= count) this.phase -= count;
    }

    return true;
  }
}

registerProcessor("xy-oscillator", XYOscillatorProcessor);
