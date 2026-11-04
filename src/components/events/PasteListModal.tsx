import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { sortByName } from '../../lib/export'
import { parseNames } from '../../lib/pasteList'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, Select, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { EventLot, EventParticipant, EventSeller, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  eventId: string
  lots: EventLot[]
  sellers: EventSeller[]
  /** comissário já escolhido ao colar pela lista dele */
  defaultSellerId?: string | null
  participants: EventParticipant[]
  /** vagas restantes (null = sem limite), usado para avisar quando lotar */
  remaining: number | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export function PasteListModal({ open, eventId, lots, sellers, defaultSellerId, participants, remaining, onClose, onSaved }: Props) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [lotId, setLotId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [paidAt, setPaidAt] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setText('')
    setSellerId(defaultSellerId ?? '')
    setLotId(lots[0]?.id ?? '')
    setAmount(moneyToInput(lots[0]?.price))
    setMethod('pix')
    setPaidAt(todayISO())
  }, [open])

  const { names, repeated } = useMemo(() => parseNames(text, participants.map((p) => p.name)), [text, participants])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!names.length) return toast('Cole pelo menos um nome novo.', 'error')
    if (remaining !== null && names.length > remaining && !confirm('Essa lista passa da capacidade do evento. Adicionar mesmo assim?')) return

    setSaving(true)
    const { error } = await supabase.from('event_participants').insert(
      names.map((name) => ({
        event_id: eventId,
        name,
        lot_id: lotId || null,
        seller_id: sellerId || null,
        amount_paid: parseMoney(amount),
        payment_method: method,
        paid_at: paidAt,
      })),
    )
    if (error) {
      setSaving(false)
      return toast('Erro ao salvar a lista.', 'error')
    }
    toast(`${names.length} pagante${names.length === 1 ? '' : 's'} adicionado${names.length === 1 ? '' : 's'}!`)
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Colar lista de pagantes"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="paste-list-form" full loading={saving} disabled={!names.length}>
            {names.length ? `Adicionar ${names.length}` : 'Adicionar'}
          </Button>
        </>
      }
    >
      <form id="paste-list-form" onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label="Nomes"
          hint="Um nome por linha. Numeração, emojis e telefone são retirados sozinhos."
          rows={7}
          placeholder={'1. Ana Souza\n2. Bruno Lima\n3. Carla Dias'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {(names.length > 0 || repeated.length > 0) && (
          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {names.length > 0 && (
              <>
                <p className="font-semibold">
                  {names.length} nome{names.length === 1 ? '' : 's'} para adicionar
                </p>
                <p className="mt-0.5 text-neutral-500">{names.join(', ')}</p>
              </>
            )}
            {repeated.length > 0 && (
              <p className={`text-amber-700 ${names.length > 0 ? 'mt-2' : ''}`}>
                Repetido{repeated.length === 1 ? '' : 's'}, não entra{repeated.length === 1 ? '' : 'm'}: {repeated.join(', ')}
              </p>
            )}
          </div>
        )}
        {sellers.length > 0 && (
          <Select label="Comissário" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            <option value="">Sem comissário</option>
            {sortByName(sellers).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Lote"
          value={lotId}
          onChange={(e) => {
            const lot = lots.find((l) => l.id === e.target.value)
            setLotId(e.target.value)
            if (lot) setAmount(moneyToInput(lot.price))
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
          <MoneyInput label="Valor pago (cada)" required value={amount} onChange={setAmount} />
          <Select label="Forma" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Data do pagamento" type="date" required value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </form>
    </Modal>
  )
}
