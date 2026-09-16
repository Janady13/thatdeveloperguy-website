import type { CompiledPage } from '../../../src/contracts/page';
/** The page body (compiled markdown) followed by the anchored sections room objects link to. */
export function ContentSections({ page }: { page: CompiledPage }) {
  return (
    <div className="page-body">
      <div className="page-prose" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      {page.sections?.length ? (
        <div className="page-sections">
          {page.sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="page-section"><h2 id={`${section.id}-heading`}>{section.heading}</h2><p>{section.body}</p></section>)}
        </div>
      ) : null}
    </div>
  );
}
