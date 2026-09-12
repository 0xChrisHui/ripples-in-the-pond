import { createHash } from 'node:crypto';
import {
  WALLET_RECIPE_GATEWAYS,
  WALLET_RECIPE_GATEWAY_QUORUM,
} from '@/src/lib/wallet-recipe/gateways';
import { PipelineStepError } from './shared';

export type PermanentObjectFetcher = (
  txId: string,
  gateway: (typeof WALLET_RECIPE_GATEWAYS)[number],
  signal: AbortSignal,
) => Promise<Buffer>;

/** 达到 2-of-3 后立即返回；只有三份均可取且互异才判永久内容冲突。 */
export function fetchPermanentObjectQuorum(
  txId: string,
  fetcher: PermanentObjectFetcher,
): Promise<{ bytes: Buffer; sha256: string }> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const groups = new Map<string, Buffer[]>();
    const errors: string[] = [];
    let settled = 0;
    let finished = false;

    const finishFailure = () => {
      if (finished || settled < WALLET_RECIPE_GATEWAYS.length) return;
      finished = true;
      const copies = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
      if (copies === WALLET_RECIPE_GATEWAYS.length) {
        reject(new PipelineStepError(`Arweave 三网关内容不一致：${txId}`, 'permanent_input'));
        return;
      }
      const detail = errors.length > 0 ? errors.join('；') : '尚未形成一致字节';
      reject(new PipelineStepError(`Arweave 尚未双网关可取：${detail}`, 'transient'));
    };

    for (const gateway of WALLET_RECIPE_GATEWAYS) {
      void fetcher(txId, gateway, controller.signal).then((bytes) => {
        if (finished) return;
        const hash = createHash('sha256').update(bytes).digest('hex');
        const group = [...(groups.get(hash) ?? []), bytes];
        groups.set(hash, group);
        if (group.length >= WALLET_RECIPE_GATEWAY_QUORUM) {
          finished = true;
          controller.abort();
          resolve({ bytes: group[0], sha256: hash });
        }
      }).catch((error) => {
        if (!finished) errors.push(error instanceof Error ? error.message : String(error));
      }).finally(() => {
        settled += 1;
        finishFailure();
      });
    }
  });
}
