const NOTES = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21];
const WAVEFORMS = ["sine", "triangle", "sine", "triangle"];

export class PondAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.ambient = [];
    this.timer = 0;
    this.startedAt = 0;
    this.duration = 38;
    this.playing = false;
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = .58;
      const delay = this.context.createDelay(1.5);
      const feedback = this.context.createGain();
      const wet = this.context.createGain();
      delay.delayTime.value = .36;
      feedback.gain.value = .28;
      wet.gain.value = .2;
      delay.connect(feedback).connect(delay);
      this.master.connect(delay).connect(wet).connect(this.context.destination);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  async play(track, onEnded) {
    await this.init();
    this.stop();
    const now = this.context.currentTime;
    const bus = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(.21, now + 2.8);
    bus.gain.setValueAtTime(.21, now + this.duration - 3);
    bus.gain.linearRampToValueAtTime(0, now + this.duration);
    filter.type = "lowpass";
    filter.frequency.value = 950 + (track.id % 7) * 90;
    filter.Q.value = .7;
    bus.connect(filter).connect(this.master);
    const root = 43.65 * Math.pow(2, (track.id % 12) / 12);
    [0, 7, 12].forEach((step, index) => {
      const oscillator = this.context.createOscillator();
      const voice = this.context.createGain();
      const lfo = this.context.createOscillator();
      const sway = this.context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = root * Math.pow(2, step / 12);
      oscillator.detune.value = (index - 1) * 4;
      voice.gain.value = [.35, .16, .09][index];
      lfo.frequency.value = .035 + index * .017;
      sway.gain.value = 2.5 + index;
      lfo.connect(sway).connect(oscillator.detune);
      oscillator.connect(voice).connect(bus);
      oscillator.start(now);
      lfo.start(now);
      oscillator.stop(now + this.duration + .1);
      lfo.stop(now + this.duration + .1);
      this.ambient.push(oscillator, lfo, voice, sway);
    });
    this.addWaterNoise(bus, now, track.id);
    this.ambient.push(bus, filter);
    this.startedAt = now;
    this.playing = true;
    this.timer = window.setTimeout(() => {
      this.playing = false;
      this.ambient = [];
      onEnded();
    }, this.duration * 1000);
  }

  addWaterNoise(bus, now, seed) {
    const length = this.context.sampleRate * 3;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (Math.sin(i * .0007 + seed) * .5 + .5);
    }
    const noise = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = .35;
    gain.gain.value = .035;
    noise.connect(filter).connect(gain).connect(bus);
    noise.start(now, seed % 2);
    noise.stop(now + this.duration);
    this.ambient.push(noise, filter, gain);
  }

  async strike(letter) {
    await this.init();
    const index = letter.charCodeAt(0) - 65;
    const now = this.context.currentTime + .008;
    const oscillator = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const pan = this.context.createStereoPanner();
    const frequency = 110 * Math.pow(2, NOTES[index % 13] / 12) * (index > 12 ? 2 : 1);
    oscillator.type = WAVEFORMS[index % WAVEFORMS.length];
    overtone.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    overtone.frequency.setValueAtTime(frequency * (index % 3 + 2), now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1500 + index * 90, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 1.4);
    pan.pan.value = (index / 25) * 1.4 - .7;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.13, now + .018 + index % 4 * .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .55 + index % 5 * .16);
    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain).connect(pan).connect(this.master);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + 1.5);
    overtone.stop(now + 1.5);
  }

  stop() {
    window.clearTimeout(this.timer);
    this.ambient.forEach((node) => {
      try { if (typeof node.stop === "function") node.stop(); } catch (error) {
        if (error.name !== "InvalidStateError") console.error("停止声音失败", error);
      }
      try { node.disconnect(); } catch (error) { console.error("断开声音节点失败", error); }
    });
    this.ambient = [];
    this.playing = false;
  }

  progress() {
    if (!this.playing || !this.context) return 0;
    return Math.min(1, (this.context.currentTime - this.startedAt) / this.duration);
  }
}
