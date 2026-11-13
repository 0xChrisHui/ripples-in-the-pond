import type { ScorePlaybackState } from '@/src/features/score-playback/types';

/** 只决定短句身份，切语言后由组件即时翻译，不缓存成品文案。 */
export function playbackStatusKey(state: ScorePlaybackState, requested: boolean) {
  if (state === 'playing') return null;
  if (state === 'loading') return requested ? 'hintQueued' as const : 'hintPreparing' as const;
  return { ready: 'hintIdle', paused: 'hintPaused', ended: 'hintEnded', error: 'hintError' }[state] as
    'hintIdle' | 'hintPaused' | 'hintEnded' | 'hintError';
}
