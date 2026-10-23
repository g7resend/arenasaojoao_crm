import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

export interface DropdownItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  hidden?: boolean
}

interface DropdownProps {
  items: DropdownItem[]
  label?: string
  /** 'dark' para usar sobre fundos escuros */
  tone?: 'light' | 'dark'
}

/** Menu "⋮" com ações secundárias */
export function Dropdown({ items, label = 'Mais ações', tone = 'light' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const visible = items.filter((i) => !i.hidden)
  if (visible.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
          tone === 'dark' ? 'text-neutral-300 hover:bg-white/10 hover:text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
        }`}
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-neutral-50 ${
                item.danger ? 'text-red-600' : 'text-neutral-700'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
