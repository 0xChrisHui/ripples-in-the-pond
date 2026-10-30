'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buildScoreRoute } from '@/src/lib/chain/multichain/registry';
import { useScorePack, type PackTarget } from '@/src/hooks/score-pack/useScorePack';
import './score-pack.css';

const STATUS_KEY = {
  queued: 'statusQueued', awaiting_wallet: 'statusAwaitingWallet', unsent: 'statusUnsent',
  submitted_unknown: 'statusSubmitted', confirming: 'statusConfirming',
} as const;

const KNOWN_ERRORS = [
  'NOT_HOLDER', 'ALREADY_OPENED', 'NO_SNAPSHOT', 'MISSING_ASSETS', 'EMPTY_PACK', 'TOO_MANY_SOUNDS',
  'GLOBAL_LIMIT', 'USER_LIMIT', 'ACTIVE_ORDER_EXISTS', 'PACK_DISABLED', 'UNAUTHENTICATED', 'NOT_ENABLED',
] as const;

export function packRoute(target: PackTarget): string {
  return `${buildScoreRoute(target.chainId, target.contract, target.tokenId)}/pack`;
}

/** /score 页的资产包入口：链上 opened 为真值；只有当前持有人看到"开通"按钮。 */
export default function ScorePackPanel({ target }: { target: PackTarget }) {
  const t = useTranslations('scorePack');
  const { status, busy, error, isHolder, isEth, open } = useScorePack(target);
  if (!status?.enabled) return null;

  const order = status.order;
  const progress = order && order.status in STATUS_KEY
    ? t(STATUS_KEY[order.status as keyof typeof STATUS_KEY]) : null;
  const errorKey = error === 'rejected' || error === 'needWallet' ? error : null;

  return (
    <section className="score-pack" data-pond-ui="true" aria-labelledby="score-pack-title">
      <p className="score-pack__eyebrow">{t('eyebrow')}</p>
      <h2 id="score-pack-title">{t('title')}</h2>
      <p className="score-pack__intro">{t('intro')}</p>
      <div className="score-pack__actions">
        {status.opened ? (
          <>
            <span className="score-pack__state">{t('statusOpened')}</span>
            <Link className="score-pack__link" href={packRoute(target)}>{t('viewPack')} →</Link>
          </>
        ) : progress ? (
          <>
            <span className="score-pack__state" role="status">{progress}</span>
            <Link className="score-pack__link" href={packRoute(target)}>{t('preview')} →</Link>
          </>
        ) : isHolder ? (
          <>
            <button className="score-pack__button" type="button" disabled={busy} onClick={() => void open()}>
              {busy ? t('opening') : t('open')}
            </button>
            <small>{isEth ? t('noteEth') : t('noteOp')}</small>
            <Link className="score-pack__link" href={packRoute(target)}>{t('preview')} →</Link>
          </>
        ) : (
          <>
            <small>{t('holderOnly')}</small>
            <Link className="score-pack__link" href={packRoute(target)}>{t('preview')} →</Link>
          </>
        )}
      </div>
      {error && (
        <p className="score-pack__error" role="alert">
          {errorKey ? t(errorKey)
            : t((KNOWN_ERRORS as readonly string[]).includes(error)
              ? `errors.${error}` as `errors.${typeof KNOWN_ERRORS[number]}` : 'errors.generic')}
        </p>
      )}
    </section>
  );
}
