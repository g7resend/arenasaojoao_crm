import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'admin' | 'portaria'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  /** null enquanto carrega; quem manda de verdade são as regras do banco */
  role: UserRole | null
  roleError: boolean
  retryRole: () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha inválidos.'
  if (/email not confirmed/i.test(message)) return 'E-mail ainda não confirmado.'
  if (/rate limit|too many/i.test(message)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.'
  if (/fetch|network/i.test(message)) return 'Sem conexão com o servidor. Verifique sua internet.'
  return 'Não foi possível entrar. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole | null>(null)
  const [roleError, setRoleError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    setRole(null)
    setRoleError(false)
    if (!userId) return
    let active = true
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!active) return
      if (error) setRoleError(true)
      else setRole(data ? 'admin' : 'portaria')
    })
    return () => {
      active = false
    }
  }, [userId, attempt])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? translateAuthError(error.message) : null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, role, roleError, retryRole: () => setAttempt((n) => n + 1), signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
