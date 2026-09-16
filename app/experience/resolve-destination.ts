import type { HotspotTarget } from '../../src/contracts/scene';
import { pagesById } from '../../src/generated';

/** Page ids resolve through the registry; anchors stay on the current page. A hotspot whose page is a draft resolves to null and is not rendered. */
export function resolveDestination(target: HotspotTarget, fromPageId: string): string | null {
  if (target.kind === 'anchor') { if (target.pageId && target.pageId !== fromPageId) { const page = pagesById[target.pageId]; return page ? `${page.path}#${target.anchor}` : null; } return `#${target.anchor}`; }
  const page = pagesById[target.pageId];
  if (!page) return null;
  return target.project ? `${page.path}?project=${encodeURIComponent(target.project)}&from=${encodeURIComponent(fromPageId)}` : page.path;
}
