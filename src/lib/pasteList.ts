import { normalizeText } from './format'

export interface PastedNames {
  /** nomes novos, prontos para salvar */
  names: string[]
  /** repetidos dentro do texto ou que já estão na lista do evento */
  repeated: string[]
}

/** Limpa uma linha copiada do WhatsApp: tira numeração, marcadores, emojis e telefone das pontas */
function cleanLine(line: string): string {
  return line
    .replace(/^[^\p{L}]+/u, '')
    .replace(/[^\p{L}\p{M}.)]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Um nome por linha; linhas sem letras são ignoradas */
export function parseNames(text: string, existing: string[]): PastedNames {
  const seen = new Set(existing.map(normalizeText))
  const names: string[] = []
  const repeated: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const name = cleanLine(line)
    if (!name) continue
    const key = normalizeText(name)
    if (seen.has(key)) repeated.push(name)
    else {
      seen.add(key)
      names.push(name)
    }
  }
  return { names, repeated }
}
