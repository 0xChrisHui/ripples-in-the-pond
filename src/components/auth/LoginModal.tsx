'use client';

import { useSyncExternalStore } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import SemiLogin from './SemiLogin';

/**
 * Phase 7 Track D D1 — 全站登录 modal，默认走 Semi 社区钱包。
 */

// 模块级 store + React useSyncExternalStore 标准三件套（subscribe / getSnapshot / getServerSnapshot）。
// 选模块级而非 Context：① modal 是全站单例 ② 任意非 React 代码也能调 openLoginModal ③ 避免新增
// Context Provider 占用 components/auth/ 目录文件位。布尔值天然引用稳定，无需 cachedState。
let isOpen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return isOpen;
}

function getServerSnapshot(): boolean {
  return false;
}

export function openLoginModal(): void {
  if (isOpen) return;
  isOpen = true;
  notify();
}

export function closeLoginModal(): void {
  if (!isOpen) return;
  isOpen = false;
  notify();
}

export default function LoginModal() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { login: privyLogin, ready: privyReady } = usePrivy();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onClick={closeLoginModal}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={closeLoginModal}
            aria-label="返回"
            className="text-lg text-white/40 transition-colors hover:text-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={closeLoginModal}
            aria-label="关闭"
            className="text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <SemiLogin onSuccess={closeLoginModal} />

        <button
          type="button"
          onClick={() => {
            closeLoginModal();
            privyLogin();
          }}
          disabled={!privyReady}
          className="mt-5 flex w-full items-center justify-end gap-1 text-xs text-white/40 transition-colors hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {privyReady ? '✉ 用邮箱登录' : '邮箱登录加载中…'}
        </button>
      </div>
    </div>
  );
}
