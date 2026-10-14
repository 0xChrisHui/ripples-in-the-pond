'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function EchoRecipe({ recipe, currentIndex }: {
  recipe: string;
  currentIndex: number | null;
}) {
  const t = useTranslations('echo.recipe');
  const [copied, setCopied] = useState(false);
  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(recipe);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="echo-recipe" aria-labelledby="echo-recipe-title">
      <header>
        <div>
          <p>36-PART RECIPE</p>
          <h2 id="echo-recipe-title">{t('title')}</h2>
        </div>
        <button type="button" onClick={copyRecipe}>{copied ? t('copied') : t('copy')}</button>
      </header>
      <ol aria-label={t('order')}>
        {[...recipe].map((key, index) => (
          <li key={index} aria-current={currentIndex === index ? 'step' : undefined}
            data-current={currentIndex === index}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{key}</strong>
            {currentIndex === index && <em>{t('playing')}</em>}
          </li>
        ))}
      </ol>
      <code>{recipe}</code>
      <p className="p11-visually-hidden" aria-live="polite">{copied ? t('copiedFull') : ''}</p>
    </section>
  );
}
