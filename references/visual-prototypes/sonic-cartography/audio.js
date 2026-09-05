const SCALE = [0, 2, 3, 7, 9, 12, 14, 15, 19, 21];
const WAVES = ['sine', 'triangle', 'sawtooth', 'square'];

export class SoundEngine {
  constructor() {
    this.context = null;
    this.output = null;
    this.trackBus = null;
    this.trackNodes = [];
    this.motifTimer = 0;
    this.endTimer = 0;
    this.motifStep = 0;
    this.noiseBuffer = null;
  }

  async ensure() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('当前浏览器不支持 Web Audio API');
      this.context = new AudioContext();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.24;
      this.output = this.context.createGain();
      this.output.gain.value = 0.72;
      this.output.connect(compressor).connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context;
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.18);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const values = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) values[i] = Math.random() * 2 - 1;
    return buffer;
  }

  async startTrack(track, onEnd, shouldStart = () => true) {
    await this.ensure();
    if (!shouldStart()) return false;
    this.stopTrack(false);
    const now = this.context.currentTime;
    const root = 43 + (track.number % 5) * 2;
    this.trackBus = this.context.createGain();
    this.trackBus.gain.setValueAtTime(0.0001, now);
    this.trackBus.gain.exponentialRampToValueAtTime(0.28, now + 1.4);
    this.trackBus.connect(this.output);
    [0, 7, 12].forEach((offset, index) => this.createDrone(root + offset, index));
    this.motifStep = track.number % SCALE.length;
    this.playMotif(root);
    this.motifTimer = window.setInterval(() => this.playMotif(root), 780);
    this.endTimer = window.setTimeout(() => {
      this.stopTrack(true);
      onEnd();
    }, track.duration * 1000);
    return true;
  }

  createDrone(midi, index) {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    oscillator.type = index === 1 ? 'triangle' : 'sine';
    oscillator.frequency.value = this.midiToHz(midi);
    oscillator.detune.value = index * 3 - 3;
    filter.type = 'lowpass';
    filter.frequency.value = 520 + index * 170;
    filter.Q.value = 1.2;
    gain.gain.value = [0.15, 0.075, 0.045][index];
    lfo.frequency.value = 0.055 + index * 0.021;
    lfoGain.gain.value = 10 + index * 4;
    lfo.connect(lfoGain).connect(oscillator.detune);
    oscillator.connect(filter).connect(gain).connect(this.trackBus);
    oscillator.start(now);
    lfo.start(now);
    this.trackNodes.push(oscillator, lfo);
  }

  playMotif(root) {
    if (!this.context || !this.trackBus) return;
    const step = this.motifStep++;
    if (step % 4 === 2) return;
    const midi = root + 12 + SCALE[step % SCALE.length];
    const time = this.context.currentTime + 0.025;
    this.createVoice({ frequency:this.midiToHz(midi), time, decay:1.3, level:0.055, wave:'sine', destination:this.trackBus, overtone:2.01 });
  }

  async triggerKey(index) {
    await this.ensure();
    const now = this.context.currentTime + 0.012;
    const octave = Math.floor(index / 9);
    const semitone = SCALE[index % SCALE.length] + octave * 12;
    const frequency = this.midiToHz(48 + semitone);
    const filterModes = ['lowpass', 'bandpass', 'highpass'];
    this.createVoice({
      frequency,
      time:now,
      decay:0.24 + (index % 6) * 0.12,
      level:0.11,
      wave:WAVES[index % WAVES.length],
      destination:this.output,
      overtone:1.5 + (index % 5) * 0.25,
      filterType:filterModes[index % 3],
      pan:(index % 7 - 3) / 4
    });
    if (index % 7 === 5) this.createNoiseStrike(now, frequency);
  }

  createVoice(options) {
    const { frequency, time, decay, level, wave, destination, overtone, filterType='lowpass', pan=0 } = options;
    const voice = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const panner = this.context.createStereoPanner();
    voice.gain.setValueAtTime(0.0001, time);
    voice.gain.exponentialRampToValueAtTime(level, time + 0.018);
    voice.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(300, frequency * 5), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, frequency * 1.2), time + decay);
    filter.Q.value = 2 + (frequency % 5);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    voice.connect(filter).connect(panner).connect(destination);
    [1, overtone].forEach((ratio, index) => {
      const oscillator = this.context.createOscillator();
      oscillator.type = index ? 'sine' : wave;
      oscillator.frequency.setValueAtTime(frequency * ratio, time);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * ratio * 0.985, time + decay);
      const balance = this.context.createGain();
      balance.gain.value = index ? 0.22 : 1;
      oscillator.connect(balance).connect(voice);
      oscillator.start(time);
      oscillator.stop(time + decay + 0.04);
    });
  }

  createNoiseStrike(time, frequency) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency * 2;
    filter.Q.value = 8;
    gain.gain.setValueAtTime(0.04, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    source.connect(filter).connect(gain).connect(this.output);
    source.start(time);
  }

  stopTrack(finished = false) {
    window.clearInterval(this.motifTimer);
    window.clearTimeout(this.endTimer);
    this.motifTimer = 0;
    this.endTimer = 0;
    if (!this.context || !this.trackBus) return;
    const now = this.context.currentTime;
    this.trackBus.gain.cancelScheduledValues(now);
    this.trackBus.gain.setTargetAtTime(0.0001, now, finished ? 0.35 : 0.08);
    const nodes = this.trackNodes.splice(0);
    window.setTimeout(() => nodes.forEach((node) => {
      try { node.stop(); } catch (error) { console.debug('音频节点已停止', error); }
    }), finished ? 1200 : 350);
    this.trackBus = null;
  }

  midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}
