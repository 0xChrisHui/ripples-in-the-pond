type EdgeSecrets = { EDGE_PROXY_SECRET?: string; EDGE_PROXY_SECRET_PREVIOUS?: string };
export type ClientIp = { ip: string; source: 'edge' | 'direct' };

// Edge 中间件不依赖 Node crypto；等长密钥完整比较，避免遇到首个不同字节就退出。
function matches(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected || candidate.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

function trustedIp(value: string | null): string | null {
  if (!value || value.includes(',') || value !== value.trim()) return null;
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) {
    return value.split('.').every(octet => Number(octet) <= 255) ? value : null;
  }
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return null;
  try {
    const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
    const [left, right] = canonical.split('::');
    const begin = left ? left.split(':') : [];
    const end = right ? right.split(':') : [];
    const parts = right === undefined ? begin : [...begin, ...Array(8 - begin.length - end.length).fill('0'), ...end];
    return parts.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(':') + '::/64';
  } catch {
    return null;
  }
}

/** 只有密钥与单一 IP 同时合法才信任香港节点；缺省严格保留原有限流来源。 */
export function resolveClientIp(headers: Headers, env: EdgeSecrets): ClientIp {
  const secret = headers.get('x-pond-edge-secret');
  if (matches(secret, env.EDGE_PROXY_SECRET) || matches(secret, env.EDGE_PROXY_SECRET_PREVIOUS)) {
    const ip = trustedIp(headers.get('x-pond-client-ip'));
    if (ip) return { ip, source: 'edge' };
  }
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'unknown',
    source: 'direct',
  };
}
