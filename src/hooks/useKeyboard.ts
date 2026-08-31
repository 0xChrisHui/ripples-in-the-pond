'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface UseKeyboardReturn {
  /** 当前正在按住的键（a-z、3-8、space） */
  pressedKeys: Set<string>;
}

interface UseKeyboardOptions {
  /** 按键按下时的回调 */
  onKeyDown?: (key: string) => void;
  /** 按键抬起时的回调 */
  onKeyUp?: (key: string) => void;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

function normalizeKey(e: KeyboardEvent): string | null {
  if (e.code === 'Space') return 'space';
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^(Digit|Numpad)[3-8]$/.test(e.code)) return e.code.at(-1) ?? null;
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(element?.tagName ?? '')
    || Boolean(element?.isContentEditable);
}

/**
 * 键盘输入 hook — 监听 a-z、3-8 和空格键，过滤重复 keydown
 * 只在用户手势（真实按键）时触发，忽略自动重复
 */
export function useKeyboard(options: UseKeyboardOptions = {}): UseKeyboardReturn {
  const { onKeyDown, onKeyUp, enabled = true } = options;
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const onKeyDownRef = useRef(onKeyDown);
  const onKeyUpRef = useRef(onKeyUp);
  useEffect(() => { onKeyDownRef.current = onKeyDown; }, [onKeyDown]);
  useEffect(() => { onKeyUpRef.current = onKeyUp; }, [onKeyUp]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat || isEditableTarget(e.target)) return;
    const key = normalizeKey(e);
    if (!key) return;
    if (key === 'space') e.preventDefault();

    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    onKeyDownRef.current?.(key);
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = normalizeKey(e);
    if (!key) return;

    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    onKeyUpRef.current?.(key);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled, handleKeyDown, handleKeyUp]);

  return { pressedKeys };
}
