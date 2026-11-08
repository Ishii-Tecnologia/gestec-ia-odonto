/**
 * Etapa 6 (Hardening) — Troca obrigatória de senha no 1º acesso.
 *
 * Por que este endpoint existe:
 * O PATCH direto em /api/collections/users/records/{id} feito pelo SDK devolvia
 * 404 "The requested resource wasn't found." — no PocketBase isso acontece quando
 * a updateRule da coleção não é satisfeita pela requisição (o registro existe,
 * mas a regra rejeita e a API responde 404, nunca 403). Como a senha provisória
 * do 1º acesso é validada pelo próprio usuário nesta tela, a troca é feita aqui,
 * autenticada pelo token da sessão, sem passar pela updateRule da coleção.
 *
 * Regras de segurança mantidas:
 * - exige usuário autenticado ($apis.requireAuth);
 * - força mínima de 10 caracteres com maiúscula, minúscula, número e especial;
 * - nunca aceita as senhas provisórias padrão (Skip@Pass / Skip@Pass123);
 * - grava a auditoria LGPD append-only (ação troca_senha_primeiro_acesso).
 */

routerAdd(
  'POST',
  '/backend/v1/gestec/trocar-senha',
  (e) => {
    const auth = e.auth
    if (!auth || !auth.id) {
      return e.json(401, {
        sucesso: false,
        mensagem: 'Sessão expirada. Faça login novamente para definir sua nova senha.',
      })
    }

    let body = {}
    try {
      body = e.requestInfo().body
    } catch (_) {
      body = {}
    }

    const novaSenha = (body && body.nova_senha) || ''
    const senhaAtual = (body && body.senha_atual) || ''

    // 1. Se o usuário ainda não trocou a senha provisória, ela É a credencial
    //    válida desta sessão — revalidamos aqui (defesa extra no servidor).
    if (senhaAtual) {
      try {
        const tentativa = $app.findAuthRecordByEmail('users', auth.getString('email'))
        if (!tentativa.validatePassword(senhaAtual)) {
          return e.json(400, {
            sucesso: false,
            mensagem: 'A senha atual informada não confere. Tente novamente.',
          })
        }
      } catch (_) {
        return e.json(400, {
          sucesso: false,
          mensagem: 'Não foi possível confirmar sua identidade. Faça login novamente.',
        })
      }
    }

    // 2. Política de senha (espelha validarForcaSenha do front).
    const erros = []
    if (typeof novaSenha !== 'string' || novaSenha.length < 10) {
      erros.push('mínimo de 10 caracteres')
    }
    if (!/[A-Z]/.test(novaSenha)) erros.push('ao menos uma letra maiúscula')
    if (!/[a-z]/.test(novaSenha)) erros.push('ao menos uma letra minúscula')
    if (!/[0-9]/.test(novaSenha)) erros.push('ao menos um número')
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(novaSenha)) {
      erros.push('ao menos um caractere especial')
    }
    if (novaSenha === 'Skip@Pass' || novaSenha === 'Skip@Pass123') {
      erros.push('não pode ser igual à senha provisória padrão')
    }
    if (erros.length > 0) {
      return e.json(400, {
        sucesso: false,
        mensagem: 'A nova senha não cumpre os requisitos de segurança: ' + erros.join('; ') + '.',
      })
    }

    // 3. Persistir a nova senha (setPassword gera hash + tokenKey novos).
    try {
      const usuario = $app.findRecordById('users', auth.id)
      usuario.setPassword(novaSenha)
      usuario.set('precisa_trocar_senha', false)
      usuario.set('senha_modificada_em', new Date().toISOString())
      $app.save(usuario)
    } catch (err) {
      console.error('Falha ao salvar a nova senha:', err)
      return e.json(500, {
        sucesso: false,
        mensagem:
          'Não foi possível salvar sua nova senha agora. Tente novamente em alguns segundos.',
      })
    }

    // 4. Auditoria LGPD append-only.
    try {
      const auditoriaCollection = $app.findCollectionByNameOrId('auditoria_acesso')
      const log = new Record(auditoriaCollection)
      log.set('tenant_id', auth.getString('tenant_id') || 'sistema')
      log.set('user_id', auth.id)
      log.set('user_email', auth.getString('email') || '')
      log.set('perfil', auth.getString('perfil') || 'usuario')
      log.set('target_patient_id', '')
      log.set('acao', 'troca_senha_primeiro_acesso')
      log.set('detalhes', 'Senha redefinida com sucesso no primeiro acesso (hardening Etapa 6).')
      log.set('ip', 'Web App')
      log.set('timestamp', new Date().toISOString())
      $app.save(log)
    } catch (err) {
      console.error('Falha ao registrar auditoria da troca de senha:', err)
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Senha alterada com sucesso.',
    })
  },
  $apis.requireAuth('users'),
)
