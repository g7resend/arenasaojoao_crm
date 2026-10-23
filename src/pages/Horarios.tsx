import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarRange, Copy, ExternalLink, RotateCcw, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { WEEKDAYS_FULL, WEEK_ORDER, addDays, formatDate, formatTime, startOfWeek, todayISO } from '../lib/format'
import { copyToClipboard, fillTemplate } from '../lib/whatsapp'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Field'
import { Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { WhatsAppPreview } from '../components/ui/WhatsAppPreview'
import type { ClassSlot } from '../types/db'

type Week = 'atual' | 'proxima'

/** Bloco {horarios}: turmas agrupadas por dia, na ordem segunda → domingo */
function buildSchedule(slots: ClassSlot[], monday: string): string {
  return WEEK_ORDER.map((wd) => {
    const items = slots.filter((s) => s.weekday === wd)
    if (!items.length) return null
    const date = addDays(monday, wd === 0 ? 6 : wd - 1)
    const lines = items.map((s) => {
      const time = s.end_time ? `${formatTime(s.start_time)} às ${formatTime(s.end_time)}` : formatTime(s.start_time)
      return `⏰ ${time} — ${s.name}${s.teacher ? ` (Prof. ${s.teacher})` : ''}`
    })
    return [`*${WEEKDAYS_FULL[wd]} (${formatDate(date).slice(0, 5)})*`, ...lines].join('\n')
  })
    .filter(Boolean)
    .join('\n\n')
}

export default function Horarios() {
  const { settings } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [slots, setSlots] = useState<ClassSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState<Week>('atual')
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

  const generated = useMemo(() => {
    if (!settings) return ''
    const monday = addDays(startOfWeek(todayISO()), week === 'proxima' ? 7 : 0)
    return fillTemplate(settings.tpl_schedule, {
      arena: settings.arena_name,
      semana: `${formatDate(monday).slice(0, 5)} a ${formatDate(addDays(monday, 6))}`,
      horarios: buildSchedule(slots, monday),
    })
  }, [settings, slots, week])

  // regenera a mensagem quando muda a semana/turmas, a menos que o admin já tenha editado
  useEffect(() => {
    if (!edited) setText(generated)
  }, [generated, edited])

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

  return (
    <>
      <PageHeader title="Horários da semana" subtitle="Mensagem para o grupo dos alunos" />

      {slots.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarRange size={40} />}
            title="Nenhuma turma ativa"
            description="Cadastre as turmas fixas para gerar a mensagem."
            action={
              <Button variant="secondary" onClick={() => navigate('/configuracoes')}>
                Ir para Configurações
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={week}
              onChange={(v) => {
                if (edited && !confirm('Trocar a semana descarta as edições feitas na mensagem. Continuar?')) return
                setEdited(false)
                setWeek(v)
              }}
              tabs={[
                { value: 'atual', label: 'Esta semana' },
                { value: 'proxima', label: 'Próxima semana' },
              ]}
            />
            {edited && (
              <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} onClick={() => setEdited(false)}>
                Restaurar mensagem
              </Button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <Textarea
                label="Mensagem (pode editar antes de enviar)"
                rows={16}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setEdited(true)
                }}
              />
              <p className="mt-2 text-xs text-neutral-500">
                *texto* = negrito no WhatsApp. O modelo da mensagem fica em Configurações → Mensagens.
              </p>
            </Card>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Prévia no WhatsApp</p>
              <WhatsAppPreview text={text} />
            </div>
          </div>

          <div className="sticky bottom-20 mt-4 flex flex-wrap gap-2 rounded-2xl bg-white/90 p-3 shadow-lg ring-1 ring-neutral-200 backdrop-blur md:bottom-4">
            <Button icon={<Copy size={16} />} onClick={handleCopy} className="flex-1 sm:flex-none">
              Copiar mensagem
            </Button>
            {settings.group_link ? (
              <Button variant="whatsapp" icon={<ExternalLink size={16} />} onClick={handleOpenGroup} className="flex-1 sm:flex-none">
                Abrir grupo
              </Button>
            ) : (
              <Link to="/configuracoes" className="self-center text-sm text-neutral-500 underline">
                Cadastre o link do grupo
              </Link>
            )}
            <Button
              variant="secondary"
              icon={<Send size={16} />}
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}
              className="flex-1 sm:flex-none"
            >
              Enviar para…
            </Button>
          </div>
        </>
      )}
    </>
  )
}
