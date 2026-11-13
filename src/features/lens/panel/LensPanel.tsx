'use client';
import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { OpMaterialMint, useMintAccess } from '@/src/components/music-catalog/claim/MaterialMintPanel';
import EthereumMaterialMint from '@/src/components/music-catalog/claim/EthereumMaterialMint';
import type { OriginalTrack } from '@/src/lib/music-catalog/types';
import { getLensBridge } from '../bridge/lens-bridge';
import ChainBlock from './ChainBlock';
import './lens-panel.css';

type Props = {
  track: OriginalTrack;
  /** 是否显示；由悬停状态机决定，关闭时只淡出，内容保留。 */
  open: boolean;
  playing: boolean;
  onToggle: () => void;
};

/** 光圈落在原曲球上时的链上信息面板；根节点关闭涟漪并标记为 UI，滚轮照常放行。 */
const LensPanel = forwardRef<HTMLElement, Props>(function LensPanel({ track, open, playing, onToggle }, ref) {
  const t = useTranslations('lens');
  const material = useTranslations('material');
  const { auth, authenticated, external, scope, login } = useMintAccess(track);
  const number = String(track.displayNumber).padStart(2, '0');
  const deployments = [...track.deployments].sort((a, b) => (a.chainId === 10 ? -1 : b.chainId === 10 ? 1 : a.chainId - b.chainId));
  return (
    <aside ref={ref} className="lens-panel" data-lens-panel="true" data-open={open ? 'true' : 'false'}
      data-pond-ui="true" data-pond-no-ripple="true" aria-label={t('panelLabel', { number })}
      onBlurCapture={(event) => {
        // 焦点离开面板：去到面板内部不处理；去到球上由球的 focus 接管；去到别处则清掉键盘选中。
        const next = event.relatedTarget;
        if (next instanceof Element && (event.currentTarget.contains(next) || next.matches('button[data-render-node-id]'))) return;
        getLensBridge().focus?.(null);
      }}>
      <header className="lens-panel__head">
        <span className="lens-panel__eyebrow">{t('eyebrow')}</span>
        <h2 className="lens-panel__title">{t('title', { number })}</h2>
        <button type="button" className="lens-play" onClick={onToggle} aria-pressed={playing} aria-label={playing ? t('pause') : t('play')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playing ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M7 4v16l14-8z'} /></svg>
        </button>
      </header>
      {deployments.map((deployment) => <ChainBlock key={`${deployment.chainId}/${deployment.contractAddress}`} deployment={deployment}>
        {authenticated && (deployment.chainId === 10 ? <OpMaterialMint key={`op:${scope}`} track={track} auth={auth} />
          : external ? <EthereumMaterialMint key={`eth:${scope}`} track={track} /> : null)}
      </ChainBlock>)}
      {!authenticated && <button type="button" className="material-collect lens-login" onClick={() => { void login(); }}>{material('signInToCollect')}</button>}
    </aside>
  );
});

export default LensPanel;
