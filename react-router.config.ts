import type { Config } from '@react-router/dev/config';
import manifest from './src/generated/route-manifest.json';

/** Build-time HTML for every registered page plus the 404 document; no request-time rendering, no SPA fallback. */
export default {
  appDirectory: 'app',
  ssr: false,
  prerender: [...manifest.routes.map(route => route.path), '/404'],
} satisfies Config;
