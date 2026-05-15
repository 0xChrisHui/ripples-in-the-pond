import LoadingSpinner from '@/src/components/common/LoadingSpinner';

export default function MeLoading() {
  return (
    <main className="min-h-screen bg-black px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-5 w-24 rounded bg-white/10" />
          <div className="h-3 w-12 rounded bg-white/10" />
        </div>

        <section>
          <div className="mb-4 flex items-center gap-3">
            <LoadingSpinner />
            <div className="h-4 w-24 rounded bg-white/10" />
          </div>
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-4 w-4 rounded-full bg-white/10" />
                  <div className="h-6 w-24 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
