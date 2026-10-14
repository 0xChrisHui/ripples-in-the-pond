import { getRequestConfig } from 'next-intl/server';
import zh from './messages/zh.json';
import { TIME_ZONE } from './locale';

// P19 方案 C：服务端固定中文，不读 cookie / headers，页面保持静态预渲染；英文只在浏览器端切换
export default getRequestConfig(async () => ({
  locale: 'zh',
  messages: zh,
  timeZone: TIME_ZONE,
}));
