'use client';

import { useCallback, useEffect, useState } from 'react';
import { setSemiJwt } from '@/src/lib/auth/client-jwt';
import PinInput from './PinInput';

const COUNTDOWN_SECONDS = 60;
const SEMI_REGISTER_URL = 'https://semi.ntdao.xyz/';

function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}...${phone.slice(-4)}`;
}

/** 未注册提示 + 跳转 Semi 注册按钮 */
function RegisterPrompt() {
  return (
    <div className="semi-login__register" id="semi-feedback" role="alert">
      <p>该手机号尚未注册 Semi 钱包，请先注册后再登录。</p>
      <a
        href={SEMI_REGISTER_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        前往注册 Semi 钱包
      </a>
    </div>
  );
}

type Phase = 'phone' | 'code';

/**
 * Phase 7 Track D D2 — Semi 社区钱包登录，两阶段身份纸页。
 */
export default function SemiLogin({ onSuccess }: { onSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('phone');
  const [error, setError] = useState<string | null>(null);
  const [needRegister, setNeedRegister] = useState(false);
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
    setNeedRegister(false);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/community/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'SEMI_NOT_REGISTERED') {
          setNeedRegister(true);
          return;
        }
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
    setNeedRegister(false);
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
        if (data.code === 'SEMI_NOT_REGISTERED') {
          setNeedRegister(true);
          return;
        }
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

  const backToPhone = () => {
    setPhase('phone');
    setCode('');
    setError(null);
    setNeedRegister(false);
  };

  const feedback = needRegister
    ? <RegisterPrompt />
    : error && <p className="semi-login__error" id="semi-feedback" role="alert">{error}</p>;

  if (phase === 'phone') {
    return (
      <form className="semi-login" onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
        <div className="semi-login__step">
          <p>01 · Semi 社区钱包</p>
          <h3>手机号登录</h3>
        </div>
        <label className="semi-login__label" htmlFor="semi-phone">手机号</label>
        <input
          id="semi-phone" type="tel" inputMode="tel" autoComplete="tel"
          value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading}
          placeholder="例如 13800000000" aria-invalid={Boolean(error)}
          aria-describedby={error || needRegister ? 'semi-feedback' : undefined}
          data-login-autofocus
        />
        <button
          type="submit"
          disabled={loading || !phoneValid}
          className="semi-login__primary"
        >
          {loading ? '发送中…' : '发送验证码'}
        </button>
        {feedback}
      </form>
    );
  }

  return (
    <form className="semi-login" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="semi-login__step semi-login__step--code">
        <button type="button" className="semi-login__back" onClick={backToPhone}>← 修改手机号</button>
        <p>02 · 验证身份</p>
        <h3>输入验证码</h3>
        <small>已发送至 {maskPhone(normalizedPhone)}</small>
      </div>
      <PinInput value={code} onChange={setCode} disabled={loading} invalid={Boolean(error)} />
      <button
        type="button"
        onClick={sendCode}
        disabled={countdown > 0 || loading}
        className="semi-login__resend"
      >
        {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
      </button>
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="semi-login__primary"
      >
        {loading ? '登录中…' : '确认并登录'}
      </button>
      {feedback}
    </form>
  );
}
