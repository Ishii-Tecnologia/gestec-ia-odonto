/**
 * Etapa 6 (Hardening) — Bloqueio por tentativas de login (força bruta).
 *
 * Registra tentativas malsucedidas de autenticação por e-mail e, após
 * MAX_TENTATIVAS erros, bloqueia novas tentativas por uma janela que cresce
 * progressivamente (15 min, 30 min, 45 min...). A checagem acontece AQUI no
 * servidor, no evento onRecordAuthRequest da coleção users — não pode ser
 * burlada pelo frontend.
 *
 * IMPORTANTE (JSVM do PocketBase): callbacks rodam em uma pool de VMs
 * separada — TODA a lógica precisa ficar inline dentro de cada callback,
 * sem funções/constantes de top-level.
 *
 * Bloqueios são registrados na auditoria append-only (auditoria_acesso).
 * O frontend traduz a resposta 429 em mensagem leiga com o tempo restante.
 */

// ---------------------------------------------------------------------------
// Intercepta TODA autenticação por senha na coleção users
// ---------------------------------------------------------------------------
onRecordAuthRequest((e) => {
  // Constantes e helpers locais do callback (nada de top-level: JSVM).
  const MAX_TENTATIVAS = 5
  const JANELA_BASE_MINUTOS = 15
  const JANELA_MAX_MINUTOS = 24 * 60
  const JANELA_CONTADOR_MINUTOS = 15 // janela dentro da qual as falhas se acumulam
  const EMAILS_IGNORADOS = ['ishii7883@gmail.com', 'superadmin@gestecodonto.com.br']

  const normalizarEmail = (email) =>
    String(email || '')
      .trim()
      .toLowerCase()

  const msAte = (dataIso) => {
    const t = Date.parse(String(dataIso || ''))
    if (isNaN(t)) return 0
    return Math.max(0, t - Date.now())
  }

  const buscarBloqueio = (app, email) => {
    try {
      return app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
    } catch (_) {
      return null
    }
  }

  const registrarAuditoriaLogin = (app, acao, detalhes, email, ip) => {
    try {
      const auditoriaCollection = app.findCollectionByNameOrId('auditoria_acesso')
      const log = new Record(auditoriaCollection)
      log.set('tenant_id', 'sistema')
      log.set('user_id', '')
      log.set('user_email', email || '')
      log.set('perfil', 'sistema')
      log.set('target_patient_id', '')
      log.set('acao', acao)
      log.set('detalhes', detalhes)
      log.set('ip', ip || 'desconhecido')
      log.set('timestamp', new Date().toISOString())
      app.save(log)
    } catch (err) {
      console.error('Falha ao salvar auditoria de login:', err)
    }
  }

  /**
   * Registra a falha de login e, ao atingir o limite, aplica o bloqueio.
   * Devolve o ISO `bloqueado_ate` quando o bloqueio é aplicado agora ('').
   */
  const registrarFalhaLogin = (app, email, ip) => {
    const agoraIso = new Date().toISOString()
    let rec = buscarBloqueio(app, email)

    // Reinicia a contagem se a primeira tentativa é mais antiga que a janela
    let tentativas = 1
    let bloqueiosTotal = 0
    if (rec) {
      const primeira = Date.parse(rec.getString('primeira_tentativa_em') || '')
      const dentroDaJanela =
        !isNaN(primeira) && Date.now() - primeira < JANELA_CONTADOR_MINUTOS * 60 * 1000
      tentativas = dentroDaJanela ? Number(rec.getInt('tentativas_falhas') || 0) + 1 : 1
      bloqueiosTotal = Number(rec.getInt('bloqueios_total') || 0)
    }

    const col = app.findCollectionByNameOrId('bloqueios_login')
    if (!rec) {
      rec = new Record(col)
      rec.set('email', email)
      rec.set('primeira_tentativa_em', agoraIso)
    }

    rec.set('tentativas_falhas', tentativas)
    rec.set('ultima_tentativa_em', agoraIso)

    let ips = []
    try {
      ips = JSON.parse(rec.getString('ips_tentantes') || '[]')
    } catch (_) {
      ips = []
    }
    if (ip && !ips.includes(ip)) {
      ips.push(ip)
      if (ips.length > 10) ips = ips.slice(-10)
    }
    rec.set('ips_tentantes', JSON.stringify(ips))

    let bloqueadoAteIso = ''
    if (tentativas >= MAX_TENTATIVAS) {
      bloqueiosTotal = bloqueiosTotal + 1
      // Crescimento progressivo: 15, 30, 45... min, teto de 24 h
      const fator = Math.min(bloqueiosTotal, JANELA_MAX_MINUTOS / JANELA_BASE_MINUTOS)
      const janelaMs = JANELA_BASE_MINUTOS * fator * 60 * 1000
      bloqueadoAteIso = new Date(Date.now() + janelaMs).toISOString()
      rec.set('bloqueado_ate', bloqueadoAteIso)
      rec.set('bloqueios_total', bloqueiosTotal)
      rec.set('tentativas_falhas', 0)
      rec.set('primeira_tentativa_em', agoraIso)
    }

    app.save(rec)

    if (bloqueadoAteIso) {
      registrarAuditoriaLogin(
        app,
        'conta_bloqueada_forca_bruta',
        `Conta bloqueada por ${MAX_TENTATIVAS} tentativas de senha inválidas. Liberação automática em ${new Date(
          bloqueadoAteIso,
        ).toLocaleString('pt-BR')}.`,
        email,
        ip,
      )
    }
    return bloqueadoAteIso
  }

  /** Zera o contador de falhas após login bem-sucedido (apaga o registro). */
  const limparFalhas = (app, email) => {
    try {
      const rec = buscarBloqueio(app, email)
      if (rec) {
        app.delete(rec)
      }
    } catch (_) {}
  }

  // Executa APENAS no fluxo de auth por senha (authWithPassword):
  // o corpo traz `identity` (e-mail) e `password`.
  const body = e.requestInfo().body || {}
  if (!body.identity || !('password' in body)) {
    return e.next()
  }
  const email = normalizarEmail(e.record.getString('email'))

  if (EMAILS_IGNORADOS.includes(email)) {
    return e.next()
  }

  const recBloqueio = buscarBloqueio(e.app, email)
  const restanteMs = recBloqueio ? msAte(recBloqueio.getString('bloqueado_ate')) : 0

  if (restanteMs > 0) {
    const minutos = Math.max(1, Math.ceil(restanteMs / 60000))
    registrarAuditoriaLogin(
      e.app,
      'login_negado_conta_bloqueada',
      `Tentativa de login recusada durante bloqueio ativo (${minutos} min restantes).`,
      email,
      e.realIP ? e.realIP() : '',
    )
    return e.json(429, {
      status: 429,
      code: 'conta_bloqueada',
      message: `Conta temporariamente bloqueada por segurança. Tente novamente em ${minutos} minutos.`,
    })
  }

  try {
    const res = e.next()
    // Login bem-sucedido: zera o contador de falhas.
    limparFalhas(e.app, email)
    return res
  } catch (err) {
    // Falha de credenciais (ou outro erro de auth) → contabiliza
    const isAuthError = err && (err.status === 400 || err.status === 401)
    if (isAuthError) {
      const bloqueadoAteIso = registrarFalhaLogin(e.app, email, e.realIP ? e.realIP() : '')
      if (bloqueadoAteIso) {
        const minutos = Math.max(1, Math.ceil((Date.parse(bloqueadoAteIso) - Date.now()) / 60000))
        return e.json(429, {
          status: 429,
          code: 'conta_bloqueada',
          message: `Conta temporariamente bloqueada por segurança. Tente novamente em ${minutos} minutos.`,
        })
      }
    }
    throw err
  }
}, 'users')

// ---------------------------------------------------------------------------
// Endpoints de Super Admin (liberar bloqueios / listar ativos)
// ---------------------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/gestec/liberar-bloqueio',
  (e) => {
    const normalizarEmail = (email) =>
      String(email || '')
        .trim()
        .toLowerCase()

    const info = e.auth
    if (!info || info.collection().name !== 'users' || info.getString('perfil') !== 'superadmin') {
      return e.json(403, { status: 403, message: 'Acesso restrito ao Super Admin.' })
    }

    let body = {}
    try {
      body = e.requestInfo().body || {}
    } catch (_) {
      body = {}
    }
    const email = normalizarEmail(body.email)
    if (!email) {
      return e.json(400, { status: 400, message: 'Informe o e-mail do bloqueio a liberar.' })
    }

    let liberado = false
    try {
      const rec = e.app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
      if (rec) {
        e.app.delete(rec)
        liberado = true
      }
    } catch (_) {
      liberado = false
    }
    if (liberado) {
      try {
        const auditoriaCollection = e.app.findCollectionByNameOrId('auditoria_acesso')
        const log = new Record(auditoriaCollection)
        log.set('tenant_id', 'sistema')
        log.set('user_id', '')
        log.set('user_email', email)
        log.set('perfil', 'sistema')
        log.set('target_patient_id', '')
        log.set('acao', 'bloqueio_liberado_superadmin')
        log.set(
          'detalhes',
          `Super Admin liberou manualmente o bloqueio de login do e-mail ${email}.`,
        )
        log.set('ip', e.realIP ? e.realIP() : 'desconhecido')
        log.set('timestamp', new Date().toISOString())
        e.app.save(log)
      } catch (errAud) {
        console.error('Falha ao salvar auditoria de liberação:', errAud)
      }
    }
    // Idempotente: liberar uma conta sem bloqueio não é erro.
    return e.json(200, { ok: true, liberado })
  },
  $apis.requireAuth(),
)

// Listagem de bloqueios ativos (somente leitura, para o painel Super Admin).
routerAdd(
  'GET',
  '/backend/v1/gestec/bloqueios',
  (e) => {
    const msAte = (dataIso) => {
      const t = Date.parse(String(dataIso || ''))
      if (isNaN(t)) return 0
      return Math.max(0, t - Date.now())
    }

    const info = e.auth
    if (!info || info.collection().name !== 'users' || info.getString('perfil') !== 'superadmin') {
      return e.json(403, { status: 403, message: 'Acesso restrito ao Super Admin.' })
    }

    const registros = e.app.findRecordsByFilter(
      'bloqueios_login',
      '',
      '-ultima_tentativa_em',
      200,
      0,
    )
    const itens = registros
      .map((r) => {
        const restante = msAte(r.getString('bloqueado_ate'))
        return {
          id: r.id,
          email: r.getString('email'),
          tentativas_falhas: r.getInt('tentativas_falhas'),
          bloqueado_ate: r.getString('bloqueado_ate'),
          bloqueios_total: r.getInt('bloqueios_total'),
          ultima_tentativa_em: r.getString('ultima_tentativa_em'),
          bloqueado: restante > 0,
          minutos_restantes: Math.ceil(restante / 60000),
        }
      })
      .filter((r) => r.bloqueado || r.tentativas_falhas > 0)

    return e.json(200, { items: itens, agora: new Date().toISOString() })
  },
  $apis.requireAuth(),
)
