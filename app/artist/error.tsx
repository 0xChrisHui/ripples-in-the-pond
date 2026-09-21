'use client';

import RouteErrorShell from '@/src/components/navigation/RouteErrorShell';

export default function ArtistError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorShell
      error={error}
      reset={reset}
      eyebrow="ARTIST / 叶禹含"
      title="叶禹含的艺术家页面暂时无法读取"
      description="人物与项目介绍没有被占位内容替代。可以重新读取，或先回到水塘。"
      logScope="ArtistError"
    />
  );
}
