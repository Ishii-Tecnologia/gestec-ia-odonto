/**
 * Implementação padrão RFC 6238 (TOTP) e RFC 4648 (Base32)
 * Usando Web Crypto API nativa do navegador (subtle.crypto)
 * 100% autossuficiente e sem dependências externas adicionais.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

export function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_ALPHABET.indexOf(cleaned[i])
    if (val === -1) {
      continue // ignora caracteres inválidos ou separadores
    }
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}

/**
 * Gera uma chave secreta TOTP aleatória (160 bits / 20 bytes -> 32 caracteres Base32)
 */
export function generateTotpSecret(): string {
  const randomBytes = new Uint8Array(20)
  crypto.getRandomValues(randomBytes)
  return base32Encode(randomBytes)
}

/**
 * Gera 8 recovery codes únicos legíveis (ex: 'A4B9-8F21')
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = []
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  for (let i = 0; i < count; i++) {
    let part1 = ''
    let part2 = ''
    const r = new Uint8Array(8)
    crypto.getRandomValues(r)
    for (let j = 0; j < 4; j++) {
      part1 += chars[r[j] % chars.length]
      part2 += chars[r[j + 4] % chars.length]
    }
    codes.push(`${part1}-${part2}`)
  }
  return codes
}

/**
 * Gera a URI otpauth:// padrão para aplicativos autenticadores
 * (Google Authenticator, Microsoft Authenticator, 1Password, Authy)
 */
export function getOtpauthUri(
  secret: string,
  userEmail: string,
  issuer = 'GesTec-IA-Odonto',
): string {
  const label = encodeURIComponent(`${issuer}:${userEmail}`)
  const encIssuer = encodeURIComponent(issuer)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Calcula o código TOTP de 6 dígitos para uma determinada época (step de 30s)
 */
export async function computeTotpCode(
  secretBase32: string,
  timeStepCounter: number,
): Promise<string> {
  const keyBytes = base32Decode(secretBase32)
  if (keyBytes.length === 0) {
    throw new Error('Chave secreta inválida')
  }

  // Converter o contador de tempo em buffer de 8 bytes (big-endian)
  const counterBuffer = new ArrayBuffer(8)
  const counterView = new DataView(counterBuffer)
  // Como Number em JS suporta até 53 bits com segurança:
  const high = Math.floor(timeStepCounter / 0x100000000)
  const low = timeStepCounter >>> 0
  counterView.setUint32(0, high, false)
  counterView.setUint32(4, low, false)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer)
  const hmacBytes = new Uint8Array(signature)

  // Dynamic truncation (RFC 4226)
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff)

  const otp = binary % 1000000
  return otp.toString().padStart(6, '0')
}

/**
 * Valida um código TOTP com tolerância de ±1 janela (30s antes / 30s depois)
 */
export async function verifyTotpCode(
  secretBase32: string,
  tokenInput: string,
  windowTolerance = 1,
): Promise<boolean> {
  const token = tokenInput.replace(/\D/g, '').trim()
  if (token.length !== 6) return false

  const nowSec = Math.floor(Date.now() / 1000)
  const currentStep = Math.floor(nowSec / 30)

  for (let offset = -windowTolerance; offset <= windowTolerance; offset++) {
    try {
      const expected = await computeTotpCode(secretBase32, currentStep + offset)
      if (expected === token) {
        return true
      }
    } catch {
      // continua
    }
  }

  return false
}

/**
 * Validação de força de senha:
 * - Mínimo 10 caracteres
 * - Letra maiúscula
 * - Letra minúscula
 * - Número
 * - Caractere especial
 */
export function validarForcaSenha(senha: string): {
  valida: boolean
  erros: string[]
} {
  const erros: string[] = []
  if (senha.length < 10) {
    erros.push('Mínimo de 10 caracteres')
  }
  if (!/[A-Z]/.test(senha)) {
    erros.push('Pelo menos uma letra maiúscula (A-Z)')
  }
  if (!/[a-z]/.test(senha)) {
    erros.push('Pelo menos uma letra minúscula (a-z)')
  }
  if (!/[0-9]/.test(senha)) {
    erros.push('Pelo menos um número (0-9)')
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(senha)) {
    erros.push('Pelo menos um caractere especial (!@#$%^&*...)')
  }

  return {
    valida: erros.length === 0,
    erros,
  }
}
