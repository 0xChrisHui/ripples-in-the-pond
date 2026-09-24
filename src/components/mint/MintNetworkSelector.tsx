'use client';

import { useEffect, useRef } from 'react';
import './mint-network-selector.css';

function displayName(chainId: number): string {
  if (chainId === 10) return 'OP Mainnet';
  if (chainId === 11155420) return 'OP Sepolia';
  if (chainId === 1) return 'Ethereum Mainnet';
  if (chainId === 11155111) return 'Ethereum Sepolia';
  return 'Ethereum 未配置';
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
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const options: Array<{ chainId: 10 | 11155420 | 1 | 11155111; label: string }> = [
    { chainId: opChainId, label: displayName(opChainId) },
    ...(ethereumChainId ? [{ chainId: ethereumChainId, label: displayName(ethereumChainId) }] : []),
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
      <summary aria-label={`${displayName(value)}，切换网络`}>
        <span className="mint-network__trigger">
          <span className="mint-network__dot" data-chain={value} aria-hidden="true" />
          <span>{displayName(value)}</span>
          <span className="mint-network__chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="mint-network__menu" role="group" aria-label="选择网络">
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
              <span className="mint-network__option-dot" aria-hidden="true" />
              <span className="mint-network__option-copy">
                <span>{option.label}</span>
                <small>{!enabled ? '当前账号暂不可用'
                  : option.chainId === opChainId ? '默认 · 平台代付 Gas'
                    : option.chainId === 1 ? '钱包自付 Gas'
                      : '测试网 · 钱包自付 Gas'}</small>
              </span>
              {value === option.chainId && <span className="mint-network__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {ethereumChainId === null && <p className="mint-network__unavailable">Ethereum 网络未配置</p>}
      </div>
    </details>
  );
}
