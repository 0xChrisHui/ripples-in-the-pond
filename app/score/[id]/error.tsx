'use client';

import RouteErrorShell from '@/src/components/navigation/RouteErrorShell';

export default function ScoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorShell
      error={error}
      reset={reset}
      eyebrow="PERMANENT RECORD · 永久唱片"
      title="这枚唱片暂时无法读取"
      description="我们不会用占位资料补齐未知信息。可以重新读取，或先回到水塘。"
      logScope="ScoreError"
    />
  );
}
