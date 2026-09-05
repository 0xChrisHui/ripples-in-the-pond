'use client';

import { useRef } from 'react';

type PinInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
};

export default function PinInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
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
    <div className="pin-input" role="group" aria-label="六位验证码">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            if (el) refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoFocus={index === 0}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={digit}
          disabled={disabled}
          aria-label={`验证码第 ${index + 1} 位`}
          aria-invalid={invalid}
          onFocus={(event) => event.currentTarget.select()}
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
        />
      ))}
    </div>
  );
}
