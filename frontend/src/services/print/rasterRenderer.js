/**
 * Draws a receipt on a canvas at printer resolution and converts it to ESC/POS
 * raster bytes (GS v 0). Because the text is drawn by the browser, every script
 * (Devanagari included) prints correctly on any ESC/POS printer — no code pages.
 *
 * 58mm paper @ 203dpi = 384 dots; 80mm = 576 dots.
 */
const DOTS = { '58mm': 384, '80mm': 576 }
const PX = { sm: 20, md: 24, lg: 30, xl: 36 }
const FONT = "'Noto Sans Devanagari', 'Inter', Arial, sans-serif"

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
    setTimeout(() => resolve(null), 3000)
  })
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Shrink text until it fits (long amounts / names in fixed cells). */
function fit(ctx, text, maxWidth) {
  let s = String(text)
  if (ctx.measureText(s).width <= maxWidth) return s
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s}…`
}

export async function renderCanvas(doc, { paper = '58mm' } = {}) {
  await document.fonts?.ready
  const width = DOTS[paper] || 384
  const pad = 6
  const inner = width - pad * 2

  const logos = {}
  for (const l of doc.lines) if (l.type === 'logo') logos[l.src] = await loadImage(l.src)

  // Two passes: measure height, then draw.
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const ops = []
  let y = 4
  const setFont = (l) => {
    ctx.font = `${l.bold ? 700 : 400} ${PX[l.size || 'md']}px ${FONT}`
  }

  for (const l of doc.lines) {
    const size = PX[l.size || 'md']
    const lh = Math.round(size * 1.45)
    setFont(l)

    switch (l.type) {
      case 'logo': {
        const img = logos[l.src]
        if (!img) break
        const h = 90
        const w = Math.min(inner, (img.width / img.height) * h)
        ops.push({ kind: 'img', img, x: (width - w) / 2, y, w, h })
        y += h + 6
        break
      }
      case 'text':
        for (const text of wrap(ctx, l.text, inner)) {
          ops.push({ kind: 'text', l, text, y })
          y += lh
        }
        break
      case 'kv':
      case 'row':
        ops.push({ kind: l.type, l, y })
        y += lh
        break
      case 'hr':
        ops.push({ kind: 'hr', l, y: y + 6 })
        y += 14
        break
      case 'feed':
        y += (l.lines || 1) * 20
        break
    }
  }

  canvas.width = width
  canvas.height = Math.ceil(y + 4)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.textBaseline = 'top'

  for (const op of ops) {
    if (op.l) setFont(op.l)
    switch (op.kind) {
      case 'img':
        ctx.drawImage(op.img, op.x, op.y, op.w, op.h)
        break
      case 'text': {
        const align = op.l.align || 'left'
        ctx.textAlign = align
        const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad
        ctx.fillText(op.text, x, op.y)
        break
      }
      case 'kv': {
        const vWidth = ctx.measureText(String(op.l.v)).width
        ctx.textAlign = 'left'
        ctx.fillText(fit(ctx, op.l.k, inner - vWidth - 12), pad, op.y)
        ctx.textAlign = 'right'
        ctx.fillText(fit(ctx, op.l.v, inner), width - pad, op.y)
        break
      }
      case 'row': {
        let x = pad
        for (const cell of op.l.cells) {
          const w = cell.w * inner
          ctx.textAlign = cell.align === 'right' ? 'right' : 'left'
          ctx.fillText(fit(ctx, cell.text, w - 4), cell.align === 'right' ? x + w : x, op.y)
          x += w
        }
        break
      }
      case 'hr':
        ctx.lineWidth = 2
        ctx.setLineDash(op.l.style === 'dashed' ? [8, 6] : [])
        ctx.beginPath()
        ctx.moveTo(pad, op.y)
        ctx.lineTo(width - pad, op.y)
        ctx.stroke()
        ctx.setLineDash([])
        break
    }
  }

  return canvas
}

/** Canvas → ESC/POS bytes: init, raster image in bands, feed, partial cut. */
export function canvasToEscPos(canvas, { copies = 1 } = {}) {
  const { width, height } = canvas
  const bytesPerRow = Math.ceil(width / 8)
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data

  const out = [0x1b, 0x40] // ESC @  initialise
  const BAND = 128 // rows per command: small enough for cheap printers' buffers

  for (let top = 0; top < height; top += BAND) {
    const rows = Math.min(BAND, height - top)
    out.push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff)

    for (let y = top; y < top + rows; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit
          if (x >= width) continue
          const i = (y * width + x) * 4
          const lum = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
          if (lum < 150) byte |= 0x80 >> bit
        }
        out.push(byte)
      }
    }
  }

  out.push(0x1b, 0x64, 0x03) // feed 3 lines
  out.push(0x1d, 0x56, 0x42, 0x00) // partial cut (ignored by printers without cutter)

  const single = Uint8Array.from(out)
  if (copies <= 1) return single

  const all = new Uint8Array(single.length * copies)
  for (let i = 0; i < copies; i++) all.set(single, i * single.length)
  return all
}

export function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
