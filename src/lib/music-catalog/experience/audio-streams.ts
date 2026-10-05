import proof from './audio-stream-proof.json';
import rows from '../data/tracks-source.json';
import { arweaveTxIdOf } from '../../arweave/shared';

/** 已随项目保存的副本必须对应同一永久身份；发布测试逐字节核对35首。 */
export function originalStreamSource(trackId: string, ref?: string | null): string | undefined {
  const row = rows.find(row => row.id === trackId);
  const stream = proof.rows.find(stream => stream.trackId === trackId);
  if (!row || !stream || stream.ref !== `ar://${arweaveTxIdOf(row.arweave_url)}`) return;
  if (ref && stream.ref !== `ar://${arweaveTxIdOf(ref)}`) return;
  if (stream.path !== `/tracks/No.${row.week}.mp3`) return;
  const path = `${stream.path}?v=${stream.sha256}`;
  return typeof location === 'undefined' ? path : new URL(path, location.origin).href;
}
