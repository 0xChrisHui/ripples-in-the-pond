'use client';

import { useState } from 'react';

export default function EchoRecipe({ recipe, currentIndex }: {
  recipe: string;
  currentIndex: number | null;
}) {
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
          <h2 id="echo-recipe-title">声音航图</h2>
        </div>
        <button type="button" onClick={copyRecipe}>{copied ? '已复制' : '复制配方'}</button>
      </header>
      <ol aria-label="36 段声音播放顺序">
        {[...recipe].map((key, index) => (
          <li key={index} aria-current={currentIndex === index ? 'step' : undefined}
            data-current={currentIndex === index}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{key}</strong>
            {currentIndex === index && <em>正在播放</em>}
          </li>
        ))}
      </ol>
      <code>{recipe}</code>
      <p className="p11-visually-hidden" aria-live="polite">{copied ? '完整 36 位配方已复制' : ''}</p>
    </section>
  );
}
