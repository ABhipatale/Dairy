/**
 * Bluetooth transport for ESC/POS thermal printers. Each returns a Promise and throws a
 * PrinterError on failure so the UI can show one friendly message.
 */
export class PrinterError extends Error {
  constructor(code, cause) {
    super(code)
    this.code = code // 'unsupported' | 'cancelled' | 'unavailable'
    this.cause = cause
  }
}

/* ── Bluetooth (BLE serial, most cheap 58mm printers) ── */
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
]

let ble = { device: null, characteristic: null }

export const bluetoothSupported = () => typeof navigator !== 'undefined' && !!navigator.bluetooth

export function bluetoothDeviceName() {
  return ble.device?.name || null
}

async function findWritable(server) {
  const services = await server.getPrimaryServices()
  for (const service of services) {
    for (const ch of await service.getCharacteristics()) {
      if (ch.properties.writeWithoutResponse || ch.properties.write) return ch
    }
  }
  return null
}

export async function connectBluetooth() {
  if (!bluetoothSupported()) throw new PrinterError('unsupported')

  let device
  try {
    device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES })
  } catch (e) {
    throw new PrinterError(e?.name === 'NotFoundError' ? 'cancelled' : 'unavailable', e)
  }

  try {
    const server = await device.gatt.connect()
    const characteristic = await findWritable(server)
    if (!characteristic) throw new Error('No writable characteristic')
    ble = { device, characteristic }
    device.addEventListener('gattserverdisconnected', () => {
      ble.characteristic = null
    })
    return device.name || 'Bluetooth printer'
  } catch (e) {
    throw new PrinterError('unavailable', e)
  }
}

async function ensureBluetooth() {
  if (ble.characteristic && ble.device?.gatt?.connected) return
  if (ble.device) {
    try {
      const server = await ble.device.gatt.connect()
      ble.characteristic = await findWritable(server)
      if (ble.characteristic) return
    } catch {
      /* fall through to a fresh pairing */
    }
  }
  await connectBluetooth()
}

async function sendBluetooth(bytes) {
  await ensureBluetooth()
  const ch = ble.characteristic
  const chunk = 180
  try {
    for (let i = 0; i < bytes.length; i += chunk) {
      const part = bytes.slice(i, i + chunk)
      if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(part)
      else await ch.writeValue(part)
    }
  } catch (e) {
    ble.characteristic = null
    throw new PrinterError('unavailable', e)
  }
}

export async function sendBytes(connection, bytes) {
  if (connection === 'bluetooth') return sendBluetooth(bytes)
  throw new PrinterError('unsupported')
}
