import type { ArenaEvent, EventLot, EventMenuItem, EventParticipant, EventSeller, ListType } from '../types/db'
import { eventImageUrl, loadImage } from './eventImages'
import { LIST_TYPES, PAYMENT_METHODS, formatCurrency, formatDate, formatDateLong, formatPhone, formatTime } from './format'
import { buildMenuPdf, type MenuLogo } from './menuPdf'

export interface ExportContext {
  arenaName: string
  event: ArenaEvent
  lots: EventLot[]
  sellers: EventSeller[]
  participants: EventParticipant[]
}

/** Pagantes em ordem alfabética (pt-BR, ignorando acentos/maiúsculas) */
export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

/** Quantos nomes há em cada lista do evento */
export function listCounts(participants: EventParticipant[]) {
  const count = (t: ListType) => participants.filter((p) => p.list_type === t).length
  return [
    { label: 'Pagantes', count: count('pagante') },
    { label: 'Cortesias', count: count('cortesia') },
    { label: 'Divulgação', count: count('divulgacao') },
  ]
}

const hasFreeList = (participants: EventParticipant[]) => participants.some((p) => p.list_type !== 'pagante')

function lotName(lots: EventLot[], id: string | null) {
  return lots.find((l) => l.id === id)?.name ?? '—'
}

function sellerName(sellers: EventSeller[], p: EventParticipant) {
  return sellers.find((s) => s.id === p.seller_id)?.name ?? (p.sold_at_gate ? 'Portaria' : '—')
}

const hasSellerColumn = (sellers: EventSeller[], participants: EventParticipant[]) => sellers.length > 0 || participants.some((p) => p.sold_at_gate)

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
export function exportCsv({ event, lots, sellers, participants }: ExportContext) {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const hasSellers = hasSellerColumn(sellers, participants)
  const hasFree = hasFreeList(participants)
  const header = ['Nº', 'Nome', ...(hasFree ? ['Lista'] : []), 'Telefone', 'Lote', ...(hasSellers ? ['Comissário'] : []), 'Valor pago', 'Forma de pagamento', 'Data do pagamento', 'Check-in']
  const rows = sortByName(participants).map((p, i) => {
    const paid = p.list_type === 'pagante'
    return [
      String(i + 1),
      p.name,
      ...(hasFree ? [LIST_TYPES[p.list_type]] : []),
      p.phone ? formatPhone(p.phone) : '',
      lotName(lots, p.lot_id),
      ...(hasSellers ? [sellerName(sellers, p)] : []),
      paid ? Number(p.amount_paid).toFixed(2).replace('.', ',') : '',
      paid ? PAYMENT_METHODS[p.payment_method] : '',
      paid ? formatDate(p.paid_at) : '',
      p.checked_in ? 'Sim' : 'Não',
    ]
  })
  const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `lista-${slug(event.name)}.csv`)
}

/** PDF para imprimir, com coluna de check-in em branco para marcar na entrada */
export async function exportPdf({ arenaName, event, lots, sellers, participants }: ExportContext) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const sorted = sortByName(participants)
  const total = participants.reduce((a, p) => a + Number(p.amount_paid), 0)
  const hasSellers = hasSellerColumn(sellers, participants)
  const hasFree = hasFreeList(participants)
  const shift = (hasSellers ? 1 : 0) + (hasFree ? 1 : 0)
  const breakdown = hasFree ? `  ·  ${listCounts(participants).map((l) => `${l.label} ${l.count}`).join(' · ')}` : ''

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
  doc.text(`Lista final: ${sorted.length}${event.capacity ? ` / ${event.capacity}` : ''}${breakdown}  ·  Total arrecadado: ${formatCurrency(total)}`, 14, 37)

  autoTable(doc, {
    startY: 41,
    head: [['Nº', 'Nome', ...(hasFree ? ['Lista'] : []), 'Lote', ...(hasSellers ? ['Comissário'] : []), 'Valor', 'Forma', 'Entrada']],
    body: sorted.map((p, i) => {
      const paid = p.list_type === 'pagante'
      return [
        String(i + 1),
        p.name,
        ...(hasFree ? [LIST_TYPES[p.list_type]] : []),
        lotName(lots, p.lot_id),
        ...(hasSellers ? [sellerName(sellers, p)] : []),
        paid ? formatCurrency(p.amount_paid) : '—',
        paid ? PAYMENT_METHODS[p.payment_method] : '—',
        p.checked_in ? 'X' : '',
      ]
    }),
    styles: { fontSize: 9, cellPadding: 2.2 },
    headStyles: { fillColor: [87, 19, 20], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      [3 + shift]: { halign: 'right' },
      [5 + shift]: { cellWidth: 18, halign: 'center', lineWidth: 0.2, lineColor: [180, 180, 180] },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · página ${page}`, 14, 290)
    },
  })

  doc.save(`lista-${slug(event.name)}.pdf`)
}

async function fetchEventLogo(path: string | null): Promise<MenuLogo | null> {
  const url = eventImageUrl(path)
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) throw new Error('Falha ao baixar a imagem do evento')
  const blob = await res.blob()
  const img = await loadImage(blob)
  return { data: new Uint8Array(await blob.arrayBuffer()), width: img.naturalWidth, height: img.naturalHeight }
}

/**
 * Cardápio em PDF A3 para imprimir, com a imagem do evento no topo.
 * Problema na imagem não impede o cardápio: sai sem logo e devolve false.
 */
export async function exportMenuPdf({ arenaName, event, items }: { arenaName: string; event: ArenaEvent; items: EventMenuItem[] }): Promise<boolean> {
  const { jsPDF } = await import('jspdf')
  const build = (logo: MenuLogo | null) => buildMenuPdf({ JsPDF: jsPDF, title: event.name, arenaName, items, logo })
  const filename = `cardapio-${slug(event.name)}.pdf`
  try {
    build(await fetchEventLogo(event.image_path)).save(filename)
    return true
  } catch (e) {
    console.error('Cardápio sem imagem:', e)
    build(null).save(filename)
    return false
  }
}

/** Texto para colar no WhatsApp */
export function participantsText({ event, lots, participants }: ExportContext): string {
  const sorted = sortByName(participants)
  const lines = sorted.map((p, i) => {
    const lot = lotName(lots, p.lot_id)
    const tag = p.list_type !== 'pagante' ? LIST_TYPES[p.list_type] : lot !== '—' && lots.length > 1 ? lot : ''
    return `${i + 1}. ${p.name}${tag ? ` (${tag})` : ''}`
  })
  return [
    `🏐 *${event.name}*`,
    `📅 ${eventSubtitle(event)}`,
    '',
    `✅ *Lista final (${sorted.length}${event.capacity ? `/${event.capacity}` : ''})*`,
    '',
    ...lines,
  ].join('\n')
}
