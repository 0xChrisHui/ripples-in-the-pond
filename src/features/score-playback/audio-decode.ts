import { getScoreP9EndMs } from './score-p9-session';
import type { ScorePlaybackResources } from './types';

export type DecodedScoreAudio = Readonly<{
  base: AudioBuffer;
  sounds: Record<string, AudioBuffer>;
  durationMs: number;
}>;

export async function decodeScoreSounds(
  context: AudioContext, soundBytes: Readonly<Record<string, ArrayBuffer>>,
): Promise<Record<string, AudioBuffer>> {
  const entries = await Promise.all(Object.entries(soundBytes).map(async ([key, bytes]) => [
    key, await context.decodeAudioData(bytes.slice(0)),
  ] as const));
  return Object.fromEntries(entries);
}

/** 压缩字节已经完整校验；解码仍并行，避免在点击后人为串行放大等待。 */
export async function decodeScoreAudio(
  context: AudioContext, resources: ScorePlaybackResources,
): Promise<DecodedScoreAudio> {
  const [base, sounds] = await Promise.all([
    context.decodeAudioData(resources.baseBytes.slice(0)),
    decodeScoreSounds(context, resources.soundBytes),
  ]);
  const soundEnd = resources.events.reduce((end, event) => {
    const duration = sounds[event.key]?.duration ?? 0;
    return Math.max(end, event.time + duration * 1000);
  }, 0);
  return {
    base, sounds,
    durationMs: Math.round(Math.max(
      base.duration * 1000, soundEnd, getScoreP9EndMs(resources.events),
    )),
  };
}
