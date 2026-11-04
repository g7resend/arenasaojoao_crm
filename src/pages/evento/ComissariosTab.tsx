import { useState } from 'react'
import { ChevronDown, ClipboardPaste, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency } from '../../lib/format'
import { sortByName } from '../../lib/export'
import { useToast } from '../../hooks/useToast'
import { Button } from '../../components/ui/Button'
import { Card, EmptyState } from '../../components/ui/Misc'
import { Dropdown } from '../../components/ui/Dropdown'
import { ParticipantRow } from '../../components/events/ParticipantRow'
import { SellerFormModal } from '../../components/events/SellerFormModal'
import type { EventLot, EventParticipant, EventSeller, PaymentMethod } from '../../types/db'

interface Props {
  eventId: string
  sellers: EventSeller[]
  lots: EventLot[]
  participants: EventParticipant[]
  reload: () => Promise<void>
  onAddParticipant: (sellerId: string | null) => void
  onPasteList: (sellerId: string | null) => void
  onEditParticipant: (p: EventParticipant) => void
  onToggleCheckIn: (p: EventParticipant) => void
  onRemoveParticipant: (p: EventParticipant) => void
}

const countLabel = (n: number) => `${n} ingresso${n === 1 ? '' : 's'}`
const sum = (list: EventParticipant[]) => list.reduce((a, p) => a + Number(p.amount_paid), 0)

export default function ComissariosTab({ eventId, sellers, lots, participants, reload, onAddParticipant, onPasteList, onEditParticipant, onToggleCheckIn, onRemoveParticipant }: Props) {
  const toast = useToast()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; seller: EventSeller | null }>({ open: false, seller: null })

  const soldBy = (sellerId: string | null) => sortByName(participants.filter((p) => p.seller_id === sellerId))
  const direct = soldBy(null)

  async function removeSeller(s: EventSeller) {
    const n = soldBy(s.id).length
    const note = n ? ` ${n === 1 ? 'O pagante dele continua' : `Os ${n} pagantes dele continuam`} na lista total, como "sem comissário".` : ''
    if (!confirm(`Excluir o comissário ${s.name}?${note}`)) return
    const { error } = await supabase.from('event_sellers').delete().eq('id', s.id)
    if (error) return toast('Erro ao excluir o comissário.', 'error')
    toast('Comissário excluído.')
    reload()
  }

  function renderGroup(key: string, name: string, sellerId: string | null, seller?: EventSeller) {
    const list = soldBy(sellerId)
    const isOpen = expanded === key
    const byMethod = (Object.keys(PAYMENT_METHODS) as PaymentMethod[])
      .map((m) => ({ label: PAYMENT_METHODS[m], total: sum(list.filter((p) => p.payment_method === m)) }))
      .filter((m) => m.total > 0)
    return (
      <Card key={key}>
        <div className="flex items-center gap-1 pr-2">
          <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : key)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-neutral-900">{name}</p>
              <p className="text-sm text-neutral-500">
                {countLabel(list.length)} · <strong className="font-semibold tabular-nums text-emerald-700">{formatCurrency(sum(list))}</strong>
              </p>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {seller && (
            <Dropdown
              items={[
                { label: 'Editar nome', icon: <Pencil size={16} />, onClick: () => setForm({ open: true, seller }) },
                { label: 'Excluir comissário', icon: <Trash2 size={16} />, onClick: () => removeSeller(seller), danger: true },
              ]}
            />
          )}
        </div>
        {isOpen && (
          <div className="border-t border-neutral-100">
            <div className="space-y-2 px-4 py-3">
              {byMethod.length > 0 && <p className="text-xs text-neutral-500">{byMethod.map((m) => `${m.label}: ${formatCurrency(m.total)}`).join(' · ')}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<UserPlus size={16} />} onClick={() => onAddParticipant(sellerId)}>
                  Adicionar pagante
                </Button>
                <Button size="sm" variant="secondary" icon={<ClipboardPaste size={16} />} onClick={() => onPasteList(sellerId)}>
                  Colar lista
                </Button>
              </div>
            </div>
            {list.length > 0 && (
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                {list.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    lotName={lots.find((l) => l.id === p.lot_id)?.name}
                    onToggleCheckIn={() => onToggleCheckIn(p)}
                    onEdit={() => onEditParticipant(p)}
                    onRemove={() => onRemoveParticipant(p)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Button icon={<Plus size={16} />} onClick={() => setForm({ open: true, seller: null })}>
          Novo comissário
        </Button>
      </div>

      {sellers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={40} />}
            title="Nenhum comissário ainda"
            description="Cadastre quem vende ingresso. Cada comissário tem a sua lista de pagantes, e todas entram na lista total do evento."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortByName(sellers).map((s) => renderGroup(s.id, s.name, s.id, s))}
          {direct.length > 0 && renderGroup('direto', 'Sem comissário', null)}
        </div>
      )}

      <SellerFormModal
        open={form.open}
        eventId={eventId}
        seller={form.seller}
        onClose={() => setForm({ open: false, seller: null })}
        onSaved={async () => {
          await reload()
          setForm({ open: false, seller: null })
        }}
      />
    </>
  )
}
