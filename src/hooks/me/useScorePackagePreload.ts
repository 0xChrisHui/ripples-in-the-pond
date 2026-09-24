'use client';

import { useEffect } from 'react';
import { resolvePermanentMedia } from '@/src/features/permanent-media';
import { parseScorePackageV3 } from '@/src/lib/score-package';
import type { OwnedScoreNFT, ScorePackagePreview } from '@/src/types/jam';

const PRELOAD_CONCURRENCY = 2;

async function loadPackage(scorePackage: ScorePackagePreview, signal: AbortSignal) {
  const result = await resolvePermanentMedia(scorePackage.ref, {
    kind: 'json', validation: { level: 'canonical', sha256: scorePackage.sha256 },
    maxBytes: scorePackage.bytes, signal,
  });
  const value = JSON.parse(new TextDecoder().decode(result.bytes)) as unknown;
  parseScorePackageV3(value);
}

/** 进入私人档案后限并发预热全部永久唱片曲谱，离页立即取消未完成请求。 */
export function useScorePackagePreload(active: boolean, scores: readonly OwnedScoreNFT[]) {
  useEffect(() => {
    if (!active) return;
    const packages = [...new Map(scores.flatMap((score) => score.scorePackage
      ? [[score.scorePackage.sha256, score.scorePackage] as const] : [])).values()];
    if (!packages.length) return;
    const controller = new AbortController();
    let next = 0;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const scorePackage = packages[next++];
        if (!scorePackage) return;
        try { await loadPackage(scorePackage, controller.signal); }
        catch (error) {
          if (!controller.signal.aborted) console.info('[score-preload] 曲谱预热暂不可用:', error);
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, packages.length) }, worker));
    return () => controller.abort();
  }, [active, scores]);
}
