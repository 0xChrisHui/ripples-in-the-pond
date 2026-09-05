import { createOrganisms, PRESETS, REACTIONS } from './data.js';

export class LivingWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.chapter = 0;
    this.nodes = createOrganisms(0);
    this.events = [];
    this.seeds = [];
    this.current = null;
    this.hovered = null;
    this.dragged = null;
    this.state = 'DORMANT';
    this.memory = 0;
    this.pointer = { x: 0, y: 0, vx: 0, vy: 0 };
    this.tuning = { ...PRESETS.listening };
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    const mobile = this.width < 720;
    this.dpr = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.75);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const gradient = this.ctx.createRadialGradient(this.width * .58, this.height * .45, 20, this.width * .52, this.height * .5, Math.max(this.width, this.height) * .78);
    gradient.addColorStop(0, '#123934');
    gradient.addColorStop(.4, '#0a2420');
    gradient.addColorStop(1, '#040c0b');
    this.background = gradient;
    this.pointerGlow = document.createElement('canvas');
    this.pointerGlow.width = 360;
    this.pointerGlow.height = 360;
    const glowCtx = this.pointerGlow.getContext('2d');
    const glow = glowCtx.createRadialGradient(180, 180, 0, 180, 180, 180);
    glow.addColorStop(0, 'rgba(121,163,135,.04)');
    glow.addColorStop(1, 'rgba(4,12,11,0)');
    glowCtx.fillStyle = glow;
    glowCtx.fillRect(0, 0, 360, 360);
  }

  setChapter(index) {
    this.chapter = index;
    this.nodes = createOrganisms(index);
    this.events = [];
    this.current = null;
    this.hovered = null;
    this.memory = 0;
    this.state = 'DORMANT';
  }

  position(node, time = this.time) {
    const still = this.reduced || this.dragged === node || this.current === node;
    const drift = still ? 0 : this.tuning.flow;
    return {
      x: node.nx * this.width + Math.sin(time * .00016 * node.drift + node.phase) * 9 * drift,
      y: node.ny * this.height + Math.cos(time * .00013 * node.drift + node.phase) * 7 * drift
    };
  }

  hitTest(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const point = this.position(node);
      const hitRadius = Math.max(24, node.radius * 1.45);
      if (Math.hypot(x - point.x, y - point.y) <= hitRadius) return node;
    }
    return null;
  }

  updatePointer(x, y) {
    this.pointer.vx = x - this.pointer.x;
    this.pointer.vy = y - this.pointer.y;
    this.pointer.x = x;
    this.pointer.y = y;
  }

  beginDrag(node) {
    this.dragged = node;
    this.state = 'DRAGGING';
    node.excitation = 1;
  }

  dragTo(x, y) {
    if (!this.dragged) return;
    this.dragged.nx = Math.max(.08, Math.min(.92, x / this.width));
    this.dragged.ny = Math.max(.12, Math.min(.9, y / this.height));
    if (Math.hypot(this.pointer.vx, this.pointer.vy) > 4) this.react((this.dragged.index + 3) % 26, x, y, .35);
  }

  endDrag() {
    if (this.dragged) this.dragged.excitation = .7;
    this.dragged = null;
    this.state = this.current ? 'PLAYING_AND_RECORDING' : 'DORMANT';
  }

  play(node) {
    this.current = node;
    this.memory = 0;
    this.state = 'PLAYING_AND_RECORDING';
    node.excitation = 1.2;
    const point = this.position(node);
    this.react((node.id + 5) % 26, point.x, point.y, 1.15);
  }

  finish() {
    if (!this.current) return;
    const point = this.position(this.current);
    this.events.push({ index: 5, x: point.x, y: point.y, age: 0, duration: 1.8, strength: .9 });
    this.current.excitation = .4;
    this.state = 'MEMORY_SAVED';
  }

  react(index, x, y, strength = 1) {
    const reaction = REACTIONS[index];
    this.events.push({ index, x, y, age: 0, duration: reaction.duration, strength });
    if (this.events.length > 44) this.events.splice(0, this.events.length - 44);
    this.nodes.forEach((node) => {
      const point = this.position(node);
      const influence = Math.max(0, 1 - Math.hypot(x - point.x, y - point.y) / 230);
      node.excitation = Math.min(1.5, node.excitation + influence * .48 * strength);
    });
    if (this.current) this.memory = Math.min(64, this.memory + 1);
  }

  collect(targetX, targetY) {
    if (!this.current) return false;
    const point = this.position(this.current);
    this.current.collected = true;
    this.seeds.push({ x: point.x, y: point.y, tx: targetX, ty: targetY, age: 0, duration: 1.15, color: this.current.palette.core });
    this.state = 'COLLECTED';
    return true;
  }

  tick(dt, time) {
    this.time = time;
    this.nodes.forEach((node) => { node.excitation *= Math.pow(.08, dt); });
    this.events.forEach((event) => { event.age += dt; });
    this.seeds.forEach((seed) => { seed.age += dt; });
    this.events = this.events.filter((event) => event.age < event.duration);
    this.seeds = this.seeds.filter((seed) => seed.age < seed.duration);
  }

  applyPreset(name) {
    Object.assign(this.tuning, PRESETS[name]);
  }
}
