import { LivingAudio } from './audio.js';
import { CHAPTERS, REACTIONS } from './data.js';
import { renderWorld } from './render.js';
import { LivingWorld } from './world.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('ecosystem');
const world = new LivingWorld(canvas);
const audio = new LivingAudio();
const ui = {
  onboarding: byId('onboarding'), tag: byId('specimen-tag'), tagIndex: byId('tag-index'), tagTitle: byId('tag-title'),
  player: byId('player'), playerIndex: byId('player-index'), playerName: byId('player-name'), time: byId('player-time'),
  progress: byId('progress-bar'), keyOrb: byId('key-orb'), keyMessage: byId('key-message'), toast: byId('toast'),
  panel: byId('tune-panel'), layer: byId('organism-layer'), collect: byId('collect-button'), seedCount: byId('seed-count')
};
function loadCollection() {
  try { return new Set(JSON.parse(localStorage.getItem('living-resonance-collection') || '[]')); }
  catch (error) { console.warn('声音种子读取失败', error); return new Set(); }
}
const collected = loadCollection();
let startedAt = 0;
let playing = false;
let pointerDown = null;
let toastTimer = 0;
let targets = [];
let lastFrame = performance.now();
let frame = 0;

function enter() {
  ui.onboarding.classList.add('is-hidden');
  localStorage.setItem('living-resonance-entered', '1');
}

function toast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 3600);
}

function showTag(node) {
  if (!node || playing && node !== world.current) { ui.tag.classList.remove('is-visible'); return; }
  const point = world.position(node);
  const left = Math.max(82, Math.min(innerWidth - 175, point.x + node.radius + 20));
  const top = Math.max(115, Math.min(innerHeight - 80, point.y));
  ui.tag.style.left = `${left}px`;
  ui.tag.style.top = `${top}px`;
  ui.tagIndex.textContent = `SPECIMEN ${String(node.id).padStart(3, '0')}`;
  ui.tagTitle.textContent = node.title;
  ui.tag.classList.add('is-visible');
}

function rebuildTargets() {
  ui.layer.replaceChildren();
  targets = world.nodes.map((node) => {
    const button = document.createElement('button');
    button.className = 'organism-target';
    button.type = 'button';
    button.setAttribute('aria-label', `播放 ${node.title}，编号 ${String(node.id).padStart(3, '0')}`);
    button.addEventListener('focus', () => { world.hovered = node; showTag(node); });
    button.addEventListener('blur', () => { world.hovered = null; showTag(null); });
    button.addEventListener('click', () => selectNode(node));
    ui.layer.append(button);
    return button;
  });
}

function syncTargets() {
  world.nodes.forEach((node, index) => {
    const point = world.position(node);
    targets[index].style.left = `${point.x}px`;
    targets[index].style.top = `${point.y}px`;
  });
}

async function selectNode(node) {
  enter();
  try {
    await audio.startAmbient(node);
  } catch (error) {
    console.error('音频生态场启动失败', error);
    toast('浏览器阻止了声音，请再次触碰生命体');
    return;
  }
  world.play(node);
  startedAt = performance.now();
  playing = true;
  ui.playerIndex.textContent = String(node.id).padStart(3, '0');
  ui.playerName.textContent = node.title;
  ui.collect.textContent = collected.has(node.id) ? '已收藏' : '收藏种子';
  ui.player.classList.add('is-active');
  showTag(node);
  toast(`「${node.title}」已经苏醒`);
}

function stopPlayback(message = true) {
  if (!playing) return;
  audio.stopAmbient();
  world.finish();
  playing = false;
  ui.player.classList.toggle('is-active', message);
  ui.tag.classList.remove('is-visible');
  if (message) toast('这段涟漪已被记住 · 24 小时内可收藏');
}

async function playKey(index) {
  enter();
  const point = world.current ? world.position(world.current) : world.pointer;
  world.react(index, point.x || innerWidth / 2, point.y || innerHeight / 2, 1);
  ui.keyOrb.textContent = REACTIONS[index].letter;
  ui.keyMessage.textContent = `${['膜收缩','神经脉冲','螺旋压力波','菌丝闪烁','能量滴','双层扩散','水脉偏折','核心震动'][index % 8]} · ${world.memory} 段记忆`;
  try { await audio.playKey(index); } catch (error) { console.error('合奏音色启动失败', error); }
}

function collectCurrent() {
  const node = world.current;
  if (!node) { toast('请先唤醒一个声音生命体'); return; }
  if (collected.has(node.id)) { toast('这枚声音种子已经在你的水塘中'); return; }
  const target = byId('collection-button').getBoundingClientRect();
  if (!world.collect(target.left + target.width / 2, target.top + target.height / 2)) return;
  collected.add(node.id);
  try { localStorage.setItem('living-resonance-collection', JSON.stringify([...collected])); }
  catch (error) { console.warn('声音种子保存失败', error); }
  ui.seedCount.textContent = String(collected.size).padStart(2, '0');
  ui.collect.textContent = '已收藏';
  toast(`已收藏「${node.title}」的声音种子`);
}

canvas.addEventListener('pointerdown', (event) => {
  enter();
  world.updatePointer(event.clientX, event.clientY);
  const node = world.hitTest(event.clientX, event.clientY);
  pointerDown = node ? { node, x: event.clientX, y: event.clientY } : null;
  if (pointerDown) canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  world.updatePointer(event.clientX, event.clientY);
  if (pointerDown) {
    if (!world.dragged && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) world.beginDrag(pointerDown.node);
    if (world.dragged) world.dragTo(event.clientX, event.clientY);
    return;
  }
  world.hovered = world.hitTest(event.clientX, event.clientY);
  showTag(world.hovered);
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown) return;
  if (world.dragged) world.endDrag(); else selectNode(pointerDown.node);
  pointerDown = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => { world.endDrag(); pointerDown = null; });

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'd' && !event.repeat && !playing) { ui.panel.classList.toggle('is-visible'); return; }
  if (event.key === 'Escape') { stopPlayback(); ui.panel.classList.remove('is-visible'); return; }
  if (event.target instanceof HTMLInputElement || event.repeat) return;
  const index = event.key.toUpperCase().charCodeAt(0) - 65;
  if (index >= 0 && index < 26) playKey(index);
});

document.querySelectorAll('.chapter').forEach((button) => button.addEventListener('click', () => {
  stopPlayback(false);
  const chapter = Number(button.dataset.chapter);
  world.setChapter(chapter);
  world.nodes.forEach((node) => { node.collected = collected.has(node.id); });
  document.querySelectorAll('.chapter').forEach((item) => item.classList.toggle('is-active', item === button));
  rebuildTargets();
  toast(`${CHAPTERS[chapter].name} · ${chapter * 36 + 1}—${chapter * 36 + 36}`);
}));

document.querySelectorAll('[data-tune]').forEach((input) => input.addEventListener('input', () => {
  world.tuning[input.dataset.tune] = Number(input.value);
  input.previousElementSibling.value = Number(input.value).toFixed(2);
}));

document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => {
  world.applyPreset(button.dataset.preset);
  document.querySelectorAll('[data-tune]').forEach((input) => { input.value = world.tuning[input.dataset.tune]; input.previousElementSibling.value = Number(input.value).toFixed(2); });
}));

byId('enter-button').addEventListener('click', enter);
byId('stop-button').addEventListener('click', () => stopPlayback());
byId('collect-button').addEventListener('click', collectCurrent);
byId('collection-button').addEventListener('click', () => toast(collected.size ? `你的水塘保存了 ${collected.size} 枚声音种子` : '收藏的声音种子会在这里汇聚'));
byId('close-panel').addEventListener('click', () => ui.panel.classList.remove('is-visible'));

addEventListener('resize', () => { world.resize(); syncTargets(); });
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => { world.reduced = event.matches; });

function animate(now) {
  const dt = Math.min(.04, (now - lastFrame) / 1000);
  lastFrame = now;
  world.tick(dt, now);
  renderWorld(world, now, audio.sampleEnergy());
  if (playing) {
    const elapsed = (now - startedAt) / 1000;
    const seconds = Math.min(144, elapsed);
    ui.progress.style.width = `${seconds / 144 * 100}%`;
    ui.time.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(Math.floor(seconds % 60)).padStart(2,'0')} / 02:24`;
    if (elapsed >= 144) stopPlayback();
  }
  if (frame++ % 3 === 0) syncTargets();
  requestAnimationFrame(animate);
}

if (localStorage.getItem('living-resonance-entered')) ui.onboarding.classList.add('is-hidden');
ui.seedCount.textContent = String(collected.size).padStart(2, '0');
world.nodes.forEach((node) => { node.collected = collected.has(node.id); });
world.pointer.x = innerWidth / 2;
world.pointer.y = innerHeight / 2;
rebuildTargets();
syncTargets();
requestAnimationFrame(animate);
