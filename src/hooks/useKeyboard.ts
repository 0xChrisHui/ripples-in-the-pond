'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface UseKeyboardReturn {
  /** 当前正在按住的键（a-z） */
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

const VALID_KEYS = new Set('abcdefghijklmnopqrstuvwxyz'.split(''));

/**
 * 键盘输入 hook — 监听 a-z 按键，过滤重复 keydown
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
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    if (!VALID_KEYS.has(key)) return;

    setPressedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    onKeyDownRef.current?.(key);
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (!VALID_KEYS.has(key)) return;

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
