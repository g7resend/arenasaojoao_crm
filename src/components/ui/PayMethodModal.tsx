import { useEffect, useState, type ReactNode } from 'react'
import { PAYMENT_METHODS } from '../../lib/format'
import { Button } from './Button'
import { Select } from './Field'
import { Modal } from './Modal'
import type { PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  title?: string
  summary?: ReactNode
  defaultMethod?: PaymentMethod | null
  onClose: () => void
  onConfirm: (method: PaymentMethod) => Promise<void>
}

/** Pergunta a forma de pagamento antes de marcar algo como pago */
export function PayMethodModal({ open, title = 'Marcar como pago', summary, defaultMethod, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setMethod(defaultMethod ?? 'pix')
  }, [open, defaultMethod])

  async function confirm() {
    setSaving(true)
    await onConfirm(method)
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button full loading={saving} onClick={confirm}>
            Confirmar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {summary && <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">{summary}</div>}
        <Select label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </Modal>
  )
}
