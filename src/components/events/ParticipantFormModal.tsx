import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, isValidPhone, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, PhoneInput, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { EventLot, EventParticipant, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  eventId: string
  participant?: EventParticipant | null
  lots: EventLot[]
  /** vagas restantes (null = sem limite), usado para avisar quando lotar */
  remaining: number | null
  onClose: () => void
  onSaved: (keepOpen: boolean) => void
}

interface FormState {
  name: string
  phone: string
  lotId: string
  amount: string
  method: PaymentMethod
  paidAt: string
}

function initial(lots: EventLot[], p?: EventParticipant | null): FormState {
  const lot = lots[0]
  return {
    name: p?.name ?? '',
    phone: p?.phone ?? '',
    lotId: p ? (p.lot_id ?? '') : (lot?.id ?? ''),
    amount: p ? moneyToInput(p.amount_paid) : moneyToInput(lot?.price),
    method: p?.payment_method ?? 'pix',
    paidAt: p?.paid_at ?? todayISO(),
  }
}

export function ParticipantFormModal({ open, eventId, participant, lots, remaining, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(lots, participant))
  const [phoneError, setPhoneError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial(lots, participant))
      setPhoneError(undefined)
    }
  }, [open])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save(keepOpen: boolean) {
    if (!form.name.trim()) return toast('Informe o nome.', 'error')
    if (form.phone && !isValidPhone(form.phone)) {
      setPhoneError('Informe DDD + número (10 ou 11 dígitos).')
      return
    }
    if (!participant && remaining !== null && remaining <= 0 && !confirm('A capacidade do evento já foi atingida. Adicionar mesmo assim?')) return

    setSaving(true)
    const payload = {
      event_id: eventId,
      name: form.name.trim(),
      phone: form.phone || null,
      lot_id: form.lotId || null,
      amount_paid: parseMoney(form.amount),
      payment_method: form.method,
      paid_at: form.paidAt,
    }
    const { error } = participant
      ? await supabase.from('event_participants').update(payload).eq('id', participant.id)
      : await supabase.from('event_participants').insert(payload)
    setSaving(false)
    if (error) return toast('Erro ao salvar participante.', 'error')
    toast(participant ? 'Participante atualizado!' : `${form.name.trim()} adicionado!`)
    if (keepOpen) {
      // mantém lote/forma/data para agilizar o próximo cadastro
      setForm((f) => ({ ...f, name: '', phone: '' }))
    }
    onSaved(keepOpen)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    save(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={participant ? 'Editar participante' : 'Adicionar pagante'}
      footer={
        participant ? (
          <>
            <Button variant="secondary" full onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="participant-form" full loading={saving}>
              Salvar
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" full loading={saving} onClick={() => save(true)}>
              Salvar e próximo
            </Button>
            <Button type="submit" form="participant-form" full loading={saving}>
              Salvar
            </Button>
          </>
        )
      }
    >
      <form id="participant-form" onSubmit={handleSubmit} className="space-y-4">
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
          label="Lote"
          value={form.lotId}
          onChange={(e) => {
            const lot = lots.find((l) => l.id === e.target.value)
            setForm((f) => ({ ...f, lotId: e.target.value, amount: lot ? moneyToInput(lot.price) : f.amount }))
          }}
        >
          <option value="">Sem lote</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {formatCurrency(l.price)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Valor pago" required value={form.amount} onChange={(v) => set('amount', v)} />
          <Select label="Forma" value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Data do pagamento" type="date" required value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} />
      </form>
    </Modal>
  )
}
