export const TZ = 'America/Sao_Paulo'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(value: number | string | null | undefined): string {
  return brl.format(Number(value ?? 0))
}

/** Data de hoje em São Paulo no formato YYYY-MM-DD */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

/** Hora atual em São Paulo no formato HH:MM */
export function nowTime(): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

/** Ano e mês (1–12) atuais em São Paulo */
export function currentYearMonth(): { year: number; month: number } {
  const [y, m] = todayISO().split('-').map(Number)
  return { year: y, month: m }
}

/** YYYY-MM-DD → dd/mm/aaaa (sem conversão de fuso) */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** YYYY-MM-DD → "Sex, 23/10" */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${WEEKDAYS_SHORT[weekdayOf(iso)]}, ${d}/${m}`
}

/** YYYY-MM-DD → "Sábado, 24/10/2026" */
export function formatDateLong(iso: string): string {
  return `${WEEKDAYS[weekdayOf(iso)]}, ${formatDate(iso)}`
}

/** Rótulo amigável: "Hoje", "Amanhã", "Ontem" ou "Sábado, 24/10/2026" */
export function formatDayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return `Hoje · ${formatDate(iso)}`
  if (iso === addDays(today, 1)) return `Amanhã · ${formatDate(iso)}`
  if (iso === addDays(today, -1)) return `Ontem · ${formatDate(iso)}`
  return formatDateLong(iso)
}

/** HH:MM:SS → HH:MM */
export function formatTime(time?: string | null): string {
  return time ? time.slice(0, 5) : ''
}

export function formatDateTime(ts?: string | null): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

/** Soma dias a uma data YYYY-MM-DD */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay()
}

/** Segunda-feira da semana da data informada */
export function startOfWeek(iso: string): string {
  const wd = weekdayOf(iso)
  return addDays(iso, wd === 0 ? -6 : 1 - wd)
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
export const WEEKDAYS_SHORT =['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
/** Ordem de exibição: segunda a domingo */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "2026-10-01" → "Outubro/2026" */
export function formatCompetence(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]}/${y}`
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Número nacional (DDD + número) → (32) 99999-9999 */
export function maskNationalPhone(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Telefone salvo (55 + DDD + número) → +55 (32) 99999-9999 */
export function formatPhone(stored?: string | null): string {
  if (!stored) return '—'
  return `+55 ${maskNationalPhone(stored.replace(/^55/, ''))}`
}

export function isValidPhone(stored: string): boolean {
  return /^55\d{10,11}$/.test(stored)
}

export const PAYMENT_METHODS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
} as const

/** Converte texto digitado ("1.234,56" ou "1234.56") em número */
export function parseMoney(input: string): number {
  const s = input.trim()
  if (!s) return 0
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

/** Número → texto para input (1234.5 → "1234,50") */
export function moneyToInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  return Number(value).toFixed(2).replace('.', ',')
}

/** Normaliza para comparação/busca (sem acentos, minúsculo) */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
