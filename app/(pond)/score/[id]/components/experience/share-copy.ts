import zh from '@/src/i18n/messages/zh.json';

type Platform = 'x' | 'weibo';
/** 分享模板（含 {title}）在词典 share.author / share.listener；不传时用中文，保持原有分享文案 */
type ShareTemplates = { author: Record<Platform, string>; listener: Record<Platform, string> };
export function isScoreAuthor(authenticated: boolean, address?: string | null, creator?: string | null): boolean {
  const valid = (value?: string | null) => Boolean(value && /^0x[0-9a-f]{40}$/i.test(value));
  return authenticated && valid(address) && valid(creator) && address!.toLowerCase() === creator!.toLowerCase();
}
export function scoreShareCopy(platform: Platform, title: string, author: boolean, templates: ShareTemplates = zh.share): string {
  return templates[author ? 'author' : 'listener'][platform].replace('{title}', title);
}
export function scoreShareUrl(base: string, path?: string): string | null {
  if (!path?.startsWith('/score/') || path.startsWith('//') || /[?#\\]/.test(path)) return null;
  try {
    const origin = new URL(base);
    if (!['https:', 'http:'].includes(origin.protocol)) return null;
    return new URL(path, origin).href;
  } catch { return null; }
}
export function scoreShareIntent(platform: Platform, text: string, url: string): string {
  const target = new URL(platform === 'x' ? 'https://twitter.com/intent/tweet' : 'https://service.weibo.com/share/share.php');
  target.searchParams.set(platform === 'x' ? 'text' : 'title', text);
  target.searchParams.set('url', url);
  return target.href;
}
