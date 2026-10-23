import type { ClassSlot } from '../types/db'
import { WEEKDAYS_FULL, addDays, formatDate, todayISO, weekdayOf } from './format'
import { fillTemplate } from './whatsapp'

/** Modelo padrão da mensagem diária (igual ao que o professor manda no grupo) */
export const DEFAULT_SCHEDULE_TEMPLATE = 'AULAS DE {quando} !! 🔥🚀\n\n{aulas}'

/** A primeira versão usava uma mensagem semanal com {semana}; esses modelos viram o diário */
export function isLegacyScheduleTemplate(template: string): boolean {
  return template.includes('{semana}')
}

/** "17:00" → "17 hrs" · "17:30" → "17:30 hrs" */
export function formatHour(time: string): string {
  const [h, m] = time.slice(0, 5).split(':')
  return m === '00' ? `${Number(h)} hrs` : `${Number(h)}:${m} hrs`
}

/** "HOJE", "AMANHÃ" ou "SEXTA-FEIRA (24/10)" */
export function whenLabel(date: string): string {
  if (date === todayISO()) return 'HOJE'
  if (date === addDays(todayISO(), 1)) return 'AMANHÃ'
  return `${WEEKDAYS_FULL[weekdayOf(date)].toUpperCase()} (${formatDate(date).slice(0, 5)})`
}

/** Aulas ativas do dia da semana da data, em ordem de horário */
export function slotsForDate(slots: ClassSlot[], date: string): ClassSlot[] {
  const wd = weekdayOf(date)
  return slots.filter((s) => s.active && s.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
}

/** Monta a mensagem: uma aula por linha, com linhas em branco para o pessoal colocar o nome */
export function dailyMessage(template: string, slots: ClassSlot[], date: string, arenaName: string): string {
  const aulas = slotsForDate(slots, date)
    .map((s) => `${formatHour(s.start_time)} (${s.name})`)
    .join('\n\n\n')
  return fillTemplate(template, {
    quando: whenLabel(date),
    aulas,
    horarios: aulas, // compatibilidade com o modelo antigo
    data: formatDate(date),
    dia_semana: WEEKDAYS_FULL[weekdayOf(date)],
    arena: arenaName,
  })
}
