import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, moneyToInput, parseMoney } from '../../lib/format'
import { useToast } from '../../hooks/useToast'
import { Button, IconButton } from '../../components/ui/Button'
import { Input, MoneyInput, Toggle } from '../../components/ui/Field'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { Modal } from '../../components/ui/Modal'
import type { Plan } from '../../types/db'

interface FormState {
  id?: string
  name: string
  price: string
  classesPerWeek: string
  active: boolean
}

const EMPTY: FormState = { name: '', price: '', classesPerWeek: '2', active: true }

export default function PlansSettings() {
  const toast = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('plans').select('*').order('active', { ascending: false }).order('monthly_price')
    if (error) toast('Erro ao carregar planos.', 'error')
    setPlans((data as Plan[]) ?? [])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      monthly_price: parseMoney(form.price),
      classes_per_week: Number(form.classesPerWeek) || 0,
      active: form.active,
    }
    const { error } = form.id
      ? await supabase.from('plans').update(payload).eq('id', form.id)
      : await supabase.from('plans').insert(payload)
    setSaving(false)
    if (error) return toast('Erro ao salvar plano.', 'error')
    toast(form.id ? 'Plano atualizado!' : 'Plano criado!')
    setForm(null)
    load()
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Excluir o plano "${plan.name}"?\n\nAlunos com este plano ficarão sem plano. Se preferir, apenas desative-o.`)) return
    const { error } = await supabase.from('plans').delete().eq('id', plan.id)
    if (error) return toast('Erro ao excluir plano.', 'error')
    toast('Plano excluído.')
    load()
  }

  if (loading) return <Spinner />

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button icon={<Plus size={16} />} onClick={() => setForm(EMPTY)}>
          Novo plano
        </Button>
      </div>

      <Card>
        {plans.length === 0 ? (
          <EmptyState icon={<Tag size={40} />} title="Nenhum plano cadastrado" description="Cadastre os planos mensais (ex: 2x por semana, 3x por semana)." />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-neutral-900">{p.name}</p>
                    {!p.active && <Badge>Inativo</Badge>}
                  </div>
                  <p className="text-sm text-neutral-500">
                    {formatCurrency(p.monthly_price)}/mês · {p.classes_per_week}x por semana
                  </p>
                </div>
                <IconButton
                  label="Editar"
                  onClick={() =>
                    setForm({ id: p.id, name: p.name, price: moneyToInput(p.monthly_price), classesPerWeek: String(p.classes_per_week), active: p.active })
                  }
                >
                  <Pencil size={18} />
                </IconButton>
                <IconButton label="Excluir" onClick={() => handleDelete(p)} className="hover:text-red-600">
                  <Trash2 size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar plano' : 'Novo plano'}
        footer={
          <>
            <Button variant="secondary" full onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="plan-form" full loading={saving}>
              Salvar
            </Button>
          </>
        }
      >
        {form && (
          <form id="plan-form" onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nome do plano" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: 2x por semana" />
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput label="Valor mensal" required value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
              <Input
                label="Aulas por semana"
                type="number"
                inputMode="numeric"
                min={0}
                max={14}
                required
                value={form.classesPerWeek}
                onChange={(e) => setForm({ ...form, classesPerWeek: e.target.value })}
              />
            </div>
            <Toggle label="Plano ativo" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          </form>
        )}
      </Modal>
    </>
  )
}
