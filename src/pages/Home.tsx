import { Link } from 'react-router-dom'
import { useDueToday } from '../hooks/useDueToday'
import type { Item } from '../types'
import { isGrammar, isVocabulary, isSentence } from '../types'

function ItemSummary({ item }: { item: Item }) {
  if (isGrammar(item)) return <span className="text-stone-600">{item.title}</span>
  if (isVocabulary(item)) return <span className="text-stone-600">{item.word} — {item.meaning || '(no meaning)'}</span>
  if (isSentence(item)) return <span className="text-stone-600">{item.japaneseText}</span>
  return null
}

export default function Home() {
  const { items: dueToday } = useDueToday()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-800">Japanese for Busy People 2 — Review</h1>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Due today</h2>
        <p className="mb-4 text-stone-600">
          You have <strong>{dueToday.length}</strong> item{dueToday.length !== 1 ? 's' : ''} due today.
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <Link
            to="/add"
            className="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Add
          </Link>
          <Link
            to="/flashcards"
            className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Review now
          </Link>
          <Link
            to="/list"
            className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Browse all
          </Link>
        </div>
        {dueToday.length > 0 ? (
          <ul className="space-y-2">
            {dueToday.slice(0, 20).map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded border border-stone-100 bg-stone-50/50 px-3 py-2">
                <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                  {item.type}
                </span>
                <ItemSummary item={item} />
                <Link to={`/list?highlight=${item.id}`} className="ml-auto text-sm text-rose-600 hover:underline">
                  Open
                </Link>
              </li>
            ))}
            {dueToday.length > 20 && (
              <li className="text-stone-500">… and {dueToday.length - 20} more. Start a session to review.</li>
            )}
          </ul>
        ) : (
          <p className="text-stone-500">Nothing due today. Add items or browse your list.</p>
        )}
      </section>
    </div>
  )
}
