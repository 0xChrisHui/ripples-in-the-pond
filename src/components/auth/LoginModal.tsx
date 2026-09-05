'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import SemiLogin from './SemiLogin';
import './auth-dialog.css';

/**
 * Phase 7 Track D D1 — 全站登录 modal，默认走 Semi 社区钱包。
 * P12 C7 — Semi kill switch：NEXT_PUBLIC_SEMI_DISABLED=1 时隐藏 Semi、邮箱(Privy)转正，
 * 上线周 Semi API 波动可一键保住新用户登录（改 env + redeploy 即生效，零代码回滚）。
 */

const SEMI_DISABLED = process.env.NEXT_PUBLIC_SEMI_DISABLED === '1';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const preferred = dialog?.querySelector<HTMLElement>('[data-login-autofocus]:not(:disabled)');
      const fallback = dialog?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)');
      (preferred ?? fallback)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = priorOverflow;
      if (previous instanceof HTMLElement
        && (document.activeElement === document.body || dialog?.contains(document.activeElement))) {
        previous.focus();
      }
    };
  }, [open]);

  const keepFocusInside = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLoginModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1)!;
    if (event.shiftKey && (document.activeElement === first
      || !dialogRef.current?.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="auth-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeLoginModal();
      }}
    >
      <div
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={keepFocusInside}
      >
        <header className="auth-dialog__header">
          <div>
            <p className="auth-dialog__eyebrow">Identity record · 身份页</p>
            <h2 id={titleId}>找回你的音乐档案</h2>
            <p id={descriptionId}>登录用于找回你的音乐档案，并继续保存属于你的声音。</p>
          </div>
          <button
            type="button"
            onClick={closeLoginModal}
            aria-label="关闭登录窗口"
            className="auth-dialog__close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {SEMI_DISABLED ? (
          <button
            type="button"
            onClick={() => {
              closeLoginModal();
              privyLogin();
            }}
            disabled={!privyReady}
            className="auth-dialog__email auth-dialog__email--primary"
            data-login-autofocus
          >
            {privyReady ? '使用邮箱登录' : '邮箱登录加载中…'}
          </button>
        ) : (
          <>
            <SemiLogin onSuccess={closeLoginModal} />
            <div className="auth-dialog__divider"><span>或</span></div>
            <button
              type="button"
              onClick={() => {
                closeLoginModal();
                privyLogin();
              }}
              disabled={!privyReady}
              className="auth-dialog__email"
            >
              {privyReady ? '使用邮箱登录' : '邮箱登录加载中…'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
