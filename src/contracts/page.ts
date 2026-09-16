/** One public page = one record. Everything the site publishes about a page derives from this. */
export type PublicationStatus = 'draft' | 'demo' | 'published';
export type Template = 'home' | 'audience' | 'capabilities' | 'capability' | 'company' | 'contact' | 'contact-received' | 'policy';
export type IndexPolicy = 'index' | 'noindex';

export interface PageRecord {
  id: string;
  path: string;
  template: Template;
  parentId: string | null;
  audience: string[];
  primaryIntent: string;
  title: string;
  description: string;
  heading: string;
  summary: string;
  bodySource: string;
  serviceId?: string;
  sceneId?: string;
  primaryAction: { label: string; pageId: string; project?: string };
  relatedPageIds: string[];
  entityReferences: string[];
  claimReferences: string[];
  publicationStatus: PublicationStatus;
  approvalReference: string;
  publishedAt?: string;
  materiallyUpdatedAt?: string;
  indexPolicy: IndexPolicy;
  socialImageId?: string;
  /** Optional in-page sections rendered as anchors (rooms link their objects to these). */
  sections?: Array<{ id: string; heading: string; body: string }>;
}

export interface CompiledPage extends PageRecord {
  bodyHtml: string;
  canonical: string;
  breadcrumbs: Array<{ name: string; path: string }>;
  related: Array<{ id: string; path: string; title: string }>;
  action: { label: string; href: string };
}

export interface RouteManifestEntry { id: string; path: string; template: Template; publicationStatus: PublicationStatus; indexPolicy: IndexPolicy; sceneId?: string }
