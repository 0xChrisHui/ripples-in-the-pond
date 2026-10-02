/** 仅显式本地验收环境启用；默认生产流程不变。 */
export function localReviewBlocks(pathname: string, method: string, enabled: boolean) {
  if (!enabled) return false;
  const publicReads = ['/api/tracks', '/api/sounds', '/api/echo/featured', '/api/music-catalog', '/api/ping'];
  return !(['GET', 'HEAD'].includes(method) && publicReads.includes(pathname));
}
