export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const parts = name.trim().split(/\s+/)
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-900 font-semibold text-white ${
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
      }`}
    >
      {initials}
    </div>
  )
}
