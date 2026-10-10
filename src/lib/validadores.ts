/**
 * Utilitários de validação e formatação fiscal brasileira
 * Validação com algoritmo oficial Módulo-11 para CPF e CNPJ
 */

/**
 * Remove caracteres não numéricos
 */
export function apenasDigitos(val: string): string {
  return (val || '').replace(/\D/g, '')
}

/**
 * Validação de CPF com verificação dos dois dígitos verificadores (Módulo 11)
 */
export function validarCPF(cpf: string): boolean {
  const digits = apenasDigitos(cpf)

  // Deve ter exatamente 11 dígitos
  if (digits.length !== 11) return false

  // Rejeita sequências de dígitos iguais conhecidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Cálculo do 1º dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits.charAt(i), 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digits.charAt(9), 10)) return false

  // Cálculo do 2º dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits.charAt(i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(digits.charAt(10), 10)) return false

  return true
}

/**
 * Formata CPF no padrão 000.000.000-00
 */
export function formatarCPF(val: string): string {
  const digits = apenasDigitos(val).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/**
 * Validação de CNPJ com verificação dos dois dígitos verificadores (Módulo 11)
 * Ajuste pendente da Etapa 0
 */
export function validarCNPJ(cnpj: string): boolean {
  const digits = apenasDigitos(cnpj)

  // Deve ter exatamente 14 dígitos
  if (digits.length !== 14) return false

  // Rejeita sequências de dígitos iguais conhecidas
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Cálculo do 1º dígito verificador
  // Multiplicadores: 5,4,3,2,9,8,7,6,5,4,3,2
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma = 0
  for (let i = 0; i < 12; i++) {
    soma += parseInt(digits.charAt(i), 10) * pesos1[i]
  }
  let resto = soma % 11
  const dv1 = resto < 2 ? 0 : 11 - resto
  if (parseInt(digits.charAt(12), 10) !== dv1) return false

  // Cálculo do 2º dígito verificador
  // Multiplicadores: 6,5,4,3,2,9,8,7,6,5,4,3,2
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  soma = 0
  for (let i = 0; i < 13; i++) {
    soma += parseInt(digits.charAt(i), 10) * pesos2[i]
  }
  resto = soma % 11
  const dv2 = resto < 2 ? 0 : 11 - resto
  if (parseInt(digits.charAt(13), 10) !== dv2) return false

  return true
}

/**
 * Formata CNPJ no padrão 00.000.000/0000-00
 */
export function formatarCNPJ(val: string): string {
  const digits = apenasDigitos(val).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/**
 * Formata telefone / celular com DDD: (11) 99999-9999 ou (11) 9999-9999
 */
export function formatarTelefone(val: string): string {
  const digits = apenasDigitos(val).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Calcula idade com base em uma data ISO YYYY-MM-DD
 */
export function calcularIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null
  const partes = dataNascimento.split('-')
  if (partes.length < 3) return null
  const ano = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10) - 1
  const dia = parseInt(partes[2], 10)

  const nasc = new Date(ano, mes, dia)
  if (isNaN(nasc.getTime())) return null

  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--
  }
  return idade >= 0 ? idade : null
}
