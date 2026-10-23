import { whatsappToHtml } from '../../lib/whatsapp'

/** Balão no estilo do WhatsApp mostrando como a mensagem vai aparecer */
export function WhatsAppPreview({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#efeae2] p-3">
      <div
        className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-sm leading-relaxed text-neutral-800 shadow-sm"
        // HTML gerado a partir de texto escapado em whatsappToHtml
        dangerouslySetInnerHTML={{ __html: whatsappToHtml(text) }}
      />
    </div>
  )
}
