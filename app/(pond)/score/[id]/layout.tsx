import type { ReactNode } from 'react';
import './score-pond-page.css';

/** Score 私有 Session 由 ready 场景接管；布局不提前终止全局试听。 */
export default function ScoreLayout({ children }: { children: ReactNode }) {
  return children;
}
