'use client';

import { useTranslations } from 'next-intl';
import RouteErrorShell from '@/src/components/navigation/RouteErrorShell';

export default function ScoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('routeError.score');
  return (
    <RouteErrorShell
      error={error}
      reset={reset}
      eyebrow={t('eyebrow')}
      title={t('title')}
      description={t('description')}
      logScope="ScoreError"
    />
  );
}
