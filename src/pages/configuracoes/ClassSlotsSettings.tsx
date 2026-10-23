import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarRange, Copy, CopyPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { WEEKDAYS, WEEKDAYS_SHORT, WEEK_ORDER, formatTime } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Input, Toggle } from '../../components/ui/Field'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { Modal } from '../../components/ui/Modal'
import type { ClassSlot } from '../../types/db'

interface FormState {
  id?: string
  duplicating?: boolean
  weekdays: number[]
  startTime: string
  endTime: string
  name: string
  teacher: string
  active: boolean
}

const EMPTY: FormState = { weekdays: [1], startTime: '18:00', endTime: '', name: '', teacher: '', active: true }

/** Botões de dia da semana (seg → dom); multiple=false vira seleção única */
function WeekdayPicker({ value, onChange, multiple, disabled = [] }: { value: number[]; onChange: (v: number[]) => void; multiple: boolean; disabled?: number[] }) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEK_ORDER.map((wd) => {
        const on = value.includes(wd)
        const off = disabled.includes(wd)
        return (
          <button
            key={wd}
            type="button"
            disabled={off}
            aria-pressed={on}
            onClick={() => onChange(multiple ? (on ? value.filter((d) => d !== wd) : [...value, wd]) : [wd])}
            className={`h-10 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 ${
              on ? 'bg-brand-800 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {WEEKDAYS_SHORT[wd]}
          </button>
        )
      })}
    </div>
  )
}

export default function ClassSlotsSettings() {
  const toast = useToast()
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [copyFrom, setCopyFrom] = useState<{ weekday: number; targets: number[] } | null>(null)
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

  const toForm = (s: ClassSlot, keepId: boolean): FormState => ({
    id: keepId ? s.id : undefined,
    duplicating: !keepId,
    weekdays: [s.weekday],
    startTime: formatTime(s.start_time),
    endTime: formatTime(s.end_time),
    name: s.name,
    teacher: s.teacher,
    active: s.active,
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (form.weekdays.length === 0) return toast('Escolha pelo menos um dia.', 'error')
    if (form.endTime && form.endTime <= form.startTime) return toast('O horário de término deve ser depois do início.', 'error')
    setSaving(true)
    const base = {
      start_time: form.startTime,
      end_time: form.endTime || null,
      name: form.name.trim(),
      teacher: form.teacher.trim(),
      active: form.active,
    }
    const { error } = form.id
      ? await supabase.from('class_slots').update({ ...base, weekday: form.weekdays[0] }).eq('id', form.id)
      : await supabase.from('class_slots').insert(form.weekdays.map((weekday) => ({ ...base, weekday })))
    setSaving(false)
    if (error) return toast('Erro ao salvar turma.', 'error')
    const n = form.weekdays.length
    toast(form.id ? 'Turma atualizada!' : n > 1 ? `Turma criada em ${n} dias!` : 'Turma criada!')
    setForm(null)
    load()
  }

  async function handleCopyDay() {
    if (!copyFrom || copyFrom.targets.length === 0) return
    const source = slots.filter((s) => s.weekday === copyFrom.weekday)
    // não duplica turma igual (mesmo horário e nome) que já exista no dia de destino
    const rows = copyFrom.targets.flatMap((weekday) =>
      source
        .filter((s) => !slots.some((x) => x.weekday === weekday && x.start_time === s.start_time && x.name === s.name))
        .map((s) => ({ weekday, start_time: s.start_time, end_time: s.end_time, name: s.name, teacher: s.teacher, active: s.active })),
    )
    if (rows.length === 0) {
      setCopyFrom(null)
      return toast('Esses dias já têm essas turmas.')
    }
    setSaving(true)
    const { error } = await supabase.from('class_slots').insert(rows)
    setSaving(false)
    if (error) return toast('Erro ao copiar turmas.', 'error')
    toast(`${rows.length} aula${rows.length > 1 ? 's' : ''} copiada${rows.length > 1 ? 's' : ''}!`)
    setCopyFrom(null)
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">As aulas de cada dia entram na mensagem diária do grupo.</p>
        <Button icon={<Plus size={16} />} onClick={() => setForm(EMPTY)}>
          Nova turma
        </Button>
      </div>

      {days.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarRange size={40} />} title="Nenhuma turma cadastrada" description="Cadastre as aulas de cada dia da semana (horário e nível). Elas são usadas na mensagem diária do grupo." />
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map(({ wd, items }) => (
            <Card key={wd}>
              <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 pl-4 pr-2">
                <h3 className="text-sm font-semibold text-neutral-700">
                  {WEEKDAYS[wd]} <span className="font-normal text-neutral-400">· {items.length} aula{items.length > 1 ? 's' : ''}</span>
                </h3>
                <Button size="sm" variant="ghost" icon={<CopyPlus size={16} />} onClick={() => setCopyFrom({ weekday: wd, targets: [] })}>
                  Copiar dia
                </Button>
              </div>
              <ul className="divide-y divide-neutral-100">
                {items.map((s) => (
                  <li key={s.id} className={`flex items-center gap-2 py-3 pl-4 pr-2 ${s.active ? '' : 'opacity-60'}`}>
                    <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-brand-700">{formatTime(s.start_time)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-neutral-900">{s.name}</p>
                        {!s.active && <Badge>Inativa</Badge>}
                      </div>
                      {(s.end_time || s.teacher) && (
                        <p className="truncate text-sm text-neutral-500">
                          {s.end_time ? `até ${formatTime(s.end_time)}` : ''}
                          {s.end_time && s.teacher ? ' · ' : ''}
                          {s.teacher && `Prof. ${s.teacher}`}
                        </p>
                      )}
                    </div>
                    <IconButton label="Duplicar" onClick={() => setForm(toForm(s, false))}>
                      <Copy size={18} />
                    </IconButton>
                    <IconButton label="Editar" onClick={() => setForm(toForm(s, true))}>
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

      {/* Criar / editar / duplicar turma */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar turma' : form?.duplicating ? 'Duplicar turma' : 'Nova turma'}
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
            <div>
              <p className="mb-1 text-sm font-medium text-neutral-700">{form.id ? 'Dia da semana' : 'Dias da semana'}</p>
              <WeekdayPicker value={form.weekdays} multiple={!form.id} onChange={(weekdays) => setForm({ ...form, weekdays })} />
              {!form.id && <p className="mt-1 text-xs text-neutral-500">Marque vários dias para criar a mesma aula em todos eles.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Horário" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <Input label="Término (opcional)" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <Input label="Nível / nome da turma" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: iniciante, intermediário, avançado" hint="Aparece na mensagem assim: 17 hrs (iniciante)" />
            <Input label="Professor (opcional)" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
            <Toggle label="Turma ativa" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          </form>
        )}
      </Modal>

      {/* Copiar todas as aulas de um dia para outros dias */}
      <Modal
        open={!!copyFrom}
        onClose={() => setCopyFrom(null)}
        title={copyFrom ? `Copiar aulas de ${WEEKDAYS[copyFrom.weekday]}` : ''}
        footer={
          <>
            <Button variant="secondary" full onClick={() => setCopyFrom(null)}>
              Cancelar
            </Button>
            <Button full loading={saving} disabled={!copyFrom?.targets.length} onClick={handleCopyDay}>
              Copiar
            </Button>
          </>
        }
      >
        {copyFrom && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              {slots
                .filter((s) => s.weekday === copyFrom.weekday)
                .map((s) => `${formatTime(s.start_time)} ${s.name}`)
                .join(' · ')}
            </p>
            <p className="text-sm font-medium text-neutral-700">Para quais dias?</p>
            <WeekdayPicker value={copyFrom.targets} multiple disabled={[copyFrom.weekday]} onChange={(targets) => setCopyFrom({ ...copyFrom, targets })} />
            <p className="text-xs text-neutral-500">Aulas iguais (mesmo horário e nome) que já existirem no dia não são duplicadas.</p>
          </div>
        )}
      </Modal>
    </>
  )
}
