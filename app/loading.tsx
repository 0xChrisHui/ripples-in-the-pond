import { POND_NIGHT_BACKGROUND } from '@/src/components/pond-gl-test3/presentation/pond-night';
import T from '@/src/i18n/T';

/** 路由兜底：只铺夜塘底色，不出任何文字；与 SceneCover 同色，交接无跳变。 */
export default function HomeLoading() {
  return (
    <main
      className="fixed inset-0 z-[25] overflow-hidden"
      style={{ background: POND_NIGHT_BACKGROUND }}
      aria-busy="true"
    >
      <p role="status" className="sr-only"><T k="common.loadingPage" /></p>
    </main>
  );
}
