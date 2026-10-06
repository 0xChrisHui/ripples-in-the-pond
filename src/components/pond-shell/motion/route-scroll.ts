import type { PondRoute } from '../transition/types';

const positions = new Map<string, number>();
export function rememberPondScroll(path: string): void { positions.set(path, window.scrollY); }
export function savedPondScroll(path: string): number { return positions.get(path) ?? 0; }

/** 动态路由由 Next 替换；只保留无交互的旧前景到淡出结束，水面仍是原 Canvas。 */
export function preserveOutgoingRoute(owner: PondRoute, target: PondRoute): void {
  if (owner === target || !['score', 'echo', 'detail'].includes(owner)) return;
  const source = document.querySelector<HTMLElement>(`.pond-route-surface[data-pond-surface="${owner}"]`);
  if (!source || source.dataset.pondSnapshotSource) return;
  document.querySelectorAll('[data-pond-snapshot]').forEach(node => node.remove());
  const rect = source.getBoundingClientRect();
  const snapshot = source.cloneNode(true) as HTMLElement;
  snapshot.dataset.pondSnapshot = 'true';
  snapshot.inert = true;
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.querySelectorAll('[id]').forEach(node => { if (!node.closest('svg')) node.removeAttribute('id'); });
  snapshot.querySelectorAll('audio, video').forEach(node => node.remove());
  Object.assign(snapshot.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, pointerEvents: 'none' });
  snapshot.dataset.pondFrozen = 'true';
  source.parentElement?.append(snapshot);
  source.dataset.pondSnapshotSource = owner;
}

/** 转场前把旧前景固定在当前屏幕位置，新页面回顶不会把旧内容拖走。 */
export function freezeOutgoingSurface(owner: PondRoute): void {
  const node = document.querySelector<HTMLElement>(`[data-pond-snapshot][data-pond-surface="${owner}"]`)
    ?? document.querySelector<HTMLElement>(`[data-pond-surface="${owner}"]`);
  if (!node || node.dataset.pondFrozen === 'true') return;
  const rect = node.getBoundingClientRect();
  node.dataset.pondFrozen = 'true';
  Object.assign(node.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px` });
}

export function releaseSurface(node: HTMLElement): void {
  if (node.dataset.pondFrozen !== 'true') return;
  delete node.dataset.pondFrozen;
  for (const property of ['position', 'top', 'left', 'width']) node.style.removeProperty(property);
}
