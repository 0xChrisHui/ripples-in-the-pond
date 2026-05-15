'use client';

import { useRef } from 'react';

type PinInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  length?: number;
};

export default function PinInput({
  value,
  onChange,
  disabled = false,
  length = 6,
}: PinInputProps) {
  const refs = useRef<HTMLInputElement[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setDigits(nextDigits: string[]) {
    onChange(nextDigits.join('').slice(0, length));
  }

  function focusIndex(index: number) {
    refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            if (el) refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit}
          disabled={disabled}
          aria-label={`验证码第 ${index + 1} 位`}
          onChange={(e) => {
            const inputDigits = e.target.value.replace(/\D/g, '').split('');
            if (inputDigits.length === 0) return;
            const next = [...digits];
            for (let i = 0; i < inputDigits.length && index + i < length; i += 1) {
              next[index + i] = inputDigits[i];
            }
            setDigits(next);
            focusIndex(index + inputDigits.length);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Backspace') return;
            e.preventDefault();
            const next = [...digits];
            if (next[index]) {
              next[index] = '';
              setDigits(next);
              return;
            }
            if (index > 0) {
              next[index - 1] = '';
              setDigits(next);
              focusIndex(index - 1);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            const next = Array.from({ length }, (_, i) => pasted[i] ?? '');
            setDigits(next);
            focusIndex(Math.min(pasted.length, length - 1));
          }}
          className="size-12 rounded-lg border border-white/10 bg-black/40 text-center text-xl text-white outline-none transition-colors focus:border-white/40 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
