import type { PondRouteEvent, PondRouteTransaction } from './types';
import { routeForPath } from './types';

export function initialRouteTransaction(pathname: string): PondRouteTransaction {
  const route = routeForPath(pathname);
  return {
    id: 0, generation: 0, current: route, target: route, href: pathname, currentHref: pathname,
    stage: 'stable', targetVisualReady: true, interactiveOwner: route,
    intentAt: null, visualReadyAt: null, revealStartAt: null, settledAt: null,
  };
}

/** generation 是唯一写权限；旧请求、旧 RAF 与旧动画事件都无法覆盖新意图。 */
export function routeTransactionReducer(
  state: PondRouteTransaction,
  event: PondRouteEvent,
): PondRouteTransaction {
  if (event.type === 'start') {
    const generation = state.generation + 1;
    return {
      id: generation, generation, current: state.interactiveOwner, target: event.target,
      href: event.href, stage: 'preparing', targetVisualReady: false,
      currentHref: state.stage === 'stable' ? state.href : state.currentHref,
      interactiveOwner: state.interactiveOwner, intentAt: event.at,
      visualReadyAt: null, revealStartAt: null, settledAt: null,
    };
  }
  if (event.generation != null && event.generation !== state.generation) return state;
  if (event.type === 'ready') {
    if (state.stage !== 'preparing' || event.owner !== state.target) return state;
    return { ...state, targetVisualReady: true, visualReadyAt: event.at };
  }
  if (event.type === 'reveal') {
    if (state.stage !== 'preparing' || !state.targetVisualReady) return state;
    return { ...state, stage: 'revealing', interactiveOwner: state.target, revealStartAt: event.at };
  }
  if (event.type === 'settling') {
    return state.stage === 'revealing' ? { ...state, stage: 'settling' } : state;
  }
  if (event.type === 'settle') {
    if (state.stage === 'preparing' && !state.targetVisualReady) return state;
    const current = routeForPath(event.pathname);
    if (current !== state.target) return state;
    return {
      ...state, current, target: current, href: event.pathname, currentHref: event.pathname, stage: 'stable',
      targetVisualReady: true, interactiveOwner: current, settledAt: event.at,
    };
  }
  if (event.type === 'cancel') {
    return {
      ...state, target: state.current, href: state.currentHref,
      stage: 'stable', targetVisualReady: true, interactiveOwner: state.current,
      settledAt: event.at,
    };
  }
  return state;
}
