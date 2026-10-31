'use client';
import { useEffect, useRef } from 'react';
import { LENS_EXIT_EVENT } from './lens-events';

type Args = {
  active: boolean;
  /** 路由过渡进行中不响应（过渡自己的 Esc 取消优先）。 */
  settled: boolean;
  locked: boolean;
  stopAll: () => void;
  clearSelection: () => void;
  goHome: () => void;
};

/** 点到这些元素不算「点空白」。 */
const KEEP = 'button, a, input, textarea, select, summary, [data-lens-panel], [data-pond-ui], [role="dialog"]';

/** 两级退出：播放锁定中先停止并解锁；跟随中再触发才回到 `/`。Esc / 点空白 / 顶栏「详情」共用。 */
export function useLensExit(args: Args) {
  const latest = useRef(args);
  useEffect(() => { latest.current = args; });
  const active = args.active;
  useEffect(() => {
    if (!active) return;
    const exit = () => {
      const s = latest.current;
      if (!s.settled) return;
      if (s.locked) { s.stopAll(); s.clearSelection(); return; }
      s.clearSelection();
      s.goHome();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // 登录弹窗 / 手机菜单开着时，Esc 只关它们。
      if (document.querySelector('[role="dialog"][aria-modal="true"], #pond-public-navigation')) return;
      exit();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(KEEP)) return;
      exit();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    window.addEventListener(LENS_EXIT_EVENT, exit);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
      window.removeEventListener(LENS_EXIT_EVENT, exit);
    };
  }, [active]);
}
