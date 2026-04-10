'use client';

import { useEffect, useState, useCallback } from 'react';
import { useKeyboard } from '@/src/hooks/useKeyboard';
import { useJam } from '@/src/hooks/useJam';
import { useRecorder } from '@/src/hooks/useRecorder';
import { useKeyVisual } from './KeyVisual';
import { saveDraft } from '@/src/lib/draft-store';

/**
 * HomeJam — 首页合奏主组件
 *
 * 按 A-Z 键触发对应音效 + 视觉反馈 + 录制 + 草稿存储。
 * 本组件独立可渲染，Track C 负责接入 app/page.tsx。
 * 移动端（<640px）显示提示，不加载音效引擎。
 */
export default function HomeJam() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <section className="flex items-center justify-center px-6 py-16">
        <p className="text-center text-sm leading-relaxed text-white/50">
          合奏需要电脑键盘体验
          <br />
          <span className="text-white/30">请在电脑上打开本页</span>
        </p>
      </section>
    );
  }

  return <HomeJamDesktop />;
}

/** 桌面端合奏组件——只在非 mobile 时渲染，避免移动端加载音效 */
function HomeJamDesktop() {
  const { sounds, ready, playSound } = useJam();
  const { triggerVisual, VisualLayer } = useKeyVisual();
  const [toast, setToast] = useState(false);

  const handleRecordComplete = useCallback(
    (result: { trackId: string; events: { key: string; time: number; duration: number }[] }) => {
      if (result.events.length === 0) return;
      saveDraft({
        trackId: result.trackId,
        eventsData: result.events,
        createdAt: new Date().toISOString(),
      });
      setToast(true);
    },
    [],
  );

  const { recording, recordKeyDown, recordKeyUp } = useRecorder({
    onComplete: handleRecordComplete,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const { pressedKeys } = useKeyboard({
    enabled: ready,
    onKeyDown: (key) => {
      playSound(key);
      triggerVisual(key);
      recordKeyDown(key);
    },
    onKeyUp: recordKeyUp,
  });

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-white/40">音效加载中...</p>
      </div>
    );
  }

  return (
    <>
      <VisualLayer />
      <section className="flex flex-col items-center gap-6 py-8">
        <p className="text-sm tracking-wide text-white/40">
          按下键盘 A-Z 演奏 · {sounds.length} 个音效
          {recording && (
            <span className="ml-2 text-red-400/70">● 录制中</span>
          )}
        </p>

        {/* 当前按下的键 */}
        <div className="flex min-h-[40px] flex-wrap items-center justify-center gap-2">
          {Array.from(pressedKeys).map((key) => (
            <span
              key={key}
              className="rounded-md bg-white/15 px-3 py-1 font-mono text-sm text-white/80"
            >
              {key.toUpperCase()}
            </span>
          ))}
        </div>

        {/* 录制完成提示 */}
        {toast && (
          <div className="animate-jam-toast rounded-lg bg-white/10 px-5 py-3 text-sm text-white/70 backdrop-blur-sm">
            你的创作已记录，24h 内可收藏
          </div>
        )}
      </section>
    </>
  );
}
