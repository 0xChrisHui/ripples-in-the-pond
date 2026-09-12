/** 浏览器与服务端共用的 Arweave 永久地址合同。 */
export const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ario.permagate.io',
] as const;

/** 浏览器长音频使用三条已在 P14 资源审计中实际验证过的独立候选。 */
export const ARWEAVE_AUDIO_GATEWAYS = [
  'https://ardrive.net',
  'https://arweave.tokyo',
  'https://arweave.net',
] as const;

export type ArweaveGateway = (typeof ARWEAVE_GATEWAYS)[number];

const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;

export function resolveArUrl(
  txId: string,
  gateway: ArweaveGateway = ARWEAVE_GATEWAYS[0],
): string {
  if (!TX_ID_RE.test(txId)) throw new Error(`Invalid Arweave txId: ${txId}`);
  return `${gateway}/${txId}`;
}

/** 只接受 ar://txid 或网关根目录下的 txid，拒绝可变的任意 HTTPS 地址。 */
export function arweaveTxIdOf(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('ar://')) {
    const txId = value.slice(5);
    return TX_ID_RE.test(txId) ? txId : null;
  }
  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const txId = segments[0] ?? '';
    const knownGateway = [...ARWEAVE_GATEWAYS, ...ARWEAVE_AUDIO_GATEWAYS].some(
      (gateway) => new URL(gateway).host === url.host,
    );
    return knownGateway && segments.length === 1 && TX_ID_RE.test(txId) ? txId : null;
  } catch {
    return null;
  }
}

export function arweaveGatewayUrls(value: string | null): string[] {
  const txId = arweaveTxIdOf(value);
  return txId ? ARWEAVE_AUDIO_GATEWAYS.map((gateway) => `${gateway}/${txId}`) : [];
}
