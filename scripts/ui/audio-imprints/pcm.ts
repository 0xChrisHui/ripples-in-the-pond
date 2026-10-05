import { spawnSync } from 'node:child_process';

export const SAMPLE_RATE = 22050;
export const SAMPLE_COUNT = 96;

function normalize(values: number[]): number[] {
  const peak = Math.max(...values);
  return values.map((value) => peak > 0 ? Number((value / peak).toFixed(5)) : 0);
}

export function analyzePcm(pcm: Buffer) {
  const frameCount = pcm.length / 2;
  if (!Number.isInteger(frameCount) || frameCount < SAMPLE_COUNT) throw new Error('音频 PCM 长度无效');
  const rms: number[] = [];
  const crossings: number[] = [];
  for (let segment = 0; segment < SAMPLE_COUNT; segment += 1) {
    const start = Math.floor(segment * frameCount / SAMPLE_COUNT);
    const end = Math.floor((segment + 1) * frameCount / SAMPLE_COUNT);
    let energy = 0;
    let crossingCount = 0;
    let previous = 0;
    for (let frame = start; frame < end; frame += 1) {
      const sample = pcm.readInt16LE(frame * 2);
      energy += sample * sample;
      if (frame > start && (sample < 0) !== (previous < 0)) crossingCount += 1;
      previous = sample;
    }
    rms.push(Math.sqrt(energy / (end - start)) / 32768);
    crossings.push(crossingCount / Math.max(1, end - start - 1));
  }
  return {
    durationSeconds: Number((frameCount / SAMPLE_RATE).toFixed(3)),
    envelope: normalize(rms),
    texture: normalize(crossings),
  };
}

export function decodeTrack(path: string): Buffer {
  // 固定单声道采样率，让刻印可重建；浏览器读取预生成特征，无须再次解码音频。
  const result = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
    '-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', String(SAMPLE_RATE),
    '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1',
  ], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`音频解码失败：${path}\n${result.stderr.toString()}`);
  return result.stdout;
}
