import { type RouteConfig, index, route } from '@react-router/dev/routes';
import manifest from '../src/generated/route-manifest.json';

const MODULES: Record<string, string> = {
  home: 'routes/home.tsx', audience: 'routes/audience.tsx', capabilities: 'routes/capabilities.tsx', capability: 'routes/capability.tsx',
  company: 'routes/company.tsx', contact: 'routes/contact.tsx', 'contact-received': 'routes/contact-received.tsx', policy: 'routes/policy.tsx',
};

/** Routes come from the generated registry: one entry per compiled page, then the catch-all 404. */
export default [
  ...manifest.routes.map(entry => {
    const file = MODULES[entry.template];
    if (!file) throw new Error(`no route module for template ${entry.template}`);
    return entry.path === '/' ? index(file, { id: entry.id }) : route(entry.path.slice(1), file, { id: entry.id });
  }),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
