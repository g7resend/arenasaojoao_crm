import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatTime, isValidPhone, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, PhoneInput, Select, Textarea, Toggle } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Tabs } from '../ui/Misc'
import type { LessonStatus, PaymentMethod, PrivateLesson, Student } from '../../types/db'

export type LessonStudent = Pick<Student, 'id' | 'name' | 'phone' | 'status'>

interface Props {
  open: boolean
  lesson?: PrivateLesson | null
  students: LessonStudent[]
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  kind: 'aluno' | 'avulso'
  studentId: string
  guestName: string
  guestPhone: string
  date: string
  time: string
  price: string
  status: LessonStatus
  paid: boolean
  method: PaymentMethod
  notes: string
}

function initial(lesson?: PrivateLesson | null): FormState {
  return {
    kind: lesson && !lesson.student_id ? 'avulso' : 'aluno',
    studentId: lesson?.student_id ?? '',
    guestName: lesson?.guest_name ?? '',
    guestPhone: lesson?.guest_phone ?? '',
    date: lesson?.lesson_date ?? todayISO(),
    time: lesson ? formatTime(lesson.start_time) : '08:00',
    price: lesson ? moneyToInput(lesson.price) : '',
    status: lesson?.status ?? 'agendada',
    paid: lesson?.paid ?? false,
    method: lesson?.payment_method ?? 'pix',
    notes: lesson?.notes ?? '',
  }
}

export function LessonFormModal({ open, lesson, students, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(lesson))
  const [phoneError, setPhoneError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial(lesson))
      setPhoneError(undefined)
    }
  }, [open, lesson])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // alunos ativos + o aluno atual da aula (mesmo se inativo)
  const options = students.filter((s) => s.status === 'ativo' || s.id === lesson?.student_id)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.kind === 'aluno' && !form.studentId) return toast('Selecione o aluno.', 'error')
    if (form.kind === 'avulso' && form.guestPhone && !isValidPhone(form.guestPhone)) {
      setPhoneError('Informe DDD + número (10 ou 11 dígitos).')
      return
    }
    setSaving(true)
    const payload = {
      student_id: form.kind === 'aluno' ? form.studentId : null,
      guest_name: form.kind === 'avulso' ? form.guestName.trim() : null,
      guest_phone: form.kind === 'avulso' ? form.guestPhone || null : null,
      lesson_date: form.date,
      start_time: form.time,
      price: parseMoney(form.price),
      status: form.status,
      paid: form.paid,
      payment_method: form.paid ? form.method : null,
      notes: form.notes.trim(),
    }
    const { error } = lesson
      ? await supabase.from('private_lessons').update(payload).eq('id', lesson.id)
      : await supabase.from('private_lessons').insert(payload)
    setSaving(false)
    if (error) return toast('Erro ao salvar aula.', 'error')
    toast(lesson ? 'Aula atualizada!' : 'Aula registrada!')
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lesson ? 'Editar aula' : 'Nova aula avulsa'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="lesson-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={handleSubmit} className="space-y-4">
        <Tabs
          value={form.kind}
          onChange={(v) => set('kind', v)}
          tabs={[
            { value: 'aluno', label: 'Aluno cadastrado' },
            { value: 'avulso', label: 'Pessoa avulsa' },
          ]}
        />
        {form.kind === 'aluno' ? (
          <Select label="Aluno" required value={form.studentId} onChange={(e) => set('studentId', e.target.value)}>
            <option value="">Selecione…</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Input label="Nome" required value={form.guestName} onChange={(e) => set('guestName', e.target.value)} />
            <PhoneInput
              value={form.guestPhone}
              onChange={(v) => {
                set('guestPhone', v)
                setPhoneError(undefined)
              }}
              error={phoneError}
            />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
          <Input label="Horário" type="time" required value={form.time} onChange={(e) => set('time', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Valor" required value={form.price} onChange={(v) => set('price', v)} />
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value as LessonStatus)}>
            <option value="agendada">Agendada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-neutral-50 px-4 py-3">
          <Toggle label="Pago" checked={form.paid} onChange={(v) => set('paid', v)} />
          {form.paid && (
            <Select aria-label="Forma de pagamento" value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)} wrapperClassName="flex-1 min-w-32">
              {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Textarea label="Observações" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </form>
    </Modal>
  )
}
