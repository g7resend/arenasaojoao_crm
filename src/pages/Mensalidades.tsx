import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt, Search, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { MONTHS, currentYearMonth, formatCurrency, normalizeText } from '../lib/format'
import { useToast } from '../hooks/useToast'
import { Button, IconButton } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { PaymentList } from '../components/payments/PaymentList'
import type { ComputedPaymentStatus, PaymentView } from '../types/db'

type Filter = 'todas' | ComputedPaymentStatus
type Scope = 'mes' | 'aberto'

function competenceISO(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function SummaryTile({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'green' | 'yellow' | 'red' }) {
  const tones = { neutral: 'text-neutral-900', green: 'text-emerald-700', yellow: 'text-amber-700', red: 'text-red-700' }
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </Card>
  )
}

export default function Mensalidades() {
  const toast = useToast()
  const [{ year, month }, setYm] = useState(currentYearMonth)
  const [scope, setScope] = useState<Scope>('mes')
  const [filter, setFilter] = useState<Filter>('todas')
  const [search, setSearch] = useState('')
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [noPlanCount, setNoPlanCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    let query = supabase.from('payments_view').select('*').order('student_name')
    query = scope === 'mes' ? query.eq('competence', competenceISO(year, month)) : query.eq('status', 'pendente').order('competence')
    const [{ data, error }, noPlan] = await Promise.all([
      query,
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ativo').is('plan_id', null),
    ])
    if (error) toast('Erro ao carregar mensalidades.', 'error')
    setPayments((data as PaymentView[]) ?? [])
    setNoPlanCount(noPlan.count ?? 0)
    setLoading(false)
  }, [scope, year, month, toast])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function shiftMonth(delta: number) {
    setYm(({ year, month }) => {
      const m = month + delta
      if (m < 1) return { year: year - 1, month: 12 }
      if (m > 12) return { year: year + 1, month: 1 }
      return { year, month: m }
    })
  }

  async function generate() {
    if (!confirm(`Gerar as mensalidades de ${MONTHS[month - 1]}/${year} para todos os alunos ativos com plano?\n\nQuem já tem cobrança neste mês não será duplicado.`)) return
    setGenerating(true)
    const { data, error } = await supabase.rpc('generate_monthly_payments', { p_year: year, p_month: month })
    setGenerating(false)
    if (error) return toast('Erro ao gerar mensalidades.', 'error')
    const n = Number(data ?? 0)
    toast(n === 0 ? 'Nenhuma nova mensalidade: todas já existiam.' : `${n} mensalidade${n > 1 ? 's' : ''} gerada${n > 1 ? 's' : ''}!`)
    load()
  }

  const totals = useMemo(() => {
    const sum = (list: PaymentView[]) => list.reduce((acc, p) => acc + Number(p.amount), 0)
    const by = (s: ComputedPaymentStatus) => payments.filter((p) => p.computed_status === s)
    return {
      all: sum(payments),
      paid: by('pago'),
      pending: by('pendente'),
      late: by('atrasado'),
      sum,
    }
  }, [payments])

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return payments.filter((p) => (filter === 'todas' || p.computed_status === filter) && (!q || normalizeText(p.student_name).includes(q)))
  }, [payments, filter, search])

  return (
    <>
      <PageHeader
        title="Mensalidades"
        actions={
          scope === 'mes' && (
            <Button icon={<Sparkles size={16} />} loading={generating} onClick={generate}>
              Gerar mensalidades do mês
            </Button>
          )
        }
      />

      {/* Escopo: mês específico ou tudo em aberto */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={scope}
          onChange={(v) => {
            setScope(v)
            setFilter('todas')
          }}
          tabs={[
            { value: 'mes', label: 'Por mês' },
            { value: 'aberto', label: 'Tudo em aberto' },
          ]}
        />
        {scope === 'mes' && (
          <div className="flex items-center rounded-xl bg-white ring-1 ring-neutral-200">
            <IconButton label="Mês anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <span className="min-w-36 text-center text-sm font-semibold text-neutral-800">
              {MONTHS[month - 1]} {year}
            </span>
            <IconButton label="Próximo mês" onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
        )}
      </div>

      {scope === 'mes' && noPlanCount > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          {noPlanCount} aluno{noPlanCount > 1 ? 's' : ''} ativo{noPlanCount > 1 ? 's' : ''} sem plano não entra{noPlanCount > 1 ? 'm' : ''} na geração automática.
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label={scope === 'mes' ? 'Previsto' : 'Em aberto'} value={formatCurrency(totals.all)} sub={`${payments.length} cobrança${payments.length === 1 ? '' : 's'}`} />
        <SummaryTile label="Recebido" tone="green" value={formatCurrency(totals.sum(totals.paid))} sub={`${totals.paid.length} paga${totals.paid.length === 1 ? '' : 's'}`} />
        <SummaryTile label="Pendente" tone="yellow" value={formatCurrency(totals.sum(totals.pending))} sub={`${totals.pending.length} no prazo`} />
        <SummaryTile label="Atrasado" tone="red" value={formatCurrency(totals.sum(totals.late))} sub={`${totals.late.length} vencida${totals.late.length === 1 ? '' : 's'}`} />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'todas', label: 'Todas', count: payments.length },
            ...(scope === 'mes' ? [{ value: 'pago' as const, label: 'Em dia', count: totals.paid.length }] : []),
            { value: 'pendente', label: 'Pendentes', count: totals.pending.length },
            { value: 'atrasado', label: 'Atrasados', count: totals.late.length },
          ]}
        />
        <div className="relative sm:w-64">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Receipt size={40} />}
            title={payments.length === 0 ? (scope === 'mes' ? 'Nenhuma mensalidade neste mês' : 'Nada em aberto 🎉') : 'Nenhum resultado'}
            description={payments.length === 0 && scope === 'mes' ? 'Use “Gerar mensalidades do mês” para criar as cobranças dos alunos ativos.' : undefined}
          />
        ) : (
          <PaymentList payments={visible} onChanged={load} />
        )}
      </Card>
    </>
  )
}
