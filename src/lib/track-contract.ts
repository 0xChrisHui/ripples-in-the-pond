import { arweaveGatewayUrls } from './arweave/shared';
import type { Track } from '@/src/types/tracks';

export type TrackRow = Omit<Track, 'audio_gateway_urls'>;

/** DB 行转公开合同；优先公开永久网关，未冻结时保留现有音频地址。 */
export function exposeTrack(row: TrackRow): Track {
  const audioGatewayUrls = arweaveGatewayUrls(row.arweave_url);
  const audioUrl = audioGatewayUrls[0] ?? row.audio_url;
  return { ...row, audio_url: audioUrl, audio_gateway_urls: audioGatewayUrls };
}
