import Island from '@/src/components/archipelago/Island';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black">
      <Island />
      <h1 className="text-sm font-light tracking-widest text-white">
        Ripples in the Pond
      </h1>
    </main>
  );
}
