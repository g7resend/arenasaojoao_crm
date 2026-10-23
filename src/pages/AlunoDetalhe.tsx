import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CreditCard, MessageCircle, Pencil, Phone, Receipt, Tag, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, formatDate, formatPhone } from '../lib/format'
import { FINANCIAL_STATUS, financialStatus } from '../lib/billing'
import { openWhatsApp } from '../lib/whatsapp'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Badge, Card, EmptyState, ErrorBox, Spinner } from '../components/ui/Misc'
import { Avatar } from '../components/students/Avatar'
import { StudentFormModal } from '../components/students/StudentFormModal'
import { PaymentList } from '../components/payments/PaymentList'
import type { PaymentView, Plan, Student } from '../types/db'

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-neutral-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="break-words text-sm font-medium text-neutral-800">{value}</p>
      </div>
    </div>
  )
}

export default function AlunoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [student, setStudent] = useState<Student | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [s, p, pay] = await Promise.all([
      supabase.from('students').select('*').eq('id', id).maybeSingle(),
      supabase.from('plans').select('*').order('monthly_price'),
      supabase.from('payments_view').select('*').eq('student_id', id).order('competence', { ascending: false }),
    ])
    if (s.error || p.error || pay.error) toast('Erro ao carregar aluno.', 'error')
    setNotFound(!s.data)
    setStudent((s.data as Student) ?? null)
    setPlans((p.data as Plan[]) ?? [])
    setPayments((pay.data as PaymentView[]) ?? [])
    setLoading(false)
  }, [id, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!student) return
    if (!confirm(`Excluir ${student.name}?\n\nTodo o histórico de mensalidades deste aluno também será apagado. Para manter o histórico, apenas marque como inativo.`)) return
    const { error } = await supabase.from('students').delete().eq('id', student.id)
    if (error) return toast('Erro ao excluir aluno.', 'error')
    toast('Aluno excluído.')
    navigate('/alunos', { replace: true })
  }

  if (loading) return <Spinner />
  if (notFound || !student)
    return (
      <div className="space-y-4">
        <ErrorBox message="Aluno não encontrado." />
        <Link to="/alunos" className="text-sm font-medium text-brand-800">
          ← Voltar para alunos
        </Link>
      </div>
    )

  const plan = plans.find((p) => p.id === student.plan_id)
  const open = payments.filter((p) => p.computed_status !== 'pago')
  const fs = FINANCIAL_STATUS[financialStatus(open)]
  const totalPaid = payments.filter((p) => p.computed_status === 'pago').reduce((a, p) => a + Number(p.amount), 0)
  const totalOpen = open.reduce((a, p) => a + Number(p.amount), 0)

  return (
    <>
      <Link to="/alunos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={16} /> Alunos
      </Link>

      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center gap-4 border-b-2 border-brand-800 bg-neutral-950 px-5 py-4">
          <Avatar name={student.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold uppercase tracking-wide text-white">{student.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {student.status === 'ativo' ? <Badge color={fs.color}>{fs.label}</Badge> : <Badge>Inativo</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 min-[400px]:grid-cols-2 lg:grid-cols-4">
          <InfoItem icon={<Phone size={16} />} label="Telefone" value={formatPhone(student.phone)} />
          <InfoItem icon={<Tag size={16} />} label="Plano" value={plan ? `${plan.name} · ${formatCurrency(plan.monthly_price)}` : 'Sem plano'} />
          <InfoItem icon={<CreditCard size={16} />} label="Pagamento" value={PAYMENT_METHODS[student.payment_method]} />
          <InfoItem icon={<CalendarDays size={16} />} label="Vencimento" value={`Todo dia ${student.due_day}`} />
        </div>
        {student.notes && <p className="whitespace-pre-wrap border-t border-neutral-100 px-5 py-3 text-sm text-neutral-600">{student.notes}</p>}
        <p className="px-5 pb-3 text-xs text-neutral-400">Cadastrado em {formatDate(student.created_at.slice(0, 10))}</p>

        <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-5 py-3">
          <Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
            Editar
          </Button>
          {student.phone && (
            <Button size="sm" variant="whatsapp" icon={<MessageCircle size={16} />} onClick={() => openWhatsApp(student.phone!, '')}>
              WhatsApp
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} onClick={handleDelete} className="ml-auto text-red-600 hover:bg-red-50">
            Excluir
          </Button>
        </div>
      </Card>

      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-neutral-900">Histórico de pagamentos</h2>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Total pago</p>
          <p className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Em aberto</p>
          <p className={`text-lg font-bold tabular-nums ${totalOpen > 0 ? 'text-red-700' : 'text-neutral-900'}`}>{formatCurrency(totalOpen)}</p>
        </Card>
      </div>
      <Card>
        {payments.length === 0 ? (
          <EmptyState icon={<Receipt size={40} />} title="Nenhuma mensalidade ainda" description="As cobranças aparecem aqui depois de geradas na tela de Mensalidades." />
        ) : (
          <PaymentList payments={payments} showStudent={false} onChanged={load} />
        )}
      </Card>

      <StudentFormModal
        open={editing}
        student={student}
        plans={plans}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          load()
        }}
      />
    </>
  )
}
