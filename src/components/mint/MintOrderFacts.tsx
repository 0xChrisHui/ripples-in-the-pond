import type { Hex } from 'viem';
import {
  explorerAddressUrlFor, explorerTxUrlFor, getChainDefinition,
} from '@/src/lib/chain/multichain/registry';
import { formatGasUsd, type PublicOrder } from './self-mint-copy';

type GasEstimate = { usd: number; enough: boolean };

function shortHex(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function HashValue({ value }: { value: string }) {
  return <code className="self-mint-status__hash" title={value}>{shortHex(value)}</code>;
}

export default function MintOrderFacts({ order, hash, canSend, gasEstimate, gasError }: {
  order: PublicOrder;
  hash: Hex | null;
  canSend: boolean;
  gasEstimate: GasEstimate | null;
  gasError: string | null;
}) {
  return (
    <dl className="self-mint-status__facts">
      <div data-kind="network">
        <dt>网络</dt>
        <dd><span className="self-mint-status__network-dot" aria-hidden="true" />
          {getChainDefinition(order.chainId).displayName}</dd>
      </div>
      {canSend && <div data-kind="gas">
        <dt>预估 Gas</dt>
        <dd>{gasEstimate
          ? `约 ${formatGasUsd(gasEstimate.usd)}${order.chainId === 11155111 ? ' · 测试网参考' : ''}`
          : gasError ? '美元估算暂不可用' : '正在估算美元费用…'}</dd>
      </div>}
      <div data-wide="true">
        <dt>接收钱包</dt>
        <dd><HashValue value={order.recipientAddress} /></dd>
      </div>
      <div data-wide="true">
        <dt>ScoreNFT</dt>
        <dd><a href={explorerAddressUrlFor(order.chainId, order.scoreContract)} target="_blank"
          rel="noreferrer" title={order.scoreContract}>
          <HashValue value={order.scoreContract} /><span aria-hidden="true">↗</span>
        </a></dd>
      </div>
      <div data-wide="true">
        <dt>Order ID</dt>
        <dd><HashValue value={order.orderId} /></dd>
      </div>
      {hash && <div data-wide="true">
        <dt>交易</dt>
        <dd><a href={explorerTxUrlFor(order.chainId, hash)} target="_blank" rel="noreferrer"
          title={hash}><HashValue value={hash} /><span aria-hidden="true">↗</span></a></dd>
      </div>}
    </dl>
  );
}
