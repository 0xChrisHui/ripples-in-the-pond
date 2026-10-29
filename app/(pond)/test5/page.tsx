import { notFound } from 'next/navigation';

/** /test5：池塘气泡与手记的调参实验页。画面由持久外壳渲染（与首页完全一致），本页只是路由标记；生产构建不开放。 */
export default function Test5Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <div data-pond-home-route="true" aria-hidden="true" />;
}
