import source from './track-imprints.json';

export type TrackImprint = {
  durationSeconds: number;
  envelope: number[];
  texture: number[];
  sha256: string;
};

const tracks: Record<string, TrackImprint> = source.tracks;

/** 原曲 PCM 特征用 8 位整数保存，读取时还原为 0–1，并返回独立数组。 */
export function getTrackImprint(trackId: string): TrackImprint | null {
  const imprint = Object.prototype.hasOwnProperty.call(tracks, trackId) ? tracks[trackId] : null;
  return imprint ? {
    ...imprint,
    envelope: imprint.envelope.map((value) => value / source.analysis.quantization),
    texture: imprint.texture.map((value) => value / source.analysis.quantization),
  } : null;
}
