import { useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { Card } from '../../components/ui/Misc'
import { WhatsAppPreview } from '../../components/ui/WhatsAppPreview'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { fillTemplate } from '../../lib/whatsapp'
import type { Settings } from '../../types/db'

type TemplateKey = 'tpl_billing' | 'tpl_lesson_confirmation' | 'tpl_schedule'

interface TemplateDef {
  key: TemplateKey
  title: string
  description: string
  variables: Record<string, string> // variável → exemplo usado na prévia
}

function templateDefs(settings: Settings): TemplateDef[] {
  return [
    {
      key: 'tpl_billing',
      title: 'Cobrança de mensalidade',
      description: 'Enviada pelo botão “Cobrar no WhatsApp”. {nome} usa o primeiro nome do aluno.',
      variables: {
        nome: 'João',
        valor: 'R$ 150,00',
        vencimento: '10/11/2026',
        competencia: 'Novembro/2026',
        chave_pix: settings.pix_key || '(chave Pix)',
      },
    },
    {
      key: 'tpl_lesson_confirmation',
      title: 'Confirmação de aula avulsa',
      description: 'Enviada pelo botão de confirmação da aula particular.',
      variables: { nome: 'Maria', data: 'Sábado, 24/10/2026', horario: '09:00', valor: 'R$ 80,00' },
    },
    {
      key: 'tpl_schedule',
      title: 'Horários da semana (grupo)',
      description: '{horarios} é preenchido automaticamente com as turmas fixas.',
      variables: {
        arena: settings.arena_name,
        semana: '26/10 a 01/11',
        horarios: '*Segunda-feira*\n⏰ 18:00 — Iniciante (Prof. Carlos)\n⏰ 19:00 — Intermediário (Prof. Carlos)',
      },
    },
  ]
}

function TemplateEditor({ def, value, onChange }: { def: TemplateDef; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function insertVariable(name: string) {
    const el = ref.current
    const token = `{${name}}`
    if (!el) return onChange(value + token)
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-neutral-900">{def.title}</h3>
      <p className="mb-3 text-sm text-neutral-500">{def.description}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <Textarea ref={ref} rows={9} value={value} onChange={(e) => onChange(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(def.variables).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-xs text-brand-800 hover:bg-brand-100"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">Use *texto* para negrito e _texto_ para itálico.</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">Prévia</p>
          <WhatsAppPreview text={fillTemplate(value, def.variables)} />
        </div>
      </div>
    </Card>
  )
}

export default function TemplatesSettings({ settings }: { settings: Settings }) {
  const { save } = useSettings()
  const toast = useToast()
  const [values, setValues] = useState<Record<TemplateKey, string>>({
    tpl_billing: settings.tpl_billing,
    tpl_lesson_confirmation: settings.tpl_lesson_confirmation,
    tpl_schedule: settings.tpl_schedule,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const err = await save(values)
    setSaving(false)
    toast(err ?? 'Mensagens salvas!', err ? 'error' : 'success')
  }

  return (
    <div className="space-y-4">
      {templateDefs(settings).map((def) => (
        <TemplateEditor key={def.key} def={def} value={values[def.key]} onChange={(v) => setValues((s) => ({ ...s, [def.key]: v }))} />
      ))}
      <div className="sticky bottom-20 flex justify-end md:bottom-4">
        <Button loading={saving} icon={<Save size={16} />} onClick={handleSave} className="shadow-lg">
          Salvar mensagens
        </Button>
      </div>
    </div>
  )
}
