'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ChainLogo from './ChainLogo';
import './mint-network-selector.css';

function displayName(chainId: number, unconfigured: string): string {
  if (chainId === 10) return 'OP Mainnet';
  if (chainId === 11155420) return 'OP Sepolia';
  if (chainId === 1) return 'Ethereum Mainnet';
  if (chainId === 11155111) return 'Ethereum Sepolia';
  return unconfigured;
}

export default function MintNetworkSelector({
  value,
  opChainId,
  ethereumChainId,
  ethereumEnabled,
  onChange,
}: {
  value: 10 | 11155420 | 1 | 11155111;
  opChainId: 10 | 11155420;
  ethereumChainId: 1 | 11155111 | null;
  ethereumEnabled: boolean;
  onChange: (chainId: 10 | 11155420 | 1 | 11155111) => void;
}) {
  const t = useTranslations('selfMint.network');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const options: Array<{ chainId: 10 | 11155420 | 1 | 11155111; label: string }> = [
    { chainId: opChainId, label: displayName(opChainId, t('unconfigured')) },
    ...(ethereumChainId ? [{ chainId: ethereumChainId, label: displayName(ethereumChainId, t('unconfigured')) }] : []),
  ];

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details && !details.contains(event.target as Node)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !detailsRef.current?.open) return;
      detailsRef.current.open = false;
      detailsRef.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <details ref={detailsRef} className="mint-network">
      <summary aria-label={t('switchLabel', { name: displayName(value, t('unconfigured')) })}>
        <span className="mint-network__trigger">
          <ChainLogo chainId={value} />
          <span className="mint-network__trigger-copy">
            <small>{t('label')}</small>
            <span className="mint-network__label">
              {options.map((option) => <span key={option.chainId} className="mint-network__measure" aria-hidden="true">{option.label}</span>)}
              <span>{displayName(value, t('unconfigured'))}</span>
            </span>
          </span>
          <span className="mint-network__chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="mint-network__menu" role="group" aria-label={t('choose')}>
        {options.map((option, index) => {
          const enabled = index === 0 || ethereumEnabled;
          return (
            <button
              key={option.chainId}
              type="button"
              disabled={!enabled}
              aria-pressed={value === option.chainId}
              data-chain={option.chainId}
              onClick={(event) => {
                onChange(option.chainId);
                const details = event.currentTarget.closest('details');
                if (details) details.open = false;
              }}
            >
              <ChainLogo chainId={option.chainId} />
              <span className="mint-network__option-copy">
                <span>{option.label}</span>
                <small>{t(!enabled ? 'unavailable'
                  : option.chainId === opChainId ? 'opDefault'
                    : option.chainId === 1 ? 'ethSelf'
                      : 'testnet')}</small>
              </span>
              {value === option.chainId && <span className="mint-network__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {ethereumChainId === null && <p className="mint-network__unavailable">{t('ethMissing')}</p>}
      </div>
    </details>
  );
}
