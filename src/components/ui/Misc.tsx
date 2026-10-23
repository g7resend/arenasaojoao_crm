import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-200/70 bg-white shadow-sm ${className}`}>{children}</div>
}

type BadgeColor = 'green' | 'yellow' | 'red' | 'gray' | 'blue'

const badgeColors: Record<BadgeColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  gray: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
}

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeColors[color]}`}>
      {children}
    </span>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-10 text-brand-600 ${className}`}>
      <Loader2 className="animate-spin" size={28} />
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-neutral-300">{icon}</div>}
      <p className="font-medium text-neutral-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-neutral-900">{title}</h1>
        <div className="mt-1 h-1 w-10 rounded-full bg-brand-800" />
        {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

interface TabsProps<T extends string> {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}

/** Abas/segmentos roláveis horizontalmente (bom para filtros no celular) */
export function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              value === t.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-neutral-400">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
}
