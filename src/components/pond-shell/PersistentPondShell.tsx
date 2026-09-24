'use client';

import type { ReactNode } from 'react';
import PondExperience from '@/src/features/home-pond/PondExperience';
import { PondTransitionProvider } from './pond-transition';
import { PondSceneSlotProvider } from './scene-slot';
import './pond-shell.css';

/** 只覆盖生产池塘路由；测试沙盒继续拥有自己的独立渲染会话。 */
export default function PersistentPondShell({ children }: { children: ReactNode }) {
  return (
    <PondTransitionProvider>
      <PondSceneSlotProvider>
        <PondExperience mode="production" persistent>
          {children}
        </PondExperience>
      </PondSceneSlotProvider>
    </PondTransitionProvider>
  );
}
