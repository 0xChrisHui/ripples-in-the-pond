import { WALLET_RECIPE_GATEWAYS } from '@/src/lib/wallet-recipe/gateways';
import type { PermanentMediaCandidate } from './types';

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;
const SOURCE_BY_GATEWAY = {
  'https://ardrive.net': 'ardrive',
  'https://arweave.tokyo': 'arweave-tokyo',
  'https://arweave.net': 'arweave',
} as const;

export function parseArweaveRef(ref: string): string {
  if (!ref.startsWith('ar://')) throw new Error('永久资源必须使用 ar:// 引用');
  const txId = ref.slice(5);
  if (!TX_ID_RE.test(txId)) throw new Error('永久资源包含无效的 Arweave txId');
  return txId;
}

function mirrorBase(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** 镜像未配置或配置无效时直接从永久网关开始。 */
export function permanentMediaCandidates(
  ref: string,
  configuredMirror = process.env.NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL,
): PermanentMediaCandidate[] {
  const txId = parseArweaveRef(ref);
  const mirror = mirrorBase(configuredMirror);
  const candidates: PermanentMediaCandidate[] = [];
  if (mirror) {
    candidates.push({
      source: 'mirror', healthKey: mirror, label: '高速镜像', url: `${mirror}/${txId}`,
    });
  }
  for (const baseUrl of WALLET_RECIPE_GATEWAYS) {
    const label = new URL(baseUrl).host;
    candidates.push({
      source: SOURCE_BY_GATEWAY[baseUrl], healthKey: baseUrl, label, url: `${baseUrl}/${txId}`,
    });
  }
  return candidates;
}
