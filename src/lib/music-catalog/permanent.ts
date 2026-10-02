import { WALLET_RECIPE_GATEWAYS } from '../wallet-recipe/gateways';
import { resolveErc1155Uri } from './identity';

export function parsePermanentUri(input: string, tokenId?: string) {
  const uri = tokenId ? resolveErc1155Uri(input, tokenId) : input;
  const match = /^ar:\/\/([a-zA-Z0-9_-]{43})(?:\/([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*))?$/.exec(uri);
  if (!match || match[2]?.split('/').some((part) => part === '.' || part === '..')) throw new Error('非法永久 URI');
  return { txid: match[1], path: match[2] ?? null, uri };
}
export async function safePermanentFetch(url: string, method: 'GET' | 'HEAD', signal: AbortSignal) {
  let target = new URL(url);
  for (let redirects=0;redirects<=2;redirects++) {
    const approved=WALLET_RECIPE_GATEWAYS.some((gateway)=>{
      const host=new URL(gateway).hostname;
      return target.hostname===host || target.hostname.endsWith(`.${host}`);
    });
    if(!approved || target.protocol!=='https:' || target.port || target.username || target.password) throw new Error('网关跳转超出可信永久域名');
    const response=await fetch(target,{method,signal,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status)) return response;
    const location=response.headers.get('location'); await response.body?.cancel();
    if(!location) throw new Error('网关跳转缺少地址'); target=new URL(location,target);
  }
  throw new Error('永久网关跳转超过2次');
}
export async function readPermanentJson(uri: string, tokenId?: string) {
  const reference = parsePermanentUri(uri, tokenId);
  const failures: string[] = [];
  for (const gateway of WALLET_RECIPE_GATEWAYS) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await safePermanentFetch(`${gateway}/${reference.txid}${reference.path ? `/${reference.path}` : ''}`,
        'GET',controller.signal);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length') ?? 0) > 262144) throw new Error('metadata 过大');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        length += next.value.length;
        if (length > 262144) { await reader.cancel(); throw new Error('metadata 超过256KiB上限'); }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { json: JSON.parse(text) as unknown, gateway, bytes };
    } catch (error) { failures.push(`${gateway}: ${error instanceof Error ? error.message : '读取失败'}`); }
    finally { clearTimeout(timeout); }
  }
  throw new Error(failures.join('；'));
}
export function parseOriginalMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('metadata 必须为对象');
  const object = value as Record<string, unknown>;
  if (typeof object.name !== 'string' || object.name.length > 500 || typeof object.animation_url !== 'string') throw new Error('原曲 metadata 字段无效');
  parsePermanentUri(object.animation_url);
  if (typeof object.image === 'string') parsePermanentUri(object.image);
  return { name: object.name, audioArUri: object.animation_url, image: typeof object.image === 'string' ? object.image : null };
}
