import { makeTracks, TUNING_DEFAULTS } from './data.js';
import { SoundEngine } from './audio.js';
import { TerrainField } from './field.js';
import { AtlasUI, PRESETS } from './ui.js';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  chapter:0, tracks:makeTracks(0), hoveredId:null, selectedId:null, selectedTrack:null,
  status:'idle', startedAt:0, notes:0, events:[], pointer:{ x:0.5, y:0.5 },
  tuning:{ ...TUNING_DEFAULTS }, reducedMotion:motionQuery.matches
};

const ui = new AtlasUI();
const sound = new SoundEngine();
let playToken = 0;
let lastDragEvent = 0;
let lastTransportUpdate = 0;

function loadCollection() {
  try { return new Set(JSON.parse(localStorage.getItem('sonic-cartography-collection') || '[]')); }
  catch (error) { console.warn('收藏记录读取失败', error); return new Set(); }
}

const collected = loadCollection();
function addEvent(x, y, key, energy=1) {
  state.events.push({ x, y, key, energy, created:performance.now() / 1000 });
  if (state.events.length > 48) state.events.splice(0, state.events.length - 48);
}

function currentDetailTrack() {
  return state.tracks.find((track) => track.id === state.hoveredId) || state.selectedTrack;
}
function refreshDetail() {
  const track = currentDetailTrack();
  const detailState = track?.id === state.selectedId ? state.status : 'ready';
  ui.showTrack(track, detailState, track ? collected.has(track.id) : false);
}
async function playTrack(track) {
  const token = ++playToken;
  state.selectedId = track.id;
  state.selectedTrack = track;
  state.status = 'buffering';
  state.notes = 0;
  ui.useGuide();
  ui.markPlaying(track.id);
  ui.showTrack(track, 'buffering', collected.has(track.id));
  ui.setTransport(track, 'buffering');
  addEvent(track.x, track.y, track.number % 26, 1.2);
  try {
    const started = await sound.startTrack(track, () => {
      if (token === playToken) finishPlayback(false);
    }, () => token === playToken);
    if (!started || token !== playToken) return;
    state.status = 'playing';
    state.startedAt = performance.now();
    ui.showTrack(track, 'playing', collected.has(track.id));
    ui.setTransport(track, 'playing');
  } catch (error) {
    console.error('声音启动失败', error);
    state.status = 'idle';
    ui.markPlaying(null);
    ui.toastMessage('声音启动失败，请检查浏览器音频权限后重试。');
  }
}
function finishPlayback(manual) {
  if (state.status !== 'playing' && state.status !== 'buffering') return;
  playToken += 1;
  if (manual) sound.stopTrack(false);
  state.status = 'saved';
  ui.markPlaying(null);
  ui.showTrack(state.selectedTrack, 'saved', collected.has(state.selectedId));
  ui.setTransport(state.selectedTrack, 'saved', state.selectedTrack?.duration || 0);
  addEvent(state.selectedTrack.x, state.selectedTrack.y, 25, 1.4);
  const noteLabel = state.notes ? `，包含 ${state.notes} 次演奏` : '';
  ui.toastMessage(`YOUR RIPPLE HAS BEEN RECORDED${noteLabel} · 24 小时内可收藏`);
}
function changeChapter(index) {
  if (index === state.chapter) return;
  if (state.status === 'playing' || state.status === 'buffering') finishPlayback(true);
  state.chapter = index;
  state.tracks = makeTracks(index);
  state.hoveredId = null;
  state.selectedId = null;
  state.selectedTrack = null;
  state.status = 'idle';
  state.events.length = 0;
  ui.setChapter(index);
  ui.renderTracks(state.tracks, collected);
  ui.showTrack(null);
  ui.setTransport(null, 'idle');
  ui.toastMessage(`CHAPTER ${String(index + 1).padStart(2, '0')} · 图谱已重新测绘`);
}

function hoverTrack(track) {
  state.hoveredId = track?.id || null;
  ui.markHovered(state.hoveredId);
  refreshDetail();
}

function dragTrack(track) {
  const now = performance.now() / 1000;
  if (now - lastDragEvent < 0.065) return;
  lastDragEvent = now;
  addEvent(track.x, track.y, 10, 0.7);
}

function collectTrack(track) {
  const alreadyCollected = collected.has(track.id);
  if (alreadyCollected) {
    ui.toastMessage(`${track.label} / ${track.title} 已在你的水塘中`);
    return;
  }
  collected.add(track.id);
  try { localStorage.setItem('sonic-cartography-collection', JSON.stringify([...collected])); }
  catch (error) { console.warn('收藏记录保存失败', error); }
  ui.markCollected(track.id, true);
  ui.setCollectionCount(collected.size);
  ui.showTrack(track, track.id === state.selectedId ? state.status : 'ready', true);
  addEvent(track.x, track.y, 12, 1.5);
  ui.toastMessage(`${track.label} / ${track.title} 已加入「我的音乐」`);
}

function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('sonic-cartography-theme', html.dataset.theme); }
  catch (error) { console.debug('主题偏好无法保存', error); }
}

function updateTuning(key, value) {
  state.tuning[key] = value;
  ui.applyTuning(state.tuning);
}

function usePreset(name) {
  Object.assign(state.tuning, PRESETS[name]);
  ui.applyTuning(state.tuning);
  ui.toastMessage(`${name.toUpperCase()} · 视觉预设已启用`);
}

ui.bind({
  chapter:changeChapter,
  play:playTrack,
  stop:() => finishPlayback(true),
  hover:hoverTrack,
  drag:dragTrack,
  collect:collectTrack,
  theme:toggleTheme,
  tune:updateTuning,
  preset:usePreset,
  showCollection:() => ui.toastMessage(collected.size ? `你的水塘已保存 ${collected.size} 首音乐` : '你的水塘仍是空的，先收藏一首音乐。')
});

function restorePreferences() {
  try {
    const theme = localStorage.getItem('sonic-cartography-theme');
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  } catch (error) { console.debug('主题偏好无法读取', error); }
  ui.restoreGuide();
}

function handleKeyboard(event) {
  const tag = event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (event.key === 'Escape' && !ui.tuning.hidden) { ui.toggleTuning(false); return; }
  if (event.key.toLowerCase() === 'd' && state.status !== 'playing' && !event.repeat) {
    ui.toggleTuning();
    return;
  }
  if (event.code === 'Space' && state.status === 'playing' && tag !== 'BUTTON') {
    event.preventDefault();
    finishPlayback(true);
    return;
  }
  if (!/^[a-z]$/i.test(event.key) || event.repeat) return;
  const index = event.key.toUpperCase().charCodeAt(0) - 65;
  const origin = state.selectedTrack || state.pointer;
  sound.triggerKey(index).catch((error) => {
    console.error('键盘声音触发失败', error);
    ui.toastMessage('浏览器暂时无法发声，请再次点击页面。');
  });
  addEvent(origin.x, origin.y, index, 1);
  if (state.status === 'playing') state.notes += 1;
  ui.pulseKey(event.key.toUpperCase());
  ui.useGuide();
}

function animate(time) {
  const now = time / 1000;
  state.events = state.events.filter((event) => now - event.created < Number(state.tuning.decay));
  if (state.status === 'playing' && time - lastTransportUpdate > 100) {
    lastTransportUpdate = time;
    const elapsed = Math.min(state.selectedTrack.duration, (time - state.startedAt) / 1000);
    ui.setTransport(state.selectedTrack, 'playing', elapsed);
  }
  requestAnimationFrame(animate);
}

ui.mapStage.addEventListener('pointermove', (event) => {
  const box = ui.mapStage.getBoundingClientRect();
  state.pointer.x = (event.clientX - box.left) / box.width;
  state.pointer.y = (event.clientY - box.top) / box.height;
});
motionQuery.addEventListener('change', (event) => { state.reducedMotion = event.matches; });
window.addEventListener('keydown', handleKeyboard);

restorePreferences();
ui.setChapter(0);
ui.renderTracks(state.tracks, collected);
ui.setCollectionCount(collected.size);
ui.applyTuning(state.tuning);
try { new TerrainField(document.getElementById('terrain'), () => state); }
catch (error) { console.error('地形渲染不可用', error); ui.toastMessage('地形层不可用，但音乐坐标仍可操作。'); }
requestAnimationFrame(animate);
