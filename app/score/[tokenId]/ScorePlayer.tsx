'use client';

import { useState } from 'react';

/**
 * ScoreNFT 播放器 — iframe 嵌入 Arweave 上的 Score Decoder
 * decoder 在 S4 上传后所有 ScoreNFT 共用同一份 HTML，
 * 通过 URL 参数区分 events / base / sounds。
 */

interface Props {
  decoderUrl: string;
  eventCount: number;
}

export default function ScorePlayer({ decoderUrl, eventCount }: Props) {
  const [showPlayer, setShowPlayer] = useState(false);

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

  return (
    <div className="overflow-hidden rounded-lg border border-white/15">
      <iframe
        src={decoderUrl}
        title="Score Decoder"
        className="h-[360px] w-full border-0 bg-black"
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
