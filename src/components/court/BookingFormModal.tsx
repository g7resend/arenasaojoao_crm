import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatTime, isValidPhone, moneyToInput, parseMoney } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, PhoneInput, Select, Textarea, Toggle } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { CourtBooking, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  booking?: CourtBooking | null
  defaultDate: string
  onClose: () => void
  onSaved: (date: string) => void
}

interface FormState {
  name: string
  phone: string
  date: string
  start: string
  end: string
  price: string
  paid: boolean
  method: PaymentMethod
  notes: string
}

function initial(booking: CourtBooking | null | undefined, defaultDate: string): FormState {
  return {
    name: booking?.responsible_name ?? '',
    phone: booking?.phone ?? '',
    date: booking?.booking_date ?? defaultDate,
    start: booking ? formatTime(booking.start_time) : '19:00',
    end: booking ? formatTime(booking.end_time) : '20:00',
    price: booking ? moneyToInput(booking.price) : '',
    paid: booking?.paid ?? false,
    method: booking?.payment_method ?? 'pix',
    notes: booking?.notes ?? '',
  }
}

/** Busca reservas do mesmo dia que se sobrepõem ao intervalo [start, end) */
async function findConflict(date: string, start: string, end: string, ignoreId?: string) {
  let q = supabase
    .from('court_bookings')
    .select('*')
    .eq('booking_date', date)
    .lt('start_time', end)
    .gt('end_time', start)
    .limit(1)
  if (ignoreId) q = q.neq('id', ignoreId)
  const { data } = await q
  return (data?.[0] as CourtBooking | undefined) ?? null
}

export function BookingFormModal({ open, booking, defaultDate, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(booking, defaultDate))
  const [phoneError, setPhoneError] = useState<string>()
  const [conflict, setConflict] = useState<CourtBooking | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial(booking, defaultDate))
      setPhoneError(undefined)
      setConflict(null)
    }
  }, [open, booking, defaultDate])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key === 'date' || key === 'start' || key === 'end') setConflict(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.phone && !isValidPhone(form.phone)) {
      setPhoneError('Informe DDD + número (10 ou 11 dígitos).')
      return
    }
    if (form.end <= form.start) return toast('O horário de término deve ser depois do início.', 'error')

    setSaving(true)
    const clash = await findConflict(form.date, form.start, form.end, booking?.id)
    if (clash) {
      setConflict(clash)
      setSaving(false)
      return
    }
    const payload = {
      responsible_name: form.name.trim(),
      phone: form.phone || null,
      booking_date: form.date,
      start_time: form.start,
      end_time: form.end,
      price: parseMoney(form.price),
      paid: form.paid,
      payment_method: form.paid ? form.method : null,
      notes: form.notes.trim(),
    }
    const { error } = booking
      ? await supabase.from('court_bookings').update(payload).eq('id', booking.id)
      : await supabase.from('court_bookings').insert(payload)
    setSaving(false)
    if (error) {
      // 23P01 = violação da constraint de exclusão (outra reserva entrou no mesmo horário)
      if (error.code === '23P01') {
        setConflict(await findConflict(form.date, form.start, form.end, booking?.id))
        return
      }
      return toast('Erro ao salvar reserva.', 'error')
    }
    toast(booking ? 'Reserva atualizada!' : 'Reserva criada!')
    onSaved(form.date)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={booking ? 'Editar reserva' : 'Nova reserva da quadra'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="booking-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Responsável" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <PhoneInput
          value={form.phone}
          onChange={(v) => {
            set('phone', v)
            setPhoneError(undefined)
          }}
          error={phoneError}
        />
        <Input label="Data" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Início" type="time" required value={form.start} onChange={(e) => set('start', e.target.value)} />
          <Input label="Fim" type="time" required value={form.end} onChange={(e) => set('end', e.target.value)} />
        </div>

        {conflict && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong>Horário ocupado.</strong> Já existe reserva de {conflict.responsible_name} das {formatTime(conflict.start_time)} às{' '}
              {formatTime(conflict.end_time)} neste dia.
            </p>
          </div>
        )}

        <MoneyInput label="Valor" required value={form.price} onChange={(v) => set('price', v)} />
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
