'use client';

import type { LoginEntry } from '@/src/types/auth';

const STORAGE_KEY = 'ripples.login-session.v1';
const EMPTY = { loginEntry: null, selectedWalletAddress: null } as const;

export type LoginSession = {
  loginEntry: LoginEntry;
  selectedWalletAddress: string | null;
};

let cached: LoginSession = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function parseStored(raw: string | null): LoginSession {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as Partial<LoginSession>;
    const validEntry = value.loginEntry === 'email'
      || value.loginEntry === 'semi'
      || value.loginEntry === 'external_wallet';
    return {
      loginEntry: validEntry ? value.loginEntry! : null,
      selectedWalletAddress: typeof value.selectedWalletAddress === 'string'
        ? value.selectedWalletAddress
        : null,
    };
  } catch {
    return EMPTY;
  }
}

export function getLoginSession(): LoginSession {
  if (!hydrated && typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = parseStored(stored);
    } else {
      cached = parseStored(sessionStorage.getItem(STORAGE_KEY));
      if (cached.loginEntry !== null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    hydrated = true;
  }
  return cached;
}

export function getServerLoginSession(): LoginSession {
  return EMPTY;
}

export function subscribeLoginSession(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
  };
}

function handleStorageChange(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cached = parseStored(localStorage.getItem(STORAGE_KEY));
  hydrated = true;
  listeners.forEach((listener) => listener());
}

export function setLoginSession(
  loginEntry: Exclude<LoginEntry, null>,
  selectedWalletAddress: string | null = null,
): void {
  cached = { loginEntry, selectedWalletAddress };
  hydrated = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  listeners.forEach((listener) => listener());
}

export function clearLoginSession(): void {
  cached = EMPTY;
  hydrated = true;
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener());
}
