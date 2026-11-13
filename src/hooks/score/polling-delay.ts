import type { OwnedScoreNFT } from '@/src/types/jam';

export function pollingDelay(scores: Pick<OwnedScoreNFT, 'status' | 'submittedAt' | 'mintMode'>[], now = Date.now()) {
  const active = scores.filter(s => s.mintMode === 'eth_self_paid'
    ? !['success', 'failed', 'expired', 'manual_review', 'abandoned'].includes(s.status)
    : s.status !== 'success' && s.status !== 'failed');
  if (!active.length) return 0;
  const newest = Math.max(...active.map(s => Date.parse(s.submittedAt)));
  return now - newest < 900_000 ? 120_000 : 300_000;
}
