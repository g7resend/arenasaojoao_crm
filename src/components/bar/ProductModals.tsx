import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT_METHODS, formatCurrency, formatDateTime, moneyToInput, parseMoney } from '../../lib/format'
import { PRODUCT_CATEGORIES, barError } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, Select, Textarea, Toggle } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Badge, Spinner } from '../ui/Misc'
import type { BarProduct, BarStockMovement, PaymentMethod } from '../../types/db'

const toInt = (s: string) => Math.trunc(Number(s) || 0)

// ---------------------------------------------------------------------
// Cadastro / edição de produto
// ---------------------------------------------------------------------
interface ProductForm {
  name: string
  category: string
  price: string
  cost: string
  stock: string
  minStock: string
  active: boolean
}

function initialProduct(p: BarProduct | null | undefined): ProductForm {
  return {
    name: p?.name ?? '',
    category: p?.category ?? 'Bebidas',
    price: p ? moneyToInput(p.price) : '',
    cost: p && Number(p.cost) > 0 ? moneyToInput(p.cost) : '',
    stock: '',
    minStock: p ? String(p.min_stock) : '5',
    active: p?.active ?? true,
  }
}

export function ProductFormModal({ open, product, onClose, onSaved }: { open: boolean; product?: BarProduct | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [form, setForm] = useState<ProductForm>(() => initialProduct(product))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(initialProduct(product))
  }, [open, product])

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const price = parseMoney(form.price)
  const cost = parseMoney(form.cost)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      price,
      cost,
      min_stock: Math.max(0, toInt(form.minStock)),
      active: form.active,
    }
    if (product) {
      const { error } = await supabase.from('bar_products').update(payload).eq('id', product.id)
      if (error) {
        setSaving(false)
        return toast('Erro ao salvar o produto.', 'error')
      }
      toast('Produto atualizado!')
      await onSaved()
      return setSaving(false)
    }
    const { data, error } = await supabase.from('bar_products').insert(payload).select('id').single()
    if (error) {
      setSaving(false)
      return toast('Erro ao salvar o produto.', 'error')
    }
    // estoque inicial entra como "entrada", para ficar no histórico
    const initialStock = toInt(form.stock)
    if (initialStock > 0) {
      const { error: stockError } = await supabase.rpc('bar_stock_entry', {
        p_product: data.id,
        p_quantity: initialStock,
        p_unit_cost: cost || null,
        p_notes: 'Estoque inicial',
      })
      if (stockError) toast('Produto criado, mas o estoque inicial não foi salvo. Use "Entrada".', 'error')
    }
    toast('Produto cadastrado!')
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar produto' : 'Novo produto'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Água sem gás 500ml" />
        <Select label="Categoria" value={form.category} onChange={(e) => set('category', e.target.value)}>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label="Preço de venda" required value={form.price} onChange={(v) => set('price', v)} />
          <MoneyInput label="Custo (opcional)" value={form.cost} onChange={(v) => set('cost', v)} hint="Quanto você paga" />
        </div>
        {price > 0 && cost > 0 && (
          <p className="-mt-2 text-xs text-neutral-500">
            Lucro de <strong className="text-emerald-700">{formatCurrency(price - cost)}</strong> por unidade.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {!product && (
            <Input label="Estoque atual" type="number" inputMode="numeric" min={0} value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" />
          )}
          <Input
            label="Avisar com"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.minStock}
            onChange={(e) => set('minStock', e.target.value)}
            hint="Estoque baixo a partir desta quantidade"
          />
        </div>
        {product && <Toggle label="Disponível para venda" checked={form.active} onChange={(v) => set('active', v)} />}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Entrada de mercadoria
// ---------------------------------------------------------------------
export function StockEntryModal({ product, onClose, onSaved }: { product: BarProduct | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [asExpense, setAsExpense] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setQty('')
      setCost(Number(product.cost) > 0 ? moneyToInput(product.cost) : '')
      setNotes('')
      setAsExpense(true)
      setMethod('pix')
    }
  }, [product])

  const quantity = toInt(qty)
  const unitCost = parseMoney(cost)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!product) return
    if (quantity <= 0) return toast('Informe a quantidade que chegou.', 'error')
    setSaving(true)
    const { error } = await supabase.rpc('bar_stock_entry', {
      p_product: product.id,
      p_quantity: quantity,
      p_unit_cost: unitCost || null,
      p_notes: notes.trim(),
      p_expense_method: asExpense && unitCost > 0 ? method : null,
    })
    if (error) {
      setSaving(false)
      return toast(barError(error, 'Erro ao lançar a entrada.'), 'error')
    }
    toast(`+${quantity} ${product.name} no estoque!`)
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title="Entrada de mercadoria"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="stock-entry-form" full loading={saving}>
            Lançar entrada
          </Button>
        </>
      }
    >
      {product && (
        <form id="stock-entry-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm">
            <strong>{product.name}</strong> · hoje tem <strong className="tabular-nums">{product.stock}</strong> un.
            {quantity > 0 && (
              <>
                {' '}→ vai ficar com <strong className="tabular-nums text-emerald-700">{product.stock + quantity}</strong>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantidade que chegou" type="number" inputMode="numeric" min={1} required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            <MoneyInput label="Custo por unidade" value={cost} onChange={setCost} hint="Opcional" />
          </div>
          {quantity > 0 && unitCost > 0 && (
            <p className="-mt-2 text-sm text-neutral-600">
              Total da compra: <strong>{formatCurrency(quantity * unitCost)}</strong>
            </p>
          )}
          {unitCost > 0 && (
            <div className="space-y-3 rounded-xl bg-neutral-50 px-4 py-3">
              <Toggle label="Lançar a compra nas despesas" checked={asExpense} onChange={setAsExpense} />
              {asExpense && (
                <Select label="Pago com" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}
          <Textarea label="Observação" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: fornecedor, nota fiscal" />
        </form>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Ajuste pela contagem
// ---------------------------------------------------------------------
export function StockAdjustModal({ product, onClose, onSaved }: { product: BarProduct | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setCounted(String(Math.max(0, product.stock)))
      setNotes('')
    }
  }, [product])

  const diff = product && counted !== '' ? toInt(counted) - product.stock : 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!product) return
    if (counted === '' || toInt(counted) < 0) return toast('Informe quantas unidades você contou.', 'error')
    setSaving(true)
    const { error } = await supabase.rpc('bar_stock_adjust', { p_product: product.id, p_counted: toInt(counted), p_notes: notes.trim() })
    if (error) {
      setSaving(false)
      return toast(barError(error, 'Erro ao ajustar o estoque.'), 'error')
    }
    toast(diff === 0 ? 'Estoque conferido: nada mudou.' : 'Estoque ajustado!')
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title="Contar estoque"
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="stock-adjust-form" full loading={saving}>
            Salvar contagem
          </Button>
        </>
      }
    >
      {product && (
        <form id="stock-adjust-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-neutral-600">
            Conte quantas unidades de <strong className="text-neutral-900">{product.name}</strong> você tem de verdade. O sistema diz que tem{' '}
            <strong className="tabular-nums text-neutral-900">{product.stock}</strong>.
          </p>
          <Input label="Quantidade contada" type="number" inputMode="numeric" min={0} required value={counted} onChange={(e) => setCounted(e.target.value)} />
          {diff !== 0 && (
            <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {diff > 0 ? `+${diff}` : diff} unidade{Math.abs(diff) > 1 ? 's' : ''} em relação ao sistema
            </p>
          )}
          <Textarea label="Motivo" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: quebrou, venceu, consumo próprio" />
        </form>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Histórico de entradas e ajustes
// ---------------------------------------------------------------------
export function StockHistoryModal({ product, onClose }: { product: BarProduct | null; onClose: () => void }) {
  const [items, setItems] = useState<BarStockMovement[] | null>(null)

  useEffect(() => {
    if (!product) return
    setItems(null)
    supabase
      .from('bar_stock_movements')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setItems((data as BarStockMovement[]) ?? []))
  }, [product])

  return (
    <Modal open={!!product} onClose={onClose} title={product ? `Histórico · ${product.name}` : 'Histórico'}>
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">Nenhuma entrada ou ajuste ainda.</p>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100 text-sm">
            {items.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {m.kind === 'entrada' ? <Badge color="green">Entrada</Badge> : <Badge color="yellow">Ajuste</Badge>}
                    <span className="text-xs text-neutral-500">{formatDateTime(m.created_at)}</span>
                  </div>
                  {m.notes && <p className="mt-0.5 text-neutral-600">{m.notes}</p>}
                  {m.unit_cost !== null && Number(m.unit_cost) > 0 && <p className="text-xs text-neutral-500">{formatCurrency(m.unit_cost)} por unidade</p>}
                </div>
                <span className={`shrink-0 font-semibold tabular-nums ${m.quantity > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-neutral-500">As vendas baixam o estoque automaticamente e aparecem em Caixa e Fechamentos.</p>
        </>
      )}
    </Modal>
  )
}
