import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DoorOpen, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Card, EmptyState, Spinner } from '../../components/ui/Misc'
import type { EventGateAccess } from '../../types/db'

function grantError(message: string) {
  if (message.includes('usuario_nao_encontrado')) return 'Nenhum login com esse e-mail. Crie o login no Supabase primeiro.'
  if (message.includes('usuario_administrador')) return 'Esse e-mail é de administrador, ele já vê tudo.'
  return 'Erro ao liberar o acesso.'
}

export default function PortariaTab({ eventId }: { eventId: string }) {
  const toast = useToast()
  const [list, setList] = useState<EventGateAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('event_gate_access').select('*').eq('event_id', eventId).order('created_at')
    if (error) toast('Erro ao carregar os acessos.', 'error')
    setList((data as EventGateAccess[]) ?? [])
    setLoading(false)
  }, [eventId, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.rpc('gate_grant', { p_event: eventId, p_email: email })
    if (error) {
      setSaving(false)
      return toast(grantError(error.message), 'error')
    }
    toast('Acesso liberado!')
    setEmail('')
    await load()
    setSaving(false)
  }

  async function revoke(a: EventGateAccess) {
    if (!confirm(`Tirar o acesso de ${a.email} a este evento?`)) return
    const { error } = await supabase.from('event_gate_access').delete().eq('event_id', a.event_id).eq('user_id', a.user_id)
    if (error) return toast('Erro ao tirar o acesso.', 'error')
    toast('Acesso removido.')
    load()
  }

  if (loading) return <Spinner />

  return (
    <>
      <Card className="mb-4 p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="E-mail do login da portaria"
            type="email"
            required
            autoComplete="off"
            hint="O login é criado no Supabase, em Authentication → Users → Add user. Essa pessoa só vê a lista dos eventos liberados aqui."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" icon={<DoorOpen size={16} />} loading={saving}>
            Liberar este evento
          </Button>
        </form>
      </Card>

      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<DoorOpen size={40} />} title="Ninguém liberado" description="Libere um login para a pessoa da portaria conferir os nomes na entrada." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {list.map((a) => (
              <li key={a.user_id} className="flex items-center gap-3 px-4 py-2.5">
                <p className="min-w-0 flex-1 break-words font-medium text-neutral-900">{a.email}</p>
                <IconButton label={`Tirar acesso de ${a.email}`} onClick={() => revoke(a)} className="text-red-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
