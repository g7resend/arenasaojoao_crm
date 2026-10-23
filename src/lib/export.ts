import type { ArenaEvent, EventLot, EventParticipant } from '../types/db'
import { PAYMENT_METHODS, formatCurrency, formatDate, formatDateLong, formatPhone, formatTime } from './format'

export interface ExportContext {
  arenaName: string
  event: ArenaEvent
  lots: EventLot[]
  participants: EventParticipant[]
}

/** Pagantes em ordem alfabética (pt-BR, ignorando acentos/maiúsculas) */
export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

function lotName(lots: EventLot[], id: string | null) {
  return lots.find((l) => l.id === id)?.name ?? '—'
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function eventSubtitle(event: ArenaEvent) {
  return [formatDateLong(event.event_date), event.start_time && formatTime(event.start_time), event.location].filter(Boolean).join(' · ')
}

/** CSV com BOM e separador ";" (abre direto no Excel em pt-BR) */
export function exportCsv({ event, lots, participants }: ExportContext) {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const header = ['Nº', 'Nome', 'Telefone', 'Lote', 'Valor pago', 'Forma de pagamento', 'Data do pagamento', 'Check-in']
  const rows = sortByName(participants).map((p, i) => [
    String(i + 1),
    p.name,
    p.phone ? formatPhone(p.phone) : '',
    lotName(lots, p.lot_id),
    Number(p.amount_paid).toFixed(2).replace('.', ','),
    PAYMENT_METHODS[p.payment_method],
    formatDate(p.paid_at),
    p.checked_in ? 'Sim' : 'Não',
  ])
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `pagantes-${slug(event.name)}.csv`)
}

/** PDF para imprimir, com coluna de check-in em branco para marcar na entrada */
export async function exportPdf({ arenaName, event, lots, participants }: ExportContext) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const sorted = sortByName(participants)
  const total = participants.reduce((a, p) => a + Number(p.amount_paid), 0)

  doc.setFillColor(10, 10, 10)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setFillColor(87, 19, 20)
  doc.rect(0, 28, 210, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(event.name, 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${arenaName} · ${eventSubtitle(event)}`, 14, 20)

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(10)
  doc.text(`Lista de pagantes: ${sorted.length}${event.capacity ? ` / ${event.capacity}` : ''}  ·  Total arrecadado: ${formatCurrency(total)}`, 14, 37)

  autoTable(doc, {
    startY: 41,
    head: [['Nº', 'Nome', 'Lote', 'Valor', 'Forma', 'Entrada']],
    body: sorted.map((p, i) => [
      String(i + 1),
      p.name,
      lotName(lots, p.lot_id),
      formatCurrency(p.amount_paid),
      PAYMENT_METHODS[p.payment_method],
      p.checked_in ? 'X' : '',
    ]),
    styles: { fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [87, 19, 20], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      3: { halign: 'right' },
      5: { cellWidth: 18, halign: 'center', lineWidth: 0.2, lineColor: [180, 180, 180] },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · página ${page}`, 14, 290)
    },
  })

  doc.save(`pagantes-${slug(event.name)}.pdf`)
}

/** Texto para colar no WhatsApp */
export function participantsText({ event, lots, participants }: ExportContext): string {
  const sorted = sortByName(participants)
  const lines = sorted.map((p, i) => {
    const lot = lotName(lots, p.lot_id)
    return `${i + 1}. ${p.name}${lot !== '—' && lots.length > 1 ? ` (${lot})` : ''}`
  })
  return [
    `🏐 *${event.name}*`,
    `📅 ${eventSubtitle(event)}`,
    '',
    `✅ *Lista de pagantes (${sorted.length}${event.capacity ? `/${event.capacity}` : ''})*`,
    '',
    ...lines,
  ].join('\n')
}
