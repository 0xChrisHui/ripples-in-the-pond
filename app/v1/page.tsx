import V1Experience from './V1Experience';

type Props = { searchParams: Promise<{ perf?: string | string[] }> };

/** `/v1` 是旧 SVG 首页的稳定存档入口，诊断 HUD 只在显式请求时加载。 */
export default async function V1Page({ searchParams }: Props) {
  const perf = (await searchParams).perf;
  const showPerf = Array.isArray(perf) ? perf.includes('1') : perf === '1';
  return <V1Experience showPerf={showPerf} />;
}
