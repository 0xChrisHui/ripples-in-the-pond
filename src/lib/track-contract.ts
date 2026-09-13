import { arweaveGatewayUrls } from './arweave/shared';
import type { Track } from '@/src/types/tracks';

export type TrackRow = Omit<Track, 'audio_gateway_urls'>;

/** 浏览器缓存只接受完整的公开 Track 合同，避免旧 schema 静默退回可变音频。 */
export function isExposedTrack(value: unknown): value is Track {
  if (!value || typeof value !== 'object') return false;
  const track = value as Record<string, unknown>;
  return typeof track.id === 'string' && track.id.length > 0
    && typeof track.title === 'string'
    && typeof track.week === 'number' && Number.isFinite(track.week)
    && typeof track.audio_url === 'string'
    && (track.arweave_url === null || typeof track.arweave_url === 'string')
    && Array.isArray(track.audio_gateway_urls)
    && track.audio_gateway_urls.every((url) => typeof url === 'string')
    && typeof track.cover === 'string'
    && typeof track.island === 'string'
    && typeof track.created_at === 'string'
    && typeof track.published === 'boolean';
}

/** DB 行转公开合同；优先公开永久网关，未冻结时保留现有音频地址。 */
export function exposeTrack(row: TrackRow): Track {
  const audioGatewayUrls = arweaveGatewayUrls(row.arweave_url);
  const audioUrl = audioGatewayUrls[0] ?? row.audio_url;
  return { ...row, audio_url: audioUrl, audio_gateway_urls: audioGatewayUrls };
}
