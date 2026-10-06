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
  | { type: 'cancel'; generation?: number; at: number };

export function routeForPath(pathname: string): PondRoute {
  if (pathname === '/') return 'home';
  if (pathname === '/tracks' || pathname === '/tracks/pond' || pathname.startsWith('/score/material/')) return 'tracks';
  if (pathname === '/artist') return 'artist';
  if (pathname.startsWith('/echo/')) return 'echo';
  if (pathname.startsWith('/me/material')) return 'detail';
  return pathname.startsWith('/score/') ? 'score' : 'archive';
}

export function pathWithoutHash(href: string): string {
  return href.split(/[?#]/, 1)[0] || '/';
}
