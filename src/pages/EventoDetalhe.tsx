import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ClipboardPaste, Copy, FileSpreadsheet, FileText, MapPin, Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDateLong, formatTime, normalizeText } from '../lib/format'
import { exportCsv, exportPdf, participantsText, sortByName, type ExportContext } from '../lib/export'
import { copyToClipboard } from '../lib/whatsapp'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Card, EmptyState, ErrorBox, Spinner, Tabs } from '../components/ui/Misc'
import { Dropdown } from '../components/ui/Dropdown'
import { EventFormModal } from '../components/events/EventFormModal'
import { ParticipantFormModal } from '../components/events/ParticipantFormModal'
import { ParticipantRow } from '../components/events/ParticipantRow'
import { PasteListModal } from '../components/events/PasteListModal'
import { CapacityBar } from '../components/events/CapacityBar'
import ComissariosTab from './evento/ComissariosTab'
import CardapioTab from './evento/CardapioTab'
import PortariaTab from './evento/PortariaTab'
import { deleteEventImage, eventImageUrl } from '../lib/eventImages'
import type { ArenaEvent, EventLot, EventParticipant, EventSeller } from '../types/db'

type Filter = 'todos' | 'entraram' | 'faltam'
type Tab = 'pagantes' | 'comissarios' | 'cardapio' | 'portaria'
const TABS: Tab[] = ['pagantes', 'comissarios', 'cardapio', 'portaria']

export default function EventoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const toast = useToast()
  // a aba fica na URL (#/eventos/id?aba=cardapio), como no Bar
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') as Tab | null
  const tab: Tab = aba && TABS.includes(aba) ? aba : 'pagantes'
  const setTab = (t: Tab) => setParams(t === 'pagantes' ? {} : { aba: t }, { replace: true })
  const [event, setEvent] = useState<ArenaEvent | null>(null)
  const [lots, setLots] = useState<EventLot[]>([])
  const [sellers, setSellers] = useState<EventSeller[]>([])
  const [participants, setParticipants] = useState<EventParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [editingEvent, setEditingEvent] = useState(false)
  const [participantForm, setParticipantForm] = useState<{ open: boolean; participant: EventParticipant | null; sellerId?: string | null }>({ open: false, participant: null })
  const [pasteList, setPasteList] = useState<{ open: boolean; sellerId?: string | null }>({ open: false })
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const [e, l, s, p] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase.from('event_lots').select('*').eq('event_id', id).order('sort_order'),
      supabase.from('event_sellers').select('*').eq('event_id', id),
      supabase.from('event_participants').select('*').eq('event_id', id),
    ])
    if (e.error || l.error || s.error || p.error) toast('Erro ao carregar evento.', 'error')
    setEvent((e.data as ArenaEvent) ?? null)
    setLots((l.data as EventLot[]) ?? [])
    setSellers((s.data as EventSeller[]) ?? [])
    setParticipants((p.data as EventParticipant[]) ?? [])
    setLoading(false)
  }, [id, toast])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(() => sortByName(participants), [participants])
  const visible = useMemo(() => {
    const q = normalizeText(search)
    return sorted.filter((p) => {
      if (filter === 'entraram' && !p.checked_in) return false
      if (filter === 'faltam' && p.checked_in) return false
      return !q || normalizeText(p.name).includes(q)
    })
  }, [sorted, search, filter])

  if (loading) return <Spinner />
  if (!event)
    return (
      <div className="space-y-4">
        <ErrorBox message="Evento não encontrado." />
        <Link to="/eventos" className="text-sm font-medium text-brand-800">
          ← Voltar para eventos
        </Link>
      </div>
    )

  const total = participants.reduce((a, p) => a + Number(p.amount_paid), 0)
  const checkedIn = participants.filter((p) => p.checked_in).length
  const remaining = event.capacity ? event.capacity - participants.length : null
  const lotName = (lotId: string | null) => lots.find((l) => l.id === lotId)?.name
  const sellerName = (sellerId: string | null) => sellers.find((s) => s.id === sellerId)?.name
  const arenaName = settings?.arena_name ?? 'Arena São João'
  const ctx: ExportContext = { arenaName, event, lots, sellers, participants }

  async function toggleCheckIn(p: EventParticipant) {
    const checked_in = !p.checked_in
    const checked_in_at = checked_in ? new Date().toISOString() : null
    // otimista: marca na hora, desfaz se der erro
    setParticipants((list) => list.map((x) => (x.id === p.id ? { ...x, checked_in, checked_in_at } : x)))
    const { error } = await supabase.from('event_participants').update({ checked_in, checked_in_at }).eq('id', p.id)
    if (error) {
      setParticipants((list) => list.map((x) => (x.id === p.id ? p : x)))
      toast('Erro ao marcar check-in.', 'error')
    }
  }

  async function removeParticipant(p: EventParticipant) {
    if (!confirm(`Excluir ${p.name} da lista de pagantes?`)) return
    const { error } = await supabase.from('event_participants').delete().eq('id', p.id)
    if (error) return toast('Erro ao excluir pagante.', 'error')
    toast('Pagante excluído.')
    load()
  }

  async function deleteEvent() {
    if (!event) return
    if (!confirm(`Excluir o evento "${event.name}" e toda a lista de ${participants.length} pagante(s)?`)) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return toast('Erro ao excluir evento.', 'error')
    await deleteEventImage(event.image_path)
    toast('Evento excluído.')
    navigate('/eventos', { replace: true })
  }

  async function handlePdf() {
    setExporting(true)
    try {
      await exportPdf(ctx)
    } catch {
      toast('Erro ao gerar PDF.', 'error')
    }
    setExporting(false)
  }

  async function handleCopy() {
    const ok = await copyToClipboard(participantsText(ctx))
    toast(ok ? 'Lista copiada! É só colar no WhatsApp.' : 'Não foi possível copiar.', ok ? 'success' : 'error')
  }

  return (
    <>
      <Link to="/eventos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={16} /> Eventos
      </Link>

      <Card className="mb-4 overflow-hidden">
        {event.image_path && <img src={eventImageUrl(event.image_path)!} alt={`Imagem do evento ${event.name}`} className="max-h-80 w-full bg-neutral-950 object-contain" />}
        <div className="flex items-start gap-3 border-b-2 border-brand-800 bg-neutral-950 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-white">{event.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-300">
              <CalendarDays size={14} /> {formatDateLong(event.event_date)}
              {event.start_time && ` · ${formatTime(event.start_time)}`}
            </p>
            {event.location && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-400">
                <MapPin size={14} /> {event.location}
              </p>
            )}
          </div>
          <Dropdown
              tone="dark"
              items={[
                { label: 'Editar evento', icon: <Pencil size={16} />, onClick: () => setEditingEvent(true) },
                { label: 'Excluir evento', icon: <Trash2 size={16} />, onClick: deleteEvent, danger: true },
              ]}
            />
        </div>

        <div className="grid grid-cols-3 divide-x divide-neutral-100">
          <div className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Pagantes</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900">
              {participants.length}
              {event.capacity && <span className="text-sm font-medium text-neutral-400"> / {event.capacity}</span>}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Arrecadado</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700">{formatCurrency(total)}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Entraram</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900">
              {checkedIn}
              <span className="text-sm font-medium text-neutral-400"> / {participants.length}</span>
            </p>
          </div>
        </div>
        {event.capacity && (
          <div className="px-4 pb-3">
            <CapacityBar value={participants.length} max={event.capacity} />
            <p className="mt-1 text-xs text-neutral-500">{remaining! > 0 ? `${remaining} vaga${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'}` : 'Lotado'}</p>
          </div>
        )}
        {lots.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-3">
            {lots.map((l) => {
              const n = participants.filter((p) => p.lot_id === l.id).length
              return (
                <span key={l.id} className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                  <strong className="text-neutral-800">{l.name}</strong> · {formatCurrency(l.price)} · {n} vendido{n === 1 ? '' : 's'}
                </span>
              )
            })}
          </div>
        )}
      </Card>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pagantes', label: 'Pagantes' },
            { value: 'comissarios', label: 'Comissários' },
            { value: 'cardapio', label: 'Cardápio' },
            { value: 'portaria', label: 'Portaria' },
          ]}
        />
      </div>

      {tab === 'pagantes' && (
        <>
          {/* Ações */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button icon={<UserPlus size={16} />} onClick={() => setParticipantForm({ open: true, participant: null })}>
              Adicionar pagante
            </Button>
            <Button variant="secondary" icon={<ClipboardPaste size={16} />} onClick={() => setPasteList({ open: true })}>
              Colar lista
            </Button>
            <Button variant="secondary" icon={<Copy size={16} />} onClick={handleCopy} disabled={!participants.length}>
              Copiar lista
            </Button>
            <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={() => exportCsv(ctx)} disabled={!participants.length}>
              Excel (CSV)
            </Button>
            <Button variant="secondary" icon={<FileText size={16} />} onClick={handlePdf} loading={exporting} disabled={!participants.length}>
              PDF
            </Button>
          </div>

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'todos', label: 'Todos', count: participants.length },
                { value: 'faltam', label: 'Não entraram', count: participants.length - checkedIn },
                { value: 'entraram', label: 'Entraram', count: checkedIn },
              ]}
            />
            <div className="relative sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400" />
              <Input placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <Card>
            {participants.length === 0 ? (
              <EmptyState
                icon={<UserPlus size={40} />}
                title="Nenhum pagante ainda"
                description="Adicione as pessoas que já pagaram o ingresso."
                action={
                  <Button icon={<Plus size={16} />} onClick={() => setParticipantForm({ open: true, participant: null })}>
                    Adicionar pagante
                  </Button>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState icon={<Search size={40} />} title="Ninguém encontrado" />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {visible.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    lotName={lotName(p.lot_id)}
                    sellerName={sellerName(p.seller_id)}
                    onToggleCheckIn={() => toggleCheckIn(p)}
                    onEdit={() => setParticipantForm({ open: true, participant: p })}
                    onRemove={() => removeParticipant(p)}
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === 'comissarios' && (
        <ComissariosTab
          eventId={event.id}
          sellers={sellers}
          lots={lots}
          participants={participants}
          reload={load}
          onAddParticipant={(sellerId) => setParticipantForm({ open: true, participant: null, sellerId })}
          onPasteList={(sellerId) => setPasteList({ open: true, sellerId })}
          onEditParticipant={(p) => setParticipantForm({ open: true, participant: p })}
          onToggleCheckIn={toggleCheckIn}
          onRemoveParticipant={removeParticipant}
        />
      )}

      {tab === 'cardapio' && <CardapioTab event={event} arenaName={arenaName} />}

      {tab === 'portaria' && <PortariaTab eventId={event.id} />}

      <EventFormModal
        open={editingEvent}
        event={event}
        lots={lots}
        onClose={() => setEditingEvent(false)}
        onSaved={() => {
          setEditingEvent(false)
          load()
        }}
      />
      <PasteListModal
        open={pasteList.open}
        eventId={event.id}
        lots={lots}
        sellers={sellers}
        defaultSellerId={pasteList.sellerId}
        participants={participants}
        remaining={remaining}
        onClose={() => setPasteList({ open: false })}
        onSaved={async () => {
          await load()
          setPasteList({ open: false })
        }}
      />
      <ParticipantFormModal
        open={participantForm.open}
        eventId={event.id}
        participant={participantForm.participant}
        lots={lots}
        sellers={sellers}
        defaultSellerId={participantForm.sellerId}
        remaining={remaining}
        onClose={() => setParticipantForm({ open: false, participant: null })}
        onSaved={(keepOpen) => {
          if (!keepOpen) setParticipantForm({ open: false, participant: null })
          load()
        }}
      />
    </>
  )
}
