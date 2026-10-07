import api from './api'

/**
 * Opens WhatsApp with the message ready; the user taps Send. The server builds
 * the message (company language, bill PDF link) and returns a wa.me link.
 *
 * A blank window is opened synchronously inside the click handler and redirected
 * afterwards — otherwise mobile browsers block the popup after the await.
 */
export async function sendWhatsApp(path, { offlineMessage, offlinePhone, countryCode } = {}) {
  const win = window.open('', '_blank')
  const go = (url) => {
    if (win) win.location.href = url
    else window.location.href = url
  }

  try {
    const { data } = await api.post(path)
    go(data.url)
  } catch (e) {
    // Offline: build the link on the phone so the message can still be sent.
    if (e.offline && offlineMessage && offlinePhone) {
      go(waLink(offlinePhone, offlineMessage, countryCode))
      return
    }
    win?.close()
    throw e
  }
}

export function waLink(phone, message, countryCode = '91') {
  let digits = String(phone || '').replace(/\D+/g, '').replace(/^0+/, '')
  if (digits.length <= 10) digits = countryCode + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
