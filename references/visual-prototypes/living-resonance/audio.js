import { REACTIONS } from './data.js';

export class LivingAudio {
  constructor() {
    this.context = null;
    this.output = null;
    this.ambient = null;
    this.analyser = null;
    this.spectrum = null;
    this.sources = [];
    this.energy = { low: 0, mid: 0, high: 0, rms: 0 };
  }

  async ensure() {
    if (!this.context) this.buildGraph();
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.currentTime;
  }

  buildGraph() {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioEngine();
    this.output = this.context.createGain();
    this.output.gain.value = .72;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 5;
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = .82;
    this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    this.output.connect(compressor).connect(this.analyser).connect(this.context.destination);
  }

  async startAmbient(node) {
    const now = await this.ensure();
    this.stopAmbient(.08);
    const bus = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580 + node.id * 7, now);
    filter.Q.value = 1.4;
    bus.gain.setValueAtTime(.0001, now);
    bus.gain.exponentialRampToValueAtTime(.16, now + 1.8);
    bus.connect(filter).connect(this.output);
    const root = 48 * Math.pow(2, (node.id % 9) / 12);
    [1, 1.5, 2.005].forEach((ratio, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = root * ratio;
      oscillator.detune.value = index * 4 - 3;
      gain.gain.value = [.34, .12, .04][index];
      oscillator.connect(gain).connect(bus);
      oscillator.start(now);
      this.sources.push(oscillator);
    });
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = .07 + (node.id % 5) * .012;
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start(now);
    this.sources.push(lfo);
    this.addWaterNoise(bus, now, node.id);
    this.ambient = bus;
  }

  addWaterNoise(bus, now, seed) {
    const length = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = last * .986 + (Math.random() * 2 - 1) * .014;
      data[i] = last;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 240 + seed * 3;
    filter.Q.value = .8;
    gain.gain.value = .055;
    source.connect(filter).connect(gain).connect(bus);
    source.start(now);
    this.sources.push(source);
  }

  stopAmbient(fade = .7) {
    if (!this.context || !this.ambient) return;
    const now = this.context.currentTime;
    this.ambient.gain.cancelScheduledValues(now);
    this.ambient.gain.setValueAtTime(Math.max(this.ambient.gain.value, .0001), now);
    this.ambient.gain.exponentialRampToValueAtTime(.0001, now + fade);
    this.sources.forEach((source) => {
      try { source.stop(now + fade + .05); } catch (error) { console.debug('声源已结束', error); }
    });
    this.sources = [];
    this.ambient = null;
  }

  async playKey(index) {
    const now = await this.ensure();
    const reaction = REACTIONS[index];
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const oscillator = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    oscillator.type = reaction.wave;
    overtone.type = index % 3 === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(reaction.frequency, now);
    overtone.frequency.setValueAtTime(reaction.frequency * (1.5 + (index % 4) * .125), now);
    filter.type = index % 2 ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(700 + index * 90, now);
    filter.frequency.exponentialRampToValueAtTime(180 + index * 10, now + reaction.duration);
    filter.Q.value = 2 + (index % 5);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.11 + (index % 4) * .018, now + .018 + (index % 3) * .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + reaction.duration);
    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain).connect(this.output);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + reaction.duration + .04);
    overtone.stop(now + reaction.duration + .04);
  }

  sampleEnergy() {
    if (!this.analyser) return this.energy;
    this.analyser.getByteFrequencyData(this.spectrum);
    const average = (from, to) => {
      let total = 0;
      for (let i = from; i < to; i += 1) total += this.spectrum[i];
      return total / ((to - from) * 255);
    };
    const targets = [average(0, 5), average(5, 24), average(24, 70)];
    ['low', 'mid', 'high'].forEach((band, index) => {
      this.energy[band] += (targets[index] - this.energy[band]) * .12;
    });
    this.energy.rms = (this.energy.low + this.energy.mid + this.energy.high) / 3;
    return this.energy;
  }
}
