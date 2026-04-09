import type { Track } from '@/src/types/tracks';
import { MOCK_TRACKS } from './mock-tracks';

/**
 * 数据适配层 — 页面组件只通过这里获取 track 数据
 * Track B（当前）：返回假数据
 * Track C 替换为：fetch('/api/tracks').then(r => r.json())
 */
export async function fetchTracks(): Promise<Track[]> {
  return MOCK_TRACKS;
}

export async function fetchTrackById(id: string): Promise<Track | null> {
  return MOCK_TRACKS.find((t) => t.id === id) ?? null;
}
