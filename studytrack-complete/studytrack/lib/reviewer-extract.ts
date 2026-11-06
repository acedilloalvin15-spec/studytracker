// Reads the text out of an uploaded file (runs on the server).
import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')

function htmlToMarked(html: string) {
  return decode(
    html
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t: string) => `\n\n# ${t.replace(/<[^>]+>/g, '')}\n\n`)
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t: string) => `\n- ${t.replace(/<\/?p[^>]*>/gi, '')}\n`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|tr|table|ul|ol)>/gi, '\n\n')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<[^>]+>/g, ''),
  )
}

export async function extractTextFromFile(data: Uint8Array, ext: string): Promise<string> {
  if (ext === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(data))
    const { text } = await extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join('\n\n') : text
  }
  if (ext === 'docx') {
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(data) })
    return htmlToMarked(value)
  }
  return new TextDecoder('utf-8').decode(data)
}
