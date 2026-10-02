import rows from './data/tracks-source.json';
import { getOriginalTrack } from './asset-registry';
import { WALLET_RECIPE_GATEWAYS } from '../wallet-recipe/gateways';
import type { Track } from '../../types/tracks';

export function originalAudioSources(trackId: string): string[] {
  const track = getOriginalTrack(trackId);
  if (!track?.audioArUri || !/^ar:\/\/[a-zA-Z0-9_-]{43}$/.test(track.audioArUri)) throw new Error('真实永久音频来源不可用');
  const txid = track.audioArUri.slice(5);
  return WALLET_RECIPE_GATEWAYS.map((gateway) => `${gateway}/${txid}`);
}
export function releaseOriginalPlayback(trackId: string, host: {
  getAudioElement: () => { src: string } | null; stop: () => void;
}): void {
  const audio = host.getAudioElement();
  if (audio && originalAudioSources(trackId).includes(audio.src)) host.stop();
}
export function toPlayerTrack(trackId: string, sourceIndex = 0): Track {
  const row = rows.find((item) => item.id === trackId);
  const catalog = getOriginalTrack(trackId);
  if (!row || !catalog) throw new Error('目录中没有这首原曲');
  const sources = originalAudioSources(trackId);
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length) throw new Error('音频网关索引无效');
  return { id: catalog.trackId, title: catalog.title, week: catalog.displayNumber, audio_url: sources[sourceIndex],
    arweave_url: catalog.audioArUri, audio_gateway_urls: [...sources.slice(sourceIndex), ...sources.slice(0, sourceIndex)],
    cover: row.cover, island: row.island, created_at: row.created_at, published: row.published };
}
export function originalCoverUrl(trackId: string): string {
  const row = rows.find((item) => item.id === trackId);
  if (!row || !/^#[0-9a-f]{6}$/i.test(row.cover)) throw new Error('原曲封面色无效');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${row.cover}"/></svg>`)}`;
}
