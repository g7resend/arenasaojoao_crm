import { TZ, addDays, formatCurrency, formatDateShort, PAYMENT_METHODS } from './format'
import type { BarCashSession, BarProduct, BarSaleWithItems, PaymentMethod } from '../types/db'

export const PRODUCT_CATEGORIES = ['Bebidas', 'Lanches', 'Doces', 'Outros']
export const EXPENSE_CATEGORIES = ['Compra de mercadoria', 'Gelo', 'Descartáveis', 'Limpeza', 'Manutenção', 'Outros']
export const METHOD_ORDER: PaymentMethod[] = ['pix', 'dinheiro', 'cartao']

/** Timestamp → HH:MM no horário de São Paulo */
export function timeOf(ts: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
}

/** Timestamp → YYYY-MM-DD no horário de São Paulo */
export function dateOf(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts))
}

/** Limites (timestamptz) para filtrar de from 00:00 até o fim de to, horário de Brasília */
export function dayBounds(from: string, to: string) {
  return { start: `${from}T00:00:00-03:00`, end: `${addDays(to, 1)}T00:00:00-03:00` }
}

/** Primeiro e último dia do mês (YYYY-MM-DD) */
export function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { from, to: addDays(next, -1) }
}

export type StockLevel = 'ok' | 'baixo' | 'zerado'

export function stockLevel(p: Pick<BarProduct, 'stock' | 'min_stock'>): StockLevel {
  if (p.stock <= 0) return 'zerado'
  if (p.min_stock > 0 && p.stock <= p.min_stock) return 'baixo'
  return 'ok'
}

/** "2x Água, 1x Coxinha" */
export function itemsSummary(sale: BarSaleWithItems): string {
  return sale.bar_sale_items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
}

const ERRORS: Record<string, string> = {
  CAIXA_FECHADO: 'O caixa está fechado. Abra o caixa para continuar.',
  CAIXA_JA_FECHADO: 'Este caixa já foi fechado; a venda não pode mais ser cancelada.',
  VENDA_VAZIA: 'Adicione pelo menos um produto.',
  QUANTIDADE_INVALIDA: 'Quantidade inválida.',
  PRODUTO_NAO_ENCONTRADO: 'Produto não encontrado. Atualize a página.',
}

/** Traduz os erros das funções do banco; usa a mensagem padrão nos demais */
export function barError(error: { message?: string } | null, fallback: string): string {
  const code = Object.keys(ERRORS).find((k) => error?.message?.includes(k))
  return code ? ERRORS[code] : fallback
}

/** Resumo do fechamento em texto para colar no WhatsApp */
export function closingText(session: BarCashSession, sales: BarSaleWithItems[], arenaName: string): string {
  const diff = Number(session.counted_cash ?? 0) - Number(session.expected_cash ?? 0)
  const top = topProducts(sales).slice(0, 10)
  const lines = [
    `*Fechamento do bar · ${arenaName}*`,
    `${formatDateShort(dateOf(session.opened_at))} · ${timeOf(session.opened_at)} às ${session.closed_at ? timeOf(session.closed_at) : '—'}`,
    '',
    `Vendas: *${formatCurrency(session.total_sales)}* (${session.sales_count ?? 0})`,
    ...METHOD_ORDER.map((m) => `• ${PAYMENT_METHODS[m]}: ${formatCurrency(session[`total_${m}`])}`),
    '',
    `Troco inicial: ${formatCurrency(session.opening_amount)}`,
    `Saídas do caixa: ${formatCurrency(session.total_expenses)}`,
    `Dinheiro esperado: ${formatCurrency(session.expected_cash)}`,
    `Dinheiro contado: ${formatCurrency(session.counted_cash)}${diff === 0 ? ' ✅' : diff > 0 ? ` (sobrou ${formatCurrency(diff)})` : ` (faltou ${formatCurrency(-diff)})`}`,
  ]
  if (top.length) lines.push('', '*Mais vendidos*', ...top.map((t) => `${t.quantity}x ${t.name} · ${formatCurrency(t.total)}`))
  if (session.notes) lines.push('', `Obs.: ${session.notes}`)
  return lines.join('\n')
}

/** Soma por produto das vendas não canceladas, do mais vendido ao menos vendido */
export function topProducts(sales: BarSaleWithItems[]) {
  const map = new Map<string, { name: string; quantity: number; total: number }>()
  for (const s of sales) {
    if (s.canceled) continue
    for (const i of s.bar_sale_items) {
      const key = i.product_id ?? i.product_name
      const cur = map.get(key) ?? { name: i.product_name, quantity: 0, total: 0 }
      cur.quantity += i.quantity
      cur.total += i.quantity * Number(i.unit_price)
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.total - a.total)
}
