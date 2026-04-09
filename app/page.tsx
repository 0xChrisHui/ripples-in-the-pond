import Archipelago from '@/src/components/archipelago/Archipelago';
import LoginButton from '@/src/components/auth/LoginButton';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-12 bg-black">
      <div className="absolute right-6 top-6">
        <LoginButton />
      </div>

      <h1 className="text-lg font-light tracking-[0.3em] text-white/80">
        Ripples in the Pond
      </h1>

      <Archipelago />

      <p className="text-sm text-white/40">点击岛屿，聆听音乐</p>
    </main>
  );
}
