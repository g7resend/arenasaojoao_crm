import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { maskNationalPhone, onlyDigits } from '../../lib/format'

const control =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 text-base text-neutral-800 placeholder:text-neutral-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-neutral-50 disabled:text-neutral-500 sm:text-sm'

interface FieldProps {
  label?: string
  hint?: ReactNode
  error?: string
  className?: string
  children: (id: string) => ReactNode
}

export function Field({ label, hint, error, className = '', children }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; error?: string; wrapperClassName?: string }

export function Input({ label, hint, error, wrapperClassName, className = '', ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => <input id={id} className={`${control} h-11 ${className}`} {...rest} />}
    </Field>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string; wrapperClassName?: string }

export function Select({ label, hint, error, wrapperClassName, className = '', children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <select id={id} className={`${control} h-11 ${className}`} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string; wrapperClassName?: string }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className = '', ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => <textarea ref={ref} id={id} className={`${control} py-2.5 ${className}`} {...rest} />}
    </Field>
  )
})

interface PhoneInputProps {
  label?: string
  value: string // armazenado: 55 + DDD + número, ou ''
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  required?: boolean
  wrapperClassName?: string
}

/** Input com prefixo +55 fixo e máscara (32) 99999-9999. Devolve só números com DDI 55. */
export function PhoneInput({ label = 'Telefone (WhatsApp)', value, onChange, error, hint, required, wrapperClassName }: PhoneInputProps) {
  const national = value.replace(/^55/, '')
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <div className="flex">
          <span className="inline-flex h-11 items-center rounded-l-xl border border-r-0 border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
            +55
          </span>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(32) 99999-9999"
            required={required}
            value={maskNationalPhone(national)}
            onChange={(e) => {
              const d = onlyDigits(e.target.value).slice(0, 11)
              onChange(d ? `55${d}` : '')
            }}
            className={`${control} h-11 rounded-l-none`}
          />
        </div>
      )}
    </Field>
  )
}

interface MoneyInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: string
  required?: boolean
  disabled?: boolean
  wrapperClassName?: string
}

/** Input de valor em reais (aceita vírgula). Trabalha com string; converta com parseMoney. */
export function MoneyInput({ label, value, onChange, hint, error, required, disabled, wrapperClassName }: MoneyInputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <div className="flex">
          <span className="inline-flex h-11 items-center rounded-l-xl border border-r-0 border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
            R$
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))}
            required={required}
            disabled={disabled}
            className={`${control} h-11 rounded-l-none`}
          />
        </div>
      )}
    </Field>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-3 text-sm font-medium text-neutral-700"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-neutral-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}
