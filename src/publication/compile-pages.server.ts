/**
 * Build-only: reads content/pages/<dir>/page.json + body.md, validates, and compiles the public page registry.
 * Publication level decides what is built: `published` (production) or `demo` (demo hosts also carry demo-status pages).
 * Drafts never compile, whatever the level.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { marked } from 'marked';
import type { CompiledPage, PageRecord, PublicationStatus, QuestionAnswer, RouteManifestEntry } from '../contracts/page.ts';
import { canonicalUrl } from '../engines/seo/urls/canonical.ts';
import { normalizePath } from '../engines/seo/urls/normalize-path.ts';

export type PublicationLevel = 'published' | 'demo';
const REQUIRED: Array<keyof PageRecord> = ['id', 'path', 'template', 'audience', 'primaryIntent', 'title', 'description', 'heading', 'summary', 'bodySource', 'primaryAction', 'relatedPageIds', 'entityReferences', 'claimReferences', 'publicationStatus', 'approvalReference', 'indexPolicy'];

export function loadRecords(contentDir: string): Array<{ record: PageRecord; dir: string }> {
  const roots = ['pages', 'capabilities'].map(sub => join(contentDir, sub)).filter(existsSync);
  return roots.flatMap(root => readdirSync(root).filter(name => existsSync(join(root, name, 'page.json'))).map(name => {
    const dir = join(root, name);
    const record = JSON.parse(readFileSync(join(dir, 'page.json'), 'utf8')) as PageRecord;
    for (const key of REQUIRED) if (record[key] === undefined || record[key] === null) throw new Error(`${name}/page.json: missing ${String(key)}`);
    if (normalizePath(record.path) !== record.path) throw new Error(`${record.id}: path "${record.path}" violates the trailing-slash policy`);
    if (record.template === 'capability' && !record.serviceDetail) throw new Error(`${record.id}: a capability page needs serviceDetail (problem, audience, included, deliverables, excluded, evidence, process)`);
    return { record, dir };
  }));
}

function includes(level: PublicationLevel, status: PublicationStatus): boolean {
  return status === 'published' || (level === 'demo' && status === 'demo');
}

export function compilePages(contentDir: string, level: PublicationLevel): { pages: CompiledPage[]; manifest: RouteManifestEntry[]; drafts: string[] } {
  const all = loadRecords(contentDir);
  const ids = new Map(all.map(({ record }) => [record.id, record]));
  const paths = new Set<string>();
  for (const { record } of all) { if (paths.has(record.path)) throw new Error(`duplicate path ${record.path}`); paths.add(record.path); }
  for (const { record } of all) {
    if (record.parentId && !ids.has(record.parentId)) throw new Error(`${record.id}: parent ${record.parentId} does not exist`);
    if (!ids.has(record.primaryAction.pageId)) throw new Error(`${record.id}: primaryAction.pageId ${record.primaryAction.pageId} does not exist`);
    for (const related of record.relatedPageIds) if (!ids.has(related)) throw new Error(`${record.id}: related ${related} does not exist`);
  }
  const live = all.filter(({ record }) => includes(level, record.publicationStatus));
  const liveIds = new Set(live.map(({ record }) => record.id));
  const drafts = all.filter(({ record }) => !liveIds.has(record.id)).map(({ record }) => record.id);
  const pages: CompiledPage[] = live.map(({ record, dir }) => {
    const bodyHtml = marked.parse(readFileSync(join(dir, record.bodySource), 'utf8'), { async: false }) as string;
    const questions: QuestionAnswer[] = record.questionsSource ? JSON.parse(readFileSync(join(dir, record.questionsSource), 'utf8')) : [];
    for (const q of questions) if (!q.id || !q.question || !q.answer) throw new Error(`${record.id}: every question needs id, question and answer`);
    const breadcrumbs: Array<{ name: string; path: string }> = [];
    for (let cursor: PageRecord | undefined = record; cursor; cursor = cursor.parentId ? ids.get(cursor.parentId) : undefined) breadcrumbs.unshift({ name: cursor.heading, path: cursor.path });
    const related = record.relatedPageIds.filter(id => liveIds.has(id)).map(id => { const r = ids.get(id)!; return { id, path: r.path, title: r.heading }; });
    const target = ids.get(record.primaryAction.pageId)!;
    const href = record.primaryAction.project ? `${target.path}?project=${encodeURIComponent(record.primaryAction.project)}&from=${encodeURIComponent(record.id)}` : target.path;
    return { ...record, bodyHtml, questions, canonical: canonicalUrl(record.path), breadcrumbs, related, action: { label: record.primaryAction.label, href } };
  });
  const manifest: RouteManifestEntry[] = pages.map(p => ({ id: p.id, path: p.path, template: p.template, publicationStatus: p.publicationStatus, indexPolicy: p.indexPolicy, ...(p.sceneId ? { sceneId: p.sceneId } : {}) }));
  return { pages, manifest, drafts };
}

export const CONTENT_DIR = resolve(import.meta.dirname ?? '.', '../../content');
