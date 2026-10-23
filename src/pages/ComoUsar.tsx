import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ExternalLink, Search, SearchX, X } from 'lucide-react'
import { MANUAL, type ManualItem } from '../lib/manual'
import { normalizeText } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Card, EmptyState, PageHeader } from '../components/ui/Misc'

function matches(item: ManualItem, sectionTitle: string, terms: string[]) {
  const haystack = normalizeText([sectionTitle, item.q, ...item.a, item.tags ?? ''].join(' '))
  return terms.every((t) => haystack.includes(t))
}

function Answer({ item }: { item: ManualItem }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-neutral-600">
      {item.a.map((line, i) => {
        const step = line.match(/^(\d+)\.\s+(.*)$/)
        return step ? (
          <div key={i} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11px] font-bold text-white">{step[1]}</span>
            <p>{step[2]}</p>
          </div>
        ) : (
          <p key={i}>{line}</p>
        )
      })}
      {item.to && (
        <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => navigate(item.to!)} className="mt-1">
          Abrir esta tela
        </Button>
      )}
    </div>
  )
}

export default function ComoUsar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const terms = useMemo(() => normalizeText(query).split(/\s+/).filter(Boolean), [query])
  const searching = terms.length > 0

  const sections = useMemo(
    () =>
      MANUAL.map((s) => ({ ...s, items: searching ? s.items.filter((i) => matches(i, s.title, terms)) : s.items })).filter(
        (s) => s.items.length > 0,
      ),
    [terms, searching],
  )
  const total = sections.reduce((a, s) => a + s.items.length, 0)

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <PageHeader title="Como usar" subtitle="Manual do sistema — pesquise sua dúvida" />

      <div className="sticky top-[60px] z-20 -mx-4 mb-4 bg-neutral-100/95 px-4 py-2 backdrop-blur md:top-0 md:mx-0 md:px-0">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
          <Input
            type="search"
            placeholder="Ex.: gerar mensalidade, check-in, cobrar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            aria-label="Pesquisar dúvida"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar pesquisa"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {searching && (
          <p className="mt-1.5 text-xs text-neutral-500">
            {total ? `${total} resultado${total > 1 ? 's' : ''} para “${query.trim()}”` : `Nenhum resultado para “${query.trim()}”`}
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX size={40} />}
            title="Nada encontrado"
            description="Tente outras palavras, como “pagamento”, “WhatsApp”, “evento” ou “turma”."
            action={
              <Button variant="secondary" onClick={() => setQuery('')}>
                Ver o manual completo
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.id}>
              <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-neutral-800">{s.title}</h2>
              <Card className="divide-y divide-neutral-100 overflow-hidden">
                {s.items.map((item) => {
                  // durante a busca, os resultados já aparecem abertos
                  const isOpen = searching || open.has(item.id)
                  return (
                    <div key={item.id}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => !searching && toggle(item.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${searching ? 'cursor-default' : 'hover:bg-neutral-50'}`}
                      >
                        <span className={`flex-1 text-sm font-semibold ${isOpen ? 'text-brand-800' : 'text-neutral-800'}`}>{item.q}</span>
                        {!searching && <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                      </button>
                      {isOpen && <Answer item={item} />}
                    </div>
                  )
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
