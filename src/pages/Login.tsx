import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { ErrorBox } from '../components/ui/Misc'
import { Logo } from '../components/ui/Logo'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 bg-[radial-gradient(ellipse_at_top,_var(--color-brand-900)_0%,_transparent_60%)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-4 h-36 w-36 drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-white">Arena São João</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-brand-300">Painel de gestão</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border-t-4 border-brand-800 bg-white p-6 shadow-2xl">
          {error && <ErrorBox message={error} />}
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" full loading={loading}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
