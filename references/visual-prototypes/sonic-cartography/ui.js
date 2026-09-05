import { CHAPTERS, PRESETS, formatTime } from './data.js';

export class AtlasUI {
  constructor() {
    const ids = ['mapStage','nodes','detailState','detailDuration','detailNumber','detailTitle','detailMeta',
      'listenButton','collectButton','transportStatus','nowNumber','nowTitle','progress','timeLabel','stopButton',
      'guide','tuning','keySignal','toast','collectionCount','themeToggle','myMusic'];
    ids.forEach((id) => { this[id] = document.getElementById(id); });
    this.callbacks = {};
    this.trackButtons = new Map();
    this.currentTrack = null;
    this.toastTimer = 0;
  }

  bind(callbacks) {
    this.callbacks = callbacks;
    document.querySelectorAll('[data-chapter]').forEach((button) => {
      button.addEventListener('click', () => callbacks.chapter(Number(button.dataset.chapter)));
    });
    this.listenButton.addEventListener('click', () => this.currentTrack && callbacks.play(this.currentTrack));
    this.collectButton.addEventListener('click', () => this.currentTrack && callbacks.collect(this.currentTrack));
    this.stopButton.addEventListener('click', callbacks.stop);
    this.themeToggle.addEventListener('click', callbacks.theme);
    this.myMusic.addEventListener('click', callbacks.showCollection);
    document.querySelectorAll('[data-tune]').forEach((input) => {
      input.addEventListener('input', () => callbacks.tune(input.dataset.tune, Number(input.value)));
    });
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => callbacks.preset(button.dataset.preset));
    });
  }

  renderTracks(tracks, collected) {
    this.nodes.replaceChildren();
    this.trackButtons.clear();
    tracks.forEach((track) => {
      const button = document.createElement('button');
      const label = document.createElement('span');
      button.type = 'button';
      button.className = 'sound-node';
      button.dataset.id = track.id;
      button.style.left = `${track.x * 100}%`;
      button.style.top = `${track.y * 100}%`;
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', `${track.label} ${track.title}，按回车播放`);
      button.title = `${track.label} / ${track.title}`;
      label.textContent = track.label;
      button.append(label);
      if (collected.has(track.id)) button.classList.add('is-collected');
      this.bindTrack(button, track);
      this.nodes.append(button);
      this.trackButtons.set(track.id, button);
    });
  }

  bindTrack(button, track) {
    let pointer = null;
    let suppressClick = false;
    const reveal = () => this.callbacks.hover(track);
    button.addEventListener('pointerenter', reveal);
    button.addEventListener('focus', reveal);
    button.addEventListener('pointerleave', () => !pointer && this.callbacks.hover(null));
    button.addEventListener('blur', () => !pointer && this.callbacks.hover(null));
    button.addEventListener('pointerdown', (event) => {
      pointer = { id:event.pointerId, startX:event.clientX, startY:event.clientY, dragging:false };
      button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointermove', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      if (distance > 8) pointer.dragging = true;
      if (!pointer.dragging) return;
      suppressClick = true;
      button.classList.add('is-dragging');
      const box = this.mapStage.getBoundingClientRect();
      track.x = Math.max(0.025, Math.min(0.975, (event.clientX - box.left) / box.width));
      track.y = Math.max(0.035, Math.min(0.965, (event.clientY - box.top) / box.height));
      button.style.left = `${track.x * 100}%`;
      button.style.top = `${track.y * 100}%`;
      this.callbacks.drag(track);
    });
    button.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      button.releasePointerCapture(event.pointerId);
      button.classList.remove('is-dragging');
      pointer = null;
      window.setTimeout(() => { suppressClick = false; }, 0);
    });
    button.addEventListener('pointercancel', () => {
      pointer = null;
      button.classList.remove('is-dragging');
    });
    button.addEventListener('click', () => {
      if (!suppressClick) this.callbacks.play(track);
    });
  }

  setChapter(index) {
    document.querySelectorAll('[data-chapter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.chapter) === index));
    });
    document.querySelector('.depth-mark').textContent = `DEPTH / ${CHAPTERS[index].depth}`;
  }

  showTrack(track, state='ready', collected=false) {
    this.currentTrack = track;
    if (!track) {
      this.detailState.textContent = '等待信号';
      this.detailNumber.textContent = 'NO. —';
      this.detailTitle.textContent = '选择一个坐标';
      this.detailMeta.textContent = '将指针移向图谱，查看一首音乐的档案。';
      this.detailDuration.textContent = '00:00';
      this.listenButton.disabled = true;
      this.collectButton.disabled = true;
      return;
    }
    const labels = { ready:'可聆听', buffering:'正在调谐', playing:'现场记录中', saved:'涟漪已记录' };
    this.detailState.textContent = labels[state] || labels.ready;
    this.detailNumber.textContent = `NO. ${track.label}`;
    this.detailTitle.textContent = track.title;
    this.detailMeta.textContent = `COORD. ${track.coordinate} · ARCHIVE ${Math.ceil(track.number / 36).toString().padStart(2, '0')}`;
    this.detailDuration.textContent = formatTime(track.duration);
    this.listenButton.disabled = state === 'buffering';
    this.listenButton.textContent = state === 'playing' ? 'RESTART / 重新聆听' : 'LISTEN / 聆听';
    this.collectButton.disabled = false;
    this.collectButton.textContent = collected ? 'IN MY POND / 已收藏' : 'ADD TO MY POND / 收藏';
  }

  markHovered(id) {
    this.trackButtons.forEach((button, key) => button.classList.toggle('is-hovered', key === id));
  }

  markPlaying(id) {
    this.trackButtons.forEach((button, key) => button.classList.toggle('is-playing', key === id));
  }

  markCollected(id, value) {
    this.trackButtons.get(id)?.classList.toggle('is-collected', value);
  }

  setTransport(track, state, elapsed=0) {
    const active = state === 'playing' || state === 'buffering';
    const labels = { idle:'ARCHIVE READY', buffering:'TUNING SIGNAL', playing:'LIVE RECORDING', saved:'RIPPLE RECORDED' };
    this.transportStatus.textContent = labels[state] || labels.idle;
    this.nowNumber.textContent = track ? track.label : '—';
    this.nowTitle.textContent = track ? track.title : '等待选择';
    this.stopButton.disabled = !active;
    const duration = track?.duration || 0;
    this.progress.style.width = `${duration ? Math.min(100, elapsed / duration * 100) : 0}%`;
    this.timeLabel.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
  }

  setCollectionCount(count) {
    this.collectionCount.textContent = String(count).padStart(2, '0');
  }

  applyTuning(tuning) {
    document.documentElement.style.setProperty('--node-scale', tuning.nodeScale);
    document.querySelectorAll('[data-tune]').forEach((input) => {
      input.value = tuning[input.dataset.tune];
    });
  }

  toggleTuning(force) {
    this.tuning.hidden = typeof force === 'boolean' ? !force : !this.tuning.hidden;
    return !this.tuning.hidden;
  }

  pulseKey(letter) {
    this.keySignal.textContent = letter;
    this.keySignal.classList.remove('is-active');
    void this.keySignal.offsetWidth;
    this.keySignal.classList.add('is-active');
  }

  toastMessage(message) {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('is-visible'), 4200);
  }

  useGuide() {
    this.guide.classList.add('is-used');
    try { localStorage.setItem('sonic-cartography-guide', 'used'); } catch (error) { console.debug('无法记录引导状态', error); }
  }

  restoreGuide() {
    try { if (localStorage.getItem('sonic-cartography-guide')) this.guide.classList.add('is-used'); }
    catch (error) { console.debug('无法读取引导状态', error); }
  }
}

export { PRESETS };
