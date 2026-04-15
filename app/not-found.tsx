import Link from "next/link";

/** 404 页面 — 黑底白字，和项目整体风格一致 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="mt-4 text-lg text-gray-400">页面不存在</p>
      <Link
        href="/"
        className="mt-8 rounded-full border border-white/20 px-6 py-2 text-sm transition-colors hover:bg-white/10"
      >
        回到首页
      </Link>
    </div>
  );
}
