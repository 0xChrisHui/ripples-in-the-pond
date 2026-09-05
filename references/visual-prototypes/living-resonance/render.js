import { REACTIONS } from './data.js';

function membranePath(ctx, world, node, point, time, radius) {
  const steps = 34;
  const active = node.excitation * world.tuning.response;
  const breath = world.reduced ? 0 : Math.sin(time * .00055 * node.drift + node.phase) * world.tuning.breath * .035;
  const dragAngle = Math.atan2(world.pointer.vy, world.pointer.vx);
  const stretch = world.dragged === node ? Math.min(.34, Math.hypot(world.pointer.vx, world.pointer.vy) * .015) : 0;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = i / steps * Math.PI * 2;
    const harmonic = Math.sin(angle * node.harmonic + node.phase) * (.055 + active * .075);
    const nerve = Math.sin(angle * (node.harmonic + 3) - time * .002) * (.018 + active * .035);
    const directional = Math.cos(angle - dragAngle) * stretch;
    const r = radius * (1 + breath + harmonic + nerve + directional);
    const x = point.x + Math.cos(angle) * r;
    const y = point.y + Math.sin(angle) * r * (1 - stretch * .28);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawField(ctx, world, time) {
  ctx.fillStyle = world.background;
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const motion = world.reduced ? 0 : world.tuning.flow;
  for (let i = 0; i < 9; i += 1) {
    const y = world.height * (.1 + i * .105);
    const sway = Math.sin(time * .00008 + i * 1.7) * 38 * motion;
    ctx.beginPath();
    ctx.moveTo(-30, y + sway);
    ctx.bezierCurveTo(world.width * .28, y - 26 - sway, world.width * .65, y + 38 + sway, world.width + 30, y - sway);
    ctx.strokeStyle = `rgba(83,140,124,${.018 + (i % 3) * .006})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.drawImage(world.pointerGlow, world.pointer.x - 180, world.pointer.y - 180);
  ctx.restore();
}

function drawFocus(ctx, world, point, radius, time) {
  const pulse = world.reduced ? 1 : 1 + Math.sin(time * .0014) * .025;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let ring = 3; ring > 0; ring -= 1) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * (1.7 + ring * .5) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(215,164,91,${.025 * (4 - ring) * world.tuning.halo})`;
    ctx.lineWidth = ring === 1 ? 1 : 7;
    ctx.stroke();
  }
  ctx.restore();
}

function drawMycelium(ctx, world, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  world.nodes.forEach((node, index) => {
    const from = world.position(node, time);
    [1, 6].forEach((offset) => {
      if (offset === 1 && index % 6 === 5) return;
      const peer = world.nodes[index + offset];
      if (!peer) return;
      const to = world.position(peer, time);
      const bend = Math.sin(node.phase + time * .00018) * 13 * (world.reduced ? 0 : 1);
      const active = Math.max(node.excitation, peer.excitation);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo((from.x + to.x) / 2 + bend, (from.y + to.y) / 2 - bend, to.x, to.y);
      ctx.strokeStyle = `rgba(126,190,174,${.045 + active * .08})`;
      ctx.lineWidth = .45 + active * .65;
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawMemory(ctx, world, point, radius, time) {
  if (!world.current || world.memory === 0) return;
  const amount = Math.min(1, world.memory / 28);
  const segments = Math.max(2, Math.ceil(world.memory * .72));
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(-Math.PI / 2 + time * .00004);
  ctx.strokeStyle = 'rgba(222,190,129,.76)';
  ctx.lineWidth = .65;
  for (let i = 0; i < segments; i += 1) {
    const start = i / Math.max(28, segments) * Math.PI * 2;
    const length = .03 + (i % 4) * .008;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.56 + Math.sin(i * 4.2) * 2, start, Math.min(start + length, amount * Math.PI * 2));
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrganism(ctx, world, node, time, energy) {
  const point = world.position(node, time);
  const selected = world.current === node;
  const dimmed = world.current && !selected;
  const radius = node.radius * (selected ? 1.18 : 1) * (1 + (selected ? energy.low * .08 : 0));
  if (selected) drawFocus(ctx, world, point, radius, time);
  ctx.save();
  ctx.globalAlpha = dimmed ? .25 : .72 + node.excitation * .17;
  ctx.shadowColor = node.palette.core;
  ctx.shadowBlur = (selected ? 20 : 7) * world.tuning.halo + node.excitation * 12;
  membranePath(ctx, world, node, point, time, radius);
  ctx.fillStyle = node.palette.membrane;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = selected ? 'rgba(231,203,151,.74)' : 'rgba(192,218,194,.24)';
  ctx.lineWidth = selected ? 1 : .55;
  ctx.stroke();
  const pull = world.hovered === node ? .13 : .04;
  const dx = Math.max(-4, Math.min(4, (world.pointer.x - point.x) * pull));
  const dy = Math.max(-4, Math.min(4, (world.pointer.y - point.y) * pull));
  ctx.beginPath();
  ctx.arc(point.x + dx, point.y + dy, radius * (.17 + energy.mid * .03), 0, Math.PI * 2);
  ctx.fillStyle = node.palette.core;
  ctx.globalAlpha = dimmed ? .18 : .78;
  ctx.shadowColor = node.palette.core;
  ctx.shadowBlur = 13 * world.tuning.halo;
  ctx.fill();
  ctx.restore();
  if (selected) drawMemory(ctx, world, point, radius, time);
}

function reactionGeometry(ctx, reaction, event, progress) {
  const fade = Math.pow(1 - progress, 1.5) * event.strength;
  const radius = 18 + progress * (80 + reaction.spokes * 4) * event.strength;
  ctx.strokeStyle = reaction.color;
  ctx.fillStyle = reaction.color;
  ctx.globalAlpha = fade * .58;
  ctx.lineWidth = .7 + (event.index % 3) * .35;
  ctx.translate(event.x, event.y);
  ctx.rotate(progress * reaction.turns + event.index);
  if (reaction.family === 0 || reaction.family === 5) {
    ctx.setLineDash(reaction.family === 5 ? [5, 8 + event.index % 6] : []);
    for (let i = 0; i < 2 + event.index % 3; i += 1) { ctx.beginPath(); ctx.arc(0, 0, radius * (1 - i * .18), i * .45, Math.PI * (1.15 + i * .2)); ctx.stroke(); }
  } else if (reaction.family === 1) {
    for (let i = 0; i < reaction.spokes; i += 1) { const a = i / reaction.spokes * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius * .2, Math.sin(a) * radius * .2); ctx.lineTo(Math.cos(a + progress * .3) * radius, Math.sin(a + progress * .3) * radius); ctx.stroke(); }
  } else if (reaction.family === 2) {
    ctx.beginPath();
    for (let i = 0; i < 42; i += 1) { const a = i / 41 * Math.PI * 2 * reaction.turns; const r = radius * i / 41; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(0, 0); }
    ctx.stroke();
  } else if (reaction.family === 3 || reaction.family === 6) {
    for (let i = 0; i < 3 + event.index % 4; i += 1) { ctx.beginPath(); ctx.moveTo(-radius, i * 7 - 12); ctx.bezierCurveTo(-radius * .3, -25 + i * 3, radius * .35, 24 - i * 4, radius, i * 5 - 9); ctx.stroke(); }
  } else if (reaction.family === 4) {
    for (let i = 0; i < reaction.spokes; i += 1) { const a = i / reaction.spokes * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius, 1 + i % 3, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.beginPath();
    for (let i = 0; i <= reaction.spokes; i += 1) { const a = i / reaction.spokes * Math.PI * 2; const r = radius * (i % 2 ? .58 : 1); if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(r, 0); }
    ctx.stroke();
  }
}

function drawEvents(ctx, world) {
  world.events.forEach((event) => {
    ctx.save();
    reactionGeometry(ctx, REACTIONS[event.index], event, event.age / event.duration);
    ctx.restore();
  });
  world.seeds.forEach((seed) => {
    const p = Math.min(1, seed.age / seed.duration);
    const ease = 1 - Math.pow(1 - p, 3);
    const x = seed.x + (seed.tx - seed.x) * ease;
    const y = seed.y + (seed.ty - seed.y) * ease - Math.sin(p * Math.PI) * 80;
    ctx.save(); ctx.globalAlpha = 1 - p * .55; ctx.fillStyle = seed.color; ctx.shadowColor = seed.color; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(x, y, 3.5 - p * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
}

export function renderWorld(world, time, energy) {
  const ctx = world.ctx;
  drawField(ctx, world, time);
  drawMycelium(ctx, world, time);
  drawEvents(ctx, world);
  world.nodes.forEach((node) => drawOrganism(ctx, world, node, time, energy));
}
