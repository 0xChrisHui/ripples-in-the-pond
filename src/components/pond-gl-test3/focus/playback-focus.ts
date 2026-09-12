export interface PlaybackFocus {
  active: boolean;
  trackId: string | null;
  x: number;
  y: number;
  scale: number;
}

const EMPTY_FOCUS: PlaybackFocus = { active: false, trackId: null, x: 0.5, y: 0.5, scale: 1 };
let playbackFocus = EMPTY_FOCUS;
let scenePresence = 1;

export function getPlaybackFocus(): PlaybackFocus {
  return playbackFocus;
}

export function setPlaybackFocus(focus: PlaybackFocus): void {
  playbackFocus = focus;
}

export function clearPlaybackFocus(): void {
  playbackFocus = EMPTY_FOCUS;
}

export function getScenePresence(): number {
  return scenePresence;
}

/** 半衰式淡入淡出；约 450ms 到视觉终点，reduced-motion 直接切换。 */
export function advanceScenePresence(target: number, deltaMs: number, reduced: boolean): number {
  if (reduced) scenePresence = target;
  else {
    const amount = 1 - Math.exp(-Math.min(64, Math.max(0, deltaMs)) / 95);
    scenePresence += (target - scenePresence) * amount;
    if (Math.abs(target - scenePresence) < 0.006) scenePresence = target;
  }
  return scenePresence;
}

export function resetScenePresence(): void {
  scenePresence = 1;
}
