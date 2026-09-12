import 'server-only';

import { createHash } from 'node:crypto';
import { WALLET_RECIPE_GATEWAYS, WALLET_RECIPE_GATEWAY_QUORUM } from '@/src/lib/wallet-recipe/gateways';
import { ARWEAVE_TX_ID_PATTERN, WALLET_RECIPE_METADATA_MAX_BYTES } from '@/src/lib/wallet-recipe/constants';

const TIMEOUT_MS = 12_000;

type GatewayCopy = { gateway: string; bytes: Buffer; hash: string };

async function fetchCopy(gateway: string, txId: string, signal: AbortSignal): Promise<GatewayCopy> {
  const response = await fetch(`${gateway}/${txId}`, {
    cache: 'force-cache', signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  if (!response.ok) throw new Error(`${new URL(gateway).host}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > WALLET_RECIPE_METADATA_MAX_BYTES) {
    throw new Error(`${new URL(gateway).host}: metadata 超过 32 KiB`);
  }
  return { gateway, bytes, hash: createHash('sha256').update(bytes).digest('hex') };
}

/** 两个独立网关返回完全相同的 metadata bytes 后才交给严格 parser。 */
export async function fetchMetadataQuorum(txId: string): Promise<{
  json: string;
  gateways: string[];
}> {
  if (!ARWEAVE_TX_ID_PATTERN.test(txId)) throw new Error('tokenURI 不是合法 Arweave txid');
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    const groups = new Map<string, GatewayCopy[]>();
    let settled = 0;
    let finished = false;
    for (const gateway of WALLET_RECIPE_GATEWAYS) {
      void fetchCopy(gateway, txId, controller.signal).then((copy) => {
        if (finished) return;
        const key = `${copy.hash}:${copy.bytes.byteLength}`;
        const group = [...(groups.get(key) ?? []), copy];
        groups.set(key, group);
        if (group.length >= WALLET_RECIPE_GATEWAY_QUORUM) {
          finished = true;
          controller.abort();
          resolve({
            json: group[0].bytes.toString('utf8'),
            gateways: group.slice(0, WALLET_RECIPE_GATEWAY_QUORUM).map((item) => item.gateway),
          });
        }
      }).catch(() => undefined).finally(() => {
        settled += 1;
        if (!finished && settled === WALLET_RECIPE_GATEWAYS.length) {
          reject(new Error('永久 metadata 尚未取得两个独立网关的一致字节'));
        }
      });
    }
  });
}
