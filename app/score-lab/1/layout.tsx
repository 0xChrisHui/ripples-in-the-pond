import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '单球水塘沙盒 · Ripples in the Pond',
  robots: { index: false, follow: false },
};

export default function ScoreLabLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
