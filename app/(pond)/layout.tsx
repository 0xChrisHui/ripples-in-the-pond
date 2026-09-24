import { Suspense, type ReactNode } from 'react';
import PersistentPondShell from '@/src/components/pond-shell/PersistentPondShell';

export default function PondLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <PersistentPondShell>{children}</PersistentPondShell>
    </Suspense>
  );
}
