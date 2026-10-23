import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Settings } from '../types/db'

interface SettingsContextValue {
  settings: Settings | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  save: (patch: Partial<Omit<Settings, 'id' | 'updated_at'>>) => Promise<string | null>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    if (error) setError('Não foi possível carregar as configurações. Verifique se o SQL foi executado no Supabase.')
    else if (!data) setError('Configurações não encontradas. Rode o arquivo 001_init.sql no Supabase.')
    else {
      setSettings(data as Settings)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function save(patch: Partial<Omit<Settings, 'id' | 'updated_at'>>) {
    const { data, error } = await supabase
      .from('settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single()
    if (error) return 'Erro ao salvar configurações.'
    setSettings(data as Settings)
    return null
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, error, reload, save }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa estar dentro de SettingsProvider')
  return ctx
}
