import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarRange, Copy, ExternalLink, RotateCcw, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addDays, formatDateLong, todayISO } from '../lib/format'
import { dailyMessage, slotsForDate } from '../lib/schedule'
import { copyToClipboard } from '../lib/whatsapp'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Field'
import { Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { WhatsAppPreview } from '../components/ui/WhatsAppPreview'
import type { ClassSlot } from '../types/db'

type Day = 'hoje' | 'amanha' | 'outro'

export default function Horarios() {
  const { settings } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [day, setDay] = useState<Day>('hoje')
  const [otherDate, setOtherDate] = useState(() => addDays(todayISO(), 2))
  const [text, setText] = useState('')
  const [edited, setEdited] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('class_slots').select('*').eq('active', true).order('start_time')
    if (error) toast('Erro ao carregar turmas.', 'error')
    setSlots((data as ClassSlot[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const date = day === 'hoje' ? todayISO() : day === 'amanha' ? addDays(todayISO(), 1) : otherDate
  const daySlots = useMemo(() => slotsForDate(slots, date), [slots, date])
  const generated = useMemo(
    () => (settings ? dailyMessage(settings.tpl_schedule, slots, date, settings.arena_name) : ''),
    [settings, slots, date],
  )

  // regenera ao trocar o dia, a menos que o admin já tenha editado o texto
  useEffect(() => {
    if (!edited) setText(generated)
  }, [generated, edited])

  function changeDay(next: () => void) {
    if (edited && !confirm('Trocar o dia descarta as edições feitas na mensagem. Continuar?')) return
    setEdited(false)
    next()
  }

  async function handleCopy() {
    const ok = await copyToClipboard(text)
    toast(ok ? 'Mensagem copiada! Agora é só colar no grupo.' : 'Não foi possível copiar.', ok ? 'success' : 'error')
  }

  function handleOpenGroup() {
    // copia em paralelo: o window.open precisa acontecer direto no toque (Safari bloqueia após await)
    copyToClipboard(text).then((ok) => ok && toast('Mensagem copiada. Cole no grupo!'))
    window.open(settings!.group_link, '_blank', 'noopener')
  }

  if (loading || !settings) return <Spinner />

  if (slots.length === 0)
    return (
      <>
        <PageHeader title="Aulas do dia" subtitle="Mensagem para o grupo dos alunos" />
        <Card>
          <EmptyState
            icon={<CalendarRange size={40} />}
            title="Nenhuma turma cadastrada"
            description="Cadastre as aulas de cada dia em Configurações → Turmas fixas para gerar a mensagem."
            action={
              <Button variant="secondary" onClick={() => navigate('/configuracoes')}>
                Ir para Configurações
              </Button>
            }
          />
        </Card>
      </>
    )

  return (
    <>
      <PageHeader title="Aulas do dia" subtitle="Mensagem para o grupo dos alunos" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs
          value={day}
          onChange={(v) => changeDay(() => setDay(v))}
          tabs={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'amanha', label: 'Amanhã' },
            { value: 'outro', label: 'Outro dia' },
          ]}
        />
        {day === 'outro' && (
          <Input type="date" aria-label="Data" value={otherDate} onChange={(e) => changeDay(() => setOtherDate(e.target.value))} wrapperClassName="w-44" />
        )}
        {edited && (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} onClick={() => setEdited(false)}>
            Restaurar mensagem
          </Button>
        )}
      </div>

      <p className="mb-3 text-sm text-neutral-600">
        <strong className="text-neutral-800">{formatDateLong(date)}</strong> ·{' '}
        {daySlots.length ? `${daySlots.length} aula${daySlots.length > 1 ? 's' : ''}` : 'nenhuma aula cadastrada para este dia da semana'}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <Textarea
            label="Mensagem (pode editar antes de enviar)"
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setEdited(true)
            }}
          />
          <p className="mt-2 text-xs text-neutral-500">
            As aulas vêm de Configurações → Turmas fixas. O cabeçalho da mensagem pode ser alterado em Configurações → Mensagens.
          </p>
        </Card>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Prévia no WhatsApp</p>
          <WhatsAppPreview text={text} />
        </div>
      </div>

      <div className="sticky bottom-20 mt-4 grid grid-cols-2 gap-2 rounded-2xl sm:flex sm:flex-wrap bg-white/90 p-3 shadow-lg ring-1 ring-neutral-200 backdrop-blur md:bottom-4">
        <Button icon={<Copy size={16} />} onClick={handleCopy} className="col-span-2 sm:col-span-1">
          Copiar mensagem
        </Button>
        {settings.group_link ? (
          <Button variant="whatsapp" icon={<ExternalLink size={16} />} onClick={handleOpenGroup}>
            Abrir grupo
          </Button>
        ) : (
          <Link to="/configuracoes" className="self-center text-center text-xs text-neutral-500 underline">
            Cadastre o link do grupo
          </Link>
        )}
        <Button
          variant="secondary"
          icon={<Send size={16} />}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}
        >
          Enviar para…
        </Button>
      </div>
    </>
  )
}
