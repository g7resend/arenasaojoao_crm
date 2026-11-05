import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, FileText, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { exportMenuPdf } from '../../lib/export'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { MenuItemFormModal } from '../../components/events/MenuItemFormModal'
import type { ArenaEvent, EventMenuItem } from '../../types/db'

export default function CardapioTab({ event, arenaName }: { event: ArenaEvent; arenaName: string }) {
  const toast = useToast()
  const [items, setItems] = useState<EventMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ open: boolean; item: EventMenuItem | null }>({ open: false, item: null })
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('event_menu_items').select('*').eq('event_id', event.id).order('sort_order').order('created_at')
    if (error) toast('Erro ao carregar o cardápio.', 'error')
    setItems((data as EventMenuItem[]) ?? [])
    setLoading(false)
  }, [event.id, toast])

  useEffect(() => {
    load()
  }, [load])

  async function removeItem(item: EventMenuItem) {
    if (!confirm(`Excluir ${item.name} do cardápio?`)) return
    const { error } = await supabase.from('event_menu_items').delete().eq('id', item.id)
    if (error) return toast('Erro ao excluir o produto.', 'error')
    toast('Produto excluído.')
    load()
  }

  /** Troca o produto de lugar com o vizinho */
  async function move(index: number, delta: -1 | 1) {
    const a = items[index]
    const b = items[index + delta]
    const next = [...items]
    next[index] = b
    next[index + delta] = a
    setItems(next)
    // regrava as posições da lista inteira: itens antigos podem ter a mesma posição
    const results = await Promise.all(next.map((item, i) => (item.sort_order === i ? null : supabase.from('event_menu_items').update({ sort_order: i }).eq('id', item.id))))
    if (results.some((r) => r?.error)) toast('Erro ao mudar a ordem.', 'error')
    load()
  }

  async function handlePdf() {
    setExporting(true)
    try {
      const withImage = await exportMenuPdf({ arenaName, event, items })
      if (!withImage) toast('PDF gerado sem a imagem do evento: não foi possível usar a imagem.', 'error')
    } catch (e) {
      console.error(e)
      toast(`Erro ao gerar o PDF: ${e instanceof Error ? e.message : 'motivo desconhecido'}`, 'error')
    }
    setExporting(false)
  }

  if (loading) return <Spinner />

  const nextOrder = items.reduce((max, i) => Math.max(max, i.sort_order + 1), 0)

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={<Plus size={16} />} onClick={() => setForm({ open: true, item: null })}>
          Adicionar produto
        </Button>
        <Button variant="secondary" icon={<FileText size={16} />} onClick={handlePdf} loading={exporting} disabled={!items.length}>
          Gerar PDF (A3)
        </Button>
      </div>

      {!event.image_path && items.length > 0 && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Este evento ainda não tem imagem, então o cardápio sai sem logo. Para colocar, toque no ⋮ lá em cima e em "Editar evento".
        </p>
      )}

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed size={40} />}
            title="Cardápio vazio"
            description="Adicione os produtos com preço. Depois é só gerar o PDF para imprimir."
            action={
              <Button icon={<Plus size={16} />} onClick={() => setForm({ open: true, item: null })}>
                Adicionar produto
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item, i) => (
              <li key={item.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-neutral-900">{item.name}</p>
                    {item.description && <p className="text-sm text-neutral-500">{item.description}</p>}
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-neutral-900">{formatCurrency(item.price)}</p>
                </div>
                <div className="mt-1 flex justify-end gap-1">
                  <IconButton label={`Subir ${item.name}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton label={`Descer ${item.name}`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton label={`Editar ${item.name}`} onClick={() => setForm({ open: true, item })}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={`Excluir ${item.name}`} onClick={() => removeItem(item)} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <MenuItemFormModal
        open={form.open}
        eventId={event.id}
        item={form.item}
        nextOrder={nextOrder}
        onClose={() => setForm({ open: false, item: null })}
        onSaved={async (keepOpen) => {
          await load()
          if (!keepOpen) setForm({ open: false, item: null })
        }}
      />
    </>
  )
}
