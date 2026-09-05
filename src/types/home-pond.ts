import type { Track } from './tracks';

/** 首页公开曲目快照；只保存真实 API 数据，不保存补位视觉节点。 */
export interface HomeTracksSnapshot {
  schemaVersion: 1;
  dataVersion: string;
  environment: string;
  writtenAt: number;
  source: 'tracks-api';
  tracks: Track[];
}

