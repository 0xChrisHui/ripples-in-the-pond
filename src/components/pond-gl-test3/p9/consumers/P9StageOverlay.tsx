'use client';

import { useEffect, useRef } from 'react';
import { getShowcasePose } from '../../showcase/showcase-state';
import { getP9Mode, getP9Modes, sampleP9, type P9VoiceFrame } from '../runtime/p9-sampler';
import { getP9EffectValue, getP9FamilyValue } from '../tuning/p9-tuning-store';

const DOTS = Array.from({ length: 24 }, (_, index) => index);
const INSTANCES = Array.from({ length: 6 }, (_, index) => index);
const hash = (value: number): number => Math.abs(Math.sin(value * 78.233) * 43758.5453) % 1;

function updateSporeGroup(group: SVGGElement, cue: P9VoiceFrame | undefined): void {
  group.style.opacity = String(cue?.energy ?? 0);
  const clusters = getP9EffectValue('FX02', 'clusters', 4);
  for (const [index, dot] of [...group.querySelectorAll('circle')].entries()) {
    const seed = cue?.voice.seed ?? 1;
    const orphan = hash(index * 31 + seed) < getP9EffectValue('FX02', 'orphanRate', 0.35);
    const cluster = index % clusters;
    const baseAngle = cluster / clusters * Math.PI * 2 + hash(cluster + seed) * 0.7;
    const angle = orphan ? hash(index * 17 + seed) * Math.PI * 2 : baseAngle + (hash(index + seed) - 0.5) * 0.42;
    const staggerMax = getP9EffectValue('FX02', 'staggerMax', 0.08);
    const delay = index === 0 ? 0 : hash(index * 13 + seed) * staggerMax / (cue?.voice.effect.duration ?? 1);
    const motionProgress = (cue?.progress ?? 0) * (cue?.motionScale ?? 1);
    const p = Math.max(0, (motionProgress - delay) / (1 - delay));
    const spreadGain = getP9EffectValue('FX02', 'spread', 1);
    const spread = 25 + p * (75 + hash(index) * 110) * spreadGain;
    dot.setAttribute('cx', String(Math.cos(angle) * spread));
    dot.setAttribute('cy', String(Math.sin(angle) * spread));
    dot.setAttribute('r', String(2.2 + hash(index * 7 + seed) * 5.8));
    dot.style.opacity = String(p > 0 ? 0.6 + hash(index * 5 + seed) * 0.4 : 0);
  }
}

function updateBoundary(path: SVGPathElement, cue: P9VoiceFrame | undefined, now: number, w: number, h: number): void {
  if (!cue) { path.style.opacity = '0'; return; }
  const wobble = getP9EffectValue(cue.voice.effect.id, 'wobble', 0.45);
  const nx = Math.cos(cue.voice.angle), ny = Math.sin(cue.voice.angle);
  const tx = -ny, ty = nx, span = Math.hypot(w, h) * 0.72;
  const travel = (cue.progress - 0.5) * cue.motionScale * Math.hypot(w, h) * 1.7;
  const cx = w * 0.5 + nx * travel, cy = h * 0.5 + ny * travel;
  const motionTime = cue.voice.reduced ? cue.progress * cue.motionScale * cue.voice.effect.duration : now;
  const bend = Math.sin(motionTime * 1.9 + cue.voice.seed) * 28 * wobble;
  path.setAttribute('d', `M${cx - tx * span},${cy - ty * span} C${cx - tx * span * 0.35 + nx * bend},${cy - ty * span * 0.35 + ny * bend} ${cx + tx * span * 0.35 - nx * bend},${cy + ty * span * 0.35 - ny * bend} ${cx + tx * span},${cy + ty * span}`);
  const width = getP9EffectValue(cue.voice.effect.id, 'width', 0.045) * 28;
  path.setAttribute('stroke-width', String(width));
  path.style.opacity = String(Math.min(0.86, cue.energy));
}

function updateTrace(path: SVGPathElement, cue: P9VoiceFrame | undefined, now: number, w: number, h: number, focusX: number, focusY: number): void {
  if (!cue) { path.style.opacity = '0'; return; }
  const a = cue.voice.angle, cx = focusX + (hash(cue.voice.seed) - 0.5) * 90, cy = focusY + (hash(cue.voice.seed * 3) - 0.5) * 90;
  const length = Math.min(w, h) * (0.28 + hash(cue.voice.seed * 5) * 0.35);
  const dx = Math.cos(a) * length, dy = Math.sin(a) * length;
  const motionTime = cue.voice.reduced ? cue.progress * cue.motionScale * cue.voice.effect.duration : now;
  const wobble = getP9EffectValue('FX39', 'wobble', 0.65) * Math.sin(motionTime * 1.7 + cue.voice.seed) * 34;
  path.setAttribute('d', `M${cx - dx},${cy - dy} C${cx - dx * 0.35 - dy * 0.25},${cy - dy * 0.35 + dx * 0.25 + wobble} ${cx + dx * 0.35 + dy * 0.25},${cy + dy * 0.35 - dx * 0.25 - wobble} ${cx + dx},${cy + dy}`);
  path.setAttribute('stroke-width', String(getP9EffectValue('FX39', 'middleWidth', 0.8)));
  path.style.opacity = String(cue.energy);
  path.style.strokeDashoffset = String(760 * (cue.progress < 0.62 ? 1 - cue.progress / 0.62 : (cue.progress - 0.62) / 0.38));
}

function updateLens(group: SVGGElement, cue: P9VoiceFrame | null, x: number, y: number, scale: number): void {
  group.style.opacity = String(Math.min(1, (cue?.energy ?? 0) * getP9EffectValue('FX05', 'brightness', 1)));
  group.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
  if (!cue) return;
  const orbit = getP9EffectValue('FX05', 'orbit', 1.1), asymmetry = getP9EffectValue('FX05', 'asymmetry', 0.67);
  const speed = getP9EffectValue('FX05', 'speed', 1.2);
  [...group.children].forEach((arc, index) => {
    const radius = 62 * orbit * (1 + index * 0.21);
    const angle = cue.voice.seed * 0.7 + cue.progress * cue.motionScale * cue.voice.effect.duration * speed * (30 + index * 5) + index * 79;
    arc.setAttribute('transform', `rotate(${angle})`);
    const ellipse = arc.querySelector('ellipse'), dot = arc.querySelector('circle');
    ellipse?.setAttribute('rx', String(radius)); ellipse?.setAttribute('ry', String(radius * asymmetry));
    ellipse?.setAttribute('stroke-width', String(2.1 - index * 0.32));
    ellipse?.setAttribute('stroke-dashoffset', String(-cue.progress * cue.motionScale * 180 * (index % 2 ? -1 : 1)));
    if (dot) { const phase = cue.progress * cue.motionScale * Math.PI * 2 + index; dot.setAttribute('cx', String(Math.cos(phase) * radius)); dot.setAttribute('cy', String(Math.sin(phase) * radius * asymmetry)); dot.setAttribute('r', String(1.4 + cue.energy * 0.8)); }
  });
}

export default function P9StageOverlay() {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now() / 1000, frame = sampleP9(now), pose = getShowcasePose();
      const svg = svgRef.current, w = innerWidth, h = innerHeight;
      if (!svg) return;
      const limit = getP9FamilyValue('scene', 'globalLimit', 0.86);
      const transit = getP9Mode(frame, 'moon-transit'), film = getP9Mode(frame, 'milk-film');
      const inversions = getP9Modes(frame, 'light-inversion');
      const dark = svg.querySelector<SVGRectElement>('[data-dark]');
      if (dark) { const a = transit?.voice.angle ?? 0, travel = ((transit?.progress ?? 0) - 0.5) * (transit?.motionScale ?? 1) * Math.hypot(w, h) * 2; dark.style.opacity = String(Math.min(limit, (transit?.motion ?? 0) * getP9EffectValue('FX41', 'shade', 1))); dark.setAttribute('x', String(-w * 0.3)); dark.setAttribute('y', String(-h)); dark.setAttribute('width', String(w * 0.6)); dark.setAttribute('height', String(h * 2)); dark.setAttribute('transform', transit ? `translate(${w / 2 + Math.cos(a) * travel} ${h / 2 + Math.sin(a) * travel}) rotate(${a * 180 / Math.PI})` : ''); }
      const filmRect = svg.querySelector<SVGRectElement>('[data-film]');
      if (filmRect) filmRect.style.opacity = String(Math.min(limit, (film?.motion ?? 0) * getP9EffectValue('FX42', 'film', 0.5)));
      svg.querySelectorAll<SVGRectElement>('[data-invert]').forEach((invert, index) => { const cue = inversions[index], a = cue?.voice.angle ?? 0, travel = ((cue?.progress ?? 0) - 0.5) * (cue?.motionScale ?? 1) * Math.hypot(w, h) * 2; invert.style.opacity = String(Math.min(limit, (cue?.motion ?? 0) * 0.72)); invert.setAttribute('x', String(-w * 0.2)); invert.setAttribute('y', String(-h)); invert.setAttribute('width', String(w * 0.4)); invert.setAttribute('height', String(h * 2)); invert.setAttribute('transform', cue ? `translate(${w / 2 + Math.cos(a) * travel} ${h / 2 + Math.sin(a) * travel}) rotate(${a * 180 / Math.PI})` : ''); });
      const spores = getP9Modes(frame, 'spore-burst');
      const sporeRoot = svg.querySelector<SVGGElement>('[data-spores]');
      sporeRoot?.setAttribute('transform', `translate(${pose.x * w} ${pose.y * h}) scale(${pose.scale})`);
      [...(sporeRoot?.children ?? [])].forEach((group, index) => updateSporeGroup(group as SVGGElement, spores[index]));
      const lensRoot = svg.querySelector<SVGGElement>('[data-lens]');
      if (lensRoot) updateLens(lensRoot, getP9Mode(frame, 'lens-orbit'), pose.x * w, pose.y * h, pose.scale);
      const sweeps = getP9Modes(frame, 'screen-sweep');
      svg.querySelectorAll<SVGPathElement>('[data-boundary]').forEach((path, index) => updateBoundary(path, sweeps[index], now, w, h));
      const traces = getP9Modes(frame, 'draw-erase');
      svg.querySelectorAll<SVGPathElement>('[data-trace]').forEach((path, index) => updateTrace(path, traces[index], now, w, h, pose.x * w, pose.y * h));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg ref={svgRef} className="pointer-events-none fixed inset-0 z-[22] h-full w-full" aria-hidden="true">
      <defs><linearGradient id="p9-film"><stop stopColor="#eef6f1" stopOpacity="0.08" /><stop offset="45%" stopColor="#dae8df" stopOpacity="0.72" /><stop offset="100%" stopColor="#b8d4cf" stopOpacity="0.12" /></linearGradient><linearGradient id="p9-trace"><stop stopColor="#e5f5ed" stopOpacity="0" /><stop offset="50%" stopColor="#e5f5ed" /><stop offset="100%" stopColor="#e5f5ed" stopOpacity="0" /></linearGradient><linearGradient id="p9-lens"><stop stopColor="#fff" /><stop offset="50%" stopColor="#a9b9bd" /><stop offset="100%" stopColor="#fff" stopOpacity="0.15" /></linearGradient></defs>
      <rect data-dark fill="#050505" style={{ opacity: 0 }} />
      <rect data-film x="0" y="0" width="100%" height="100%" fill="#f5fbff" style={{ opacity: 0 }} />
      {INSTANCES.map((i) => <rect key={`i${i}`} data-invert fill="#fff" style={{ opacity: 0, mixBlendMode: 'difference' }} />)}
      {INSTANCES.map((i) => <path key={`b${i}`} data-boundary fill="none" stroke="#d9f4ed" strokeLinecap="round" style={{ opacity: 0 }} />)}
      <g data-spores>{INSTANCES.map((batch) => <g key={batch} style={{ opacity: 0 }}>{DOTS.map((dot) => <circle key={dot} fill={dot % 4 ? '#9bc9c1' : '#f2fff9'} />)}</g>)}</g>
      <g data-lens style={{ opacity: 0 }}>{INSTANCES.slice(0, 4).map((index) => <g key={index}><ellipse fill="none" stroke="url(#p9-lens)" strokeDasharray="72 250" strokeLinecap="round" /><circle fill="#fff" /></g>)}</g>
      {INSTANCES.map((i) => <path key={`t${i}`} data-trace fill="none" stroke="url(#p9-trace)" strokeDasharray="760" style={{ opacity: 0 }} />)}
    </svg>
  );
}
