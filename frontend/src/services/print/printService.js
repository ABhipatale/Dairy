import api from '../api'
import { printHtml, renderHtml } from './htmlRenderer'
import { canvasToEscPos, renderCanvas } from './rasterRenderer'
import { PrinterError, sendBytes } from './transports'

/**
 * One entry point for all printing:
 *   receipt document → (browser: HTML page) | (ESC/POS: raster bytes → transport)
 * Every attempt is logged to the server (print_logs) without blocking the UI.
 */
export async function printDocument(doc, printer = {}, { referenceId = null } = {}) {
  // Only two kinds: Bluetooth thermal printer, or the phone's normal print dialog.
  const connection = printer.connection_type === 'bluetooth' ? 'bluetooth' : 'browser'
  const paper = printer.paper_size || '58mm'
  const copies = Math.max(1, Math.min(3, Number(printer.copies) || 1))

  try {
    if (connection === 'browser') {
      for (let i = 0; i < copies; i++) await printHtml(renderHtml(doc, { paper }))
    } else {
      const canvas = await renderCanvas(doc, { paper })
      await sendBytes(connection, canvasToEscPos(canvas, { copies }))
    }
    log(doc.kind, referenceId, connection, 'success')
  } catch (e) {
    const err = e instanceof PrinterError ? e : new PrinterError('unavailable', e)
    if (err.code !== 'cancelled') log(doc.kind, referenceId, connection, 'failed', err.cause?.message || err.code)
    throw err
  }
}

/** PNG preview of exactly what an ESC/POS printer will receive (settings screen). */
export async function previewDataUrl(doc, paper = '58mm') {
  return (await renderCanvas(doc, { paper })).toDataURL('image/png')
}

function log(documentType, referenceId, connectionType, status, error) {
  api
    .post('/print-logs', {
      document_type: documentType,
      reference_id: referenceId,
      connection_type: connectionType,
      status,
      error: error ? String(error).slice(0, 500) : null,
    })
    .catch(() => {})
}
