import LoadingSpinner from '@/src/components/common/LoadingSpinner';

export default function ArtistLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-16 text-white">
      <div className="mb-4 flex items-center gap-3 text-white/40">
        <LoadingSpinner />
        <span className="text-xs tracking-[0.2em]">正在读取项目进度</span>
      </div>

      <div className="mb-12 h-4 w-44 rounded bg-white/10" />
      <div className="mb-12 w-full max-w-md">
        <div className="mb-2 flex justify-between">
          <div className="h-3 w-20 rounded bg-white/10" />
          <div className="h-3 w-10 rounded bg-white/10" />
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" />
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="h-7 w-16 rounded bg-white/10" />
            <div className="mt-2 h-3 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
