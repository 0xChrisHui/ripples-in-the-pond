'use client';

import { useCallback, useEffect, useState } from 'react';
import { setSemiJwt } from '@/src/lib/auth/client-jwt';
import PinInput from './PinInput';

const COUNTDOWN_SECONDS = 60;

function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}...${phone.slice(-4)}`;
}

type Phase = 'phone' | 'code';

/**
 * Phase 7 Track D D2 — Semi 社区钱包登录，两阶段深色布局。
 */
export default function SemiLogin({ onSuccess }: { onSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  const normalizedPhone = phone.trim();
  // 宽松校验：纯数字 / + 前缀，长度 5-15；具体由 Semi API 兜底
  const phoneValid = /^\+?[0-9]{5,15}$/.test(normalizedPhone);

  const sendCode = useCallback(async () => {
    if (!phoneValid) {
      setError('请输入有效的手机号');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/community/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '发送验证码失败，请稍后重试');
      }
      setPhase('code');
      setCountdown(COUNTDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [phoneValid, normalizedPhone]);

  const submit = useCallback(async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, code: trimmedCode }),
      });
      if (res.status === 401) {
        throw new Error('验证码无效或已过期');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '登录失败，请稍后重试');
      }
      const data = await res.json();
      const token: string | undefined = data?.token;
      if (!token) throw new Error('登录失败：未返回 token');
      setSemiJwt(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [code, normalizedPhone, onSuccess]);

  if (phase === 'phone') {
    return (
      <div className="flex flex-col gap-5 text-center">
        <div>
          <h2 className="text-2xl font-light tracking-[0.35em] text-white">登 录</h2>
          <p className="mt-3 text-sm text-white/50">输入你登录用的手机号</p>
        </div>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
          placeholder="例如 13800000000"
          className="w-full rounded-full border border-white/10 bg-black/40 px-5 py-3 text-center text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/30 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={sendCode}
          disabled={loading || !phoneValid}
          className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {loading ? '发送中…' : '下 一 步'}
        </button>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <h2 className="text-2xl font-light tracking-[0.35em] text-white">验 证 码</h2>
        <p className="mt-3 text-sm text-white/50">请输入收到的 6 位验证码</p>
        <p className="mt-1 text-xs text-white/35">发往 {maskPhone(normalizedPhone)}</p>
      </div>

      <PinInput value={code} onChange={setCode} disabled={loading} />

      <button
        type="button"
        onClick={sendCode}
        disabled={countdown > 0 || loading}
        className="text-xs text-white/45 transition-colors hover:text-white/70 disabled:cursor-not-allowed disabled:hover:text-white/45"
      >
        {countdown > 0 ? `${countdown}s 后重发` : '重发'}
      </button>

      <button
        type="button"
        onClick={submit}
        disabled={loading || code.length !== 6}
        className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm tracking-[0.2em] text-white transition-colors hover:bg-white/20 disabled:opacity-40"
      >
        {loading ? '登录中…' : '验  证'}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
