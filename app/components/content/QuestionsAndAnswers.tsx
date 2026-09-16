import type { CompiledPage } from '../../../src/contracts/page';

/** Visible Q&A from questions.json — the same text the structured data carries; nothing crawler-only. */
export function QuestionsAndAnswers({ page }: { page: CompiledPage }) {
  if (!page.questions.length) return null;
  return (
    <section id="questions" aria-labelledby="questions-h" className="qa">
      <h2 id="questions-h">Questions buyers ask</h2>
      {page.questions.map(q => (
        <details key={q.id} id={`q-${q.id}`} open>
          <summary><h3>{q.question}</h3></summary>
          <p>{q.answer}</p>
        </details>
      ))}
    </section>
  );
}
