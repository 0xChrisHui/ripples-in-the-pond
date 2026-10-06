import PondRouteLink from '../pond-shell/PondRouteLink';

export default function EchoUnavailable({ message }: { message: string }) {
  return (
    <main className="echo-unavailable" data-p11-theme="echo">
      <p>PERMANENT ARCHIVE · TEMPORARILY UNAVAILABLE</p>
      <h1>这圈回声暂时没有抵达。</h1>
      <p>{message}</p>
      <div><PondRouteLink href="/">返回池塘</PondRouteLink><PondRouteLink href="/me">查看我的档案</PondRouteLink></div>
    </main>
  );
}
