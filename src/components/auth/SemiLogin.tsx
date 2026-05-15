'use client';

import { useCallback, useEffect, useState } from 'react';
import { setSemiJwt } from '@/src/lib/auth/client-jwt';

const COUNTDOWN_SECONDS = 60;

type Phase = 'phone' | 'code';

/**
 * Phase 7 Track B B2 — Semi 社区钱包登录组件
 *
 * 状态机：phone（输手机号 → 发码）→ code（输验证码 + 60s 倒计时 → 登录）→ onSuccess
 * 后端走 /api/auth/community/send-code + /api/auth/community（Phase 4A S2 已就绪）
 * D-B4 错误分类：手机格式不对 / 60s 内重发禁用 / 验证码错（401）/ 网络错
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
    if (!trimmedCode) {
      setError('请输入验证码');
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

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs text-white/50">
        手机号
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={phase === 'code' || loading}
          placeholder="例如 13800000000"
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/30 disabled:opacity-50"
        />
      </label>

      {phase === 'code' && (
        <label className="text-xs text-white/50">
          验证码
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位短信验证码"
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/30 disabled:opacity-50"
          />
        </label>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {phase === 'phone' ? (
        <button
          type="button"
          onClick={sendCode}
          disabled={loading || !phoneValid}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {loading ? '发送中…' : '发送验证码'}
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !code.trim()}
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            {loading ? '登录中…' : '登录'}
          </button>
          <button
            type="button"
            onClick={sendCode}
            disabled={countdown > 0 || loading}
            className="rounded-full border border-white/20 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {countdown > 0 ? `${countdown}s 后重发` : '重发'}
          </button>
        </div>
      )}
    </div>
  );
}
