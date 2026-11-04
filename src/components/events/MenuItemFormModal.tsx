import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { moneyToInput, parseMoney } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input, MoneyInput, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { EventMenuItem } from '../../types/db'

interface Props {
  open: boolean
  eventId: string
  item?: EventMenuItem | null
  /** posição do próximo produto no cardápio */
  nextOrder: number
  onClose: () => void
  onSaved: (keepOpen: boolean) => Promise<void>
}

export function MenuItemFormModal({ open, eventId, item, nextOrder, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  function fill(i?: EventMenuItem | null) {
    setName(i?.name ?? '')
    setDescription(i?.description ?? '')
    setPrice(i ? moneyToInput(i.price) : '')
  }

  useEffect(() => {
    if (open) fill(item)
  }, [open, item])

  async function save(keepOpen: boolean) {
    if (!name.trim()) return toast('Informe o nome do produto.', 'error')
    if (!price.trim()) return toast('Informe o preço.', 'error')
    setSaving(true)
    const payload = { name: name.trim(), description: description.trim(), price: parseMoney(price) }
    const { error } = item
      ? await supabase.from('event_menu_items').update(payload).eq('id', item.id)
      : await supabase.from('event_menu_items').insert({ ...payload, event_id: eventId, sort_order: nextOrder })
    if (error) {
      setSaving(false)
      return toast('Erro ao salvar o produto.', 'error')
    }
    toast(item ? 'Produto atualizado!' : `${payload.name} adicionado!`)
    if (keepOpen) fill(null)
    await onSaved(keepOpen)
    setSaving(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    save(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar produto' : 'Adicionar produto'}
      footer={
        <>
          {item ? (
            <Button variant="secondary" full onClick={onClose}>
              Cancelar
            </Button>
          ) : (
            <Button variant="secondary" full loading={saving} onClick={() => save(true)}>
              Salvar e próximo
            </Button>
          )}
          <Button type="submit" form="menu-item-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="menu-item-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Produto" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label="Descrição (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <MoneyInput label="Preço" required value={price} onChange={setPrice} />
      </form>
    </Modal>
  )
}
