type Platform = 'x' | 'weibo';
const COPY = {
  author: {
    x: '这是我今天留在水塘里的声音。换你，会弹成什么样？',
    weibo: '同一首底曲，每个人都能留下不同的声音。这是我的这一版。你也可以进去弹一段，我很想听听你的版本。',
  },
  listener: {
    x: '听到这一段，很想知道换你会弹成什么样。',
    weibo: '发现一段有意思的即兴演奏。同一首底曲，换个人会留下怎样的声音？把它分享给你，也想听听你的版本。',
  },
};
export function isScoreAuthor(authenticated: boolean, address?: string | null, creator?: string | null): boolean {
  const valid = (value?: string | null) => Boolean(value && /^0x[0-9a-f]{40}$/i.test(value));
  return authenticated && valid(address) && valid(creator) && address!.toLowerCase() === creator!.toLowerCase();
}
export function scoreShareCopy(platform: Platform, title: string, author: boolean): string {
  return `${COPY[author ? 'author' : 'listener'][platform]}
《${title}》`;
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
