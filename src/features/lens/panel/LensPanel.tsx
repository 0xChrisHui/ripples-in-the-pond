'use client';
import { forwardRef, type MutableRefObject } from 'react';
import { useTranslations } from 'next-intl';
import MaterialMintPanel from '@/src/components/music-catalog/claim/MaterialMintPanel';
import type { OriginalTrack } from '@/src/lib/music-catalog/types';
import ChainBlock from './ChainBlock';
import './lens-panel.css';

type Props = {
  track: OriginalTrack;
  playing: boolean;
  onToggle: () => void;
  /** 指针 / 键盘焦点在面板内时，功能层不撤面板（D4：收藏键够得着）。 */
  hotRef: MutableRefObject<boolean>;
};

/** 光圈落在原曲球上时的链上信息面板；根节点关闭涟漪并标记为 UI，滚轮照常放行。 */
const LensPanel = forwardRef<HTMLElement, Props>(function LensPanel({ track, playing, onToggle, hotRef }, ref) {
  const t = useTranslations('lens');
  const number = String(track.displayNumber).padStart(2, '0');
  const deployments = [...track.deployments].sort((a, b) => (a.chainId === 10 ? -1 : b.chainId === 10 ? 1 : a.chainId - b.chainId));
  return (
    <aside ref={ref} className="lens-panel" data-lens-panel="true" data-pond-ui="true" data-pond-no-ripple="true"
      aria-label={t('panelLabel', { number })}
      onPointerEnter={() => { hotRef.current = true; }}
      onPointerLeave={(event) => { hotRef.current = event.currentTarget.contains(document.activeElement); }}
      onFocusCapture={() => { hotRef.current = true; }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) hotRef.current = false; }}>
      <header className="lens-panel__head">
        <span className="lens-panel__eyebrow">{t('eyebrow')}</span>
        <h2 className="lens-panel__title">{t('title', { number })}</h2>
      </header>
      {deployments.map((deployment) => <ChainBlock key={`${deployment.chainId}/${deployment.contractAddress}`} deployment={deployment} />)}
      <button type="button" className="lens-play" onClick={onToggle} aria-pressed={playing}>
        {playing ? t('pause') : t('play')}
      </button>
      <div className="lens-collect"><MaterialMintPanel track={track} compact /></div>
    </aside>
  );
});

export default LensPanel;
