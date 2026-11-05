import { Check, Pencil, Trash2 } from 'lucide-react'
import { LIST_TYPES, PAYMENT_METHODS, formatCurrency, formatDate } from '../../lib/format'
import { IconButton } from '../ui/Button'
import type { EventParticipant } from '../../types/db'

interface Props {
  participant: EventParticipant
  lotName?: string
  sellerName?: string
  onToggleCheckIn: () => void
  onEdit: () => void
  onRemove: () => void
}

/** Linha de uma lista do evento: check-in, dados e ações de editar/excluir */
export function ParticipantRow({ participant: p, lotName, sellerName, onToggleCheckIn, onEdit, onRemove }: Props) {
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${p.checked_in ? 'bg-emerald-50/50' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={p.checked_in}
        aria-label={`Check-in de ${p.name}`}
        onClick={onToggleCheckIn}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
          p.checked_in ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white text-transparent hover:border-emerald-500'
        }`}
      >
        <Check size={22} strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium ${p.checked_in ? 'text-emerald-800' : 'text-neutral-900'}`}>{p.name}</p>
        <p className="text-xs text-neutral-500">
          {p.list_type === 'pagante'
            ? [lotName, formatCurrency(p.amount_paid), PAYMENT_METHODS[p.payment_method], formatDate(p.paid_at), sellerName && `Comissário: ${sellerName}`].filter(Boolean).join(' · ')
            : LIST_TYPES[p.list_type]}
        </p>
      </div>
      <IconButton label={`Editar ${p.name}`} onClick={onEdit}>
        <Pencil size={16} />
      </IconButton>
      <IconButton label={`Excluir ${p.name}`} onClick={onRemove} className="text-red-500 hover:bg-red-50 hover:text-red-600">
        <Trash2 size={16} />
      </IconButton>
    </li>
  )
}
