'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LoginButton from '@/src/components/auth/LoginButton';

const MENU_ID = 'pond-public-navigation';

function PublicLinks({ onNavigate }: { onNavigate?: () => void }) {
  const linkClass = [
    'flex min-h-11 items-center border-b border-[var(--p11-line)]',
    'text-sm text-[var(--p11-muted)] transition-colors duration-150',
    'hover:text-[var(--p11-brass-strong)] focus-visible:outline-2',
    'focus-visible:outline-offset-4 focus-visible:outline-[var(--p11-focus-color)]',
    'md:min-h-0 md:border-0 md:text-xs md:tracking-[var(--p11-tracking-label)]',
  ].join(' ');

  return (
    <>
      <Link href="/me" onClick={onNavigate} className={linkClass}>
        我的音乐档案
      </Link>
      <Link href="/artist" onClick={onNavigate} className={linkClass}>
        艺术家
      </Link>
    </>
  );
}

/** 首页与 GL 沙盒共用的公开导航；只有交互岛接管指针，空白区域继续交给水塘。 */
export default function PondHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSandbox = pathname === '/test3' || pathname === '/test4';

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header
      data-pond-ui="true"
      data-p11-theme="pond"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex items-start justify-between gap-4 px-5 pt-[max(12px,env(safe-area-inset-top))] md:px-8 md:pt-5"
    >
      <Link
        href="/"
        className="pointer-events-auto min-w-0 py-2 text-[var(--p11-bone)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--p11-focus-color)]"
      >
        <span className="block truncate font-[family-name:var(--p11-font-display)] text-xl font-light leading-none tracking-[0.04em] md:text-2xl">
          Ripples in the Pond
        </span>
        {isSandbox && (
          <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--p11-faint)]">
            {pathname} · GL sandbox
          </span>
        )}
      </Link>

      <nav aria-label="主导航" className="pointer-events-auto hidden min-h-11 items-center gap-7 md:flex">
        <PublicLinks />
        <span className="h-4 w-px bg-[var(--p11-line)]" aria-hidden="true" />
        <LoginButton hideArchiveLink />
      </nav>

      <div className="pointer-events-auto relative md:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          aria-label={menuOpen ? '关闭主菜单' : '打开主菜单'}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center border border-[var(--p11-line)] bg-[var(--p11-overlay)] text-[var(--p11-bone)] backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--p11-focus-color)]"
        >
          <span className="relative block h-3.5 w-4" aria-hidden="true">
            <span className={`absolute left-0 top-0 h-px w-4 bg-current transition-transform ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
            <span className={`absolute left-0 top-[6px] h-px w-4 bg-current transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`absolute left-0 top-3 h-px w-4 bg-current transition-transform ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
          </span>
        </button>

        {menuOpen && (
          <div
            id={MENU_ID}
            className="absolute right-0 top-[52px] w-[min(280px,calc(100vw-40px))] border border-[var(--p11-line)] bg-[var(--p11-overlay)] px-5 py-3 shadow-[var(--p11-shadow-raised)] backdrop-blur-xl"
          >
            <div className="flex flex-col">
              <PublicLinks onNavigate={() => setMenuOpen(false)} />
              <div className="flex min-h-14 items-center justify-end pt-2">
                <LoginButton hideArchiveLink />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
