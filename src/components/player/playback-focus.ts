/** 用户发起播放时同步让其他播放器退让，包含仍在加载的播放意图。 */
const listeners = new Map<object, () => void>();

export function subscribePlaybackFocus(owner: object, stop: () => void): () => void {
  listeners.set(owner, stop);
  return () => { listeners.delete(owner); };
}

export function requestPlaybackFocus(owner: object): void {
  listeners.forEach((stop, candidate) => {
    if (candidate !== owner) stop();
  });
}
