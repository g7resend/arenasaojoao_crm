import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs } from '../components/ui/Misc'
import CaixaTab from './bar/CaixaTab'
import ProdutosTab from './bar/ProdutosTab'
import DespesasTab from './bar/DespesasTab'
import FechamentosTab from './bar/FechamentosTab'

type Tab = 'caixa' | 'estoque' | 'despesas' | 'fechamentos'
const TABS: Tab[] = ['caixa', 'estoque', 'despesas', 'fechamentos']

export default function Bar() {
  // a aba fica na URL (#/bar?aba=estoque) para dar para abrir direto numa aba
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') as Tab | null
  const tab: Tab = aba && TABS.includes(aba) ? aba : 'caixa'
  const setTab = (t: Tab) => setParams(t === 'caixa' ? {} : { aba: t }, { replace: true })

  return (
    <>
      <PageHeader title="Bar" />
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'caixa', label: 'Caixa' },
            { value: 'estoque', label: 'Estoque' },
            { value: 'despesas', label: 'Despesas' },
            { value: 'fechamentos', label: 'Fechamentos' },
          ]}
        />
      </div>

      {tab === 'caixa' && <CaixaTab onGoToProducts={() => setTab('estoque')} />}
      {tab === 'estoque' && <ProdutosTab />}
      {tab === 'despesas' && <DespesasTab />}
      {tab === 'fechamentos' && <FechamentosTab />}
    </>
  )
}
