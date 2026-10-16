import { QR_ROTATION_INTERVAL_SECONDS, CLAIM_TICKET_EXPIRY_SECONDS } from './constants'

/**
 * Computes HMAC-SHA256 hex string using Web Crypto API
 */
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const keyData = enc.encode(secret)
  const messageData = enc.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Calculates current rotation time window
 */
export function getCurrentWindow(unixSeconds: number = Math.floor(Date.now() / 1000)): number {
  return Math.floor(unixSeconds / QR_ROTATION_INTERVAL_SECONDS)
}

/**
 * Generates the JAV QR code string for a session
 */
export async function generateQrPayload(
  sessionId: string,
  qrSecret: string,
  rotating: boolean = true,
  unixSeconds: number = Math.floor(Date.now() / 1000)
): Promise<{ payload: string; window: number; signature: string }> {
  const window = rotating ? getCurrentWindow(unixSeconds) : 0
  const message = `${sessionId}.${window}`
  const fullSignature = await computeHmacSha256(qrSecret, message)
  const signature = fullSignature.slice(0, 16)
  const payload = `JAV1.${sessionId}.${window}.${signature}`

  return { payload, window, signature }
}

export interface ParsedQr {
  prefix: string
  sessionId: string
  window: number
  signature: string
}

/**
 * Parses and verifies a scanned QR string against the session secret and rotation window
 */
export function parseQrPayload(raw: string): ParsedQr | null {
  if (!raw || typeof raw !== 'string') return null
  const parts = raw.trim().split('.')
  if (parts.length !== 4) return null
  if (parts[0] !== 'JAV1') return null

  const sessionId = parts[1]
  const windowNum = parseInt(parts[2], 10)
  const signature = parts[3]

  if (!sessionId || isNaN(windowNum) || !signature) return null

  return {
    prefix: parts[0],
    sessionId,
    window: windowNum,
    signature,
  }
}

/**
 * Validates the QR signature and window
 */
export async function verifyQrCode(
  parsed: ParsedQr,
  qrSecret: string,
  rotating: boolean,
  unixSeconds: number = Math.floor(Date.now() / 1000)
): Promise<{ valid: boolean; reason?: string }> {
  const currentWin = getCurrentWindow(unixSeconds)

  if (!rotating) {
    if (parsed.window !== 0) {
      return { valid: false, reason: 'Static session requires window 0' }
    }
  } else {
    // Rotating: allow current window or previous window (tolerance for scan transition)
    const isCurrent = parsed.window === currentWin
    const isPrevious = parsed.window === currentWin - 1
    if (!isCurrent && !isPrevious) {
      return { valid: false, reason: 'QR code has expired. Please scan the current code on screen.' }
    }
  }

  const expectedFullSig = await computeHmacSha256(qrSecret, `${parsed.sessionId}.${parsed.window}`)
  const expectedSig = expectedFullSig.slice(0, 16)

  if (!timingSafeEqual(parsed.signature, expectedSig)) {
    return { valid: false, reason: 'Invalid signature for this session' }
  }

  return { valid: true }
}

export interface ClaimTicketPayload {
  jti: string
  sub: string // student_id
  sid: string // session_id
  iat: number
  exp: number
}

/**
 * Signs a 10-minute claim ticket for a student who verified a live QR code
 */
export async function createClaimTicket(
  studentId: string,
  sessionId: string,
  serverSecret: string
): Promise<{ ticket: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + CLAIM_TICKET_EXPIRY_SECONDS
  const jti = crypto.randomUUID()

  const payload: ClaimTicketPayload = {
    jti,
    sub: studentId,
    sid: sessionId,
    iat: now,
    exp,
  }

  const payloadB64 = btoa(JSON.stringify(payload))
  const sig = await computeHmacSha256(serverSecret, payloadB64)
  const ticket = `${payloadB64}.${sig.slice(0, 32)}`

  return { ticket, expiresAt: exp }
}

/**
 * Verifies a claim ticket
 */
export async function verifyClaimTicket(
  ticket: string,
  serverSecret: string
): Promise<{ valid: boolean; payload?: ClaimTicketPayload; reason?: string }> {
  try {
    const parts = ticket.split('.')
    if (parts.length !== 2) return { valid: false, reason: 'Malformed claim ticket' }

    const [payloadB64, sig] = parts
    const expectedFullSig = await computeHmacSha256(serverSecret, payloadB64)
    const expectedSig = expectedFullSig.slice(0, 32)

    if (!timingSafeEqual(sig, expectedSig)) {
      return { valid: false, reason: 'Invalid claim ticket signature' }
    }

    const payload: ClaimTicketPayload = JSON.parse(atob(payloadB64))
    const now = Math.floor(Date.now() / 1000)

    if (payload.exp < now) {
      return { valid: false, reason: 'Claim ticket has expired. Please scan the QR code again.' }
    }

    return { valid: true, payload }
  } catch (err: any) {
    return { valid: false, reason: 'Failed to parse claim ticket' }
  }
}
