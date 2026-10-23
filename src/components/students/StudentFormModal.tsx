import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, isValidPhone } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, PhoneInput, Select, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { PaymentMethod, Plan, Student, StudentStatus } from '../../types/db'

interface Props {
  open: boolean
  student?: Student | null // null/undefined = novo aluno
  plans: Plan[]
  onClose: () => void
  onSaved: (student: Student) => void
}

interface FormState {
  name: string
  phone: string
  planId: string
  paymentMethod: PaymentMethod
  dueDay: string
  status: StudentStatus
  notes: string
}

function initialState(student?: Student | null): FormState {
  return {
    name: student?.name ?? '',
    phone: student?.phone ?? '',
    planId: student?.plan_id ?? '',
    paymentMethod: student?.payment_method ?? 'pix',
    dueDay: String(student?.due_day ?? 10),
    status: student?.status ?? 'ativo',
    notes: student?.notes ?? '',
  }
}

export function StudentFormModal({ open, student, plans, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initialState(student))
  const [saving, setSaving] = useState(false)
  const [phoneError, setPhoneError] = useState<string>()

  useEffect(() => {
    if (open) {
      setForm(initialState(student))
      setPhoneError(undefined)
    }
  }, [open, student])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // planos ativos + o plano atual do aluno (mesmo se desativado)
  const planOptions = plans.filter((p) => p.active || p.id === student?.plan_id)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.phone && !isValidPhone(form.phone)) {
      setPhoneError('Informe DDD + número (10 ou 11 dígitos).')
      return
    }
    const dueDay = Number(form.dueDay)
    if (!(dueDay >= 1 && dueDay <= 31)) return toast('Dia de vencimento deve ser entre 1 e 31.', 'error')

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      plan_id: form.planId || null,
      payment_method: form.paymentMethod,
      due_day: dueDay,
      status: form.status,
      notes: form.notes.trim(),
    }
    const { data, error } = student
      ? await supabase.from('students').update(payload).eq('id', student.id).select().single()
      : await supabase.from('students').insert(payload).select().single()
    setSaving(false)
    if (error) return toast('Erro ao salvar aluno.', 'error')
    toast(student ? 'Aluno atualizado!' : 'Aluno cadastrado!')
    onSaved(data as Student)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? 'Editar aluno' : 'Novo aluno'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="student-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" required autoComplete="off" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <PhoneInput
          value={form.phone}
          onChange={(v) => {
            set('phone', v)
            setPhoneError(undefined)
          }}
          error={phoneError}
        />
        <Select
          label="Plano"
          value={form.planId}
          onChange={(e) => set('planId', e.target.value)}
          hint={plans.length === 0 ? 'Cadastre os planos em Configurações → Planos.' : 'Sem plano, o aluno não entra na geração de mensalidades.'}
        >
          <option value="">Sem plano</option>
          {planOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatCurrency(p.monthly_price)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Forma de pagamento" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Dia de vencimento"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            required
            value={form.dueDay}
            onChange={(e) => set('dueDay', e.target.value)}
          />
        </div>
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as StudentStatus)}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
        <Textarea label="Observações" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </form>
    </Modal>
  )
}
