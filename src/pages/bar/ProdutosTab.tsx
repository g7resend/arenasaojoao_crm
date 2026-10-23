import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, EyeOff, History, Package, PackagePlus, Pencil, Plus, Search, Trash2, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, normalizeText } from '../../lib/format'
import { stockLevel } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Badge, Card, EmptyState, Spinner, Tabs } from '../../components/ui/Misc'
import { Dropdown } from '../../components/ui/Dropdown'
import { ProductFormModal, StockAdjustModal, StockEntryModal, StockHistoryModal } from '../../components/bar/ProductModals'
import type { BarProduct } from '../../types/db'

type Filter = 'todos' | 'baixo' | 'inativos'

export default function ProdutosTab() {
  const toast = useToast()
  const [products, setProducts] = useState<BarProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [form, setForm] = useState<{ open: boolean; product: BarProduct | null }>({ open: false, product: null })
  const [entry, setEntry] = useState<BarProduct | null>(null)
  const [adjust, setAdjust] = useState<BarProduct | null>(null)
  const [history, setHistory] = useState<BarProduct | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bar_products').select('*').order('category').order('name')
    if (error) toast('Erro ao carregar os produtos.', 'error')
    setProducts((data as BarProduct[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const active = products.filter((p) => p.active)
  const low = active.filter((p) => stockLevel(p) !== 'ok')
  const inactive = products.filter((p) => !p.active)
  const stockValue = active.reduce((a, p) => a + Math.max(0, p.stock) * Number(p.cost), 0)

  const groups = useMemo(() => {
    const q = normalizeText(search)
    const base = filter === 'baixo' ? low : filter === 'inativos' ? inactive : active
    const list = base.filter((p) => !q || normalizeText(p.name).includes(q))
    const map = new Map<string, BarProduct[]>()
    for (const p of list) map.set(p.category, [...(map.get(p.category) ?? []), p])
    return [...map.entries()]
  }, [active, low, inactive, filter, search])

  async function toggleActive(p: BarProduct) {
    const { error } = await supabase.from('bar_products').update({ active: !p.active }).eq('id', p.id)
    if (error) return toast('Erro ao atualizar o produto.', 'error')
    toast(p.active ? `${p.name} não aparece mais na venda.` : `${p.name} voltou para a venda.`)
    load()
  }

  async function remove(p: BarProduct) {
    if (!confirm(`Excluir "${p.name}"?\n\nAs vendas antigas continuam no histórico. Se só parou de vender por um tempo, prefira "Tirar da venda".`)) return
    const { error } = await supabase.from('bar_products').delete().eq('id', p.id)
    if (error) return toast('Erro ao excluir o produto.', 'error')
    toast('Produto excluído.')
    load()
  }

  if (loading) return <Spinner />

  const saved = async () => {
    await load()
    setForm({ open: false, product: null })
    setEntry(null)
    setAdjust(null)
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Produtos</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{active.length}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Repor</p>
          <p className={`text-lg font-bold tabular-nums ${low.length ? 'text-amber-700' : 'text-neutral-900'}`}>{low.length}</p>
        </Card>
        <Card className="col-span-2 px-4 py-3 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Valor em estoque (custo)</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{formatCurrency(stockValue)}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input aria-label="Buscar produto" placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setForm({ open: true, product: null })}>
          Novo produto
        </Button>
      </div>

      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: 'todos', label: 'Todos', count: active.length },
            { value: 'baixo', label: 'Para repor', count: low.length },
            ...(inactive.length ? [{ value: 'inativos' as const, label: 'Fora da venda', count: inactive.length }] : []),
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          {products.length === 0 ? (
            <EmptyState
              icon={<Package size={40} />}
              title="Nenhum produto cadastrado"
              description="Cadastre o que você vende no bar: bebidas, lanches, balas... com o preço e quantos tem."
              action={
                <Button icon={<Plus size={16} />} onClick={() => setForm({ open: true, product: null })}>
                  Cadastrar o primeiro produto
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<Package size={40} />} title={filter === 'baixo' ? 'Nada para repor 🎉' : 'Nenhum produto encontrado'} />
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([category, list]) => (
            <div key={category}>
              <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wide text-neutral-900">{category}</h2>
              <Card>
                <ul className="divide-y divide-neutral-100">
                  {list.map((p) => {
                    const level = stockLevel(p)
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-neutral-900">{p.name}</p>
                          <p className="text-sm text-neutral-500">
                            <span className="font-semibold text-neutral-800">{formatCurrency(p.price)}</span>
                            {Number(p.cost) > 0 && <span> · custo {formatCurrency(p.cost)}</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-lg font-bold leading-tight tabular-nums ${
                              level === 'zerado' ? 'text-red-600' : level === 'baixo' ? 'text-amber-700' : 'text-neutral-900'
                            }`}
                          >
                            {p.stock}
                          </p>
                          {level === 'ok' ? (
                            <p className="text-[11px] text-neutral-400">em estoque</p>
                          ) : (
                            <Badge color={level === 'zerado' ? 'red' : 'yellow'}>{p.stock < 0 ? 'Conferir' : level === 'zerado' ? 'Acabou' : 'Baixo'}</Badge>
                          )}
                        </div>
                        <Button size="sm" variant="secondary" icon={<PackagePlus size={16} />} onClick={() => setEntry(p)} className="px-2.5">
                          Entrada
                        </Button>
                        <div className="-mr-2">
                          <Dropdown
                            items={[
                              { label: 'Editar', icon: <Pencil size={16} />, onClick: () => setForm({ open: true, product: p }) },
                              { label: 'Contar estoque', icon: <ClipboardCheck size={16} />, onClick: () => setAdjust(p) },
                              { label: 'Histórico', icon: <History size={16} />, onClick: () => setHistory(p) },
                              p.active
                                ? { label: 'Tirar da venda', icon: <EyeOff size={16} />, onClick: () => toggleActive(p) }
                                : { label: 'Voltar para a venda', icon: <Eye size={16} />, onClick: () => toggleActive(p) },
                              { label: 'Excluir', icon: <Trash2 size={16} />, onClick: () => remove(p), danger: true },
                            ]}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      <ProductFormModal open={form.open} product={form.product} onClose={() => setForm({ open: false, product: null })} onSaved={saved} />
      <StockEntryModal product={entry} onClose={() => setEntry(null)} onSaved={saved} />
      <StockAdjustModal product={adjust} onClose={() => setAdjust(null)} onSaved={saved} />
      <StockHistoryModal product={history} onClose={() => setHistory(null)} />
    </>
  )
}
