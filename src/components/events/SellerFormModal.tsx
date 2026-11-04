import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'
import { Modal } from '../ui/Modal'
import type { EventSeller } from '../../types/db'

interface Props {
  open: boolean
  eventId: string
  seller?: EventSeller | null
  onClose: () => void
  onSaved: () => Promise<void>
}

export function SellerFormModal({ open, eventId, seller, onClose, onSaved }: Props) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(seller?.name ?? '')
  }, [open, seller])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast('Informe o nome.', 'error')
    setSaving(true)
    const { error } = seller
      ? await supabase.from('event_sellers').update({ name: name.trim() }).eq('id', seller.id)
      : await supabase.from('event_sellers').insert({ event_id: eventId, name: name.trim() })
    if (error) {
      setSaving(false)
      return toast('Erro ao salvar o comissário.', 'error')
    }
    toast(seller ? 'Comissário atualizado!' : `${name.trim()} adicionado!`)
    await onSaved()
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={seller ? 'Editar comissário' : 'Novo comissário'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="seller-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="seller-form" onSubmit={handleSubmit}>
        <Input label="Nome do comissário" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </form>
    </Modal>
  )
}
