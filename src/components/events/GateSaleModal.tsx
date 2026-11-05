import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, isValidPhone, normalizeText, parseMoney } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, PhoneInput, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'

interface Props {
  open: boolean
  eventId: string
  /** o que estava na busca: quem não achou o nome já começa com ele preenchido */
  initialName: string
  /** nomes que já estão na lista, para avisar antes de vender de novo */
  takenNames: string[]
  onClose: () => void
  onSaved: () => Promise<void>
}

/** Venda na hora pelo login de portaria */
export function GateSaleModal({ open, eventId, initialName, takenNames, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string>()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setPhone('')
    setPhoneError(undefined)
    setAmount('')
    setMethod('')
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const person = name.trim()
    if (!person) return toast('Informe o nome.', 'error')
    if (phone && !isValidPhone(phone)) {
      setPhoneError('Informe DDD + número (10 ou 11 dígitos).')
      return
    }
    const value = parseMoney(amount)
    if (value <= 0) return toast('Informe o valor pago.', 'error')
    if (!method) return toast('Escolha a forma de pagamento.', 'error')
    const taken = takenNames.some((n) => normalizeText(n) === normalizeText(person))
    if (taken && !confirm(`${person} já está na lista. Registrar a venda mesmo assim?`)) return

    setSaving(true)
    const { error } = await supabase.rpc('gate_register_sale', { p_event: eventId, p_name: person, p_phone: phone || null, p_amount: value, p_method: method })
    if (error) {
      setSaving(false)
      return toast(error.message.includes('sem_permissao') ? 'Este evento não está mais liberado para você.' : 'Venda não registrada. Confira a internet e tente de novo.', 'error')
    }
    toast(`Venda registrada: ${person}`)
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar venda"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="gate-sale-form" full loading={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="gate-sale-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        <PhoneInput
          label="Telefone (opcional)"
          value={phone}
          onChange={(v) => {
            setPhone(v)
            setPhoneError(undefined)
          }}
          error={phoneError}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Valor pago" required value={amount} onChange={setAmount} />
          <Select label="Forma" required value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Escolha</option>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  )
}
