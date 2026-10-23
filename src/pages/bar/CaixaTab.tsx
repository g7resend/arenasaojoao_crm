import { useCallback, useEffect, useState } from 'react'
import { ArrowDownCircle, Ban, Lock, LockOpen, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, formatDayLabel } from '../../lib/format'
import { METHOD_ORDER, barError, dateOf, itemsSummary, timeOf } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../../components/ui/Button'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { Dropdown } from '../../components/ui/Dropdown'
import { SaleModal } from '../../components/bar/SaleModal'
import { CloseSessionModal, OpenSessionModal } from '../../components/bar/CashModals'
import { ExpenseFormModal } from '../../components/bar/ExpenseFormModal'
import { SessionDetailModal } from '../../components/bar/SessionDetailModal'
import type { BarCashSession, BarExpense, BarProduct, BarSaleWithItems } from '../../types/db'

export default function CaixaTab({ onGoToProducts }: { onGoToProducts: () => void }) {
  const toast = useToast()
  const [session, setSession] = useState<BarCashSession | null>(null)
  const [sales, setSales] = useState<BarSaleWithItems[]>([])
  const [expenses, setExpenses] = useState<BarExpense[]>([])
  const [products, setProducts] = useState<BarProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'abrir' | 'venda' | 'saida' | 'fechar' | null>(null)
  const [closedId, setClosedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('bar_cash_sessions').select('*').is('closed_at', null).maybeSingle(),
      supabase.from('bar_products').select('*').eq('active', true).order('category').order('name'),
    ])
    if (s.error || p.error) toast('Erro ao carregar o caixa.', 'error')
    const current = (s.data as BarCashSession) ?? null
    setSession(current)
    setProducts((p.data as BarProduct[]) ?? [])
    if (current) {
      const [v, e] = await Promise.all([
        supabase.from('bar_sales').select('*, bar_sale_items(*)').eq('session_id', current.id).order('sold_at', { ascending: false }),
        supabase.from('bar_expenses').select('*').eq('session_id', current.id).order('created_at', { ascending: false }),
      ])
      if (v.error || e.error) toast('Erro ao carregar as vendas.', 'error')
      setSales((v.data as BarSaleWithItems[]) ?? [])
      setExpenses((e.data as BarExpense[]) ?? [])
    } else {
      setSales([])
      setExpenses([])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function cancelSale(sale: BarSaleWithItems) {
    if (!confirm(`Cancelar a venda das ${timeOf(sale.sold_at)} (${itemsSummary(sale)} · ${formatCurrency(sale.total)})?\n\nOs produtos voltam para o estoque.`)) return
    const { error } = await supabase.rpc('bar_cancel_sale', { p_sale: sale.id })
    if (error) return toast(barError(error, 'Erro ao cancelar a venda.'), 'error')
    toast('Venda cancelada. Produtos devolvidos ao estoque.')
    load()
  }

  async function removeExpense(e: BarExpense) {
    if (!confirm(`Excluir a saída "${e.description}" de ${formatCurrency(e.amount)}?`)) return
    const { error } = await supabase.from('bar_expenses').delete().eq('id', e.id)
    if (error) return toast('Erro ao excluir a saída.', 'error')
    toast('Saída excluída.')
    load()
  }

  if (loading) return <Spinner />

  const close = () => setModal(null)
  const afterSave = async () => {
    await load()
    setModal(null)
  }

  // ---------------- Caixa fechado ----------------
  if (!session) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<Lock size={40} />}
            title="O caixa está fechado"
            description="Abra o caixa no começo do expediente, informando o troco que tem na gaveta. Depois é só registrar as vendas."
            action={
              <Button icon={<LockOpen size={16} />} onClick={() => setModal('abrir')}>
                Abrir caixa
              </Button>
            }
          />
        </Card>
        {products.length === 0 && (
          <p className="mt-3 text-center text-sm text-neutral-500">
            Ainda não tem produtos cadastrados.{' '}
            <button type="button" onClick={onGoToProducts} className="font-semibold text-brand-800 underline">
              Cadastrar produtos
            </button>
          </p>
        )}
        <OpenSessionModal open={modal === 'abrir'} onClose={close} onSaved={afterSave} />
        <SessionDetailModal sessionId={closedId} onClose={() => setClosedId(null)} />
      </>
    )
  }

  // ---------------- Caixa aberto ----------------
  const valid = sales.filter((s) => !s.canceled)
  const total = valid.reduce((a, s) => a + Number(s.total), 0)
  const byMethod = Object.fromEntries(METHOD_ORDER.map((m) => [m, valid.filter((s) => s.payment_method === m).reduce((a, s) => a + Number(s.total), 0)]))
  const cashOut = expenses.reduce((a, e) => a + Number(e.amount), 0)
  const drawer = Number(session.opening_amount) + byMethod.dinheiro - cashOut

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Caixa aberto · {formatDayLabel(dateOf(session.opened_at)).split(' · ')[0]} às {timeOf(session.opened_at)}
      </div>

      <Button full icon={<ShoppingCart size={18} />} className="mb-4 h-14 text-base" onClick={() => (products.length ? setModal('venda') : onGoToProducts())}>
        {products.length ? 'Nova venda' : 'Cadastre os produtos para vender'}
      </Button>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 px-4 py-3 lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Vendido</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">{formatCurrency(total)}</p>
          <p className="text-xs text-neutral-500">
            {valid.length} venda{valid.length === 1 ? '' : 's'}
          </p>
        </Card>
        {METHOD_ORDER.filter((m) => m !== 'dinheiro').map((m) => (
          <Card key={m} className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{PAYMENT_METHODS[m]}</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(byMethod[m])}</p>
          </Card>
        ))}
        <Card className="col-span-2 px-4 py-3 lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Dinheiro na gaveta</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(drawer)}</p>
          <p className="text-xs text-neutral-500">
            Troco {formatCurrency(session.opening_amount)} + vendas {formatCurrency(byMethod.dinheiro)}
            {cashOut > 0 && ` − saídas ${formatCurrency(cashOut)}`}
          </p>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" icon={<ArrowDownCircle size={16} />} onClick={() => setModal('saida')}>
          Saída do caixa
        </Button>
        <Button variant="secondary" icon={<Lock size={16} />} onClick={() => setModal('fechar')}>
          Fechar caixa
        </Button>
      </div>

      <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-neutral-900">Vendas deste caixa</h2>
      <Card className="mb-4">
        {sales.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={36} />} title="Nenhuma venda ainda" description='Toque em "Nova venda" para registrar.' />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {sales.map((s) => (
              <li key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${s.canceled ? 'opacity-60' : ''}`}>
                <span className="w-11 shrink-0 text-sm font-bold tabular-nums text-brand-800">{timeOf(s.sold_at)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-neutral-900 ${s.canceled ? 'line-through' : ''}`}>{itemsSummary(s)}</p>
                  {s.canceled ? <Badge color="red">Cancelada</Badge> : <p className="text-xs text-neutral-500">{PAYMENT_METHODS[s.payment_method]}</p>}
                </div>
                <span className={`shrink-0 font-semibold tabular-nums ${s.canceled ? 'line-through' : ''}`}>{formatCurrency(s.total)}</span>
                <div className="-mr-2 w-9 shrink-0">
                  <Dropdown items={[{ label: 'Cancelar venda', icon: <Ban size={16} />, onClick: () => cancelSale(s), danger: true, hidden: s.canceled }]} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {expenses.length > 0 && (
        <>
          <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-neutral-900">Saídas do caixa</h2>
          <Card>
            <ul className="divide-y divide-neutral-100">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-900">{e.description}</p>
                    <p className="text-xs text-neutral-500">
                      {e.category} · {timeOf(e.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-red-700">− {formatCurrency(e.amount)}</span>
                  <div className="-mr-2 w-9 shrink-0">
                    <Dropdown items={[{ label: 'Excluir', icon: <Trash2 size={16} />, onClick: () => removeExpense(e), danger: true }]} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {products.length === 0 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" icon={<Plus size={16} />} onClick={onGoToProducts}>
            Cadastrar produtos
          </Button>
        </div>
      )}

      <SaleModal open={modal === 'venda'} products={products} onClose={close} onSaved={afterSave} />
      <ExpenseFormModal open={modal === 'saida'} openSessionId={session.id} fromRegister onClose={close} onSaved={afterSave} />
      <CloseSessionModal
        open={modal === 'fechar'}
        opening={Number(session.opening_amount)}
        cashSales={byMethod.dinheiro}
        cashOut={cashOut}
        totalSales={total}
        onClose={close}
        onSaved={async (id) => {
          await load()
          setModal(null)
          setClosedId(id)
        }}
      />
    </>
  )
}
