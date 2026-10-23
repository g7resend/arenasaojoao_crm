import { useEffect, useId, useState } from 'react'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'

interface Props {
  /** Imagem já salva (URL pública) */
  currentUrl: string | null
  /** Arquivo escolhido e ainda não enviado */
  file: File | null
  onPick: (file: File) => void
  onRemove: () => void
  onError: (message: string) => void
}

const MAX_MB = 20

/** Escolher imagem: no celular abre a galeria/câmera, no computador o seletor de arquivos */
export function EventImagePicker({ currentUrl, file, onPick, onRemove, onError }: Props) {
  const id = useId()
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const shown = preview ?? currentUrl

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!f) return
    if (!f.type.startsWith('image/')) return onError('Escolha um arquivo de imagem (JPG, PNG…).')
    if (f.size > MAX_MB * 1024 * 1024) return onError(`Imagem muito grande (máx. ${MAX_MB} MB).`)
    onPick(f)
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-neutral-700">Imagem do evento</p>
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
      {shown ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <img src={shown} alt="Imagem do evento" className="aspect-video w-full bg-neutral-100 object-cover" />
          <div className="flex gap-2 bg-neutral-50 p-2">
            <label
              htmlFor={id}
              className="inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
            >
              <RefreshCw size={16} /> Trocar
            </label>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} /> Remover
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-brand-600 hover:text-brand-800"
        >
          <ImagePlus size={32} />
          <span className="text-sm font-semibold">Adicionar imagem</span>
          <span className="text-xs text-neutral-400">da galeria ou dos arquivos</span>
        </label>
      )}
    </div>
  )
}
