/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar a coleção users:
    // - permitir perfil 'superadmin' no select
    // - ajustar apiRules para permitir listar colegas do mesmo tenant ou se for superadmin/owner
    const users = app.findCollectionByNameOrId('users')
    const perfilField = users.fields.getByName('perfil')
    if (perfilField) {
      perfilField.values = ['superadmin', 'owner', 'dentista', 'recepcao', 'financeiro', 'asb']
    }
    // ListRule / ViewRule para users:
    // Um usuário logado pode ver a si mesmo, ou usuários do mesmo tenant, ou superadmin vê todos
    users.listRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.id = id || tenant_id = @request.auth.tenant_id)"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.id = id || tenant_id = @request.auth.tenant_id)"
    users.createRule = "@request.auth.id != ''"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner' || @request.auth.id = id)"
    app.save(users)

    // 2. Coleção tenants: atualizar apiRules e garantir campos
    const tenants = app.findCollectionByNameOrId('tenants')
    tenants.listRule = "@request.auth.id != ''"
    tenants.viewRule = "@request.auth.id != ''"
    tenants.createRule = "@request.auth.id != ''"
    tenants.updateRule = "@request.auth.id != ''"
    tenants.deleteRule = null // Tenants não podem ser excluídos via API (apenas suspensos)
    app.save(tenants)

    // 3. Coleção auditoria_acesso: garantir append-only (sem update, sem delete)
    const auditoria = app.findCollectionByNameOrId('auditoria_acesso')
    auditoria.listRule = "@request.auth.id != ''"
    auditoria.viewRule = "@request.auth.id != ''"
    auditoria.createRule = "@request.auth.id != ''"
    auditoria.updateRule = null // CRÍTICO: Append-only estrito LGPD
    auditoria.deleteRule = null // CRÍTICO: Append-only estrito LGPD
    app.save(auditoria)

    // 4. Coleção pacientes: regras de acesso
    const pacientes = app.findCollectionByNameOrId('pacientes')
    pacientes.listRule = "@request.auth.id != ''"
    pacientes.viewRule = "@request.auth.id != ''"
    pacientes.createRule = "@request.auth.id != ''"
    pacientes.updateRule = "@request.auth.id != ''"
    pacientes.deleteRule = "@request.auth.id != ''"
    app.save(pacientes)

    // 5. Coleção procedimentos: regras de acesso
    const procedimentos = app.findCollectionByNameOrId('procedimentos')
    procedimentos.listRule = "@request.auth.id != ''"
    procedimentos.viewRule = "@request.auth.id != ''"
    procedimentos.createRule = "@request.auth.id != ''"
    procedimentos.updateRule = "@request.auth.id != ''"
    procedimentos.deleteRule = "@request.auth.id != ''"
    app.save(procedimentos)

    // 6. Coleção orcamentos: regras de acesso
    const orcamentos = app.findCollectionByNameOrId('orcamentos')
    orcamentos.listRule = "@request.auth.id != ''"
    orcamentos.viewRule = "@request.auth.id != ''"
    orcamentos.createRule = "@request.auth.id != ''"
    orcamentos.updateRule = "@request.auth.id != ''"
    orcamentos.deleteRule = "@request.auth.id != ''"
    app.save(orcamentos)

    // 7. Coleção lancamentos_financeiros: regras de acesso
    const lancamentos = app.findCollectionByNameOrId('lancamentos_financeiros')
    lancamentos.listRule = "@request.auth.id != ''"
    lancamentos.viewRule = "@request.auth.id != ''"
    lancamentos.createRule = "@request.auth.id != ''"
    lancamentos.updateRule = "@request.auth.id != ''"
    lancamentos.deleteRule = "@request.auth.id != ''"
    app.save(lancamentos)

    // 8. Coleção odontogramas_snapshots: regras de leitura e criação (sem update, sem delete)
    const odontogramas = app.findCollectionByNameOrId('odontogramas_snapshots')
    odontogramas.listRule = "@request.auth.id != ''"
    odontogramas.viewRule = "@request.auth.id != ''"
    odontogramas.createRule = "@request.auth.id != ''"
    odontogramas.updateRule = null
    odontogramas.deleteRule = null
    app.save(odontogramas)

    // 9. Coleção evolucoes_clinicas: regras de leitura e criação (sem update, sem delete)
    const evolucoes = app.findCollectionByNameOrId('evolucoes_clinicas')
    evolucoes.listRule = "@request.auth.id != ''"
    evolucoes.viewRule = "@request.auth.id != ''"
    evolucoes.createRule = "@request.auth.id != ''"
    evolucoes.updateRule = null
    evolucoes.deleteRule = null
    app.save(evolucoes)

    // 10. Criar/Garantir usuário Super Admin da plataforma
    try {
      app.findAuthRecordByEmail('users', 'superadmin@gestecodonto.com.br')
    } catch (_) {
      const superAdmin = new Record(users)
      superAdmin.set('email', 'superadmin@gestecodonto.com.br')
      superAdmin.set('name', 'Super Admin (Plataforma)')
      superAdmin.setPassword('Skip@Pass123')
      superAdmin.set('verified', true)
      superAdmin.set('perfil', 'superadmin')
      app.save(superAdmin)
    }

    // 11. Criar usuário ishii7883@gmail.com como Super Admin / Owner conforme exigência do Skip Cloud
    try {
      const curUser = app.findAuthRecordByEmail('users', 'ishii7883@gmail.com')
      curUser.set('perfil', 'superadmin')
      app.save(curUser)
    } catch (_) {
      const devUser = new Record(users)
      devUser.set('email', 'ishii7883@gmail.com')
      devUser.set('name', 'Desenvolvedor Skip')
      devUser.setPassword('Skip@Pass123')
      devUser.set('verified', true)
      devUser.set('perfil', 'superadmin')
      app.save(devUser)
    }
  },
  (app) => {
    // Reversão básica
  },
)
