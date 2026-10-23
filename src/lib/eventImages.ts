import { supabase } from './supabase'

const BUCKET = 'eventos'
const MAX_SIDE = 1600

/** URL pública da imagem do evento (bucket público) */
export function eventImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Formato de imagem não suportado'))
    }
    img.src = url
  })
}

/** Reduz para no máximo 1600px e converte para JPEG (fotos de celular ficam com ~200–400 KB) */
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff' // fundo branco para PNG transparente
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/jpeg', 0.85),
  )
}

/** Envia a imagem do evento e devolve o caminho salvo no bucket */
export async function uploadEventImage(eventId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `${eventId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function deleteEventImage(path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(BUCKET).remove([path])
}
