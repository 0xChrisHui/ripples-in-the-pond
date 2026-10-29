'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buildScoreRoute, explorerAddressUrlFor, explorerTxUrlFor } from '@/src/lib/chain/multichain/registry';
import { useScorePack, type PackTarget } from '@/src/hooks/score-pack/useScorePack';
import ScorePackPanel from './ScorePackPanel';
import './score-pack.css';

function Addr({ chainId, address }: { chainId: number; address: string }) {
  return <a href={explorerAddressUrlFor(chainId, address)} target="_blank" rel="noreferrer">{address}</a>;
}

/** 钥匙（Score）→ 保险箱（TBA）→ 素材：数据取链上读数，展示范围限定为本包素材及其余额。 */
export default function PackView({ target }: { target: PackTarget }) {
  const t = useTranslations('scorePack');
  const { status } = useScorePack(target);
  const { chainId } = target;
  const pack = status?.pack;

  return (
    <main className="pack-page" data-p11-theme="score" data-theme="dark" data-pond-ui="true">
      <header className="pack-page__head">
        <p className="score-pack__eyebrow">{t('pageEyebrow')}</p>
        <h1>{t('pageTitle')}</h1>
        <p className="pack-page__lead">{t('pageLead')}</p>
        <Link className="score-pack__link" href={buildScoreRoute(chainId, target.contract, target.tokenId)}>
          ← {t('backToScore')}
        </Link>
      </header>

      {!status ? <p className="pack-note" role="status">{t('loading')}</p>
        : !status.enabled ? <p className="pack-note">{t('errors.PACK_DISABLED')}</p> : (
          <div className="pack-flow">
            <section className="pack-node" data-kind="key">
              <p className="pack-node__label">{t('keyLabel')}</p>
              <dl>
                <dt>Score</dt>
                <dd><Addr chainId={chainId} address={target.contract} /> #{target.tokenId}</dd>
                <dt>{t('holder')}</dt>
                <dd>{status.owner ? <Addr chainId={chainId} address={status.owner} /> : '—'}</dd>
              </dl>
            </section>
            <div className="pack-link-line" aria-hidden="true" />
            <section className="pack-node" data-kind="vault">
              <p className="pack-node__label">{t('vaultLabel')}</p>
              <dl>
                <dt>{t('account')}</dt>
                <dd>{status.account && <Addr chainId={chainId} address={status.account} />}</dd>
                <dt>ERC-6551</dt>
                <dd>{status.accountDeployed ? t('deployed') : t('notDeployed')}</dd>
              </dl>
              {!status.opened && <p className="pack-note">{t('unopenedPreview')}</p>}
            </section>
            <div className="pack-link-line" aria-hidden="true" />
            <section className="pack-node pack-assets" data-kind="assets">
              <p className="pack-node__label">{t('assetsLabel')}</p>
              {pack ? (
                <>
                  <p className="pack-note">{t('contents', { count: pack.sounds.length })}</p>
                  <dl>
                    <dt>{t('trackLabel')}</dt>
                    <dd>
                      <ul className="pack-assets__grid">
                        <li className="pack-chip" data-held={pack.trackBalance !== '0'}
                          title={pack.trackBalance === '0' ? t('balanceMissing') : t('balanceHeld')}>
                          #{pack.trackTokenId}
                        </li>
                      </ul>
                    </dd>
                    <dt>{t('soundLabel')}</dt>
                    <dd>
                      <ul className="pack-assets__grid">
                        {pack.sounds.map((sound) => (
                          <li key={sound.id} className="pack-chip" data-held={sound.balance !== '0'}
                            title={sound.balance === '0' ? t('balanceMissing') : t('balanceHeld')}>
                            #{sound.id}
                          </li>
                        ))}
                      </ul>
                    </dd>
                    <dt>{t('openTx')}</dt>
                    <dd>
                      <a href={explorerTxUrlFor(chainId, pack.txHash)} target="_blank" rel="noreferrer">{pack.txHash}</a>
                      {' · '}{t('block')} {pack.blockNumber}
                    </dd>
                  </dl>
                </>
              ) : <p className="pack-note">{t('intro')}</p>}
              {status.contracts && (
                <dl>
                  <dt>{t('contracts')}</dt>
                  <dd>
                    {t('openerLabel')}: <Addr chainId={chainId} address={status.contracts.opener} /><br />
                    {t('soundsContract')}: <Addr chainId={chainId} address={status.contracts.sounds} /><br />
                    {t('tracksContract')}: <Addr chainId={chainId} address={status.contracts.tracks} />
                  </dd>
                  <dt>{t('readAt')}</dt>
                  <dd>{status.readAtBlock}</dd>
                </dl>
              )}
            </section>
          </div>
        )}
      <ScorePackPanel target={target} />
    </main>
  );
}
