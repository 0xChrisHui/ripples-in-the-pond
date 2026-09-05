import { KEY_MOTIONS } from "./data.js";
import { PondRenderer } from "./pond-render.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class MoonlitPond {
  constructor(canvas, settings, callbacks) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.settings = settings;
    this.callbacks = callbacks;
    this.tracks = [];
    this.waves = [];
    this.hoverId = null;
    this.activeId = null;
    this.drag = null;
    this.width = 0;
    this.height = 0;
    this.lastTime = performance.now();
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.background = null;
    this.renderer = new PondRenderer(this);
    this.bindEvents();
    this.resize();
    requestAnimationFrame((time) => this.frame(time));
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.pointerCancel(event));
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.drag) this.setHover(null);
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.background = this.context.createLinearGradient(0, 0, 0, this.height);
    this.background.addColorStop(0, "#071615");
    this.background.addColorStop(.5, "#0a1b19");
    this.background.addColorStop(1, "#030b0b");
    this.callbacks.onResize?.();
  }

  setTracks(tracks) {
    this.tracks = tracks;
    this.hoverId = null;
    this.activeId = null;
    this.waves.length = 0;
  }

  setActive(id) {
    this.activeId = id;
    if (id) {
      const track = this.tracks.find((item) => item.id === id);
      if (track) {
        const point = this.positionFor(track);
        this.emitWave(point.x, point.y, "focus", 1.4);
      }
    }
  }

  setHover(id) {
    if (this.hoverId === id || (this.activeId && id !== this.activeId)) return;
    this.hoverId = id;
    const track = this.tracks.find((item) => item.id === id) || null;
    this.callbacks.onHover(track);
  }

  positionFor(track, time = performance.now() * .001) {
    const ambient = this.reduced ? 0 : Math.sin(time * .34 + track.phase) * this.settings.drift * 2.4;
    return { x: track.nx * this.width, y: track.ny * this.height + ambient };
  }

  pick(x, y) {
    let match = null;
    let nearest = Infinity;
    this.tracks.forEach((track) => {
      const point = this.positionFor(track);
      const distance = Math.hypot(point.x - x, point.y - y);
      const hitRadius = Math.max(24, track.radius * 1.55);
      if (distance < hitRadius && distance < nearest) {
        nearest = distance;
        match = track;
      }
    });
    return match;
  }

  pointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  pointerDown(event) {
    const point = this.pointer(event);
    const track = this.pick(point.x, point.y);
    this.callbacks.onInteract();
    this.canvas.setPointerCapture(event.pointerId);
    this.drag = track ? { track, startX: point.x, startY: point.y, moved: false } : null;
    if (!track) this.emitWave(point.x, point.y, "soft", .45);
  }

  pointerMove(event) {
    const point = this.pointer(event);
    if (!this.drag) {
      const track = this.pick(point.x, point.y);
      this.setHover(track?.id ?? null);
      return;
    }
    const distance = Math.hypot(point.x - this.drag.startX, point.y - this.drag.startY);
    if (distance > 8) this.drag.moved = true;
    if (this.drag.moved) {
      this.drag.track.nx = clamp(point.x / this.width, .1, .9);
      this.drag.track.ny = clamp(point.y / this.height, .15, .82);
      if (!this.reduced && (!this.drag.lastWave || performance.now() - this.drag.lastWave > 55)) {
        this.emitWave(point.x, point.y, "wake", .38);
        this.drag.lastWave = performance.now();
      }
      this.callbacks.onMove?.();
    }
  }

  pointerUp(event) {
    if (!this.drag) return;
    const point = this.pointer(event);
    const { track, moved } = this.drag;
    this.drag = null;
    if (moved) {
      this.emitWave(point.x, point.y, "double", .72);
      this.callbacks.onMove?.();
    } else {
      this.callbacks.onSelect(track);
    }
  }

  pointerCancel(event) {
    this.drag = null;
    this.setHover(null);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  }

  emitKey(letter) {
    const track = this.tracks.find((item) => item.id === (this.activeId || this.hoverId));
    const base = track ? this.positionFor(track) : { x: this.width * .52, y: this.height * .5 };
    const index = letter.charCodeAt(0) - 65;
    const angle = index * 2.399;
    const offset = track ? track.radius * .5 : 28 + (index % 5) * 8;
    this.emitWave(base.x + Math.cos(angle) * offset, base.y + Math.sin(angle) * offset * .55, KEY_MOTIONS[index % KEY_MOTIONS.length], .65 + (index % 6) * .1);
  }

  emitWave(x, y, type = "ring", strength = 1) {
    this.waves.push({ x, y, type, strength, age: 0 });
    if (this.waves.length > 34) this.waves.shift();
  }

  frame(time) {
    const delta = Math.min(.04, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.renderer.draw(time * .001, delta);
    requestAnimationFrame((next) => this.frame(next));
  }
}
