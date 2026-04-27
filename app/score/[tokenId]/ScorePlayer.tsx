'use client';

import { useState, useEffect } from 'react';

/**
 * ScoreNFT 播放器 — iframe 嵌入 Arweave 上的 Score Decoder
 * decoder 在 S4 上传后所有 ScoreNFT 共用同一份 HTML，
 * 通过 URL 参数区分 events / base / sounds。
 *
 * Phase 6 E4：客户端探测 Arweave 网关可达性，自动替换 decoderUrl 的 host
 *   - 主路径（/score/[id]）我们能控制 iframe src，所以可以做探测 + 替换
 *   - OpenSea 端 metadata 写死 ARWEAVE_GATEWAYS[0]（arweave.net），那里没法 fallback
 */

interface Props {
  decoderUrl: string;
  eventCount: number;
}

// 与 src/lib/arweave/core.ts 的 ARWEAVE_GATEWAYS 同步；那个文件 server-only 不能前端 import
const PROBE_GATEWAYS = [
  'https://arweave.net',
  'https://ario.permagate.io',
] as const;

async function probeGateway(timeoutMs = 3000): Promise<string | null> {
  for (const gw of PROBE_GATEWAYS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${gw}/`, { method: 'HEAD', signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status < 500) return gw;
    } catch {
      /* try next */
    }
  }
  return null;
}

function replaceGateway(url: string, newGateway: string): string {
  for (const gw of PROBE_GATEWAYS) {
    if (url.startsWith(gw)) return newGateway + url.slice(gw.length);
  }
  return url;
}

export default function ScorePlayer({ decoderUrl, eventCount }: Props) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [reachableGateway, setReachableGateway] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  // 点击播放后才 probe，避免页面打开就发探测请求
  // queueMicrotask 推到下一帧避 React 19 react-hooks/set-state-in-effect 警告
  useEffect(() => {
    if (!showPlayer || reachableGateway || probing) return;
    queueMicrotask(() => {
      setProbing(true);
      probeGateway()
        .then((gw) => setReachableGateway(gw))
        .finally(() => setProbing(false));
    });
  }, [showPlayer, reachableGateway, probing]);

  if (!decoderUrl) {
    return (
      <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">
        播放器暂不可用
      </div>
    );
  }

  if (!showPlayer) {
    return (
      <button
        type="button"
        onClick={() => setShowPlayer(true)}
        className="group flex w-full flex-col items-center gap-3 rounded-lg border border-white/15 bg-white/[0.03] p-8 transition hover:border-white/30 hover:bg-white/[0.06]"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 text-2xl text-white/70 transition group-hover:border-white/40 group-hover:text-white">
          ▶
        </span>
        <span className="text-sm text-white/50">
          {eventCount} 个音符 · 点击播放
        </span>
      </button>
    );
  }

  if (probing) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg border border-white/10 text-sm text-white/40">
        正在连接 Arweave 网关...
      </div>
    );
  }

  if (!reachableGateway) {
    return (
      <div className="flex h-[360px] flex-col items-center justify-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 text-center text-sm text-amber-200/80">
        <p>Arweave 网关全部不可达</p>
        <p className="text-xs text-white/40">
          检查网络后{' '}
          <button
            type="button"
            onClick={() => setProbing(false)}
            className="underline hover:text-white/60"
          >
            重试
          </button>
        </p>
      </div>
    );
  }

  const finalUrl = replaceGateway(decoderUrl, reachableGateway);

  return (
    <div className="overflow-hidden rounded-lg border border-white/15">
      <iframe
        src={finalUrl}
        title="Score Decoder"
        className="h-[360px] w-full border-0 bg-black"
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
