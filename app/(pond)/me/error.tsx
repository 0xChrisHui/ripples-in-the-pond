'use client';

import RouteErrorShell from '@/src/components/navigation/RouteErrorShell';

export default function MeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorShell
      error={error}
      reset={reset}
      eyebrow="PERSONAL ARCHIVE · 私人档案"
      title="音乐档案暂时无法读取"
      description="你的唱片、录音和声音素材没有被改动。可以重新读取，或先回到水塘。"
      logScope="MeError"
    />
  );
}
