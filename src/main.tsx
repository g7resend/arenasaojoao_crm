import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)
const configured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY

if (configured) {
  // App só é carregado com a configuração presente (o cliente Supabase falha sem ela)
  import('./App').then(({ default: App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
} else {
  // Sem isso o site fica em branco: mostra o que falta configurar no deploy
  root.render(
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 px-4">
      <div className="max-w-md rounded-2xl border-t-4 border-brand-800 bg-white p-6 shadow-2xl">
        <h1 className="font-display text-xl font-bold uppercase tracking-wide text-neutral-900">Configuração pendente</h1>
        <p className="mt-2 text-sm text-neutral-600">
          O site foi publicado sem as variáveis de ambiente do Supabase. Cadastre <code className="rounded bg-neutral-100 px-1">VITE_SUPABASE_URL</code> e{' '}
          <code className="rounded bg-neutral-100 px-1">VITE_SUPABASE_ANON_KEY</code> nas configurações do serviço de hospedagem e publique novamente.
        </p>
      </div>
    </div>,
  )
}
