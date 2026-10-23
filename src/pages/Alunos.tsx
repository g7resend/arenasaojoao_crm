import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, normalizeText } from '../lib/format'
import { FINANCIAL_STATUS, financialStatus, type FinancialStatus } from '../lib/billing'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Badge, Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { Avatar } from '../components/students/Avatar'
import { StudentFormModal } from '../components/students/StudentFormModal'
import type { PaymentView, Plan, Student } from '../types/db'

type Filter = 'ativos' | FinancialStatus | 'inativos'

interface Row extends Student {
  plan?: Plan
  finance: FinancialStatus
  openAmount: number
}

export default function Alunos() {
  const toast = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [openPayments, setOpenPayments] = useState<Pick<PaymentView, 'student_id' | 'computed_status' | 'amount'>[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('ativos')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    const [s, p, o] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('plans').select('*').order('monthly_price'),
      supabase.from('payments_view').select('student_id, computed_status, amount').eq('status', 'pendente'),
    ])
    if (s.error || p.error || o.error) toast('Erro ao carregar alunos.', 'error')
    setStudents((s.data as Student[]) ?? [])
    setPlans((p.data as Plan[]) ?? [])
    setOpenPayments((o.data as typeof openPayments) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo<Row[]>(() => {
    const planById = new Map(plans.map((p) => [p.id, p]))
    return students.map((s) => {
      const open = openPayments.filter((p) => p.student_id === s.id)
      return {
        ...s,
        plan: s.plan_id ? planById.get(s.plan_id) : undefined,
        finance: financialStatus(open),
        openAmount: open.reduce((acc, p) => acc + Number(p.amount), 0),
      }
    })
  }, [students, plans, openPayments])

  const active = rows.filter((r) => r.status === 'ativo')
  const counts = {
    ativos: active.length,
    em_dia: active.filter((r) => r.finance === 'em_dia').length,
    pendente: active.filter((r) => r.finance === 'pendente').length,
    atrasado: active.filter((r) => r.finance === 'atrasado').length,
    inativos: rows.length - active.length,
  }

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return rows.filter((r) => {
      if (q && !normalizeText(r.name).includes(q)) return false
      if (filter === 'inativos') return r.status === 'inativo'
      if (r.status !== 'ativo') return false
      return filter === 'ativos' || r.finance === filter
    })
  }, [rows, filter, search])

  return (
    <>
      <PageHeader
        title="Alunos"
        subtitle={`${counts.ativos} ativo${counts.ativos === 1 ? '' : 's'}`}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            Novo aluno
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'ativos', label: 'Ativos', count: counts.ativos },
            { value: 'em_dia', label: 'Em dia', count: counts.em_dia },
            { value: 'pendente', label: 'Pendentes', count: counts.pendente },
            { value: 'atrasado', label: 'Atrasados', count: counts.atrasado },
            { value: 'inativos', label: 'Inativos', count: counts.inativos },
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
            icon={<Users size={40} />}
            title={students.length === 0 ? 'Nenhum aluno cadastrado' : 'Nenhum aluno encontrado'}
            action={
              students.length === 0 && (
                <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
                  Cadastrar primeiro aluno
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map((r) => {
              const fs = FINANCIAL_STATUS[r.finance]
              return (
                <li key={r.id}>
                  <Link to={`/alunos/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-neutral-900">{r.name}</p>
                      <p className="truncate text-sm text-neutral-500">
                        {r.plan ? `${r.plan.name} · ${formatCurrency(r.plan.monthly_price)}` : 'Sem plano'} · vence dia {r.due_day}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {r.status === 'ativo' ? <Badge color={fs.color}>{fs.label}</Badge> : <Badge>Inativo</Badge>}
                      {r.openAmount > 0 && <span className="text-xs tabular-nums text-neutral-500">{formatCurrency(r.openAmount)}</span>}
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-neutral-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <StudentFormModal
        open={formOpen}
        plans={plans}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
    </>
  )
}
