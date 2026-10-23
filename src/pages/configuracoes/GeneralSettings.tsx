import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Card } from '../../components/ui/Misc'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import type { Settings } from '../../types/db'

export default function GeneralSettings({ settings }: { settings: Settings }) {
  const { save } = useSettings()
  const toast = useToast()
  const [arenaName, setArenaName] = useState(settings.arena_name)
  const [pixKey, setPixKey] = useState(settings.pix_key)
  const [groupLink, setGroupLink] = useState(settings.group_link)
  const [saving, setSaving] = useState(false)

  const linkInvalid = groupLink.trim() !== '' && !/^https:\/\/chat\.whatsapp\.com\//.test(groupLink.trim())

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const err = await save({ arena_name: arenaName.trim() || 'Arena São João', pix_key: pixKey.trim(), group_link: groupLink.trim() })
    setSaving(false)
    toast(err ?? 'Configurações salvas!', err ? 'error' : 'success')
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome da arena" value={arenaName} onChange={(e) => setArenaName(e.target.value)} required />
        <Input
          label="Chave Pix"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          hint="Usada na variável {chave_pix} da mensagem de cobrança."
        />
        <Input
          label="Link do grupo dos alunos (WhatsApp)"
          type="url"
          value={groupLink}
          onChange={(e) => setGroupLink(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          hint="Usado no botão “Abrir grupo” da mensagem de horários."
          error={linkInvalid ? 'O link de convite costuma começar com https://chat.whatsapp.com/' : undefined}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon={<Save size={16} />}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  )
}
