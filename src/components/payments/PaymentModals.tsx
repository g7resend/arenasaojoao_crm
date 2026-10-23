import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCompetence, formatCurrency, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { PaymentMethod, PaymentView } from '../../types/db'

interface Props {
  payment: PaymentView | null
  onClose: () => void
  onSaved: () => void
}

/** Registra o pagamento de uma mensalidade (data + forma) */
export function MarkPaidModal({ payment, onClose, onSaved }: Props) {
  const toast = useToast()
  const [paidAt, setPaidAt] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (payment) {
      setPaidAt(todayISO())
      setMethod(payment.payment_method ?? 'pix')
    }
  }, [payment])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!payment) return
    setSaving(true)
    const { error } = await supabase
      .from('payments')
      .update({ status: 'pago', paid_at: paidAt, payment_method: method })
      .eq('id', payment.id)
    setSaving(false)
    if (error) return toast('Erro ao registrar pagamento.', 'error')
    toast('Pagamento registrado!')
    onSaved()
  }

  return (
    <Modal
      open={!!payment}
      onClose={onClose}
      title="Marcar como pago"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="mark-paid-form" full loading={saving}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      {payment && (
        <form id="mark-paid-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <p className="font-medium text-neutral-900">{payment.student_name}</p>
            <p className="text-sm text-neutral-500">
              {formatCompetence(payment.competence)} · <span className="font-semibold text-neutral-800">{formatCurrency(payment.amount)}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data do pagamento" type="date" required value={paidAt} max={todayISO()} onChange={(e) => setPaidAt(e.target.value)} />
            <Select label="Forma" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      )}
    </Modal>
  )
}

/** Ajusta valor e vencimento de uma mensalidade */
export function EditPaymentModal({ payment, onClose, onSaved }: Props) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (payment) {
      setAmount(moneyToInput(payment.amount))
      setDueDate(payment.due_date)
    }
  }, [payment])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!payment) return
    setSaving(true)
    const { error } = await supabase.from('payments').update({ amount: parseMoney(amount), due_date: dueDate }).eq('id', payment.id)
    setSaving(false)
    if (error) return toast('Erro ao salvar mensalidade.', 'error')
    toast('Mensalidade atualizada!')
    onSaved()
  }

  return (
    <Modal
      open={!!payment}
      onClose={onClose}
      title="Editar mensalidade"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-payment-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      {payment && (
        <form id="edit-payment-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-neutral-500">
            {payment.student_name} · {formatCompetence(payment.competence)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Valor" required value={amount} onChange={setAmount} />
            <Input label="Vencimento" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </form>
      )}
    </Modal>
  )
}
