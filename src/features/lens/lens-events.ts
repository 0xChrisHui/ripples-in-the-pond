/** 顶栏「详情」再点一次 → 请求 /lens 两级退出（停止播放 → 回首页）。 */
export const LENS_EXIT_EVENT = 'pond-lens:exit-request';

export function requestLensExit(): void {
  window.dispatchEvent(new Event(LENS_EXIT_EVENT));
}
