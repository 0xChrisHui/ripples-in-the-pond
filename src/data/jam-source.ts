import type {
  Sound,
  SoundsListResponse,
  SaveScoreRequest,
  SaveScoreResponse,
  ScorePreviewResponse,
  MyScoresResponse,
  OwnedScoreNFT,
  MyScoreNFTsResponse,
  MintScoreResponse,
  KeyEvent,
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
  const res = await fetch('/api/me/scores?light=1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data: MyScoresResponse = await res.json();
  return data.scores;
}

export async function fetchMyScoreEvents(
  token: string,
  pendingScoreId: string,
): Promise<KeyEvent[]> {
  const res = await fetch(`/api/me/scores/${pendingScoreId}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('草稿事件加载失败');
  const data = (await res.json()) as { events: KeyEvent[] };
  return data.events;
}

export async function fetchMyScoreNFTs(token: string): Promise<OwnedScoreNFT[]> {
  const res = await fetch('/api/me/score-nfts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data: MyScoreNFTsResponse = await res.json();
  return data.scoreNfts;
}

/** Phase 6 B3：草稿铸造 ScoreNFT 的入口 — 入队后 cron 5 步状态机异步处理 */
export async function mintScore(
  token: string,
  pendingScoreId: string,
): Promise<MintScoreResponse> {
  const res = await fetch('/api/mint/score', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pendingScoreId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '铸造请求失败' }));
    throw new Error(err.error ?? '铸造请求失败');
  }
  return res.json();
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
