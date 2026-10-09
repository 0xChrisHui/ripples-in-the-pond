'use client';

import { useEffect, useState } from 'react';
import PondRouteLink from '../pond-shell/PondRouteLink';
import { MINT_RECORDED_EVENT } from '../../lib/mint-notice';

type Notice = { id: number; title: string; hint: string; href?: string };
const COPY = {
  'jam:draft-saved': { title: '你的创作已记录 ↗', hint: '点击右上角「我的音乐」或「登录」查看' },
  [MINT_RECORDED_EVENT]: { title: '你的收藏已记录 ↗', hint: '到「我的」查看', href: '/me' },
} as const;

/**
 * 记录成功 toast — 显示在 LoginButton 下方（顶栏右侧），5.5s 自动消失。
 * 录制完成 dispatch 'jam:draft-saved'；收藏/铸造提交后 dispatch 'pond:mint-recorded'（带跳转到 /me）。
 */
export default function DraftSavedToast() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined, sequence = 0;
    const show = (name: keyof typeof COPY) => () => {
      clearTimeout(timer); setNotice(null);
      requestAnimationFrame(() => setNotice({ id: ++sequence, ...COPY[name] }));
      timer = setTimeout(() => setNotice(null), 5500);
    };
    const handlers = (Object.keys(COPY) as (keyof typeof COPY)[]).map((name) => [name, show(name)] as const);
    handlers.forEach(([name, handler]) => window.addEventListener(name, handler));
    return () => { clearTimeout(timer); handlers.forEach(([name, handler]) => window.removeEventListener(name, handler)); };
  }, []);

  if (!notice) return null;
  const body = <>
    <div className="rounded-lg bg-white/10 px-4 py-2 text-xs text-white/85 backdrop-blur-sm">{notice.title}</div>
    <p className="text-[10px] tracking-wide text-white/50">{notice.hint}</p>
  </>;
  return (
    <div key={notice.id} className="fixed right-6 top-16 z-[55] flex flex-col items-end gap-1.5 animate-jam-toast-slide">
      {notice.href ? <PondRouteLink href={notice.href} className="flex flex-col items-end gap-1.5">{body}</PondRouteLink>
        : <div className="pointer-events-none flex flex-col items-end gap-1.5">{body}</div>}
    </div>
  );
}
