import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, CalendarClock, CheckCheck, CircleDollarSign, MessageCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, formatDateLong, formatDayLabel, formatTime, todayISO } from '../lib/format'
import { firstName } from '../lib/billing'
import { fillTemplate, openWhatsApp } from '../lib/whatsapp'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Badge, Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { Dropdown } from '../components/ui/Dropdown'
import { PayMethodModal } from '../components/ui/PayMethodModal'
import { LessonFormModal, type LessonStudent } from '../components/lessons/LessonFormModal'
import type { LessonStatus, PaymentMethod, PrivateLesson } from '../types/db'

type View = 'proximas' | 'anteriores'

const STATUS: Record<LessonStatus, { label: string; color: 'blue' | 'green' | 'gray' }> = {
  agendada: { label: 'Agendada', color: 'blue' },
  realizada: { label: 'Realizada', color: 'green' },
  cancelada: { label: 'Cancelada', color: 'gray' },
}

export default function Aulas() {
  const { settings } = useSettings()
  const toast = useToast()
  const [view, setView] = useState<View>('proximas')
  const [lessons, setLessons] = useState<PrivateLesson[]>([])
  const [students, setStudents] = useState<LessonStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PrivateLesson | null>(null)
  const [paying, setPaying] = useState<PrivateLesson | null>(null)

  const load = useCallback(async () => {
    const today = todayISO()
    let q = supabase.from('private_lessons').select('*')
    q =
      view === 'proximas'
        ? q.gte('lesson_date', today).order('lesson_date').order('start_time')
        : q.lt('lesson_date', today).order('lesson_date', { ascending: false }).order('start_time').limit(200)
    const [l, s] = await Promise.all([q, supabase.from('students').select('id, name, phone, status').order('name')])
    if (l.error || s.error) toast('Erro ao carregar aulas.', 'error')
    setLessons((l.data as PrivateLesson[]) ?? [])
    setStudents((s.data as LessonStudent[]) ?? [])
    setLoading(false)
  }, [view, toast])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const personOf = (l: PrivateLesson) => {
    const s = l.student_id ? studentById.get(l.student_id) : undefined
    return { name: s?.name ?? l.guest_name ?? '—', phone: s?.phone ?? l.guest_phone, registered: !!s }
  }

  const groups = useMemo(() => {
    const map = new Map<string, PrivateLesson[]>()
    for (const l of lessons) map.set(l.lesson_date, [...(map.get(l.lesson_date) ?? []), l])
    return [...map.entries()]
  }, [lessons])

  async function update(l: PrivateLesson, patch: Partial<PrivateLesson>, msg: string) {
    const { error } = await supabase.from('private_lessons').update(patch).eq('id', l.id)
    if (error) return toast('Erro ao atualizar aula.', 'error')
    toast(msg)
    load()
  }

  async function remove(l: PrivateLesson) {
    if (!confirm(`Excluir a aula de ${personOf(l).name} em ${formatDateLong(l.lesson_date)} às ${formatTime(l.start_time)}?`)) return
    const { error } = await supabase.from('private_lessons').delete().eq('id', l.id)
    if (error) return toast('Erro ao excluir aula.', 'error')
    toast('Aula excluída.')
    load()
  }

  function sendConfirmation(l: PrivateLesson) {
    const p = personOf(l)
    if (!p.phone) return toast('Sem telefone cadastrado para esta aula.', 'error')
    if (!settings) return
    const text = fillTemplate(settings.tpl_lesson_confirmation, {
      nome: firstName(p.name),
      data: formatDateLong(l.lesson_date),
      horario: formatTime(l.start_time),
      valor: formatCurrency(l.price),
    })
    openWhatsApp(p.phone, text)
  }

  async function confirmPaid(method: PaymentMethod) {
    if (!paying) return
    await update(paying, { paid: true, payment_method: method }, 'Pagamento registrado!')
    setPaying(null)
  }

  const pendingTotal = lessons.filter((l) => !l.paid && l.status !== 'cancelada').reduce((a, l) => a + Number(l.price), 0)

  return (
    <>
      <PageHeader
        title="Aulas avulsas"
        subtitle="Aulas particulares"
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Nova aula
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { value: 'proximas', label: 'Próximas' },
            { value: 'anteriores', label: 'Anteriores' },
          ]}
        />
        {pendingTotal > 0 && (
          <span className="text-sm text-neutral-500">
            A receber: <strong className="text-amber-700">{formatCurrency(pendingTotal)}</strong>
          </span>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarClock size={40} />} title={view === 'proximas' ? 'Nenhuma aula agendada' : 'Nenhuma aula anterior'} />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <Card key={date}>
              <h3 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">{formatDayLabel(date)}</h3>
              <ul className="divide-y divide-neutral-100">
                {items.map((l) => {
                  const p = personOf(l)
                  const st = STATUS[l.status]
                  const cancelled = l.status === 'cancelada'
                  return (
                    <li key={l.id} className={`px-4 py-3 ${cancelled ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-brand-800">{formatTime(l.start_time)}</div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-medium text-neutral-900 ${cancelled ? 'line-through' : ''}`}>{p.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge color={st.color}>{st.label}</Badge>
                            {!cancelled &&
                              (l.paid ? (
                                <Badge color="green">Pago{l.payment_method ? ` · ${PAYMENT_METHODS[l.payment_method]}` : ''}</Badge>
                              ) : (
                                <Badge color="yellow">A pagar</Badge>
                              ))}
                            {!p.registered && <span className="text-xs text-neutral-400">avulso</span>}
                          </div>
                          {l.notes && <p className="mt-1 text-xs text-neutral-500">{l.notes}</p>}
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-neutral-900">{formatCurrency(l.price)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 pl-15">
                        {!cancelled && (
                          <Button size="sm" variant="whatsapp" icon={<MessageCircle size={16} />} onClick={() => sendConfirmation(l)}>
                            Confirmar
                          </Button>
                        )}
                        {!cancelled && !l.paid && (
                          <Button size="sm" variant="secondary" icon={<CircleDollarSign size={16} />} onClick={() => setPaying(l)}>
                            Pago
                          </Button>
                        )}
                        <div className="ml-auto">
                          <Dropdown
                            items={[
                              { label: 'Marcar como realizada', icon: <CheckCheck size={16} />, onClick: () => update(l, { status: 'realizada' }, 'Aula marcada como realizada.'), hidden: l.status === 'realizada' },
                              { label: 'Voltar para agendada', icon: <RotateCcw size={16} />, onClick: () => update(l, { status: 'agendada' }, 'Aula reagendada.'), hidden: l.status === 'agendada' },
                              { label: 'Cancelar aula', icon: <Ban size={16} />, onClick: () => update(l, { status: 'cancelada' }, 'Aula cancelada.'), hidden: cancelled },
                              { label: 'Desfazer pagamento', icon: <RotateCcw size={16} />, onClick: () => update(l, { paid: false, payment_method: null }, 'Pagamento desfeito.'), hidden: !l.paid },
                              {
                                label: 'Editar',
                                icon: <Pencil size={16} />,
                                onClick: () => {
                                  setEditing(l)
                                  setFormOpen(true)
                                },
                              },
                              { label: 'Excluir', icon: <Trash2 size={16} />, onClick: () => remove(l), danger: true },
                            ]}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <LessonFormModal
        open={formOpen}
        lesson={editing}
        students={students}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          load()
        }}
      />
      <PayMethodModal
        open={!!paying}
        summary={paying && `${personOf(paying).name} · ${formatCurrency(paying.price)}`}
        onClose={() => setPaying(null)}
        onConfirm={confirmPaid}
      />
    </>
  )
}
