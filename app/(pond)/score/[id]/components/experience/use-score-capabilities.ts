import { useEffect, useState } from 'react';

export function useScoreCapabilities() {
  const [value, setValue] = useState({ fine: false, reduced: false });
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setValue({ fine: fine.matches, reduced: reduced.matches });
    sync();
    fine.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    return () => {
      fine.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);
  return value;
}
