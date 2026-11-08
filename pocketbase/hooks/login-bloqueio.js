/**
 * Etapa 6 (Hardening) — Bloqueio por tentativas de login (força bruta).
 *
 * Registra tentativas malsucedidas de autenticação por e-mail e, após
 * MAX_TENTATIVAS erros, bloqueia novas tentativas por uma janela que cresce
 * progressivamente (15 min, 30 min, 45 min...). A checagem acontece AQUI no
 * servidor, no evento onRecordAuthRequest da coleção users, de modo que não
 * pode ser burlada pelo frontend.
 *
 * Os bloqueios são registrados na auditoria append-only (auditoria_acesso).
 */

const MAX_TENTATIVAS = 5
const JANELA_BASE_MINUTOS = 15
const JANELA_MAX_MINUTOS = 24 * 60

// E-mails que nunca são bloqueados (conta do dono do sistema e superadmin).
const EMAILS_IGNORADOS = ['ishii7883@gmail.com', 'superadmin@gestecodonto.com.br']

function normalizarEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function agoraMs() {
  return Date.now()
}

function msAte(dataIso) {
  const t = Date.parse(String(dataIso || ''))
  if (isNaN(t)) return 0
  return Math.max(0, t - agoraMs())
}

/**
 * Retorna quantos milissegundos restam de bloqueio para o e-mail (0 = livre).
 */
function bloqueioRestanteMs(app, email) {
  let rec
  try {
    rec = app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
  } catch (_) {
    return 0
  }
  if (!rec) return 0
  return msAte(rec.getString('bloqueado_ate'))
}

function registrarAuditoriaLogin(app, acao, detalhes, email, ip) {
  try {
    const auditoriaCollection = $app.findCollectionByNameOrId('auditoria_acesso')
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
    $app.save(log)
  } catch (err) {
    console.error('Falha ao salvar auditoria de login:', err)
  }
}

/**
 * Registra a falha de login e, ao atingir o limite, aplica o bloqueio.
 */
function registrarFalhaLogin(app, email, ip) {
  const agoraIso = new Date().toISOString()
  let rec = null
  try {
    rec = app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
  } catch (_) {
    rec = null
  }

  const col = $app.findCollectionByNameOrId('bloqueios_login')

  // Reinicia a contagem se a primeira tentativa é mais antiga que 15 min
  let tentativas = 1
  let bloqueiosTotal = 0
  if (rec) {
    const primeira = Date.parse(rec.getString('primeira_tentativa_em') || '')
    const dentroDaJanela = !isNaN(primeira) && agoraMs() - primeira < 15 * 60 * 1000
    tentativas = dentroDaJanela ? Number(rec.getInt('tentativas_falhas') || 0) + 1 : 1
    bloqueiosTotal = Number(rec.getInt('bloqueios_total') || 0)
  }

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
    bloqueadoAteIso = new Date(agoraMs() + janelaMs).toISOString()
    rec.set('bloqueado_ate', bloqueadoAteIso)
    rec.set('bloqueios_total', bloqueiosTotal)
    rec.set('tentativas_falhas', 0)
    rec.set('primeira_tentativa_em', agoraIso)
  }

  $app.save(rec)

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

/**
 * Limpa o contador de falhas após um login bem-sucedido.
 */
function limparFalhas(app, email) {
  try {
    const rec = app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
    if (rec) {
      app.delete(rec)
    }
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Intercepta TODA autenticação por senha na coleção users
// ---------------------------------------------------------------------------
onRecordAuthRequest((e) => {
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

  const restanteMs = bloqueioRestanteMs($app, email)

  if (restanteMs > 0) {
    const minutos = Math.max(1, Math.ceil(restanteMs / 60000))
    registrarAuditoriaLogin(
      $app,
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
    return e.next()
  } catch (err) {
    // Falha de credenciais (ou outro erro de auth) → contabiliza
    const isAuthError = err && (err.status === 400 || err.status === 401)
    if (isAuthError) {
      const bloqueadoAteIso = registrarFalhaLogin($app, email, e.realIP ? e.realIP() : '')
      if (bloqueadoAteIso) {
        const minutos = Math.ceil((Date.parse(bloqueadoAteIso) - agoraMs()) / 60000)
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
    const info = e.auth
    if (!info || info.collection().name !== 'users' || info.getString('perfil') !== 'superadmin') {
      return e.json(403, { status: 403, message: 'Acesso restrito ao Super Admin.' })
    }

    const body = e.requestInfo().body || {}
    const email = normalizarEmail(body.email)
    if (!email) {
      return e.json(400, { status: 400, message: 'Informe o e-mail do bloqueio a liberar.' })
    }

    try {
      const rec = $app.findFirstRecordByFilter('bloqueios_login', `email = '${email}'`)
      if (rec) {
        $app.delete(rec)
        registrarAuditoriaLogin(
          $app,
          'bloqueio_liberado_superadmin',
          `Super Admin liberou manualmente o bloqueio de login do e-mail ${email}.`,
          email,
          e.realIP ? e.realIP() : '',
        )
      }
      return e.json(200, { ok: true })
    } catch (_) {
      return e.json(200, { ok: true })
    }
  },
  $apis.requireAuth(),
)

// Listagem de bloqueios ativos (somente leitura, para o painel Super Admin).
routerAdd(
  'GET',
  '/backend/v1/gestec/bloqueios',
  (e) => {
    const info = e.auth
    if (!info || info.collection().name !== 'users' || info.getString('perfil') !== 'superadmin') {
      return e.json(403, { status: 403, message: 'Acesso restrito ao Super Admin.' })
    }

    const registros = $app.findRecordsByFilter(
      'bloqueios_login',
      '',
      '-ultima_tentativa_em',
      200,
      0,
    )
    const agora = agoraMs()
    const itens = registros
      .map((r) => ({
        id: r.id,
        email: r.getString('email'),
        tentativas_falhas: r.getInt('tentativas_falhas'),
        bloqueado_ate: r.getString('bloqueado_ate'),
        bloqueios_total: r.getInt('bloqueios_total'),
        ultima_tentativa_em: r.getString('ultima_tentativa_em'),
        bloqueado: msAte(r.getString('bloqueado_ate')) > 0,
        minutos_restantes: Math.ceil(msAte(r.getString('bloqueado_ate')) / 60000),
      }))
      .filter((r) => r.bloqueado || r.tentativas_falhas > 0)

    return e.json(200, { items: itens, agora: new Date(agora).toISOString() })
  },
  $apis.requireAuth(),
)
