export type PondRoute = 'home' | 'archive' | 'score' | 'tracks' | 'artist' | 'echo' | 'detail';
export type PondRouteStage = 'stable' | 'preparing' | 'revealing' | 'settling';

export type PondRouteTransaction = {
  id: number;
  generation: number;
  current: PondRoute;
  target: PondRoute;
  href: string;
  currentHref: string;
  stage: PondRouteStage;
  targetVisualReady: boolean;
  interactiveOwner: PondRoute;
  intentAt: number | null;
  visualReadyAt: number | null;
  revealStartAt: number | null;
  settledAt: number | null;
};

export type PondRouteEvent =
  | { type: 'start'; target: PondRoute; href: string; at: number }
  | { type: 'ready'; generation: number; owner: PondRoute; at: number }
  | { type: 'reveal'; generation: number; at: number }
  | { type: 'settling'; generation: number }
  | { type: 'settle'; generation: number; pathname: string; at: number }
  | { type: 'cancel'; generation?: number; at: number }
  | { type: 'alias'; pathname: string };

/** 开发用调参页（P20）：按首页处理，生产构建下该页返回 404。 */
export const LAB_PATH = '/test5';

/** P21：`/lens` 是首页别名——共用同一场景，只切功能层。 */
export const LENS_PATH = '/lens';

/** 首页场景的所有路径（`/`、别名 `/lens`、开发调参页）。 */
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === LENS_PATH || pathname === LAB_PATH;
}

export function routeForPath(pathname: string): PondRoute {
  if (isHomePath(pathname)) return 'home';
  if (pathname === '/tracks' || pathname === '/tracks/pond' || pathname.startsWith('/score/material/')) return 'tracks';
  if (pathname === '/artist') return 'artist';
  if (pathname.startsWith('/echo/')) return 'echo';
  if (pathname.startsWith('/me/material')) return 'detail';
  return pathname.startsWith('/score/') ? 'score' : 'archive';
}

export function pathWithoutHash(href: string): string {
  return href.split(/[?#]/, 1)[0] || '/';
}
