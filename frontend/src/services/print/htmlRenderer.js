/**
 * Renders a receipt document as a dedicated 58/80mm print page (not the app UI)
 * and prints it through a hidden iframe. Used for browser / Android system print.
 */
const SIZES = { sm: 10, md: 12, lg: 15, xl: 18 }

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function renderHtml(doc, { paper = '58mm' } = {}) {
  const width = paper === '80mm' ? 72 : 48 // printable width in mm

  const body = doc.lines.map((l) => {
    const fs = SIZES[l.size || 'md']
    const weight = l.bold ? 700 : 400
    switch (l.type) {
      case 'logo':
        return `<div class="c"><img src="${esc(l.src)}" style="max-height:14mm;max-width:40mm" onerror="this.remove()"></div>`
      case 'text':
        return `<div style="text-align:${l.align || 'left'};font-size:${fs}px;font-weight:${weight}">${esc(l.text)}</div>`
      case 'kv':
        return `<div class="kv" style="font-size:${fs}px;font-weight:${weight}"><span>${esc(l.k)}</span><span>${esc(l.v)}</span></div>`
      case 'row':
        return `<div class="row" style="font-size:${fs}px;font-weight:${weight}">${l.cells
          .map((c) => `<span style="width:${c.w * 100}%;text-align:${c.align || 'left'}">${esc(c.text)}</span>`)
          .join('')}</div>`
      case 'hr':
        return `<div class="hr ${l.style === 'dashed' ? 'd' : ''}"></div>`
      case 'feed':
        return `<div style="height:${(l.lines || 1) * 3}mm"></div>`
      default:
        return ''
    }
  })

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: ${paper === '80mm' ? '80mm' : '58mm'} auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { width: ${width}mm; margin: 0 auto; padding: 2mm 0; color: #000;
         font-family: 'Noto Sans Devanagari', 'Inter', Arial, sans-serif; line-height: 1.35; }
  .c { text-align: center; }
  .kv, .row { display: flex; justify-content: space-between; gap: 2mm; }
  .kv span:last-child { text-align: right; white-space: nowrap; }
  .row span { display: inline-block; overflow: hidden; white-space: nowrap; }
  .hr { border-top: 1px solid #000; margin: 1.5mm 0; }
  .hr.d { border-top-style: dashed; }
</style></head><body>${body.join('')}</body></html>`
}

export function printHtml(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)

    const cleanup = () => setTimeout(() => iframe.remove(), 1000)

    iframe.onload = () => {
      try {
        const w = iframe.contentWindow
        // Wait for fonts/logo so the first print isn't blank.
        const go = () => {
          w.focus()
          w.print()
          cleanup()
          resolve()
        }
        ;(w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 150))
      } catch (e) {
        cleanup()
        reject(e)
      }
    }

    iframe.srcdoc = html
  })
}
