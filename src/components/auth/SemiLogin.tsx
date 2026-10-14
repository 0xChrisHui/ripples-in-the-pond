'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setSemiJwt } from '@/src/lib/auth/client-jwt';
import { useServerText } from '@/src/i18n/use-server-text';
import PinInput from './PinInput';

const COUNTDOWN_SECONDS = 60;
const SEMI_REGISTER_URL = 'https://semi.ntdao.xyz/';

function maskPhone(phone: string): string {
  if (phone.length <= 7) return phone;
  return `${phone.slice(0, 3)}...${phone.slice(-4)}`;
}

/** 未注册提示 + 跳转 Semi 注册按钮 */
function RegisterPrompt() {
  const t = useTranslations('semi.register');
  return (
    <div className="semi-login__register" id="semi-feedback" role="alert">
      <p>{t('prompt')}</p>
      <a
        href={SEMI_REGISTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('linkLabel')}
      >
        {t('link')}
      </a>
    </div>
  );
}

type Phase = 'phone' | 'code';
type ErrorKey = 'invalidPhone' | 'sendFailed' | 'network' | 'codeLength' | 'codeInvalid' | 'loginFailed' | 'noToken';
/** server：服务器或浏览器给出的原文，中文模式照旧显示；英文模式只显示 key 对应的前端文案 */
type LoginError = { key: ErrorKey; server?: string };

/**
 * Phase 7 Track D D2 — SEMI社区身份登录，两阶段身份纸页。
 */
export default function SemiLogin({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations('semi');
  const serverText = useServerText();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('phone');
  const [error, setError] = useState<LoginError | null>(null);
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
      setError({ key: 'invalidPhone' });
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
        setError({ key: 'sendFailed', server: data.error });
        return;
      }
      setPhase('code');
      setCountdown(COUNTDOWN_SECONDS);
    } catch (err) {
      setError({ key: 'network', server: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [phoneValid, normalizedPhone]);

  const submit = useCallback(async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError({ key: 'codeLength' });
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
        setError({ key: 'codeInvalid' });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'SEMI_NOT_REGISTERED') {
          setNeedRegister(true);
          return;
        }
        setError({ key: 'loginFailed', server: data.error });
        return;
      }
      const data = await res.json();
      const token: string | undefined = data?.token;
      if (!token) {
        setError({ key: 'noToken' });
        return;
      }
      setSemiJwt(token);
      onSuccess();
    } catch (err) {
      setError({ key: 'network', server: err instanceof Error ? err.message : undefined });
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
    : error && (
      <p className="semi-login__error" id="semi-feedback" role="alert">
        {serverText(error.server, t(`errors.${error.key}`))}
      </p>
    );

  if (phase === 'phone') {
    return (
      <form className="semi-login" onSubmit={(event) => { event.preventDefault(); void sendCode(); }}>
        <div className="semi-login__step">
          <p>{t('phone.step')}</p>
          <h3>{t('phone.title')}</h3>
        </div>
        <label className="semi-login__label" htmlFor="semi-phone">{t('phone.label')}</label>
        <input
          id="semi-phone" type="tel" inputMode="tel" autoComplete="tel"
          value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading}
          placeholder={t('phone.placeholder')} aria-invalid={Boolean(error)}
          aria-describedby={error || needRegister ? 'semi-feedback' : undefined}
          data-login-autofocus
        />
        <button
          type="submit"
          disabled={loading || !phoneValid}
          className="semi-login__primary"
        >
          {loading ? t('phone.sending') : t('phone.send')}
        </button>
        {feedback}
      </form>
    );
  }

  return (
    <form className="semi-login" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="semi-login__step semi-login__step--code">
        <button type="button" className="semi-login__back" onClick={backToPhone}>{t('code.back')}</button>
        <p>{t('code.step')}</p>
        <h3>{t('code.title')}</h3>
        <small>{t('code.sentTo', { phone: maskPhone(normalizedPhone) })}</small>
      </div>
      <PinInput value={code} onChange={setCode} disabled={loading} invalid={Boolean(error)} />
      <button
        type="button"
        onClick={sendCode}
        disabled={countdown > 0 || loading}
        className="semi-login__resend"
      >
        {countdown > 0 ? t('code.resendIn', { seconds: countdown }) : t('code.resend')}
      </button>
      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="semi-login__primary"
      >
        {loading ? t('code.signingIn') : t('code.submit')}
      </button>
      {feedback}
    </form>
  );
}
