export const PROBE_SOURCE = `(() => {
  if (window.__p11J) return;
  const nativeRaf = requestAnimationFrame.bind(window);
  const ids = new WeakMap(); let nextId = 0;
  const idOf = (node) => { if (!node) return null; if (!ids.has(node)) ids.set(node, ++nextId); return ids.get(node); };
  const surface = (name, selector) => {
    const node = document.querySelector(selector); if (!node) return { name, exists: false, opacity: 0 };
    const rect = node.getBoundingClientRect(); let opacity = 1; let visible = true;
    let pointer = true; let cursor = node;
    while (cursor instanceof Element) {
      const style = getComputedStyle(cursor); opacity *= Number(style.opacity || 1);
      visible &&= style.visibility !== 'hidden' && style.display !== 'none';
      pointer &&= style.pointerEvents !== 'none'; cursor = cursor.parentElement;
    }
    const inert = Boolean(node.closest('[inert]'));
    return { name, exists: true, opacity: Math.round(opacity * 1000) / 1000,
      visible, inert, pointer, rect: { x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height) } };
  };
  const activeResources = { raf: new Set(), fetch: new Set(), audio: new Set(),
    sources: new Set(), media: new Set() };
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => { let handle = raf((time) => {
    activeResources.raf.delete(handle); fn(time);
  }); activeResources.raf.add(handle); return handle; };
  window.cancelAnimationFrame = (handle) => { activeResources.raf.delete(handle); return caf(handle); };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (...args) => { const marker = { url: String(args[0]?.url ?? args[0] ?? ''),
      owner: document.querySelector('[data-pond-shell]')?.dataset.pondSceneOwner ?? null };
    activeResources.fetch.add(marker);
    return nativeFetch(...args).finally(() => activeResources.fetch.delete(marker)); };
  const mediaPlay = HTMLMediaElement.prototype.play, mediaPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.play = function(...args) { const media = this;
    const result = mediaPlay.apply(media, args); Promise.resolve(result).then(() => {
      if (!media.paused) activeResources.media.add(media);
    }).catch(() => activeResources.media.delete(media)); return result; };
  HTMLMediaElement.prototype.pause = function(...args) {
    activeResources.media.delete(this); return mediaPause.apply(this, args); };
  let listeners = 0; const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener; const registry = new WeakMap();
  EventTarget.prototype.addEventListener = function(type, fn, options) {
    if (fn && !options?.once && !options?.signal) { const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      let keys = registry.get(this); if (!keys) { keys = new Map(); registry.set(this, keys); }
      const key = type + '|' + capture; let set = keys.get(key); if (!set) { set = new Set(); keys.set(key, set); }
      if (!set.has(fn)) { set.add(fn); listeners++; }
    } return add.call(this, type, fn, options);
  };
  EventTarget.prototype.removeEventListener = function(type, fn, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    if (fn && registry.get(this)?.get(type + '|' + capture)?.delete(fn)) listeners--;
    return remove.call(this, type, fn, options);
  };
  let contexts = 0, framebuffers = 0; const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
    const context = getContext.call(this, kind, ...args);
    if (context && /^webgl/.test(kind) && !this.dataset.p11JContext) {
      this.dataset.p11JContext = String(++contexts); const create = context.createFramebuffer.bind(context);
      context.createFramebuffer = (...items) => { framebuffers++; return create(...items); };
    } return context;
  };
  const NativeAudio = window.AudioContext || window.webkitAudioContext;
  if (NativeAudio) { const Wrapped = function(...args) { const context = new NativeAudio(...args);
    activeResources.audio.add(context); const close = context.close.bind(context);
    context.close = (...items) => close(...items).finally(() => activeResources.audio.delete(context));
    const create = context.createBufferSource.bind(context); context.createBufferSource = (...items) => {
      const source = create(...items); const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...values) => { activeResources.sources.add(source); return start(...values); };
      source.stop = (...values) => { activeResources.sources.delete(source); return stop(...values); };
      source.addEventListener('ended', () => activeResources.sources.delete(source), { once: true }); return source;
    }; return context; }; Wrapped.prototype = NativeAudio.prototype; Object.setPrototypeOf(Wrapped, NativeAudio);
    window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped; }
  const state = { active: false, label: null, source: null, target: null, intentAt: null,
    visualReadyAt: null, revealStartAt: null, settledAt: null, frames: [] };
  const read = () => {
    const shell = document.querySelector('[data-pond-shell]');
    const surfaces = [surface('home', '.pond-home-surface'), surface('archive', '.pond-prepared-archive'),
      surface('score', 'main[data-score-state], .score-fallback')];
    const usable = surfaces.filter((item) => item.exists && item.visible && item.rect.width > 0
      && item.rect.height > 0 && item.opacity > .2);
    const inferredInteractive = surfaces.find((item) => usable.includes(item) && !item.inert && item.pointer)?.name ?? null;
    const core = document.querySelector('[data-pond-mount-id]'); const canvases = [...document.querySelectorAll('canvas')];
    return { t: performance.now(), path: location.pathname,
      stage: shell?.dataset.pondStage ?? shell?.dataset.pondTransition ?? null,
      current: shell?.dataset.pondCurrent ?? null, target: shell?.dataset.pondTarget ?? null,
      generation: shell?.dataset.pondGeneration ?? null,
      interactiveOwner: shell?.dataset.pondInteractiveOwner ?? inferredInteractive,
      sceneOwner: shell?.dataset.pondSceneOwner ?? null, surfaces,
      foregrounds: usable.map((item) => item.name), coreId: idOf(core), mountId: core?.dataset.pondMountId ?? null,
      canvasIds: canvases.map(idOf), contexts, framebuffers,
      anchors: [...document.querySelectorAll('*')].filter((node) => getComputedStyle(node).viewTransitionName === 'score-record').length,
      resources: { raf: activeResources.raf.size, fetch: activeResources.fetch.size,
        fetchUrls: [...activeResources.fetch].map((item) => item.url),
        scoreFetchUrls: [...activeResources.fetch].filter((item) => item.owner === 'score').map((item) => item.url),
        audio: activeResources.audio.size, sources: activeResources.sources.size,
        media: activeResources.media.size, listeners },
      players: { score: document.querySelector('main[data-score-state]')?.dataset.playbackState ?? null,
        global: Boolean(document.querySelector('.bottom-player-shell[aria-label="全局播放器"]')),
        featured: document.querySelector('[data-featured-echo-player]')?.dataset.playing === 'true' } };
  };
  const tick = () => { if (state.active) { const frame = read(); state.frames.push(frame);
    const source = frame.surfaces.find((item) => item.name === state.source);
    const target = frame.surfaces.find((item) => item.name === state.target);
    const targetReady = target?.exists && target.visible && target.rect.width > 0 && target.rect.height > 0;
    if (!state.revealStartAt && ((source?.opacity ?? 0) < .98 || (target?.opacity ?? 0) > .02)) state.revealStartAt = frame.t;
    if (!state.visualReadyAt && targetReady) state.visualReadyAt = frame.t;
    if (!state.settledAt && state.visualReadyAt && frame.path === (state.target === 'home' ? '/' : state.target === 'archive' ? '/me' : '/score/1')
      && (target?.opacity ?? 0) > .98 && frame.interactiveOwner === state.target) state.settledAt = frame.t;
  } nativeRaf(tick); }; nativeRaf(tick);
  window.__p11J = { begin(label, source, target) { Object.assign(state, { active: true, label, source, target,
    intentAt: performance.now(), visualReadyAt: null, revealStartAt: null, settledAt: null, frames: [] }); return state.intentAt; },
    snapshot: read, end() { state.active = false; return structuredClone(state); } };
})()`;

const nearest = (frames, at) => frames.reduce((best, frame) =>
  Math.abs(frame.t - at) < Math.abs(best.t - at) ? frame : best, frames[0]);

export function addClockSamples(trace) {
  const intentOffsets = [0, 150, 450, 1500, 1900, 2150, 2600];
  const readyOffsets = [0, 150, 450, 1500];
  const samples = (origin, offsets) => origin == null || !trace.frames.length ? [] : offsets.map((offset) => {
    const frame = nearest(trace.frames, origin + offset);
    return { requestedOffset: offset, actualOffset: Math.round(frame.t - origin), frame };
  });
  trace.clocks = { intent: samples(trace.intentAt, intentOffsets),
    visualReady: samples(trace.visualReadyAt, readyOffsets) };
  trace.deltas = {
    visualReadyFromIntent: trace.visualReadyAt == null ? null : Math.round(trace.visualReadyAt - trace.intentAt),
    revealFromIntent: trace.revealStartAt == null ? null : Math.round(trace.revealStartAt - trace.intentAt),
    revealFromReady: trace.revealStartAt == null || trace.visualReadyAt == null
      ? null : Math.round(trace.revealStartAt - trace.visualReadyAt),
    settledFromIntent: trace.settledAt == null ? null : Math.round(trace.settledAt - trace.intentAt),
  };
  return trace;
}
