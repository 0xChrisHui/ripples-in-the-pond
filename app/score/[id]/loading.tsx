import LoadingSpinner from '@/src/components/common/LoadingSpinner';

export default function ScoreLoading() {
  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 h-3 w-32 rounded bg-white/10" />

        <div className="mb-6 text-center">
          <div className="mx-auto mb-6 flex h-[280px] w-[280px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <LoadingSpinner className="h-6 w-6" />
          </div>
          <div className="mx-auto h-6 w-36 rounded bg-white/10" />
          <div className="mx-auto mt-2 h-4 w-28 rounded bg-white/10" />
        </div>

        <div className="flex h-[360px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-white/15 bg-white/[0.03]">
          <div className="h-16 w-16 rounded-full border border-white/20 bg-white/5" />
          <div className="h-4 w-36 rounded bg-white/10" />
        </div>

        <section className="mt-8 space-y-3 border-t border-white/10 pt-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-16 rounded bg-white/10" />
              <div className="h-3 w-24 rounded bg-white/10" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
