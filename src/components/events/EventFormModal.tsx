import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatTime, moneyToInput, parseMoney, todayISO } from '../../lib/format'
import { deleteEventImage, eventImageUrl, uploadEventImage } from '../../lib/eventImages'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../ui/Button'
import { Input, MoneyInput, Textarea } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { EventImagePicker } from './EventImagePicker'
import type { ArenaEvent, EventLot } from '../../types/db'

interface Props {
  open: boolean
  event?: ArenaEvent | null
  lots?: EventLot[]
  onClose: () => void
  onSaved: (eventId: string) => void
}

interface LotDraft {
  id?: string
  name: string
  price: string
}

interface FormState {
  name: string
  date: string
  time: string
  location: string
  capacity: string
  notes: string
  lots: LotDraft[]
}

function initial(event?: ArenaEvent | null, lots: EventLot[] = []): FormState {
  return {
    name: event?.name ?? '',
    date: event?.event_date ?? todayISO(),
    time: event?.start_time ? formatTime(event.start_time) : '',
    location: event?.location ?? '',
    capacity: event?.capacity ? String(event.capacity) : '',
    notes: event?.notes ?? '',
    lots: lots.length ? lots.map((l) => ({ id: l.id, name: l.name, price: moneyToInput(l.price) })) : [{ name: '1º lote', price: '' }],
  }
}

export function EventFormModal({ open, event, lots = [], onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initial(event, lots))
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  // reinicia o formulário só ao abrir (lots chega como array novo a cada render)
  useEffect(() => {
    if (open) {
      setForm(initial(event, lots))
      setImageFile(null)
      setRemoveImage(false)
    }
  }, [open])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setLot = (i: number, patch: Partial<LotDraft>) => set('lots', form.lots.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const lotDrafts = form.lots.filter((l) => l.name.trim())
    if (lotDrafts.length === 0) return toast('Cadastre pelo menos um lote/ingresso.', 'error')

    const removed = lots.filter((l) => !lotDrafts.some((d) => d.id === l.id))
    if (removed.length && !confirm(`Remover ${removed.map((l) => `"${l.name}"`).join(', ')}? Participantes desses lotes ficarão sem lote.`)) return

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      event_date: form.date,
      start_time: form.time || null,
      location: form.location.trim(),
      capacity: form.capacity ? Number(form.capacity) : null,
      notes: form.notes.trim(),
    }
    const res = event
      ? await supabase.from('events').update(payload).eq('id', event.id).select('id').single()
      : await supabase.from('events').insert(payload).select('id').single()
    if (res.error || !res.data) {
      setSaving(false)
      return toast('Erro ao salvar evento.', 'error')
    }
    const eventId = res.data.id as string

    // Sincroniza os lotes: atualiza/insere os do formulário e apaga os removidos
    const ops: PromiseLike<{ error: unknown }>[] = lotDrafts.map((l, i) => {
      const row = { event_id: eventId, name: l.name.trim(), price: parseMoney(l.price), sort_order: i }
      return l.id ? supabase.from('event_lots').update(row).eq('id', l.id) : supabase.from('event_lots').insert(row)
    })
    if (removed.length) ops.push(supabase.from('event_lots').delete().in('id', removed.map((l) => l.id)))
    const results = await Promise.all(ops)
    if (results.some((r) => r.error)) {
      setSaving(false)
      return toast('Evento salvo, mas houve erro ao salvar os lotes.', 'error')
    }

    // Imagem: envia a nova (e apaga a antiga) ou remove a atual
    const oldPath = event?.image_path ?? null
    if (imageFile || (removeImage && oldPath)) {
      try {
        const newPath = imageFile ? await uploadEventImage(eventId, imageFile) : null
        const { error } = await supabase.from('events').update({ image_path: newPath }).eq('id', eventId)
        if (error) throw error
        if (oldPath) await deleteEventImage(oldPath)
      } catch {
        setSaving(false)
        toast('Evento salvo, mas não foi possível salvar a imagem.', 'error')
        return onSaved(eventId)
      }
    }
    setSaving(false)

    toast(event ? 'Evento atualizado!' : 'Evento criado!')
    onSaved(eventId)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Editar evento' : 'Novo evento'}
      footer={
        <>
          <Button variant="secondary" full onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="event-form" full loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
        <EventImagePicker
          currentUrl={removeImage ? null : eventImageUrl(event?.image_path)}
          file={imageFile}
          onPick={(f) => {
            setImageFile(f)
            setRemoveImage(false)
          }}
          onRemove={() => {
            setImageFile(null)
            setRemoveImage(true)
          }}
          onError={(m) => toast(m, 'error')}
        />
        <Input label="Nome do evento" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Torneio de Duplas" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
          <Input label="Horário" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
        </div>
        <Input label="Local" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ex: Arena São João" />
        <Input
          label="Capacidade"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          hint="Deixe em branco se não houver limite."
        />

        <div>
          <p className="mb-1 text-sm font-medium text-neutral-700">Ingressos / lotes</p>
          <div className="space-y-2">
            {form.lots.map((l, i) => (
              <div key={l.id ?? `new-${i}`} className="flex items-end gap-2">
                <Input aria-label="Nome do lote" placeholder="Nome do lote" value={l.name} onChange={(e) => setLot(i, { name: e.target.value })} wrapperClassName="flex-1" />
                <MoneyInput value={l.price} onChange={(v) => setLot(i, { price: v })} wrapperClassName="w-36" />
                <IconButton
                  label="Remover lote"
                  className="mb-1 hover:text-red-600"
                  disabled={form.lots.length === 1}
                  onClick={() => set('lots', form.lots.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            icon={<Plus size={16} />}
            onClick={() => set('lots', [...form.lots, { name: `${form.lots.length + 1}º lote`, price: '' }])}
          >
            Adicionar lote
          </Button>
        </div>

        <Textarea label="Observações" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </form>
    </Modal>
  )
}
