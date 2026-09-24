'use client';

import { useEffect, useRef, useState } from 'react';
import { createPublicClient, formatEther, getAddress, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { explorerAddressUrlFor, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import { useAuth } from '@/src/hooks/useAuth';
import ReconnectMintWallet from './ReconnectMintWallet';
import './mint-choice.css';

type Choice = 'op' | 'eth';
type Estimate = { gasEth: string; balanceEth: string; enough: boolean };

export default function MintChoiceDialog({
  pendingScoreId,
  title,
  lockedChoice,
  onClose,
  onOpMint,
  onPrepared,
}: {
  pendingScoreId: string;
  title: string;
  lockedChoice?: Choice;
  onClose: () => void;
  onOpMint: () => void;
  onPrepared: (orderId: `0x${string}`) => void;
}) {
  const auth = useAuth();
  const [choice, setChoice] = useState<Choice>(lockedChoice ?? 'op');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const chainId = Number(process.env.NEXT_PUBLIC_ETH_SCORE_CHAIN_ID);
  const contract = process.env.NEXT_PUBLIC_ETH_SCORE_NFT_ADDRESS;
  const wallet = auth.selectedExternalWallet;
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (choice !== 'eth' || !wallet || (chainId !== 1 && chainId !== 11155111)) return;
    let cancelled = false;
    const chain = chainId === 1 ? mainnet : sepolia;
    const client = createPublicClient({ chain, transport: http() });
    void Promise.all([
      client.getGasPrice(),
      client.getBalance({ address: getAddress(wallet.address) }),
    ]).then(([gasPrice, balance]) => {
      const upperCost = gasPrice * 230_000n;
      if (!cancelled) setEstimate({
        gasEth: formatEther(upperCost),
        balanceEth: formatEther(balance),
        enough: balance >= upperCost,
      });
    }).catch(() => {
      if (!cancelled) setError('暂时无法取得费用预估，稍后再试。');
    });
    return () => { cancelled = true; };
  }, [chainId, choice, wallet]);

  async function prepareEthereum() {
    if (!wallet || !auth.walletCapability.canSelfPayEthGas) return;
    setBusy(true);
    setError(null);
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('登录已失效');
      const response = await fetch('/api/self-mint/prepare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingScoreId, walletAddress: wallet.address }),
      });
      const result = await response.json() as { orderId?: string; error?: string };
      if (!response.ok || !result.orderId) throw new Error(result.error ?? '永久作品准备失败');
      onPrepared(result.orderId as `0x${string}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '永久作品准备失败');
      setBusy(false);
    }
  }

  const network = chainId === 1 || chainId === 11155111
    ? getChainDefinition(chainId).displayName : 'Ethereum 未配置';
  const address = wallet ? getAddress(wallet.address) : null;
  const contractHref = contract && (chainId === 1 || chainId === 11155111)
    ? explorerAddressUrlFor(chainId, contract) : null;

  return (
    <div className="mint-choice" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section ref={dialogRef} tabIndex={-1} className="mint-choice__sheet" role="dialog"
        aria-modal="true" aria-labelledby="mint-choice-title">
        <header>
          <p>PRESSING ROUTE · {lockedChoice === 'eth' ? 'Ethereum 自付 Gas' : '铸造方式'}</p>
          <h2 id="mint-choice-title">{lockedChoice === 'eth'
            ? `为「${title}」在 ${chainId === 1 ? 'Ethereum Mainnet' : 'Ethereum Sepolia'} 铸造`
            : `为「${title}」选择网络`}</h2>
        </header>
        {lockedChoice !== 'eth' && (
          <fieldset className="mint-choice__routes">
            <legend>本次选择</legend>
            <label data-selected={choice === 'op'}>
              <input type="radio" name="mint-chain" value="op" checked={choice === 'op'}
                onChange={() => { setChoice('op'); setError(null); }} />
              <span><strong>OP</strong><small>平台支付 Gas · 默认</small></span>
              <b>无需钱包交易</b>
            </label>
            <label data-selected={choice === 'eth'}>
              <input type="radio" name="mint-chain" value="eth" checked={choice === 'eth'}
                onChange={() => { setChoice('eth'); setError(null); }} />
              <span><strong>Ethereum</strong><small>你用当前钱包支付 Gas</small></span>
              <b>ScoreNFT only</b>
            </label>
          </fieldset>
        )}

        {choice === 'eth' && (
          <div className="mint-choice__ledger" aria-live="polite">
            <dl>
              <div><dt>网络</dt><dd>{network}</dd></div>
              <div><dt>付款 / 接收钱包</dt><dd>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '未连接'}</dd></div>
              <div><dt>连接方式</dt><dd>{auth.walletCapability.walletClientType ?? auth.walletCapability.connectorType ?? '外部钱包'}</dd></div>
              <div><dt>保守 Gas 上限</dt><dd>{estimate ? `约 ${estimate.gasEth} ETH` : wallet ? '正在读取…' : '连接钱包后读取'}</dd></div>
              <div><dt>钱包余额</dt><dd>{estimate ? `${estimate.balanceEth} ETH` : wallet ? '正在读取…' : '钱包未连接'}</dd></div>
              <div><dt>ScoreNFT</dt><dd>{contractHref ? <a href={contractHref} target="_blank" rel="noreferrer">查看合约 ↗</a> : '尚未部署'}</dd></div>
            </dl>
            <p>铸造价格为 0，但钱包会支付网络 Gas。下一步会永久保存素材；上传后无法删除。</p>
            {!wallet && <p>请先重新连接原钱包，再继续准备作品。</p>}
            {estimate && !estimate.enough && <p className="mint-choice__warning">余额低于当前保守估算，暂不能继续。</p>}
          </div>
        )}
        {error && <p className="mint-choice__error" role="alert">{error}</p>}
        <footer>
          <button type="button" className="mint-choice__cancel" disabled={busy} onClick={onClose}>取消</button>
          {choice === 'eth' && !wallet && auth.walletsReady && auth.walletCapability.activeWalletAddress && (
            <ReconnectMintWallet expectedAddress={auth.walletCapability.activeWalletAddress}
              walletClientType={auth.walletCapability.walletClientType} />
          )}
          {choice === 'op' ? (
            <button type="button" className="mint-choice__primary" onClick={onOpMint}>由平台在 OP 铸造</button>
          ) : (
            <button type="button" className="mint-choice__primary" disabled={busy || !auth.walletCapability.canSelfPayEthGas || !estimate?.enough || !contractHref}
              onClick={() => void prepareEthereum()}>
              {busy ? '正在建立作品档案…' : '准备永久作品'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
