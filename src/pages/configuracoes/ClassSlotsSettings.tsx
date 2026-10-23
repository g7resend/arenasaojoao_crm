import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { WEEKDAYS, WEEK_ORDER, formatTime } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Input, Select, Toggle } from '../../components/ui/Field'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { Modal } from '../../components/ui/Modal'
import type { ClassSlot } from '../../types/db'

interface FormState {
  id?: string
  weekday: string
  startTime: string
  endTime: string
  name: string
  teacher: string
  active: boolean
}

const EMPTY: FormState = { weekday: '1', startTime: '18:00', endTime: '19:00', name: '', teacher: '', active: true }

export default function ClassSlotsSettings() {
  const toast = useToast()
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('class_slots').select('*').order('start_time')
    if (error) toast('Erro ao carregar turmas.', 'error')
    setSlots((data as ClassSlot[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (form.endTime && form.endTime <= form.startTime) return toast('O horário de término deve ser depois do início.', 'error')
    setSaving(true)
    const payload = {
      weekday: Number(form.weekday),
      start_time: form.startTime,
      end_time: form.endTime || null,
      name: form.name.trim(),
      teacher: form.teacher.trim(),
      active: form.active,
    }
    const { error } = form.id
      ? await supabase.from('class_slots').update(payload).eq('id', form.id)
      : await supabase.from('class_slots').insert(payload)
    setSaving(false)
    if (error) return toast('Erro ao salvar turma.', 'error')
    toast(form.id ? 'Turma atualizada!' : 'Turma criada!')
    setForm(null)
    load()
  }

  async function handleDelete(slot: ClassSlot) {
    if (!confirm(`Excluir a turma "${slot.name}" de ${WEEKDAYS[slot.weekday]} às ${formatTime(slot.start_time)}?`)) return
    const { error } = await supabase.from('class_slots').delete().eq('id', slot.id)
    if (error) return toast('Erro ao excluir turma.', 'error')
    toast('Turma excluída.')
    load()
  }

  if (loading) return <Spinner />

  const days = WEEK_ORDER.map((wd) => ({ wd, items: slots.filter((s) => s.weekday === wd) })).filter((d) => d.items.length > 0)

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button icon={<Plus size={16} />} onClick={() => setForm(EMPTY)}>
          Nova turma
        </Button>
      </div>

      {days.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarRange size={40} />} title="Nenhuma turma cadastrada" description="Cadastre as turmas fixas da semana. Elas são usadas na mensagem de horários do grupo." />
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ wd, items }) => (
            <Card key={wd}>
              <h3 className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">{WEEKDAYS[wd]}</h3>
              <ul className="divide-y divide-neutral-100">
                {items.map((s) => (
                  <li key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.active ? '' : 'opacity-60'}`}>
                    <div className="w-14 shrink-0 text-sm font-semibold tabular-nums text-brand-700">{formatTime(s.start_time)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-neutral-900">{s.name}</p>
                        {!s.active && <Badge>Inativa</Badge>}
                      </div>
                      <p className="truncate text-sm text-neutral-500">
                        {s.end_time ? `até ${formatTime(s.end_time)}` : ''}
                        {s.end_time && s.teacher ? ' · ' : ''}
                        {s.teacher && `Prof. ${s.teacher}`}
                      </p>
                    </div>
                    <IconButton
                      label="Editar"
                      onClick={() =>
                        setForm({
                          id: s.id,
                          weekday: String(s.weekday),
                          startTime: formatTime(s.start_time),
                          endTime: formatTime(s.end_time),
                          name: s.name,
                          teacher: s.teacher,
                          active: s.active,
                        })
                      }
                    >
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => handleDelete(s)} className="hover:text-red-600">
                      <Trash2 size={18} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar turma' : 'Nova turma'}
        footer={
          <>
            <Button variant="secondary" full onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="slot-form" full loading={saving}>
              Salvar
            </Button>
          </>
        }
      >
        {form && (
          <form id="slot-form" onSubmit={handleSubmit} className="space-y-4">
            <Select label="Dia da semana" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
              {WEEK_ORDER.map((wd) => (
                <option key={wd} value={wd}>
                  {WEEKDAYS[wd]}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Início" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <Input label="Término (opcional)" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <Input label="Nível / nome da turma" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Iniciante, Intermediário" />
            <Input label="Professor" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
            <Toggle label="Turma ativa" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          </form>
        )}
      </Modal>
    </>
  )
}
