import { CHAPTERS, createTracks } from "./data.js";
import { PondAudio } from "./audio.js";
import { MoonlitPond } from "./pond.js";

const $ = (selector) => document.querySelector(selector);
const settings = { waveSpeed: 1, damping: .75, glow: 1, drift: .7, moon: 1, contrast: .9 };
const audio = new PondAudio();
let chapter = 0;
let tracks = createTracks(chapter);
let displayTrack = null;
let activeTrack = null;
let playedKeys = 0;
let toastTimer = 0;

function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem("pond-favorites") || "[]")); }
  catch (error) { console.error("读取收藏记录失败", error); return new Set(); }
}

const favorites = loadFavorites();
const pond = new MoonlitPond($("#pond"), settings, {
  onHover: (track) => {
    if (activeTrack && track?.id !== activeTrack.id) return;
    if (track) showTrack(track); else if (!activeTrack) hideTrack();
  },
  onSelect: (track) => playTrack(track),
  onInteract: dismissIntro,
  onMove: () => renderA11yNodes(),
  onResize: () => queueMicrotask(renderA11yNodes),
});
pond.setTracks(tracks);

function dismissIntro() {
  $("#intro").classList.add("is-gone");
  localStorage.setItem("pond-intro-seen", "1");
}

function showTrack(track) {
  displayTrack = track;
  $("#trackNumber").textContent = `NO. ${track.number} · ${CHAPTERS[track.chapter].title}`;
  $("#trackTitle").textContent = track.title;
  $("#trackCard").classList.add("is-visible");
  $("#trackCard").setAttribute("aria-hidden", "false");
  updateFavoriteButton();
}

function hideTrack() {
  displayTrack = null;
  $("#trackCard").classList.remove("is-visible");
  $("#trackCard").setAttribute("aria-hidden", "true");
}

async function playTrack(track) {
  dismissIntro();
  activeTrack = track;
  playedKeys = 0;
  showTrack(track);
  pond.setActive(track.id);
  $("#playerTitle").textContent = `${track.number} · ${track.title}`;
  $("#recordStatus").textContent = "正在聆听 · 你的演奏会被自然记录";
  $("#player").classList.add("is-visible");
  $("#player").setAttribute("aria-hidden", "false");
  try { await audio.play(track, () => finishPlayback(true)); }
  catch (error) { console.error("启动月下音乐失败", error); showToast("声音未能苏醒，请再次触碰"); }
}

function finishPlayback(naturalEnd) {
  if (!naturalEnd) audio.stop();
  pond.setActive(null);
  $("#player").classList.remove("is-visible");
  $("#player").setAttribute("aria-hidden", "true");
  $("#progressBar").style.width = "0%";
  const message = playedKeys
    ? "你的创作已记录 · 24 小时内可在「我的音乐」中收藏"
    : "这段聆听已沉入水中";
  showToast(message);
  activeTrack = null;
  if (!displayTrack) hideTrack();
}

function updateProgress() {
  const progress = audio.progress();
  $("#progressBar").style.width = `${progress * 100}%`;
  const elapsed = Math.floor(progress * audio.duration);
  $("#playerTime").textContent = `0:${String(elapsed).padStart(2, "0")}`;
  requestAnimationFrame(updateProgress);
}

function toggleFavorite() {
  const track = activeTrack || displayTrack;
  if (!track) return;
  if (favorites.has(track.id)) favorites.delete(track.id); else favorites.add(track.id);
  localStorage.setItem("pond-favorites", JSON.stringify([...favorites]));
  updateFavoriteButton();
  showToast(favorites.has(track.id) ? `「${track.title}」已收藏` : `「${track.title}」已移出收藏`);
}

function updateFavoriteButton() {
  const track = activeTrack || displayTrack;
  const saved = track ? favorites.has(track.id) : false;
  $("#cardFavorite").classList.toggle("is-favorite", saved);
  $("#cardFavorite span").textContent = saved ? "已收藏" : "收藏";
  $("#cardFavorite").setAttribute("aria-pressed", String(saved));
  $("#favoriteCount").textContent = favorites.size;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("is-visible");
  toastTimer = window.setTimeout(() => $("#toast").classList.remove("is-visible"), 3600);
}

function changeChapter(nextChapter) {
  if (chapter === nextChapter) return;
  if (audio.playing) {
    audio.stop();
    $("#player").classList.remove("is-visible");
  }
  chapter = nextChapter;
  tracks = createTracks(chapter);
  activeTrack = null;
  displayTrack = null;
  pond.setTracks(tracks);
  hideTrack();
  document.querySelectorAll(".chapter").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.chapter) === chapter);
  });
  renderA11yNodes();
  showToast(`${CHAPTERS[chapter].roman} · ${CHAPTERS[chapter].title}`);
}

function renderA11yNodes() {
  const layer = $("#a11yNodes");
  layer.replaceChildren(...tracks.map((track) => {
    const point = pond.positionFor(track, 0);
    const button = document.createElement("button");
    button.className = "a11y-node";
    button.type = "button";
    button.style.left = `${point.x}px`;
    button.style.top = `${point.y}px`;
    button.setAttribute("aria-label", `${track.number} ${track.title}，按回车播放`);
    button.addEventListener("focus", () => { pond.setHover(track.id); showTrack(track); });
    button.addEventListener("blur", () => { pond.setHover(null); if (!activeTrack) hideTrack(); });
    button.addEventListener("click", () => playTrack(track));
    return button;
  }));
}

function toggleDebug(force) {
  const panel = $("#debugPanel");
  const open = typeof force === "boolean" ? force : !panel.classList.contains("is-open");
  panel.classList.toggle("is-open", open);
  panel.setAttribute("aria-hidden", String(!open));
}

const presets = {
  still: { waveSpeed: .55, damping: .55, glow: .75, drift: .15, moon: .7, contrast: .75 },
  moon: { waveSpeed: .8, damping: .85, glow: 1.15, drift: .45, moon: 1.55, contrast: 1.05 },
  alive: { waveSpeed: 1.35, damping: 1.05, glow: 1.25, drift: 1.2, moon: .9, contrast: .95 },
};

function applyPreset(name) {
  Object.assign(settings, presets[name]);
  document.querySelectorAll("[data-setting]").forEach((input) => { input.value = settings[input.dataset.setting]; });
}

document.querySelectorAll(".chapter").forEach((button) => button.addEventListener("click", () => changeChapter(Number(button.dataset.chapter))));
document.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("input", () => { settings[input.dataset.setting] = Number(input.value); }));
document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset)));
$("#cardPlay").addEventListener("click", () => displayTrack && playTrack(displayTrack));
$("#cardFavorite").addEventListener("click", toggleFavorite);
$("#stopButton").addEventListener("click", () => finishPlayback(false));
$("#libraryButton").addEventListener("click", () => showToast(favorites.size ? `水庭中已收藏 ${favorites.size} 段声音` : "你的水庭还是空的"));
$("#debugToggle").addEventListener("click", () => toggleDebug());
$("#debugClose").addEventListener("click", () => toggleDebug(false));

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "d" && event.target.tagName !== "INPUT") { toggleDebug(); return; }
  if (!/^[a-z]$/i.test(event.key) || event.repeat || event.target.tagName === "INPUT") return;
  const letter = event.key.toUpperCase();
  dismissIntro();
  pond.emitKey(letter);
  audio.strike(letter).catch((error) => console.error("演奏声音失败", error));
  if (audio.playing) playedKeys += 1;
  $("#keyEcho").innerHTML = `<strong class="key-flash">${letter}</strong> <span>涟漪已落入水中</span>`;
  window.setTimeout(() => { $("#keyEcho").innerHTML = "A—Z <span>让声音落入水中</span>"; }, 700);
});

if (localStorage.getItem("pond-intro-seen")) $("#intro").classList.add("is-gone");
updateFavoriteButton();
renderA11yNodes();
updateProgress();
