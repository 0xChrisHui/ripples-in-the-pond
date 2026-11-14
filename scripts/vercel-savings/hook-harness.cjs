// 执行真实Hook；仅替换React调度和浏览器/钱包I/O边界。
exports.hooks = () => {
  let cursor = 0; const slots = [], effects = [], cleanups = [];
  return {
    react: {
      useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
      useState(value) { const index = cursor++; slots[index] ??= typeof value === 'function' ? value() : value;
        return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
      useCallback(value) { cursor++; return value; },
      useSyncExternalStore(_, get) { return get(); },
      useEffect(fn, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => value !== previous[i])) {
          effects.push(() => { cleanups[index]?.(); cleanups[index] = fn(); }); slots[index] = deps;
        }
      },
    },
    render(work) { cursor = 0; const value = work(); while (effects.length) effects.shift()(); return value; },
    unmount() { cleanups.forEach(stop => stop?.()); },
  };
};
