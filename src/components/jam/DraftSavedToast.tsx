'use client';

import { useEffect, useState } from 'react';

/**
 * 草稿保存 toast — 显示在 LoginButton 下方（顶栏右侧）。
 * TestJam 完成录制 → dispatch CustomEvent('jam:draft-saved')
 * 这里监听事件 + 5s 自动消失，配合 jam-toast-slide 动画从右侧滑入
 * 文案箭头 ↗ 引导眼神到右上角"我的音乐 / 登录"
 */
export default function DraftSavedToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onSaved = () => {
      setShow(false);
      requestAnimationFrame(() => setShow(true));
      setTimeout(() => setShow(false), 5500);
    };
    window.addEventListener('jam:draft-saved', onSaved);
    return () => window.removeEventListener('jam:draft-saved', onSaved);
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-16 z-[55] flex flex-col items-end gap-1.5 animate-jam-toast-slide">
      <div className="rounded-lg bg-white/10 px-4 py-2 text-xs text-white/85 backdrop-blur-sm">
        你的创作已记录 ↗
      </div>
      <p className="text-[10px] tracking-wide text-white/50">
        点击右上角「我的音乐」或「登录」查看
      </p>
    </div>
  );
}
