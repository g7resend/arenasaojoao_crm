import type { ComputedPaymentStatus, PaymentView, Settings } from '../types/db'
import { formatCompetence, formatCurrency, formatDate } from './format'
import { fillTemplate } from './whatsapp'

export const PAYMENT_STATUS: Record<ComputedPaymentStatus, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  pago: { label: 'Pago', color: 'green' },
  pendente: { label: 'Pendente', color: 'yellow' },
  atrasado: { label: 'Atrasado', color: 'red' },
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Mensagem de cobrança a partir do template das Configurações */
export function billingMessage(settings: Settings, p: Pick<PaymentView, 'student_name' | 'amount' | 'due_date' | 'competence'>): string {
  return fillTemplate(settings.tpl_billing, {
    nome: firstName(p.student_name),
    valor: formatCurrency(p.amount),
    vencimento: formatDate(p.due_date),
    competencia: formatCompetence(p.competence),
    chave_pix: settings.pix_key || '(consulte a recepção)',
  })
}

export type FinancialStatus = 'em_dia' | 'pendente' | 'atrasado'

/** Situação financeira do aluno a partir das mensalidades em aberto */
export function financialStatus(open: Pick<PaymentView, 'computed_status'>[]): FinancialStatus {
  if (open.some((p) => p.computed_status === 'atrasado')) return 'atrasado'
  if (open.some((p) => p.computed_status === 'pendente')) return 'pendente'
  return 'em_dia'
}

export const FINANCIAL_STATUS: Record<FinancialStatus, { label: string; color: 'green' | 'yellow' | 'red' }> = {
  em_dia: { label: 'Em dia', color: 'green' },
  pendente: { label: 'Pendente', color: 'yellow' },
  atrasado: { label: 'Atrasado', color: 'red' },
}
