import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, normalizeText, parseMoney } from '../../lib/format'
import { METHOD_ORDER, barError } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../ui/Button'
import { Input, MoneyInput } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Tabs } from '../ui/Misc'
import type { BarProduct, PaymentMethod } from '../../types/db'

interface Props {
  open: boolean
  products: BarProduct[]
  onClose: () => void
  onSaved: () => Promise<void>
}

/** Nova venda: toca nos produtos, escolhe a forma de pagamento e finaliza */
export function SaleModal({ open, products, onClose, onSaved }: Props) {
  const toast = useToast()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [received, setReceived] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCart({})
      setMethod('pix')
      setReceived('')
      setSearch('')
      setCategory('todas')
    }
  }, [open])

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products])

  const visible = useMemo(() => {
    const q = normalizeText(search)
    return products.filter((p) => (category === 'todas' || p.category === category) && (!q || normalizeText(p.name).includes(q)))
  }, [products, search, category])

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
        .filter((l) => l.product),
    [cart, products],
  )
  const total = lines.reduce((a, l) => a + Number(l.product.price) * l.qty, 0)
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const change = parseMoney(received) - total

  const add = (id: string, delta: number) =>
    setCart((c) => {
      const qty = (c[id] ?? 0) + delta
      const next = { ...c }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })

  async function finish() {
    if (!lines.length) return toast('Toque nos produtos para adicionar à venda.', 'error')
    setSaving(true)
    const { error } = await supabase.rpc('bar_register_sale', {
      p_method: method,
      p_items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
    })
    if (error) {
      setSaving(false)
      return toast(barError(error, 'Erro ao registrar a venda.'), 'error')
    }
    toast(`Venda de ${formatCurrency(total)} registrada!`)
    // só libera depois que a lista atualizar, para ninguém registrar a mesma venda duas vezes
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova venda"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button full loading={saving} disabled={!lines.length} onClick={finish}>
            Finalizar{count ? ` · ${count} ${count > 1 ? 'itens' : 'item'}` : ''} · {formatCurrency(total)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {products.length > 8 && (
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input aria-label="Buscar produto" placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        )}
        {categories.length > 1 && (
          <Tabs value={category} onChange={setCategory} tabs={[{ value: 'todas', label: 'Todos' }, ...categories.map((c) => ({ value: c, label: c }))]} />
        )}

        {/* Produtos */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((p) => {
            const qty = cart[p.id] ?? 0
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id, 1)}
                className={`relative flex min-h-[72px] flex-col justify-between rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors active:scale-[0.98] ${
                  qty ? 'bg-brand-50 ring-brand-600' : 'bg-white ring-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span className="line-clamp-2 pr-6 text-sm font-medium leading-tight text-neutral-900">{p.name}</span>
                <span className="mt-1 flex items-end justify-between gap-1">
                  <span className="text-sm font-bold tabular-nums text-brand-800">{formatCurrency(p.price)}</span>
                  <span className={`text-[11px] tabular-nums ${p.stock - qty <= 0 ? 'font-semibold text-red-600' : 'text-neutral-400'}`}>{p.stock - qty} un.</span>
                </span>
                {qty > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-800 px-1.5 text-xs font-bold text-white">
                    {qty}
                  </span>
                )}
              </button>
            )
          })}
          {visible.length === 0 && <p className="col-span-full py-6 text-center text-sm text-neutral-400">Nenhum produto encontrado.</p>}
        </div>

        {/* Itens da venda */}
        <div className="rounded-xl bg-neutral-50 px-3 py-2">
          <p className="py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Itens da venda</p>
          {lines.length === 0 ? (
            <p className="py-2 text-sm text-neutral-400">Toque nos produtos acima para adicionar.</p>
          ) : (
            <ul className="divide-y divide-neutral-200/70">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{product.name}</span>
                  <IconButton label={qty === 1 ? 'Remover' : 'Diminuir'} onClick={() => add(product.id, -1)}>
                    {qty === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                  </IconButton>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <IconButton label="Aumentar" onClick={() => add(product.id, 1)}>
                    <Plus size={16} />
                  </IconButton>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatCurrency(Number(product.price) * qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagamento */}
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700">Forma de pagamento</p>
          <div className="grid grid-cols-3 gap-2">
            {METHOD_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-11 rounded-xl text-sm font-semibold ring-1 ring-inset ${
                  method === m ? 'bg-brand-800 text-white ring-brand-800' : 'bg-white text-neutral-700 ring-neutral-200'
                }`}
              >
                {PAYMENT_METHODS[m]}
              </button>
            ))}
          </div>
        </div>
        {method === 'dinheiro' && (
          <div className="grid grid-cols-2 items-end gap-3">
            <MoneyInput label="Valor recebido" value={received} onChange={setReceived} hint="Opcional, para calcular o troco" />
            <div className="mb-5 rounded-xl bg-neutral-50 px-3 py-2">
              <p className="text-xs text-neutral-500">Troco</p>
              <p className={`font-bold tabular-nums ${received && change < 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                {received ? (change < 0 ? `Faltam ${formatCurrency(-change)}` : formatCurrency(change)) : '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
