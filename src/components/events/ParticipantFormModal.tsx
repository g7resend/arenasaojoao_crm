import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { LIST_TYPES, PAYMENT_METHODS, formatCurrency, isValidPhone, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { sortByName } from '../../lib/export'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, PhoneInput, Select } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { EventLot, EventParticipant, EventSeller, ListType, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  eventId: string
  participant?: EventParticipant | null
  lots: EventLot[]
  sellers: EventSeller[]
  /** comissário já escolhido ao adicionar pela lista dele */
  defaultSellerId?: string | null
  /** lista já escolhida ao adicionar por Cortesias ou Divulgação */
  defaultListType?: ListType
  /** vagas restantes (null = sem limite), usado para avisar quando lotar */
  remaining: number | null
  onClose: () => void
  onSaved: (keepOpen: boolean) => void
}

interface FormState {
  name: string
  phone: string
  listType: ListType
  lotId: string
  sellerId: string
  amount: string
  method: PaymentMethod
  paidAt: string
}

function initial(lots: EventLot[], p?: EventParticipant | null, defaultSellerId?: string | null, defaultListType?: ListType): FormState {
  const lot = lots[0]
  // cortesia e divulgação não têm lote nem valor: se virar pagante, parte do primeiro lote
  const paying = p?.list_type === 'pagante' ? p : null
  return {
    name: p?.name ?? '',
    phone: p?.phone ?? '',
    listType: p?.list_type ?? defaultListType ?? 'pagante',
    lotId: paying ? (paying.lot_id ?? '') : (lot?.id ?? ''),
    sellerId: (p ? p.seller_id : defaultSellerId) ?? '',
    amount: moneyToInput(paying ? paying.amount_paid : lot?.price),
    method: p?.payment_method ?? 'pix',
    paidAt: p?.paid_at ?? todayISO(),
  }
}

export function ParticipantFormModal({ open, eventId, participant, lots, sellers, defaultSellerId, defaultListType, remaining, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(lots, participant, defaultSellerId, defaultListType))
  const [phoneError, setPhoneError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial(lots, participant, defaultSellerId, defaultListType))
      setPhoneError(undefined)
    }
  }, [open])

  const paid = form.listType === 'pagante'

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
      list_type: form.listType,
      lot_id: paid ? form.lotId || null : null,
      seller_id: paid ? form.sellerId || null : null,
      amount_paid: paid ? parseMoney(form.amount) : 0,
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
      // mantém lote/comissário/forma/data para agilizar o próximo cadastro
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
      title={participant ? 'Editar participante' : `Adicionar ${LIST_TYPES[form.listType].toLowerCase()}`}
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
        <Select label="Lista" value={form.listType} onChange={(e) => set('listType', e.target.value as ListType)}>
          {Object.entries(LIST_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {paid && sellers.length > 0 && (
          <Select label="Comissário" value={form.sellerId} onChange={(e) => set('sellerId', e.target.value)}>
            <option value="">Sem comissário</option>
            {sortByName(sellers).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {paid && (
          <>
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
          </>
        )}
      </form>
    </Modal>
  )
}
