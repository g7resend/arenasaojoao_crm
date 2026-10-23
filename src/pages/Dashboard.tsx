import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, CalendarDays, ChevronRight, PartyPopper, Users, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MONTHS, addDays, currentYearMonth, formatCurrency, formatDateLong, formatDayLabel, formatTime, todayISO } from '../lib/format'
import { useToast } from '../hooks/useToast'
import { Card, Spinner } from '../components/ui/Misc'
import { CapacityBar } from '../components/events/CapacityBar'
import { eventImageUrl } from '../lib/eventImages'
import type { ArenaEvent, CourtBooking, PrivateLesson } from '../types/db'

type LessonWithStudent = PrivateLesson & { students: { name: string } | null }

interface DashboardData {
  activeStudents: number
  overdueCount: number
  overdueAmount: number
  received: { mensalidades: number; aulas: number; quadra: number; eventos: number }
  lessons: LessonWithStudent[]
  bookings: CourtBooking[]
  nextEvent: (ArenaEvent & { paidCount: number; total: number }) | null
}

const sum = (rows: Record<string, unknown>[] | null, key: string) => (rows ?? []).reduce((a, r) => a + Number(r[key] ?? 0), 0)

async function fetchDashboard(): Promise<DashboardData> {
  const today = todayISO()
  const { year, month } = currentYearMonth()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = addDays(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`, -1)

  const [students, overdue, paidPayments, paidLessons, paidBookings, eventSales, lessons, bookings, events] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    supabase.from('payments_view').select('amount').eq('computed_status', 'atrasado'),
    supabase.from('payments').select('amount').eq('status', 'pago').gte('paid_at', monthStart).lte('paid_at', monthEnd),
    supabase.from('private_lessons').select('price').eq('paid', true).neq('status', 'cancelada').gte('lesson_date', monthStart).lte('lesson_date', monthEnd),
    supabase.from('court_bookings').select('price').eq('paid', true).gte('booking_date', monthStart).lte('booking_date', monthEnd),
    supabase.from('event_participants').select('amount_paid').gte('paid_at', monthStart).lte('paid_at', monthEnd),
    supabase.from('private_lessons').select('*, students(name)').eq('status', 'agendada').gte('lesson_date', today).order('lesson_date').order('start_time').limit(5),
    supabase.from('court_bookings').select('*').gte('booking_date', today).order('booking_date').order('start_time').limit(5),
    supabase.from('events').select('*').gte('event_date', today).order('event_date').limit(1),
  ])

  const failed = [students, overdue, paidPayments, paidLessons, paidBookings, eventSales, lessons, bookings, events].find((r) => r.error)
  if (failed) throw failed.error

  let nextEvent: DashboardData['nextEvent'] = null
  const ev = (events.data as ArenaEvent[])[0]
  if (ev) {
    const { data } = await supabase.from('event_participants').select('amount_paid').eq('event_id', ev.id)
    nextEvent = { ...ev, paidCount: data?.length ?? 0, total: sum(data, 'amount_paid') }
  }

  return {
    activeStudents: students.count ?? 0,
    overdueCount: overdue.data?.length ?? 0,
    overdueAmount: sum(overdue.data, 'amount'),
    received: {
      mensalidades: sum(paidPayments.data, 'amount'),
      aulas: sum(paidLessons.data, 'price'),
      quadra: sum(paidBookings.data, 'price'),
      eventos: sum(eventSales.data, 'amount_paid'),
    },
    lessons: lessons.data as LessonWithStudent[],
    bookings: bookings.data as CourtBooking[],
    nextEvent,
  }
}

function StatCard({ to, icon, label, value, sub, tone = 'neutral' }: { to: string; icon: ReactNode; label: string; value: string; sub?: ReactNode; tone?: 'neutral' | 'red' | 'green' }) {
  const tones = { neutral: 'text-neutral-900', red: 'text-red-700', green: 'text-emerald-700' }
  return (
    <Link to={to} className="block">
      <Card className="h-full px-4 py-3 transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 text-neutral-500">
          {icon}
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
        {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
      </Card>
    </Link>
  )
}

function ListCard({ title, to, icon, empty, children }: { title: string; to: string; icon: ReactNode; empty: string; children: ReactNode[] }) {
  return (
    <Card>
      <Link to={to} className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-neutral-900">
          {icon} {title}
        </h2>
        <span className="flex items-center text-xs font-medium text-brand-800">
          Ver tudo <ChevronRight size={14} />
        </span>
      </Link>
      {children.length ? <ul className="divide-y divide-neutral-100">{children}</ul> : <p className="px-4 py-6 text-center text-sm text-neutral-400">{empty}</p>}
    </Card>
  )
}

function Row({ time, title, sub, right }: { time: string; title: string; sub: string; right?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="w-12 shrink-0 text-sm font-bold tabular-nums text-brand-800">{time}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
        <p className="truncate text-xs text-neutral-500">{sub}</p>
      </div>
      {right}
    </li>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(() => toast('Erro ao carregar o painel.', 'error'))
  }, [toast])

  const { month } = currentYearMonth()

  if (!data) return <Spinner />

  const r = data.received
  const receivedTotal = r.mensalidades + r.aulas + r.quadra + r.eventos
  const breakdown = [
    ['Mensalidades', r.mensalidades],
    ['Aulas', r.aulas],
    ['Quadra', r.quadra],
    ['Eventos', r.eventos],
  ].filter(([, v]) => Number(v) > 0) as [string, number][]

  return (
    <>
      {/* Banner da Arena */}
      <div className="relative mb-5 h-28 overflow-hidden rounded-2xl border-b-4 border-brand-800 bg-neutral-900 shadow-sm sm:h-36">
        <img src={`${import.meta.env.BASE_URL}banner-inicio.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/50 to-transparent" />
        <div className="relative flex h-full flex-col justify-center px-5">
          <p className="text-sm text-neutral-300">{formatDateLong(todayISO())}</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">Visão geral</h1>
          <div className="mt-1 h-1 w-10 rounded-full bg-brand-600" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard to="/alunos" icon={<Users size={16} />} label="Alunos ativos" value={String(data.activeStudents)} />
        <StatCard
          to="/mensalidades"
          icon={<AlertTriangle size={16} />}
          label="Em atraso"
          tone={data.overdueCount ? 'red' : 'neutral'}
          value={formatCurrency(data.overdueAmount)}
          sub={data.overdueCount ? `${data.overdueCount} mensalidade${data.overdueCount > 1 ? 's' : ''} vencida${data.overdueCount > 1 ? 's' : ''}` : 'Tudo em dia 🎉'}
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            to="/mensalidades"
            icon={<Wallet size={16} />}
            label={`Recebido em ${MONTHS[month - 1].toLowerCase()}`}
            tone="green"
            value={formatCurrency(receivedTotal)}
            sub={breakdown.length ? breakdown.map(([k, v]) => `${k} ${formatCurrency(v)}`).join(' · ') : 'Nenhum recebimento ainda'}
          />
        </div>
      </div>

      {/* Próximo evento */}
      {data.nextEvent && (
        <Link to={`/eventos/${data.nextEvent.id}`} className="mb-4 block">
          <Card className="overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 border-b-2 border-brand-800 bg-neutral-950 px-4 py-3">
              {data.nextEvent.image_path ? (
                <img src={eventImageUrl(data.nextEvent.image_path)!} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <PartyPopper size={20} className="shrink-0 text-brand-300" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">Próximo evento</p>
                <p className="truncate font-display text-lg font-bold uppercase tracking-wide text-white">{data.nextEvent.name}</p>
              </div>
              <ChevronRight size={18} className="text-neutral-500" />
            </div>
            <div className="space-y-2 px-4 py-3">
              <p className="text-sm text-neutral-600">
                {formatDayLabel(data.nextEvent.event_date)}
                {data.nextEvent.start_time && ` · ${formatTime(data.nextEvent.start_time)}`}
              </p>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-neutral-700">
                  {data.nextEvent.paidCount}
                  {data.nextEvent.capacity ? ` / ${data.nextEvent.capacity}` : ''} pagantes
                </span>
                <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(data.nextEvent.total)}</span>
              </div>
              {data.nextEvent.capacity && <CapacityBar value={data.nextEvent.paidCount} max={data.nextEvent.capacity} />}
            </div>
          </Card>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Próximas aulas avulsas" to="/aulas" icon={<CalendarClock size={18} />} empty="Nenhuma aula agendada">
          {data.lessons.map((l) => (
            <Row
              key={l.id}
              time={formatTime(l.start_time)}
              title={l.students?.name ?? l.guest_name ?? '—'}
              sub={formatDayLabel(l.lesson_date)}
              right={!l.paid && <span className="text-xs font-medium text-amber-700">A pagar</span>}
            />
          ))}
        </ListCard>
        <ListCard title="Próximos aluguéis" to="/quadra" icon={<CalendarDays size={18} />} empty="Nenhuma reserva futura">
          {data.bookings.map((b) => (
            <Row
              key={b.id}
              time={formatTime(b.start_time)}
              title={b.responsible_name}
              sub={`${formatDayLabel(b.booking_date)} · até ${formatTime(b.end_time)}`}
              right={!b.paid && <span className="text-xs font-medium text-amber-700">A pagar</span>}
            />
          ))}
        </ListCard>
      </div>
    </>
  )
}
