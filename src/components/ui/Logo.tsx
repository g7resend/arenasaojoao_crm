export const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`

export function Logo({ className = 'h-10 w-10' }: { className?: string }) {
  return <img src={LOGO_URL} alt="Arena São João Del Rei — Futevôlei" className={`object-contain ${className}`} />
}
