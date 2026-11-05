import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, DoorOpen, LogOut, Search, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateLong, formatTime, normalizeText } from '../lib/format'
import { sortByName } from '../lib/export'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Card, EmptyState, Spinner, Tabs } from '../components/ui/Misc'
import { Logo } from '../components/ui/Logo'
import { GateSaleModal } from '../components/events/GateSaleModal'
import type { GateEvent, GateParticipant } from '../types/db'

type Filter = 'todos' | 'faltam' | 'entraram'

// com mais de uma pessoa na entrada, a lista se atualiza sozinha
const REFRESH_MS = 15000

/** Única tela de quem tem login de portaria */
export default function Portaria() {
  const { signOut } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState<GateEvent[] | null>(null)
  const [selected, setSelected] = useState<GateEvent | null>(null)

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase.rpc('gate_events')
    if (error) toast('Erro ao carregar os eventos.', 'error')
    const list = (data as GateEvent[]) ?? []
    setEvents(list)
    setSelected(list.length === 1 ? list[0] : null)
  }, [toast])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-brand-800 bg-neutral-950 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <p className="font-display text-base font-bold uppercase tracking-wide text-white">Portaria</p>
        </div>
        <button onClick={signOut} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-neutral-300 hover:bg-white/10 hover:text-white">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-10 pt-5">
        {events === null ? (
          <Spinner />
        ) : selected ? (
          <GateList event={selected} onBack={events.length > 1 ? () => setSelected(null) : undefined} onLostAccess={loadEvents} />
        ) : events.length === 0 ? (
          <Card>
            <EmptyState icon={<DoorOpen size={40} />} title="Nenhum evento liberado" description="Peça para o administrador liberar o evento para o seu login." />
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <button key={e.id} onClick={() => setSelected(e)} className="block w-full text-left">
                <Card className="px-4 py-3">
                  <p className="font-display text-lg font-bold uppercase tracking-wide text-neutral-900">{e.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
                    <CalendarDays size={14} /> {formatDateLong(e.event_date)}
                    {e.start_time && ` · ${formatTime(e.start_time)}`}
                  </p>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function GateList({ event, onBack, onLostAccess }: { event: GateEvent; onBack?: () => void; onLostAccess: () => void }) {
  const toast = useToast()
  const [people, setPeople] = useState<GateParticipant[] | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('faltam')
  const [selling, setSelling] = useState(false)
  const saving = useRef(0)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('gate_participants', { p_event: event.id })
    // não sobrescreve uma marcação que ainda está sendo salva
    if (saving.current > 0) return
    if (error) {
      if (error.message.includes('sem_permissao')) onLostAccess()
      else toast('Sem conexão. Tentando de novo…', 'error')
      return
    }
    setPeople(data as GateParticipant[])
  }, [event.id, onLostAccess, toast])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const list = people ?? []
  const entered = list.filter((p) => p.checked_in).length
  const visible = useMemo(() => {
    const q = normalizeText(search)
    return sortByName(people ?? []).filter((p) => {
      // buscando, mostra todo mundo: dá para ver quem já entrou
      if (q) return normalizeText(p.name).includes(q)
      if (filter === 'entraram') return p.checked_in
      if (filter === 'faltam') return !p.checked_in
      return true
    })
  }, [people, search, filter])

  async function toggle(p: GateParticipant) {
    const checked_in = !p.checked_in
    setPeople((l) => l && l.map((x) => (x.id === p.id ? { ...x, checked_in } : x)))
    saving.current++
    const { error } = await supabase.rpc('gate_set_check_in', { p_participant: p.id, p_checked: checked_in })
    saving.current--
    if (error) {
      setPeople((l) => l && l.map((x) => (x.id === p.id ? p : x)))
      toast('Não foi possível salvar. Tente de novo.', 'error')
      return
    }
    if (checked_in) setSearch('')
  }

  if (!people) return <Spinner />

  return (
    <>
      {onBack && (
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800">
          <ArrowLeft size={16} /> Eventos
        </button>
      )}
      <h1 className="font-display text-xl font-bold uppercase tracking-wide text-neutral-900">{event.name}</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Entraram <strong className="tabular-nums text-neutral-900">{entered}</strong> de <span className="tabular-nums">{list.length}</span>
      </p>

      <div className="mb-3">
        <Button full icon={<ShoppingCart size={16} />} onClick={() => setSelling(true)}>
          Registrar venda
        </Button>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
        <Input placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="mb-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'faltam', label: 'Não entraram', count: list.length - entered },
            { value: 'entraram', label: 'Entraram', count: entered },
            { value: 'todos', label: 'Todos', count: list.length },
          ]}
        />
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState
            icon={<Search size={40} />}
            title={search ? 'Nome não está na lista' : 'Ninguém aqui'}
            action={
              search ? (
                <Button icon={<ShoppingCart size={16} />} onClick={() => setSelling(true)}>
                  Registrar venda
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={p.checked_in}
                  onClick={() => toggle(p)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left ${p.checked_in ? 'bg-emerald-50/50' : ''}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${
                      p.checked_in ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    <Check size={22} strokeWidth={3} />
                  </span>
                  <span className={`min-w-0 flex-1 break-words font-medium ${p.checked_in ? 'text-emerald-800' : 'text-neutral-900'}`}>{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <GateSaleModal
        open={selling}
        eventId={event.id}
        initialName={search}
        takenNames={list.map((p) => p.name)}
        onClose={() => setSelling(false)}
        onSaved={async () => {
          await load()
          setSearch('')
          setSelling(false)
        }}
      />
    </>
  )
}
