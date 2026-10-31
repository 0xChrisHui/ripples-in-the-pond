'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { setLensBridge } from '@/src/components/pond-gl-test3/overlay/lens-bridge';
import type { GlSim } from '@/src/components/pond-gl-test3/spheres/use-gl-sim';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import { isHomePath, LENS_PATH } from '@/src/components/pond-shell/transition/types';
import { getOriginalTrack } from '@/src/lib/music-catalog/asset-registry';
import LensPanel from './panel/LensPanel';
import { useLensDeepLink, useTrackNumbers } from './use-lens-deeplink';
import { useLensExit } from './use-lens-exit';
import { useLensFrame, type LensSelection } from './use-lens-frame';
import { useLensPointer } from './use-lens-pointer';
import './lens-veil.css';

type Props = { pathname: string; glSim: GlSim; stopEcho: () => void };

function LensInner({ pathname, glSim, stopEcho }: Props) {
  const active = pathname === LENS_PATH;
  const player = usePlayer();
  const transition = usePondTransition();
  const numbers = useTrackNumbers();
  const [panelId, setPanelId] = useState<string | null>(null);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const veilRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const selectionRef = useRef<LensSelection>(null);
  const panelHotRef = useRef(false);
  const regularId = player.playing && player.currentTrack ? player.currentTrack.id : null;
  const lockedId = glSim.echoPlayingId ?? regularId;

  const pointerRef = useLensPointer(active, () => {
    if (selectionRef.current?.source === 'deeplink') selectionRef.current = null;
  });
  const writeUrl = useLensDeepLink({ active, ready: glSim.nodes.length > 0, numbers, selectionRef });
  const { stop } = player;
  const stopAll = useCallback(() => { stop(); stopEcho(); }, [stop, stopEcho]);
  const navigate = transition?.navigate;
  useLensExit({
    active, settled: !transition || transition.transaction.stage === 'stable', locked: lockedId != null,
    stopAll, clearSelection: () => { selectionRef.current = null; writeUrl(null); },
    goHome: () => { void navigate?.('/'); },
  });
  useLensFrame({
    active, reduced, veilRef, panelRef, pointerRef, lockedId, selectionRef, panelHotRef,
    onPanelId: (id) => { panelHotRef.current = false; setPanelId(id); },
    numberOf: (id) => {
      if (id == null) return '';
      return glSim.nodes.find((n) => n.id === id)?.echo ? '36' : String(numbers.byId.get(id) ?? '');
    },
  });

  // 命中层回调：手机第一次轻点只选中；#36 直接播放；键盘聚焦 = 光圈照到它。
  useEffect(() => {
    if (!active) return;
    setLensBridge({
      activate: (node, via) => {
        if (node.echo) return false;
        if (via === 'touch' && selectionRef.current?.id !== node.id) {
          selectionRef.current = { id: node.id, source: 'tap' }; writeUrl(node.id); return true;
        }
        if (via === 'mouse') selectionRef.current = null; // 桌面播放后光圈回到鼠标
        writeUrl(node.id);
        return false;
      },
      focus: (node) => {
        if (node) { selectionRef.current = { id: node.id, source: 'key' }; return; }
        if (selectionRef.current?.source === 'key') selectionRef.current = null;
      },
    });
    return () => setLensBridge({});
  }, [active, writeUrl]);

  useEffect(() => { if (lockedId && active) writeUrl(lockedId); }, [active, lockedId, writeUrl]);
  useEffect(() => {
    if (!active) { selectionRef.current = null; queueMicrotask(() => setPanelId(null)); }
  }, [active]);

  // 从 /lens 去别的页面（/me 等）：原曲与 #36 都停；回首页（/）保持播放。
  const previous = useRef(pathname);
  useEffect(() => {
    const was = previous.current; previous.current = pathname;
    if (was === LENS_PATH && !isHomePath(pathname)) stopAll();
  }, [pathname, stopAll]);

  const node = useMemo(() => (panelId ? glSim.nodes.find((n) => n.id === panelId) : undefined), [glSim.nodes, panelId]);
  const track = active && node && !node.echo ? getOriginalTrack(node.id) : null;
  return (
    <>
      <div ref={veilRef} className="lens-veil" data-lens-veil="true" data-on={active} aria-hidden="true" />
      {track && node?.track && <LensPanel key={track.trackId} ref={panelRef} track={track} hotRef={panelHotRef}
        playing={lockedId === node.id} onToggle={() => { void glSim.toggle(node.track); writeUrl(node.id); }} />}
    </>
  );
}

/** `/lens` 功能层：遮罩 + 光圈 + 链上面板。整体在异步边界内加载，首页不下载。 */
export default function LensLayer(props: Props) {
  return <Suspense fallback={null}><LensInner {...props} /></Suspense>;
}
