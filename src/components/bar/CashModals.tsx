import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, parseMoney } from '../../lib/format'
import { barError } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { MoneyInput, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'

export function OpenSessionModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setAmount('')
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('bar_cash_sessions').insert({ opening_amount: parseMoney(amount) })
    setSaving(false)
    // 23505 = já existe um caixa aberto (índice único)
    if (error) return toast(error.code === '23505' ? 'Já existe um caixa aberto.' : 'Erro ao abrir o caixa.', 'error')
    toast('Caixa aberto! Boas vendas 🍻')
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Abrir caixa"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="open-session-form" full loading={saving}>
            Abrir caixa
          </Button>
        </>
      }
    >
      <form id="open-session-form" onSubmit={handleSubmit} className="space-y-4">
        <MoneyInput
          label="Troco inicial"
          value={amount}
          onChange={setAmount}
          hint="Quanto de dinheiro tem na gaveta agora, para dar troco. Se não tiver, deixe em branco."
        />
      </form>
    </Modal>
  )
}

interface CloseProps {
  open: boolean
  opening: number
  cashSales: number
  cashOut: number
  totalSales: number
  onClose: () => void
  onSaved: (sessionId: string) => void
}

export function CloseSessionModal({ open, opening, cashSales, cashOut, totalSales, onClose, onSaved }: CloseProps) {
  const toast = useToast()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCounted('')
      setNotes('')
    }
  }, [open])

  const expected = opening + cashSales - cashOut
  const diff = parseMoney(counted) - expected

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!counted.trim()) return toast('Conte o dinheiro da gaveta e informe o valor.', 'error')
    setSaving(true)
    const { data, error } = await supabase.rpc('bar_close_session', { p_counted: parseMoney(counted), p_notes: notes.trim() })
    setSaving(false)
    if (error) return toast(barError(error, 'Erro ao fechar o caixa.'), 'error')
    toast('Caixa fechado!')
    onSaved(data as string)
  }

  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between py-1 ${strong ? 'border-t border-neutral-200 pt-2 font-semibold text-neutral-900' : 'text-neutral-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Fechar caixa"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="close-session-form" full loading={saving}>
            Fechar caixa
          </Button>
        </>
      }
    >
      <form id="close-session-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-neutral-600">
          Total vendido neste caixa: <strong className="text-neutral-900">{formatCurrency(totalSales)}</strong>
        </p>
        <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dinheiro na gaveta</p>
          {row('Troco inicial', formatCurrency(opening))}
          {row('+ Vendas em dinheiro', formatCurrency(cashSales))}
          {cashOut > 0 && row('− Saídas do caixa', formatCurrency(cashOut))}
          {row('= Deveria ter', formatCurrency(expected), true)}
        </div>
        <MoneyInput label="Dinheiro contado na gaveta" required value={counted} onChange={setCounted} hint="Conte as notas e moedas e digite o total." />
        {counted.trim() && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              Math.abs(diff) < 0.005 ? 'bg-emerald-50 text-emerald-700' : diff > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {Math.abs(diff) < 0.005 ? 'Confere certinho ✅' : diff > 0 ? `Está sobrando ${formatCurrency(diff)}` : `Está faltando ${formatCurrency(-diff)}`}
          </div>
        )}
        <Textarea label="Observações" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: retirei R$ 100 para o depósito" />
      </form>
    </Modal>
  )
}
