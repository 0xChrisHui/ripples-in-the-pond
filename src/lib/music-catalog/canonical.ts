import { sha256, stringToHex } from 'viem';

const OMIT = new Set(['revision', 'generatedAt', 'verifiedAt', 'checkedAt', 'gitSha']);
function canonical(value: unknown, key = ''): unknown {
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error('公开目录不能含 undefined/NaN');
  }
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n');
  if (Array.isArray(value)) {
    const rows = value.map((item) => canonical(item));
    if (['tracks', 'collections', 'deployments'].includes(key)) {
      rows.sort((a, b) => {
        const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
        const coordinate = (row: Record<string, unknown>) => key === 'tracks' ? String(row.trackId)
          : `${String(row.chainId).padStart(12, '0')}/${row.contractAddress ?? ''}/${row.tokenId ?? ''}`;
        return coordinate(x).localeCompare(coordinate(y), 'en');
      });
    }
    return rows;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name]) => !OMIT.has(name))
      .sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, item]) => [name, canonical(item, name)]));
  }
  return value;
}
export function canonicalCatalogContent(value: unknown): string { return JSON.stringify(canonical(value)); }
export function catalogRevision(value: unknown): string { return sha256(stringToHex(canonicalCatalogContent(value))).slice(2); }
