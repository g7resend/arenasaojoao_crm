import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Clock, MessageCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PAYMENT_METHODS, addDays, formatCurrency, formatDate, formatDateLong, formatDayLabel, formatPhone, formatTime, startOfWeek, todayISO } from '../lib/format'
import { openWhatsApp } from '../lib/whatsapp'
import { useToast } from '../hooks/useToast'
import { useSettings } from '../hooks/useSettings'
import { Button, IconButton } from '../components/ui/Button'
import { Badge, Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { Dropdown } from '../components/ui/Dropdown'
import { PayMethodModal } from '../components/ui/PayMethodModal'
import { BookingFormModal } from '../components/court/BookingFormModal'
import type { CourtBooking, PaymentMethod } from '../types/db'

type View = 'dia' | 'semana'

function durationLabel(start: string, end: string) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const min = toMin(end) - toMin(start)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h && m ? `${h}h${String(m).padStart(2, '0')}` : h ? `${h}h` : `${m}min`
}

export default function Quadra() {
  const toast = useToast()
  const { settings } = useSettings()
  const [view, setView] = useState<View>('dia')
  const [date, setDate] = useState(todayISO)
  const [bookings, setBookings] = useState<CourtBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CourtBooking | null>(null)
  const [paying, setPaying] = useState<CourtBooking | null>(null)

  const range = useMemo(() => {
    if (view === 'dia') return { from: date, to: date }
    const from = startOfWeek(date)
    return { from, to: addDays(from, 6) }
  }, [view, date])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('court_bookings')
      .select('*')
      .gte('booking_date', range.from)
      .lte('booking_date', range.to)
      .order('booking_date')
      .order('start_time')
    if (error) toast('Erro ao carregar reservas.', 'error')
    setBookings((data as CourtBooking[]) ?? [])
    setLoading(false)
  }, [range, toast])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const days = useMemo(() => {
    const list: string[] = []
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) list.push(d)
    return list.map((d) => ({ date: d, items: bookings.filter((b) => b.booking_date === d) }))
  }, [range, bookings])

  const total = bookings.reduce((a, b) => a + Number(b.price), 0)
  const received = bookings.filter((b) => b.paid).reduce((a, b) => a + Number(b.price), 0)

  async function update(b: CourtBooking, patch: Partial<CourtBooking>, msg: string) {
    const { error } = await supabase.from('court_bookings').update(patch).eq('id', b.id)
    if (error) return toast('Erro ao atualizar reserva.', 'error')
    toast(msg)
    load()
  }

  async function remove(b: CourtBooking) {
    if (!confirm(`Excluir a reserva de ${b.responsible_name} em ${formatDate(b.booking_date)}, ${formatTime(b.start_time)}–${formatTime(b.end_time)}?`)) return
    const { error } = await supabase.from('court_bookings').delete().eq('id', b.id)
    if (error) return toast('Erro ao excluir reserva.', 'error')
    toast('Reserva excluída.')
    load()
  }

  function message(b: CourtBooking) {
    if (!b.phone) return toast('Sem telefone cadastrado nesta reserva.', 'error')
    const text = `Olá, ${b.responsible_name.split(' ')[0]}! Sua reserva da quadra na *${settings?.arena_name ?? 'Arena São João'}* está confirmada:\n📅 *${formatDateLong(b.booking_date)}*\n⏰ *${formatTime(b.start_time)} às ${formatTime(b.end_time)}*\n💰 ${formatCurrency(b.price)}`
    openWhatsApp(b.phone, text)
  }

  async function confirmPaid(method: PaymentMethod) {
    if (!paying) return
    await update(paying, { paid: true, payment_method: method }, 'Pagamento registrado!')
    setPaying(null)
  }

  const shift = (dir: 1 | -1) => setDate((d) => addDays(d, dir * (view === 'dia' ? 1 : 7)))
  const periodLabel = view === 'dia' ? formatDayLabel(date) : `${formatDate(range.from).slice(0, 5)} a ${formatDate(range.to)}`

  function renderBooking(b: CourtBooking) {
    return (
      <li key={b.id} className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-neutral-950 px-2 py-1 text-center text-white">
            <p className="text-sm font-bold tabular-nums leading-tight">{formatTime(b.start_time)}</p>
            <p className="text-[11px] tabular-nums leading-tight text-neutral-400">{formatTime(b.end_time)}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-neutral-900">{b.responsible_name}</p>
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              <Clock size={12} /> {durationLabel(b.start_time, b.end_time)}
              {b.phone && <span className="truncate"> · {formatPhone(b.phone)}</span>}
            </p>
            <div className="mt-1">
              {b.paid ? <Badge color="green">Pago{b.payment_method ? ` · ${PAYMENT_METHODS[b.payment_method]}` : ''}</Badge> : <Badge color="yellow">A pagar</Badge>}
            </div>
            {b.notes && <p className="mt-1 text-xs text-neutral-500">{b.notes}</p>}
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{formatCurrency(b.price)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {!b.paid && (
            <Button size="sm" variant="secondary" icon={<CircleDollarSign size={16} />} onClick={() => setPaying(b)}>
              Pago
            </Button>
          )}
          {b.phone && (
            <Button size="sm" variant="whatsapp" icon={<MessageCircle size={16} />} onClick={() => message(b)}>
              WhatsApp
            </Button>
          )}
          <div className="ml-auto">
            <Dropdown
              items={[
                { label: 'Desfazer pagamento', icon: <RotateCcw size={16} />, onClick: () => update(b, { paid: false, payment_method: null }, 'Pagamento desfeito.'), hidden: !b.paid },
                {
                  label: 'Editar',
                  icon: <Pencil size={16} />,
                  onClick: () => {
                    setEditing(b)
                    setFormOpen(true)
                  },
                },
                { label: 'Excluir', icon: <Trash2 size={16} />, onClick: () => remove(b), danger: true },
              ]}
            />
          </div>
        </div>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title="Aluguel da quadra"
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Nova reserva
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'dia', label: 'Dia' },
            { value: 'semana', label: 'Semana' },
          ]}
        />
        <div className="flex items-center rounded-xl bg-white ring-1 ring-neutral-200">
          <IconButton label={view === 'dia' ? 'Dia anterior' : 'Semana anterior'} onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-44 text-center text-sm font-semibold text-neutral-800">{periodLabel}</span>
          <IconButton label={view === 'dia' ? 'Próximo dia' : 'Próxima semana'} onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        {date !== todayISO() && (
          <Button size="sm" variant="ghost" onClick={() => setDate(todayISO())}>
            Hoje
          </Button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Reservas</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{bookings.length}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(total)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Recebido</p>
          <p className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(received)}</p>
        </Card>
      </div>

      {loading ? (
        <Spinner />
      ) : view === 'dia' ? (
        <Card>
          {bookings.length === 0 ? (
            <EmptyState icon={<CalendarDays size={40} />} title="Quadra livre neste dia" description="Nenhuma reserva cadastrada." />
          ) : (
            <ul className="divide-y divide-neutral-100">{bookings.map(renderBooking)}</ul>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map(({ date: d, items }) => (
            <Card key={d}>
              <button
                type="button"
                onClick={() => {
                  setDate(d)
                  setView('dia')
                }}
                className={`flex w-full items-center justify-between px-4 text-left text-sm font-semibold ${
                  items.length ? 'border-b border-neutral-100 py-2.5 text-neutral-700' : 'py-1.5 text-neutral-400'
                } ${d === todayISO() ? 'text-brand-800' : ''}`}
              >
                {formatDayLabel(d)}
                <span className="text-xs font-normal text-neutral-400">{items.length ? `${items.length} reserva${items.length > 1 ? 's' : ''}` : 'livre'}</span>
              </button>
              {items.length > 0 && <ul className="divide-y divide-neutral-100">{items.map(renderBooking)}</ul>}
            </Card>
          ))}
        </div>
      )}

      <BookingFormModal
        open={formOpen}
        booking={editing}
        defaultDate={date}
        onClose={() => setFormOpen(false)}
        onSaved={(d) => {
          setFormOpen(false)
          if (view === 'dia') setDate(d)
          load()
        }}
      />
      <PayMethodModal
        open={!!paying}
        summary={paying && `${paying.responsible_name} · ${formatTime(paying.start_time)}–${formatTime(paying.end_time)} · ${formatCurrency(paying.price)}`}
        onClose={() => setPaying(null)}
        onConfirm={confirmPaid}
      />
    </>
  )
}
