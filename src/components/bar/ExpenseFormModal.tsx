import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { EXPENSE_CATEGORIES } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, Select, Toggle } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { BarExpense, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  expense?: BarExpense | null
  /** Caixa aberto no momento (permite marcar "saiu do caixa") */
  openSessionId: string | null
  /** Já abre marcado como saída do caixa (botão "Saída do caixa") */
  fromRegister?: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}

interface FormState {
  description: string
  amount: string
  category: string
  date: string
  method: PaymentMethod
  fromRegister: boolean
}

function initial(expense: BarExpense | null | undefined, fromRegister: boolean): FormState {
  return {
    description: expense?.description ?? '',
    amount: expense ? moneyToInput(expense.amount) : '',
    category: expense?.category ?? (fromRegister ? 'Outros' : 'Compra de mercadoria'),
    date: expense?.expense_date ?? todayISO(),
    method: expense?.payment_method ?? 'pix',
    fromRegister: expense ? !!expense.session_id : fromRegister,
  }
}

export function ExpenseFormModal({ open, expense, openSessionId, fromRegister = false, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(expense, fromRegister))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initial(expense, fromRegister))
  }, [open, expense, fromRegister])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  // a opção só faz sentido com caixa aberto (ou numa despesa que já saiu do caixa aberto)
  const canUseRegister = !!openSessionId

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseMoney(form.amount)
    if (amount <= 0) return toast('Informe o valor da despesa.', 'error')
    const register = canUseRegister && form.fromRegister
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      amount,
      category: form.category,
      expense_date: register ? todayISO() : form.date,
      payment_method: register ? 'dinheiro' : form.method,
      session_id: register ? openSessionId : null,
    }
    const { error } = expense
      ? await supabase.from('bar_expenses').update(payload).eq('id', expense.id)
      : await supabase.from('bar_expenses').insert(payload)
    if (error) {
      setSaving(false)
      return toast('Erro ao salvar a despesa.', 'error')
    }
    toast(expense ? 'Despesa atualizada!' : 'Despesa lançada!')
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? 'Editar despesa' : fromRegister ? 'Saída do caixa' : 'Nova despesa'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="expense-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Descrição"
          required
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={canUseRegister && form.fromRegister ? 'Ex.: gelo, troco para o fornecedor' : 'Ex.: 10 fardos de água no atacado'}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Valor" required value={form.amount} onChange={(v) => set('amount', v)} />
          <Select label="Categoria" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        {canUseRegister && !(fromRegister && !expense) && (
          <div className="rounded-xl bg-neutral-50 px-4 py-3">
            <Toggle label="Paguei com o dinheiro do caixa" checked={form.fromRegister} onChange={(v) => set('fromRegister', v)} />
            <p className="mt-1 text-xs text-neutral-500">Marque se o dinheiro saiu da gaveta do bar. Assim o fechamento do caixa já desconta.</p>
          </div>
        )}
        {!(canUseRegister && form.fromRegister) && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
            <Select label="Pago com" value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </form>
    </Modal>
  )
}
