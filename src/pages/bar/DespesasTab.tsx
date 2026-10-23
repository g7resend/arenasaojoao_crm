import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { MONTHS, PAYMENT_METHODS, currentYearMonth, formatCurrency, formatDateShort } from '../../lib/format'
import { dayBounds, monthRange } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { Dropdown } from '../../components/ui/Dropdown'
import { ExpenseFormModal } from '../../components/bar/ExpenseFormModal'
import type { BarExpense } from '../../types/db'

type ExpenseRow = BarExpense & { bar_cash_sessions: { closed_at: string | null } | null }
type SoldItem = { quantity: number; unit_price: number; unit_cost: number }

export default function DespesasTab() {
  const toast = useToast()
  const [{ year, month }, setYm] = useState(currentYearMonth)
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [sold, setSold] = useState<SoldItem[]>([])
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ open: boolean; expense: BarExpense | null }>({ open: false, expense: null })

  const load = useCallback(async () => {
    const { from, to } = monthRange(year, month)
    const { start, end } = dayBounds(from, to)
    const [e, s, o] = await Promise.all([
      supabase
        .from('bar_expenses')
        .select('*, bar_cash_sessions(closed_at)')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('bar_sale_items')
        .select('quantity, unit_price, unit_cost, bar_sales!inner(sold_at, canceled)')
        .eq('bar_sales.canceled', false)
        .gte('bar_sales.sold_at', start)
        .lt('bar_sales.sold_at', end),
      supabase.from('bar_cash_sessions').select('id').is('closed_at', null).maybeSingle(),
    ])
    if (e.error || s.error) toast('Erro ao carregar as despesas.', 'error')
    setExpenses((e.data as ExpenseRow[]) ?? [])
    setSold((s.data as unknown as SoldItem[]) ?? [])
    setOpenSessionId(o.data?.id ?? null)
    setLoading(false)
  }, [year, month, toast])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function shiftMonth(delta: number) {
    setYm(({ year, month }) => {
      const m = month + delta
      if (m < 1) return { year: year - 1, month: 12 }
      if (m > 12) return { year: year + 1, month: 1 }
      return { year, month: m }
    })
  }

  async function remove(e: BarExpense) {
    if (!confirm(`Excluir a despesa "${e.description}" de ${formatCurrency(e.amount)}?`)) return
    const { error } = await supabase.from('bar_expenses').delete().eq('id', e.id)
    if (error) return toast('Erro ao excluir a despesa.', 'error')
    toast('Despesa excluída.')
    load()
  }

  const sales = sold.reduce((a, i) => a + i.quantity * Number(i.unit_price), 0)
  const productProfit = sold.some((i) => Number(i.unit_cost) > 0) ? sold.reduce((a, i) => a + i.quantity * (Number(i.unit_price) - Number(i.unit_cost)), 0) : null
  const spent = expenses.reduce((a, e) => a + Number(e.amount), 0)
  const balance = sales - spent

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl bg-white ring-1 ring-neutral-200">
          <IconButton label="Mês anterior" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="min-w-28 text-center text-sm font-semibold text-neutral-800">
            {MONTHS[month - 1]}/{year}
          </span>
          <IconButton label="Próximo mês" onClick={() => shiftMonth(1)}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <Button icon={<Plus size={16} />} className="ml-auto" onClick={() => setForm({ open: true, expense: null })}>
          Nova despesa
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card className="mb-4 px-4 py-2">
            <div className="flex justify-between py-1 text-sm">
              <span className="text-neutral-600">Vendas do bar</span>
              <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(sales)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-neutral-600">− Despesas</span>
              <span className="font-semibold tabular-nums text-red-700">{formatCurrency(spent)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-neutral-100 pt-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Saldo do mês</span>
              <span className={`text-xl font-bold tabular-nums ${balance < 0 ? 'text-red-700' : 'text-neutral-900'}`}>{formatCurrency(balance)}</span>
            </div>
          </Card>
          {(productProfit !== null || byCategory.length > 1) && (
            <div className="mb-4 space-y-1 text-sm text-neutral-600">
              {productProfit !== null && (
                <p>
                  Lucro nos produtos vendidos (preço − custo): <strong className="text-neutral-900">{formatCurrency(productProfit)}</strong>
                </p>
              )}
              {byCategory.length > 1 && <p>{byCategory.map(([c, v]) => `${c} ${formatCurrency(v)}`).join(' · ')}</p>}
            </div>
          )}

          <Card>
            {expenses.length === 0 ? (
              <EmptyState
                icon={<Receipt size={40} />}
                title="Nenhuma despesa neste mês"
                description="Lance aqui as compras de mercadoria, gelo, descartáveis e outros gastos do bar."
              />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {expenses.map((e) => {
                  const locked = !!e.bar_cash_sessions?.closed_at
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-neutral-900">{e.description}</p>
                        <p className="text-xs text-neutral-500">
                          {formatDateShort(e.expense_date)} · {e.category} · {PAYMENT_METHODS[e.payment_method]}
                        </p>
                        {e.session_id && (
                          <div className="mt-1">
                            <Badge color="blue">Saiu do caixa</Badge>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-red-700">{formatCurrency(e.amount)}</span>
                      <div className="-mr-2 w-9 shrink-0">
                        {/* saídas de um caixa já fechado ficam travadas para não mudar o fechamento */}
                        <Dropdown
                          items={[
                            { label: 'Editar', icon: <Pencil size={16} />, onClick: () => setForm({ open: true, expense: e }), hidden: locked },
                            { label: 'Excluir', icon: <Trash2 size={16} />, onClick: () => remove(e), danger: true, hidden: locked },
                          ]}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <ExpenseFormModal
        open={form.open}
        expense={form.expense}
        openSessionId={openSessionId}
        onClose={() => setForm({ open: false, expense: null })}
        onSaved={async () => {
          await load()
          setForm({ open: false, expense: null })
        }}
      />
    </>
  )
}
