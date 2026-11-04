import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SettingsProvider } from './hooks/useSettings'
import { ToastProvider } from './hooks/useToast'
import { AppShell } from './components/layout/AppShell'
import { Button } from './components/ui/Button'
import { ErrorBox, Spinner } from './components/ui/Misc'
import Login from './pages/Login'

// páginas carregadas sob demanda (bundle inicial menor no celular)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Alunos = lazy(() => import('./pages/Alunos'))
const AlunoDetalhe = lazy(() => import('./pages/AlunoDetalhe'))
const Mensalidades = lazy(() => import('./pages/Mensalidades'))
const Aulas = lazy(() => import('./pages/Aulas'))
const Quadra = lazy(() => import('./pages/Quadra'))
const Eventos = lazy(() => import('./pages/Eventos'))
const EventoDetalhe = lazy(() => import('./pages/EventoDetalhe'))
const Bar = lazy(() => import('./pages/Bar'))
const Horarios = lazy(() => import('./pages/Horarios'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const ComoUsar = lazy(() => import('./pages/ComoUsar'))
const Portaria = lazy(() => import('./pages/Portaria'))

/** Só renderiza as telas internas com usuário logado */
function ProtectedRoute() {
  const { session, loading, role, roleError, retryRole, signOut } = useAuth()
  if (loading) return <Spinner className="min-h-dvh items-center" />
  if (!session) return <Navigate to="/login" replace />
  if (roleError)
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4">
        <ErrorBox message="Não foi possível carregar o seu acesso. Verifique a internet." />
        <Button onClick={retryRole}>Tentar de novo</Button>
        <Button variant="ghost" onClick={signOut}>
          Sair
        </Button>
      </div>
    )
  if (!role) return <Spinner className="min-h-dvh items-center" />
  // login de portaria só tem esta tela, seja qual for o endereço aberto
  if (role === 'portaria')
    return (
      <Suspense fallback={<Spinner className="min-h-dvh items-center" />}>
        <Portaria />
      </Suspense>
    )
  return (
    <SettingsProvider>
      <Outlet />
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="alunos" element={<Alunos />} />
                <Route path="alunos/:id" element={<AlunoDetalhe />} />
                <Route path="mensalidades" element={<Mensalidades />} />
                <Route path="aulas" element={<Aulas />} />
                <Route path="quadra" element={<Quadra />} />
                <Route path="eventos" element={<Eventos />} />
                <Route path="eventos/:id" element={<EventoDetalhe />} />
                <Route path="bar" element={<Bar />} />
                <Route path="horarios" element={<Horarios />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="ajuda" element={<ComoUsar />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
