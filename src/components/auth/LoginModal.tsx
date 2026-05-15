'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import SemiLogin from './SemiLogin';

/**
 * Phase 7 Track B B2 — 全站登录 modal（两 tab：Privy 邮箱 / Semi 社区钱包）
 *
 * 由 Providers 挂载一次，通过模块级 openLoginModal() 触发显示。
 * Privy tab 点击调 privy.login() 弹 Privy 原生 modal（避免重写 Privy UI）。
 * Semi tab 走 SemiLogin 组件。
 */

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

type Tab = 'privy' | 'semi';

export default function LoginModal() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [tab, setTab] = useState<Tab>('privy');
  const { login: privyLogin } = usePrivy();

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-light tracking-widest text-white/80">
            登录
          </h2>
          <button
            type="button"
            onClick={closeLoginModal}
            aria-label="关闭"
            className="text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setTab('privy')}
            className={`flex-1 rounded-full border px-3 py-1.5 transition-colors ${
              tab === 'privy'
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            邮箱
          </button>
          <button
            type="button"
            onClick={() => setTab('semi')}
            className={`flex-1 rounded-full border px-3 py-1.5 transition-colors ${
              tab === 'semi'
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            社区钱包
          </button>
        </div>

        {tab === 'privy' && (
          <button
            type="button"
            onClick={() => {
              closeLoginModal();
              privyLogin();
            }}
            className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            用邮箱登录
          </button>
        )}

        {tab === 'semi' && <SemiLogin onSuccess={closeLoginModal} />}
      </div>
    </div>
  );
}
