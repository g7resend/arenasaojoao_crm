import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDayLabel } from '../../lib/format'
import { dateOf, timeOf } from '../../lib/bar'
import { useToast } from '../../hooks/useToast'
import { Button } from '../../components/ui/Button'
import { Badge, Card, EmptyState, Spinner } from '../../components/ui/Misc'
import { SessionDetailModal } from '../../components/bar/SessionDetailModal'
import type { BarCashSession } from '../../types/db'

const PAGE = 30

function DiffBadge({ s }: { s: BarCashSession }) {
  const diff = Number(s.counted_cash ?? 0) - Number(s.expected_cash ?? 0)
  if (Math.abs(diff) < 0.005) return <Badge color="green">Dinheiro confere</Badge>
  return diff > 0 ? <Badge color="yellow">Sobrou {formatCurrency(diff)}</Badge> : <Badge color="red">Faltou {formatCurrency(-diff)}</Badge>
}

export default function FechamentosTab() {
  const toast = useToast()
  const [sessions, setSessions] = useState<BarCashSession[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('bar_cash_sessions')
      .select('*')
      .not('closed_at', 'is', null)
      .order('opened_at', { ascending: false })
      .limit(limit)
    if (error) toast('Erro ao carregar os fechamentos.', 'error')
    setSessions((data as BarCashSession[]) ?? [])
    setLoading(false)
  }, [limit, toast])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />

  return (
    <>
      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={40} />}
            title="Nenhum caixa fechado ainda"
            description='Quando você fechar o caixa na aba "Caixa", o resumo do dia aparece aqui.'
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-neutral-100">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setDetail(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{formatDayLabel(dateOf(s.opened_at))}</p>
                    <p className="text-xs text-neutral-500">
                      {timeOf(s.opened_at)} às {s.closed_at ? timeOf(s.closed_at) : '—'} · {s.sales_count ?? 0} venda{s.sales_count === 1 ? '' : 's'}
                    </p>
                    <div className="mt-1">
                      <DiffBadge s={s} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums text-emerald-700">{formatCurrency(s.total_sales)}</p>
                    {Number(s.total_expenses) > 0 && <p className="text-xs tabular-nums text-red-700">− {formatCurrency(s.total_expenses)}</p>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-neutral-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sessions.length === limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Ver mais antigos
          </Button>
        </div>
      )}
      <SessionDetailModal sessionId={detail} onClose={() => setDetail(null)} />
    </>
  )
}
