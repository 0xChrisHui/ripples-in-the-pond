'use client';

import { useEffect, useState, useCallback } from 'react';
import { useKeyboard } from '@/src/hooks/useKeyboard';
import { useJam } from '@/src/hooks/useJam';
import { useRecorder } from '@/src/hooks/useRecorder';
import { saveDraft } from '@/src/lib/draft-store';

/**
 * TestJam — /test 沙箱专用 jam 组件（移除 useKeyVisual 旧动画）。
 * 保留：键盘音效 + 录制 + 草稿存储。
 * 旧的 keyVisual 视觉反馈在此关闭，由 SvgAnimationLayer 接管视觉。
 */
export default function TestJam() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile === null) {
    return (
      <section className="flex items-center justify-center px-6 py-16">
        <p className="text-sm text-white/30">加载中...</p>
      </section>
    );
  }

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

  return <TestJamDesktop />;
}

function TestJamDesktop() {
  const { sounds, ready, playSound } = useJam();
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
      // 关键差异：不调 triggerVisual（旧动画关闭）— SvgAnimationLayer 走自己的 keydown
      playSound(key);
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
    <section className="flex flex-col items-center gap-6 py-8">
      <p className="text-sm tracking-wide text-white/40">
        按下键盘 A-Z 演奏
        {recording && <span className="ml-2 text-red-400/70">● 录制中</span>}
      </p>

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

      {toast && (
        <div className="animate-jam-toast rounded-lg bg-white/10 px-5 py-3 text-sm text-white/70 backdrop-blur-sm">
          你的创作已记录，24h 内可收藏
        </div>
      )}
    </section>
  );
}
