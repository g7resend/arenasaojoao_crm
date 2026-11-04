import type { jsPDF } from 'jspdf'
import type { EventMenuItem } from '../types/db'
import { formatCurrency } from './format'

export interface MenuLogo {
  data: Uint8Array
  width: number
  height: number
}

interface MenuPdfInput {
  JsPDF: typeof jsPDF
  title: string
  arenaName: string
  items: EventMenuItem[]
  logo: MenuLogo | null
}

// A3 em pé, em mm
const PAGE_W = 297
const PAGE_H = 420
const MARGIN = 20
const FOOTER_H = 18
const COLUMN_GAP = 16
const PT_TO_MM = 0.3528
const LINE_HEIGHT = 1.2
const BRAND: [number, number, number] = [87, 19, 20]

// tamanho do nome do produto, em pontos; a descrição acompanha na proporção DESC_RATIO
const MAX_NAME_PT = 46
const MIN_NAME_PT = 24
const DESC_RATIO = 0.62

const lineMm = (pt: number) => pt * PT_TO_MM * LINE_HEIGHT
const priceText = (value: number) => formatCurrency(value).replace(/\s/g, ' ')

/** Tira o que a fonte do PDF não tem (emojis etc.), que sairia como lixo na impressão */
const printable = (s: string) => s.replace(/[^ -ÿ–—•€]/g, '').replace(/\s+/g, ' ').trim()

interface Block {
  nameLines: string[]
  descLines: string[]
  price: string
  height: number
}

function measure(doc: jsPDF, items: EventMenuItem[], colW: number, namePt: number): Block[] {
  const descPt = namePt * DESC_RATIO
  return items.map((item) => {
    const price = priceText(item.price)
    doc.setFont('helvetica', 'bold').setFontSize(namePt)
    const nameLines: string[] = doc.splitTextToSize(printable(item.name), colW - doc.getTextWidth(price) - 8)
    doc.setFont('helvetica', 'normal').setFontSize(descPt)
    const description = printable(item.description)
    const descLines: string[] = description ? doc.splitTextToSize(description, colW) : []
    return { nameLines, descLines, price, height: nameLines.length * lineMm(namePt) + descLines.length * lineMm(descPt) }
  })
}

/** Distribui os itens em colunas, na ordem, abrindo uma coluna nova quando a altura acaba */
function flow(blocks: Block[], areaH: number, gap: number): Block[][] {
  const columns: Block[][] = [[]]
  let used = 0
  for (const b of blocks) {
    if (used + b.height > areaH && columns[columns.length - 1].length > 0) {
      columns.push([])
      used = 0
    }
    columns[columns.length - 1].push(b)
    used += b.height + gap
  }
  return columns
}

/** Menor altura que ainda cabe nas colunas da página, para as colunas ficarem parecidas */
function balancedHeight(blocks: Block[], areaH: number, gap: number, cols: number): number {
  const total = blocks.reduce((a, b) => a + b.height + gap, 0)
  for (let h = total / cols; h < areaH; h += 4) {
    if (flow(blocks, h, gap).length <= cols) return h
  }
  return areaH
}

/** Maior letra que cabe numa página: tenta 1 coluna grande, depois 2 colunas */
function chooseLayout(doc: jsPDF, items: EventMenuItem[], areaH: number) {
  const fullW = PAGE_W - MARGIN * 2
  const halfW = (fullW - COLUMN_GAP) / 2
  const options = [
    { cols: 1, colW: fullW, maxPt: MAX_NAME_PT, minPt: 28 },
    { cols: 2, colW: halfW, maxPt: 30, minPt: MIN_NAME_PT },
  ]
  for (const { cols, colW, maxPt, minPt } of options) {
    for (let namePt = maxPt; namePt >= minPt; namePt -= 2) {
      const blocks = measure(doc, items, colW, namePt)
      if (flow(blocks, areaH, namePt * 0.2).length <= cols) return { cols, colW, namePt, blocks }
    }
  }
  // não coube em uma página: mantém a letra legível e continua na página seguinte
  return { cols: 2, colW: halfW, namePt: MIN_NAME_PT, blocks: measure(doc, items, halfW, MIN_NAME_PT) }
}

function drawHeader(doc: jsPDF, title: string, logo: MenuLogo | null, logoMaxH: number): number {
  let y = MARGIN
  if (logo) {
    const scale = Math.min((PAGE_W - MARGIN * 2) / logo.width, logoMaxH / logo.height)
    const w = logo.width * scale
    const h = logo.height * scale
    doc.addImage(logo.data, 'JPEG', (PAGE_W - w) / 2, y, w, h)
    y += h + 8
  }
  doc.setTextColor(...BRAND).setFont('helvetica', 'bold').setFontSize(54)
  y += 54 * PT_TO_MM
  doc.text('CARDÁPIO', PAGE_W / 2, y, { align: 'center' })
  y += 3
  doc.setTextColor(40, 40, 40).setFont('helvetica', 'normal').setFontSize(24)
  for (const line of doc.splitTextToSize(printable(title), PAGE_W - MARGIN * 2) as string[]) {
    y += lineMm(24)
    doc.text(line, PAGE_W / 2, y, { align: 'center' })
  }
  y += 6
  doc.setFillColor(...BRAND).rect(PAGE_W / 2 - 30, y, 60, 1.4, 'F')
  return y + 12
}

function drawFooter(doc: jsPDF, arenaName: string) {
  const y = PAGE_H - MARGIN
  doc.setDrawColor(...BRAND).setLineWidth(0.5).line(MARGIN, y - 9, PAGE_W - MARGIN, y - 9)
  doc.setTextColor(70, 70, 70).setFont('helvetica', 'normal').setFontSize(16)
  doc.text(printable(arenaName), PAGE_W / 2, y, { align: 'center' })
}

function drawBlock(doc: jsPDF, b: Block, x: number, y: number, colW: number, namePt: number) {
  const nameLine = lineMm(namePt)
  const descPt = namePt * DESC_RATIO
  const descLine = lineMm(descPt)

  doc.setFont('helvetica', 'bold').setFontSize(namePt).setTextColor(15, 15, 15)
  b.nameLines.forEach((line, i) => doc.text(line, x, y + nameLine * (i + 0.8)))
  const descTop = y + nameLine * b.nameLines.length
  const baseline = descTop - nameLine * 0.2

  // pontilhado ligando o nome ao preço, na última linha do nome
  const nameEnd = x + doc.getTextWidth(b.nameLines[b.nameLines.length - 1]) + 3
  const priceStart = x + colW - doc.getTextWidth(b.price)
  if (priceStart - 3 > nameEnd) {
    doc.setDrawColor(130, 130, 130).setLineWidth(0.6).setLineCap('round').setLineDashPattern([0.01, 2.4], 0)
    doc.line(nameEnd, baseline, priceStart - 3, baseline)
    doc.setLineDashPattern([], 0).setLineCap('butt')
  }
  doc.setTextColor(...BRAND).text(b.price, x + colW, baseline, { align: 'right' })

  doc.setFont('helvetica', 'normal').setFontSize(descPt).setTextColor(50, 50, 50)
  b.descLines.forEach((line, i) => doc.text(line, x, descTop + descLine * (i + 0.8)))
}

/** Cardápio em A3 para imprimir: logo, produtos, descrições e preços, com a maior letra que couber */
export function buildMenuPdf({ JsPDF, title, arenaName, items, logo }: MenuPdfInput): jsPDF {
  const doc = new JsPDF({ unit: 'mm', format: 'a3', orientation: 'portrait' })
  // quanto mais produtos, menor a logo: a prioridade é a letra grande
  const logoMaxH = items.length <= 6 ? 120 : items.length <= 16 ? 90 : 70
  const top = drawHeader(doc, title, logo, logoMaxH)
  const bottom = PAGE_H - MARGIN - FOOTER_H
  const { cols, colW, namePt, blocks } = chooseLayout(doc, items, bottom - top)
  const baseGap = namePt * 0.2

  flow(blocks, balancedHeight(blocks, bottom - top, baseGap, cols), baseGap).forEach((column, i) => {
    if (i % cols === 0) {
      if (i > 0) doc.addPage('a3', 'portrait')
      drawFooter(doc, arenaName)
    }
    // o cabeçalho só existe na primeira página
    const start = i < cols ? top : MARGIN
    const free = bottom - start - column.reduce((a, b) => a + b.height, 0)
    // sobrou espaço: abre os itens para ocupar a folha, sem exagerar
    const gap = column.length > 1 ? Math.min(free / (column.length - 1), baseGap * 3.5) : 0
    const x = MARGIN + (i % cols) * (colW + COLUMN_GAP)
    let y = start
    for (const b of column) {
      drawBlock(doc, b, x, y, colW, namePt)
      y += b.height + gap
    }
  })
  return doc
}
