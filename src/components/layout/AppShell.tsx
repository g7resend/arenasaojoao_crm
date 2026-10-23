import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarClock, CalendarDays, CircleHelp, CupSoda, Home, LogOut, Megaphone, Menu, PartyPopper, Receipt, Settings, Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { ErrorBox, Spinner } from '../ui/Misc'
import { Logo } from '../ui/Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: Home },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/mensalidades', label: 'Mensalidades', icon: Receipt },
  { to: '/aulas', label: 'Aulas avulsas', icon: CalendarClock },
  { to: '/quadra', label: 'Quadra', icon: CalendarDays },
  { to: '/eventos', label: 'Eventos', icon: PartyPopper },
  { to: '/bar', label: 'Bar', icon: CupSoda },
  { to: '/horarios', label: 'Horários', icon: Megaphone },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/ajuda', label: 'Como usar', icon: CircleHelp },
]

// No celular: 4 atalhos fixos + "Mais"
const BOTTOM = ['/', '/alunos', '/mensalidades', '/quadra']

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

function Brand({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-3">
      <Logo className={size === 'md' ? 'h-12 w-12' : 'h-9 w-9'} />
      <div className="leading-none">
        <p className={`font-display font-bold uppercase tracking-wide text-white ${size === 'md' ? 'text-lg' : 'text-base'}`}>{name}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">Futevôlei</p>
      </div>
    </div>
  )
}

export function AppShell() {
  const { signOut, session } = useAuth()
  const { settings, error } = useSettings()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const arenaName = settings?.arena_name || 'Arena São João'

  const moreItems = NAV.filter((n) => !BOTTOM.includes(n.to))
  const moreActive = moreItems.some((n) => isActive(pathname, n.to))

  return (
    <div className="min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-neutral-950 md:flex">
        <div className="px-5 py-5">
          <Brand name={arenaName} />
        </div>
        <div className="mx-5 mb-4 h-px bg-gradient-to-r from-brand-800 via-brand-600/40 to-transparent" />
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-800 text-white shadow-sm shadow-brand-950' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="truncate px-3 pb-2 text-xs text-neutral-500">{session?.user.email}</p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-brand-800 bg-neutral-950 px-4 py-2.5 md:hidden">
        <Brand name={arenaName} size="sm" />
      </header>

      <main className="px-4 pb-28 pt-5 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4">
              <ErrorBox message={error} />
            </div>
          )}
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Navegação inferior (celular) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white md:hidden">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => BOTTOM.includes(n.to)).map(({ to, label, icon: Icon }) => {
            const active = isActive(pathname, to)
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-brand-800' : 'text-neutral-500'}`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {label}
              </NavLink>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? 'text-brand-800' : 'text-neutral-500'}`}
          >
            <Menu size={22} strokeWidth={moreActive ? 2.4 : 2} />
            Mais
          </button>
        </div>
      </nav>

      {/* Menu "Mais" (celular) */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-neutral-900/40" onClick={() => setMoreOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" />
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center text-xs font-medium ${
                    isActive(pathname, to) ? 'bg-brand-800 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <Icon size={22} />
                  {label}
                </NavLink>
              ))}
              <button
                onClick={signOut}
                className="flex flex-col items-center gap-2 rounded-xl bg-neutral-50 p-3 text-xs font-medium text-red-600"
              >
                <LogOut size={22} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
