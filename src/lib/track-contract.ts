import { arweaveGatewayUrls } from './arweave/shared';
import type { Track } from '@/src/types/tracks';

export type TrackRow = Omit<Track, 'audio_gateway_urls'>;

/** DB 行转公开合同；第 36 首没有永久身份时绝不回退到临时地址。 */
export function exposeTrack(row: TrackRow): Track {
  const audioGatewayUrls = arweaveGatewayUrls(row.arweave_url);
  const audioUrl = audioGatewayUrls[0] ?? (row.week === 36 ? '' : row.audio_url);
  return { ...row, audio_url: audioUrl, audio_gateway_urls: audioGatewayUrls };
}
