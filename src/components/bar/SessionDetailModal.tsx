import { useEffect, useState, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, formatDateLong } from '../../lib/format'
import { METHOD_ORDER, closingText, dateOf, itemsSummary, timeOf, topProducts } from '../../lib/bar'
import { copyToClipboard } from '../../lib/whatsapp'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Badge, Spinner } from '../ui/Misc'
import { Modal } from '../ui/Modal'
import type { BarCashSession, BarExpense, BarSaleWithItems } from '../../types/db'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </div>
  )
}

/** Resumo completo de um caixa já fechado */
export function SessionDetailModal({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const toast = useToast()
  const { settings } = useSettings()
  const [session, setSession] = useState<BarCashSession | null>(null)
  const [sales, setSales] = useState<BarSaleWithItems[]>([])
  const [expenses, setExpenses] = useState<BarExpense[]>([])

  useEffect(() => {
    if (!sessionId) return
    setSession(null)
    Promise.all([
      supabase.from('bar_cash_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('bar_sales').select('*, bar_sale_items(*)').eq('session_id', sessionId).order('sold_at'),
      supabase.from('bar_expenses').select('*').eq('session_id', sessionId).order('created_at'),
    ]).then(([s, v, e]) => {
      if (s.error || v.error || e.error) toast('Erro ao carregar o fechamento.', 'error')
      setSession(s.data as BarCashSession)
      setSales((v.data as BarSaleWithItems[]) ?? [])
      setExpenses((e.data as BarExpense[]) ?? [])
    })
  }, [sessionId, toast])

  async function copy() {
    if (!session) return
    const ok = await copyToClipboard(closingText(session, sales, settings?.arena_name ?? 'Arena São João'))
    toast(ok ? 'Resumo copiado! Cole no WhatsApp.' : 'Não foi possível copiar.', ok ? 'success' : 'error')
  }

  const diff = session ? Number(session.counted_cash ?? 0) - Number(session.expected_cash ?? 0) : 0
  const top = topProducts(sales)

  return (
    <Modal
      open={!!sessionId}
      onClose={onClose}
      title="Fechamento do caixa"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Fechar
          </Button>
          <Button full icon={<Copy size={16} />} disabled={!session} onClick={copy}>
            Copiar resumo
          </Button>
        </>
      }
    >
      {!session ? (
        <Spinner />
      ) : (
        <div className="space-y-5 text-sm">
          <p className="text-neutral-600">
            {formatDateLong(dateOf(session.opened_at))} · {timeOf(session.opened_at)} às {session.closed_at ? timeOf(session.closed_at) : '—'}
          </p>

          <Section title="Vendas">
            <p className="text-2xl font-bold tabular-nums text-emerald-700">{formatCurrency(session.total_sales)}</p>
            <p className="mb-2 text-neutral-500">
              {session.sales_count ?? 0} venda{session.sales_count === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {METHOD_ORDER.map((m) => (
                <div key={m} className="rounded-xl bg-neutral-50 px-3 py-2">
                  <p className="text-xs text-neutral-500">{PAYMENT_METHODS[m]}</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(session[`total_${m}`])}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Conferência do dinheiro">
            <div className="rounded-xl bg-neutral-50 px-4 py-2">
              {[
                ['Troco inicial', session.opening_amount],
                ['+ Vendas em dinheiro', session.total_dinheiro],
                ['− Saídas do caixa', session.total_expenses],
                ['= Deveria ter', session.expected_cash],
                ['Contado', session.counted_cash],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-0.5 text-neutral-600">
                  <span>{label}</span>
                  <span className="tabular-nums">{formatCurrency(value)}</span>
                </div>
              ))}
              <div
                className={`mt-1 flex justify-between border-t border-neutral-200 pt-1.5 font-semibold ${
                  Math.abs(diff) < 0.005 ? 'text-emerald-700' : diff > 0 ? 'text-amber-700' : 'text-red-700'
                }`}
              >
                <span>{Math.abs(diff) < 0.005 ? 'Confere' : diff > 0 ? 'Sobrou' : 'Faltou'}</span>
                <span className="tabular-nums">{formatCurrency(Math.abs(diff))}</span>
              </div>
            </div>
          </Section>

          {top.length > 0 && (
            <Section title="Mais vendidos">
              <ul className="divide-y divide-neutral-100">
                {top.map((t) => (
                  <li key={t.name} className="flex justify-between py-1.5">
                    <span>
                      <strong className="tabular-nums">{t.quantity}x</strong> {t.name}
                    </span>
                    <span className="tabular-nums text-neutral-600">{formatCurrency(t.total)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {expenses.length > 0 && (
            <Section title="Saídas do caixa">
              <ul className="divide-y divide-neutral-100">
                {expenses.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">{e.description}</span>
                    <span className="shrink-0 tabular-nums text-red-700">− {formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {sales.length > 0 && (
            <Section title="Todas as vendas">
              <ul className="divide-y divide-neutral-100">
                {sales.map((s) => (
                  <li key={s.id} className={`flex items-start gap-3 py-1.5 ${s.canceled ? 'text-neutral-400' : ''}`}>
                    <span className="w-11 shrink-0 tabular-nums text-neutral-500">{timeOf(s.sold_at)}</span>
                    <span className={`min-w-0 flex-1 ${s.canceled ? 'line-through' : ''}`}>{itemsSummary(s)}</span>
                    <span className="shrink-0 text-right">
                      <span className={`block tabular-nums ${s.canceled ? 'line-through' : 'font-medium'}`}>{formatCurrency(s.total)}</span>
                      {s.canceled ? <Badge color="red">Cancelada</Badge> : <span className="text-xs text-neutral-500">{PAYMENT_METHODS[s.payment_method]}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {session.notes && (
            <Section title="Observações">
              <p className="whitespace-pre-line text-neutral-700">{session.notes}</p>
            </Section>
          )}
        </div>
      )}
    </Modal>
  )
}
