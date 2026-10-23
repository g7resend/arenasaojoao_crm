import { useState } from 'react'
import { PageHeader, Spinner, Tabs } from '../components/ui/Misc'
import { useSettings } from '../hooks/useSettings'
import GeneralSettings from './configuracoes/GeneralSettings'
import PlansSettings from './configuracoes/PlansSettings'
import ClassSlotsSettings from './configuracoes/ClassSlotsSettings'
import TemplatesSettings from './configuracoes/TemplatesSettings'

type Tab = 'geral' | 'planos' | 'turmas' | 'mensagens'

export default function Configuracoes() {
  const [tab, setTab] = useState<Tab>('geral')
  const { settings, loading } = useSettings()

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'geral', label: 'Geral' },
            { value: 'planos', label: 'Planos' },
            { value: 'turmas', label: 'Turmas fixas' },
            { value: 'mensagens', label: 'Mensagens' },
          ]}
        />
      </div>

      {tab === 'planos' && <PlansSettings />}
      {tab === 'turmas' && <ClassSlotsSettings />}
      {(tab === 'geral' || tab === 'mensagens') &&
        (loading ? <Spinner /> : settings && (tab === 'geral' ? <GeneralSettings settings={settings} /> : <TemplatesSettings settings={settings} />))}
    </>
  )
}
