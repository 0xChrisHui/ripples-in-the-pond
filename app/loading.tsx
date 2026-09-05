export default function HomeLoading() {
  return (
    <main
      className="grid min-h-svh place-items-center overflow-hidden bg-black px-6 text-center text-white"
      aria-busy="true"
    >
      <section className="grid max-w-lg justify-items-center gap-5" role="status">
        <p className="font-mono text-xs tracking-[.28em] text-white/55">RIPPLES IN THE POND</p>
        <h1 className="text-4xl font-light tracking-[-.04em] sm:text-6xl">声音正在汇入水塘</h1>
        <p className="max-w-sm text-sm leading-7 text-white/60">
          正在准备音乐与共同演奏入口，页面就绪后会自然显现。
        </p>
        <span className="mt-4 h-px w-32 animate-pulse bg-white/35" aria-hidden="true" />
      </section>
    </main>
  );
}
