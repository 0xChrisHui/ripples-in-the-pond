import type {
  Sound,
  SoundsListResponse,
  SaveScoreRequest,
  SaveScoreResponse,
  ScorePreviewResponse,
  MyScoresResponse,
} from '@/src/types/jam';

/**
 * 合奏数据适配层 — 函数签名冻结
 * Track C：真实 API 调用
 */

export async function fetchSounds(): Promise<Sound[]> {
  const res = await fetch('/api/sounds');
  if (!res.ok) throw new Error('Failed to fetch sounds');
  const data: SoundsListResponse = await res.json();
  return data.sounds;
}

export async function saveScore(
  token: string,
  data: SaveScoreRequest,
): Promise<SaveScoreResponse> {
  const res = await fetch('/api/score/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '保存失败' }));
    throw new Error(err.error ?? '保存失败');
  }
  return res.json();
}

export async function fetchMyScores(token: string): Promise<MyScoresResponse['scores']> {
  const res = await fetch('/api/me/scores', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data: MyScoresResponse = await res.json();
  return data.scores;
}

export async function fetchScorePreview(
  token: string,
  scoreId: string,
): Promise<ScorePreviewResponse | null> {
  const res = await fetch(`/api/scores/${scoreId}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch preview');
  return res.json();
}
