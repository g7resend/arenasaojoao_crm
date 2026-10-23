import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, PartyPopper, Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateLong, formatTime, todayISO } from '../lib/format'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { EventFormModal } from '../components/events/EventFormModal'
import { CapacityBar } from '../components/events/CapacityBar'
import type { ArenaEvent, EventParticipant } from '../types/db'

type View = 'proximos' | 'anteriores'

export default function Eventos() {
  const toast = useToast()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('proximos')
  const [events, setEvents] = useState<ArenaEvent[]>([])
  const [participants, setParticipants] = useState<Pick<EventParticipant, 'event_id' | 'amount_paid'>[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    const today = todayISO()
    let q = supabase.from('events').select('*')
    q = view === 'proximos' ? q.gte('event_date', today).order('event_date') : q.lt('event_date', today).order('event_date', { ascending: false })
    const { data, error } = await q
    if (error) toast('Erro ao carregar eventos.', 'error')
    const list = (data as ArenaEvent[]) ?? []
    setEvents(list)
    if (list.length) {
      const { data: parts } = await supabase.from('event_participants').select('event_id, amount_paid').in('event_id', list.map((e) => e.id))
      setParticipants((parts as typeof participants) ?? [])
    } else setParticipants([])
    setLoading(false)
  }, [view, toast])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const p of participants) {
      const s = map.get(p.event_id) ?? { count: 0, total: 0 }
      s.count++
      s.total += Number(p.amount_paid)
      map.set(p.event_id, s)
    }
    return map
  }, [participants])

  return (
    <>
      <PageHeader
        title="Eventos"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            Novo evento
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'proximos', label: 'Próximos' },
            { value: 'anteriores', label: 'Anteriores' },
          ]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <Card>
          <EmptyState icon={<PartyPopper size={40} />} title={view === 'proximos' ? 'Nenhum evento agendado' : 'Nenhum evento anterior'} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((ev) => {
            const s = stats.get(ev.id) ?? { count: 0, total: 0 }
            return (
              <Link key={ev.id} to={`/eventos/${ev.id}`} className="block">
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  <div className="border-b-2 border-brand-800 bg-neutral-950 px-4 py-3">
                    <h2 className="truncate font-display text-lg font-bold uppercase tracking-wide text-white">{ev.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-300">
                      <CalendarDays size={14} />
                      {formatDateLong(ev.event_date)}
                      {ev.start_time && ` · ${formatTime(ev.start_time)}`}
                    </p>
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    {ev.location && (
                      <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin size={14} /> {ev.location}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-neutral-700">
                        <Users size={15} /> {s.count}
                        {ev.capacity ? ` / ${ev.capacity}` : ''} pagantes
                      </span>
                      <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(s.total)}</span>
                    </div>
                    {ev.capacity && <CapacityBar value={s.count} max={ev.capacity} />}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <EventFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(id) => navigate(`/eventos/${id}`)} />
    </>
  )
}
