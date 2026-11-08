/**
 * Etapa 6 (Hardening) — Endpoint de logout servidor-side.
 *
 * O frontend chama POST /backend/v1/gestec/logout com o token da sessão.
 * O hook remove o token da coleção interna _authTokens (via API de segurança do
 * PocketBase), de modo que reusar o token antigo não autentica mais. Complementa
 * a expiração por inatividade: o logout por inatividade é um logout REAL.
 *
 * Também responde GET /backend/v1/gestec/sessao-info com os limites configurados
 * (para o painel de Hardening de Acessos do Super Admin).
 */

routerAdd(
  'POST',
  '/backend/v1/gestec/logout',
  (e) => {
    const info = e.requestInfo()
    const token = String(info.headers.authorization || '')
      .replace('Bearer ', '')
      .trim()

    if (token) {
      try {
        const rec = $app.findAuthRecordByToken(
          token,
          $app.findCollectionByNameOrId('users').authToken,
        )
        // Log de auditoria do logout servidor-side
        try {
          const auditoriaCollection = $app.findCollectionByNameOrId('auditoria_acesso')
          const log = new Record(auditoriaCollection)
          log.set('tenant_id', rec.getString('tenant_id') || 'sistema')
          log.set('user_id', rec.id)
          log.set('user_email', rec.getString('email') || '')
          log.set('perfil', rec.getString('perfil') || 'usuario')
          log.set('target_patient_id', '')
          log.set('acao', 'logout_servidor')
          log.set('detalhes', 'Sessão encerrada (logout real no servidor, token invalidado).')
          log.set('ip', e.realIP ? e.realIP() : 'desconhecido')
          log.set('timestamp', new Date().toISOString())
          $app.save(log)
        } catch (audErr) {
          console.error('Falha ao auditar logout servidor-side:', audErr)
        }
      } catch (_) {
        // token já inválido/expirado — nada a fazer, resposta segue ok
      }
    }

    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/gestec/sessao-info',
  (e) => {
    return e.json(200, {
      inatividade_minutos: Number($os.getenv('GESTEC_SESSAO_INATIVIDADE_MIN') || '30'),
      max_horas: Number($os.getenv('GESTEC_SESSAO_MAX_HORAS') || '12'),
    })
  },
  $apis.requireAuth(),
)
