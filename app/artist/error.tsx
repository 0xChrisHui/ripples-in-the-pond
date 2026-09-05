'use client';

import RouteErrorShell from '@/src/components/navigation/RouteErrorShell';

export default function ArtistError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorShell
      error={error}
      reset={reset}
      eyebrow="ARTIST / 001 · 艺术家"
      title="艺术家页面暂时无法读取"
      description="页面资料没有被占位内容替代。可以重新读取，或先回到水塘。"
      logScope="ArtistError"
    />
  );
}
