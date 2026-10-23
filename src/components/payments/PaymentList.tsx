import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MessageCircle, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCompetence, formatCurrency, formatDate } from '../../lib/format'
import { PAYMENT_STATUS, billingMessage } from '../../lib/billing'
import { openWhatsApp } from '../../lib/whatsapp'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Misc'
import { Dropdown } from '../ui/Dropdown'
import { EditPaymentModal, MarkPaidModal } from './PaymentModals'
import type { PaymentView } from '../../types/db'

interface Props {
  payments: PaymentView[]
  /** true = mostra o nome do aluno (tela de mensalidades); false = histórico do aluno */
  showStudent?: boolean
  onChanged: () => void
}

export function PaymentList({ payments, showStudent = true, onChanged }: Props) {
  const { settings } = useSettings()
  const toast = useToast()
  const [paying, setPaying] = useState<PaymentView | null>(null)
  const [editing, setEditing] = useState<PaymentView | null>(null)

  function charge(p: PaymentView) {
    if (!p.student_phone) return toast('Este aluno não tem telefone cadastrado.', 'error')
    if (!settings) return
    openWhatsApp(p.student_phone, billingMessage(settings, p))
  }

  async function undoPayment(p: PaymentView) {
    if (!confirm(`Desfazer o pagamento de ${p.student_name} (${formatCompetence(p.competence)})?`)) return
    const { error } = await supabase.from('payments').update({ status: 'pendente', paid_at: null }).eq('id', p.id)
    if (error) return toast('Erro ao desfazer pagamento.', 'error')
    toast('Pagamento desfeito.')
    onChanged()
  }

  async function remove(p: PaymentView) {
    if (!confirm(`Excluir a mensalidade de ${p.student_name} (${formatCompetence(p.competence)})?`)) return
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    if (error) return toast('Erro ao excluir mensalidade.', 'error')
    toast('Mensalidade excluída.')
    onChanged()
  }

  return (
    <>
      <ul className="divide-y divide-neutral-100">
        {payments.map((p) => {
          const st = PAYMENT_STATUS[p.computed_status]
          const paid = p.computed_status === 'pago'
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showStudent ? (
                    <Link to={`/alunos/${p.student_id}`} className="block truncate font-medium text-neutral-900 hover:text-brand-800">
                      {p.student_name}
                    </Link>
                  ) : (
                    <p className="font-medium text-neutral-900">{formatCompetence(p.competence)}</p>
                  )}
                  <p className="text-sm text-neutral-500">
                    {showStudent && `${formatCompetence(p.competence)} · `}
                    {paid
                      ? `Pago em ${formatDate(p.paid_at)}${p.payment_method ? ` · ${PAYMENT_METHODS[p.payment_method]}` : ''}`
                      : `Vence ${formatDate(p.due_date)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums text-neutral-900">{formatCurrency(p.amount)}</span>
                    <Badge color={st.color}>{st.label}</Badge>
                  </div>
                  <div className="-mr-2">
                    <Dropdown
                      items={[
                        { label: 'Editar valor/vencimento', icon: <Pencil size={16} />, onClick: () => setEditing(p), hidden: paid },
                        { label: 'Desfazer pagamento', icon: <RotateCcw size={16} />, onClick: () => undoPayment(p), hidden: !paid },
                        { label: 'Excluir mensalidade', icon: <Trash2 size={16} />, onClick: () => remove(p), danger: true },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {!paid && (
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" icon={<CheckCircle2 size={16} />} onClick={() => setPaying(p)}>
                    Marcar como pago
                  </Button>
                  <Button size="sm" variant="whatsapp" icon={<MessageCircle size={16} />} onClick={() => charge(p)}>
                    Cobrar
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <MarkPaidModal
        payment={paying}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null)
          onChanged()
        }}
      />
      <EditPaymentModal
        payment={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onChanged()
        }}
      />
    </>
  )
}
