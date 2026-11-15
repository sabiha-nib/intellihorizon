import { Link, createFileRoute } from "@tanstack/react-router";

import { BookStatus, EmptyState, bookLabel, card } from "../components/app/kit";
import { PaperPage } from "../components/edu/ui";
import { getBook } from "../lib/api/learning.functions";
import { useLearner } from "../lib/store";

export const Route = createFileRoute("/books/$bookId")({
  loader: ({ params }) => getBook({ data: { id: params.bookId } }),
  head: () => ({ meta: [{ title: "Textbook | IntelliHorizon" }] }),
  component: Book,
});

function Book() {
  const data = Route.useLoaderData();
  const { tx, t, lang } = useLearner();
  if (!data.ok) return <PaperPage><main className="mx-auto max-w-3xl px-4 pt-6"><EmptyState title={tx("Textbook not found", "বইটি পাওয়া যায়নি")} body={tx("It may have been removed.", "হয়তো সরিয়ে ফেলা হয়েছে।")} action={<Link to="/learn" className="font-semibold underline decoration-dashed underline-offset-4">{tx("Back to Learn", "শেখো-তে ফিরে যাও")}</Link>} /></main></PaperPage>;
  const { book, chapters } = data;
  const ready = book.status === "indexed";
  return (
    <PaperPage>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-6 md:px-6">
        <Link to="/learn" className="text-sm text-ink-mid hover:text-ink">{tx("All textbooks", "সব পাঠ্যবই")}</Link>
        <header className={`${card} space-y-3 p-6`}>
          <p className="text-sm font-semibold text-ink-mid">{bookLabel(book, t, lang)} · {tx(`Class ${book.grade}`, `${book.grade} শ্রেণি`)} · {book.medium === "bangla" ? tx("Bangla medium", "বাংলা মাধ্যম") : tx("English version", "ইংলিশ ভার্সন")}</p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight" lang={book.language}>{book.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-mid">
            <BookStatus status={book.status} />
            <span>{book.publisher}</span>
            {book.edition && <span>· {book.edition}</span>}
            {book.page_count && <span>· {tx(`${book.page_count} PDF pages`, `${book.page_count} পিডিএফ পৃষ্ঠা`)}</span>}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            {ready && <Link to="/tutor" search={{ book: book.id }} className="inline-flex h-11 items-center rounded-[14px] bg-brand px-5 font-semibold text-sheet">{tx("Ask the tutor about this book", "এই বই নিয়ে টিউটরকে প্রশ্ন করো")}</Link>}
            {book.official_url && <a href={book.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-[14px] border border-ink-low/35 px-5 font-semibold">{tx("Official book on nctb.gov.bd", "nctb.gov.bd-তে মূল বই")}</a>}
          </div>
          {!ready && <p className="text-sm text-ink-mid">{book.status === "needs_review" ? tx("This book's text is being checked before the tutor uses it.", "টিউটর ব্যবহারের আগে এই বইয়ের লেখা যাচাই করা হচ্ছে।") : tx("This book's text hasn't been added yet, so the tutor can't search it.", "এই বইয়ের লেখা এখনো যোগ হয়নি, তাই টিউটর এতে খুঁজতে পারে না।")}</p>}
        </header>
        <section aria-labelledby="ch-h">
          <h2 id="ch-h" className="font-display text-xl font-bold">{tx("Chapters", "অধ্যায়")}</h2>
          {chapters.length === 0 ? (
            <p className="mt-3 text-ink-mid">{tx("The chapter list for this book hasn't been entered yet.", "এই বইয়ের অধ্যায়ের তালিকা এখনো যোগ হয়নি।")}</p>
          ) : (
            <ol className={`${card} mt-3 divide-y divide-ink-low/15`}>
              {chapters.map((c) => (
                <li key={c.id}>
                  <Link to="/chapters/$chapterId" params={{ chapterId: c.id }} className="flex items-center gap-4 px-5 py-4 hover:bg-paper/60">
                    <span className="font-display w-8 shrink-0 text-lg font-bold tabular-nums text-ink-low">{c.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold" lang={book.language}>{c.title}</span>
                      <span className="block text-xs text-ink-mid">
                        {c.start_page && c.end_page ? tx(`PDF pages ${c.start_page} to ${c.end_page}`, `পিডিএফ পৃষ্ঠা ${c.start_page} থেকে ${c.end_page}`) : ""}
                        {c.objectives > 0 ? tx(` · ${c.objectives} learning outcomes`, ` · ${c.objectives}টি শিখনফল`) : ""}
                        {c.questions > 0 ? tx(` · ${c.questions} practice questions`, ` · ${c.questions}টি প্রশ্ন`) : ""}
                      </span>
                    </span>
                    {c.mine && <span className="shrink-0 text-right text-xs text-ink-mid">{tx(`${c.mine.correct} of ${c.mine.attempts} right`, `${c.mine.attempts}টির ${c.mine.correct}টি সঠিক`)}</span>}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </PaperPage>
  );
}
