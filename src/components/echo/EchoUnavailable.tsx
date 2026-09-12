import Link from 'next/link';

export default function EchoUnavailable({ message }: { message: string }) {
  return (
    <main className="echo-unavailable" data-p11-theme="echo">
      <p>PERMANENT ARCHIVE · TEMPORARILY UNAVAILABLE</p>
      <h1>这圈回声暂时没有抵达。</h1>
      <p>{message}</p>
      <div><Link href="/">返回池塘</Link><Link href="/me">查看我的档案</Link></div>
    </main>
  );
}
