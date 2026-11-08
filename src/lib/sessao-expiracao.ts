/**
 * Etapa 6 (Hardening) — Sessão por inatividade + janela máxima absoluta.
 *
 * - INATIVIDADE: 30 min sem interação (clique, tecla, scroll, navegação) →
 *   logout real no servidor (token invalidado) + redirect ao login com aviso.
 * - MÁXIMA ABSOLUTA: 12 h mesmo com atividade contínua.
 *
 * Aviso prévio: 2 minutos antes de expirar (por inatividade), um modal dá a
 * chance de manter a sessão ("Continuar sessão"), reiniciando o contador sem
 * perder dados de formulários não salvos.
 */

export const LIMITE_INATIVIDADE_MS = 30 * 60 * 1000 // 30 min (configurável aqui)
export const SESSAO_MAX_HORAS = 12 // janela máxima absoluta (12 h)
const AVISO_ANTES_MS = 2 * 60 * 1000 // avisa 2 min antes de expirar
const EVENTOS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']

interface SessaoExpiracaoOptions {
  onExpirar: () => Promise<void> | void // callback de logout real (async ok)
}

export class SessaoExpiracaoWatcher {
  private onExpirar: () => Promise<void> | void
  private timerInatividade: number | null = null
  private timerMaxima: number | null = null
  private timerAviso: number | null = null
  private expirou = false
  private avisoAberto = false

  constructor(opcoes: SessaoExpiracaoOptions) {
    this.onExpirar = opcoes.onExpirar
  }

  /** Reinicia o contador de inatividade (toda interação chama isto). */
  rearmar() {
    if (this.expirou) return
    if (this.timerInatividade !== null) clearTimeout(this.timerInatividade)
    if (this.timerAviso !== null) clearTimeout(this.timerAviso)

    this.timerInatividade = window.setTimeout(
      () => this.expirar('inatividade'),
      LIMITE_INATIVIDADE_MS,
    )
    // Aviso 2 min antes do fim da inatividade
    this.timerAviso = window.setTimeout(
      () => this.dispararAviso(),
      LIMITE_INATIVIDADE_MS - AVISO_ANTES_MS,
    )
  }

  /** Agenda a expiração absoluta da sessão (janela de 12 h). */
  agendarMaxima() {
    if (this.timerMaxima !== null) return // só uma vez por sessão
    this.timerMaxima = window.setTimeout(
      () => this.expirar('maxima'),
      SESSAO_MAX_HORAS * 3600 * 1000,
    )
  }

  /** Encerra a sessão: logout real no backend + redirect ao login. */
  private async expirar(motivo: 'inatividade' | 'maxima') {
    if (this.expirou) return
    this.expirou = true
    this.pararTimers()

    try {
      await this.onExpirar()
    } finally {
      // Mensagem leiga, distinta por motivo
      const msg =
        motivo === 'inatividade'
          ? 'Sua sessão expirou por inatividade. Faça login novamente.'
          : 'Sua sessão atingiu o tempo máximo de uso contínuo. Faça login novamente.'
      sessionStorage.setItem('gestec_sessao_mensagem', msg)
      window.location.href = '/login'
    }
  }

  /** Dispara o evento global consumido pelo modal de aviso (AvisoSessaoModal). */
  private dispararAviso() {
    if (this.avisoAberto || this.expirou) return
    this.avisoAberto = true
    window.dispatchEvent(
      new CustomEvent('gestec:sessao-aviso', {
        detail: {
          segundosRestantes: Math.round(AVISO_ANTES_MS / 1000),
          aoContinuar: () => {
            this.avisoAberto = false
            this.rearmar()
          },
        },
      }),
    )
  }

  private pararTimers() {
    if (this.timerInatividade !== null) {
      clearTimeout(this.timerInatividade)
      this.timerInatividade = null
    }
    if (this.timerAviso !== null) {
      clearTimeout(this.timerAviso)
      this.timerAviso = null
    }
    if (this.timerMaxima !== null) {
      clearTimeout(this.timerMaxima)
      this.timerMaxima = null
    }
  }

  private handleInteracao = () => {
    if (this.expirou) return
    this.avisoAberto = false
    this.rearmar()
  }

  /** Instala listeners de interação e o timer inicial. */
  iniciar() {
    this.expirou = false
    EVENTOS.forEach((ev) => window.addEventListener(ev, this.handleInteracao, { passive: true }))
    this.rearmar()
    this.agendarMaxima()
  }

  parar() {
    this.expirou = true
    this.pararTimers()
    EVENTOS.forEach((ev) => window.removeEventListener(ev, this.handleInteracao))
  }
}
