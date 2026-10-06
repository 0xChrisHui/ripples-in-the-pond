import type { PondRoute } from '../transition/types';

export const POND_ROUTES: PondRoute[] = ['home', 'archive', 'score', 'tracks', 'artist', 'echo', 'detail'];
const presence = Object.fromEntries(POND_ROUTES.map(owner => [owner, { current: 0 }])) as Record<PondRoute, { current: number }>;

export function getScenePresence(owner: PondRoute): number { return presence[owner].current; }
export function scenePresenceRef(owner: PondRoute): { current: number } { return presence[owner]; }
export function setScenePresence(owner: PondRoute, value: number): void { presence[owner].current = value; }

/** 新意图从当前亮度续接；DOM、GL 与日食读取同一条曲线。 */
export function interpolatePresence(from: number, to: number, elapsed: number, duration: number): number {
  const progress = Math.max(0, Math.min(1, elapsed / Math.max(1, duration)));
  return from + (to - from) * (1 - (1 - progress) ** 3);
}
