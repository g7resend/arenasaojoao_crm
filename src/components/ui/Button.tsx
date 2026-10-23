import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 active:bg-brand-950',
  secondary: 'bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50 active:bg-neutral-100',
  ghost: 'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1ebe5a] active:bg-[#17a74e]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, full, className = '', children, disabled, type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${full ? 'w-full min-w-0 flex-1' : 'shrink-0'} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
