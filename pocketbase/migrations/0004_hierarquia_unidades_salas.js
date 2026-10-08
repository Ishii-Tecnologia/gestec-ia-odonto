/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar a coleção tenants com os novos campos solicitados:
    // - situacao (ativa, suspensa)
    // - configuracoes (JSON)
    // - garantir razao_social e cnpj
    const tenants = app.findCollectionByNameOrId('tenants')

    if (!tenants.fields.getByName('situacao')) {
      tenants.fields.add(
        new SelectField({
          name: 'situacao',
          values: ['ativa', 'suspensa'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!tenants.fields.getByName('configuracoes')) {
      tenants.fields.add(
        new JSONField({
          name: 'configuracoes',
          required: false,
        }),
      )
    }

    app.save(tenants)

    try {
      tenants.addIndex('idx_tenants_cnpj_unique', true, 'cnpj', "cnpj != '' AND cnpj IS NOT NULL")
      app.save(tenants)
    } catch (err) {
      console.warn('Index cnpj unique notice:', err)
    }

    // 2. Nova Coleção `unidades`:
    // tenant_id (obrigatório), nome (ex: "Unidade Centro"), endereco, telefone, ativa (bool), ordem (number)
    let unidades
    try {
      unidades = app.findCollectionByNameOrId('unidades')
    } catch (_) {
      unidades = new Collection({
        name: 'unidades',
        type: 'base',
        fields: [
          { name: 'tenant_id', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          { name: 'endereco', type: 'text', required: false },
          { name: 'telefone', type: 'text', required: false },
          { name: 'ativa', type: 'bool', required: false },
          { name: 'ordem', type: 'number', required: false, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        indexes: ['CREATE INDEX idx_unidades_tenant ON unidades (tenant_id, ordem ASC)'],
      })
      app.save(unidades)
    }

    // 3. Nova Coleção `salas`:
    // tenant_id (obrigatório), unidade_id (obrigatório), nome, descricao, cadeiras_qtd (number), ativo (bool), ordem (number)
    let salas
    try {
      salas = app.findCollectionByNameOrId('salas')
    } catch (_) {
      salas = new Collection({
        name: 'salas',
        type: 'base',
        fields: [
          { name: 'tenant_id', type: 'text', required: true },
          {
            name: 'unidade_id',
            type: 'relation',
            collectionId: unidades.id,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'nome', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: false },
          { name: 'cadeiras_qtd', type: 'number', required: false, onlyInt: true },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'ordem', type: 'number', required: false, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner')",
        indexes: [
          'CREATE INDEX idx_salas_unidade ON salas (unidade_id, ordem ASC)',
          'CREATE INDEX idx_salas_tenant ON salas (tenant_id)',
        ],
      })
      app.save(salas)
    }

    // 4. Adicionar campos de escopo de unidade em `users`:
    // - todas_unidades (bool, default true)
    // - unidades_ids (JSON array de strings)
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('todas_unidades')) {
      users.fields.add(
        new BoolField({
          name: 'todas_unidades',
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('unidades_ids')) {
      users.fields.add(
        new JSONField({
          name: 'unidades_ids',
          required: false,
        }),
      )
    }
    app.save(users)

    // 5. Adicionar `unidade_id` e `sala_id` em agendamentos
    const agendamentos = app.findCollectionByNameOrId('agendamentos')
    if (!agendamentos.fields.getByName('unidade_id')) {
      agendamentos.fields.add(
        new TextField({
          name: 'unidade_id',
          required: false,
        }),
      )
    }
    if (!agendamentos.fields.getByName('sala_id')) {
      agendamentos.fields.add(
        new TextField({
          name: 'sala_id',
          required: false,
        }),
      )
    }
    app.save(agendamentos)

    // 6. Migração de dados:
    // Buscar tenants via findRecordsByFilter com sort em 'id' ou ''
    const allTenantsList = app.findRecordsByFilter('tenants', 'id != ""', 'id', 100, 0)
    for (const t of allTenantsList) {
      const tId = t.id
      const isAtivo = t.getBool('ativo')
      if (!t.getString('situacao')) {
        t.set('situacao', isAtivo ? 'ativa' : 'suspensa')
        app.save(t)
      }

      let principalUnidade
      try {
        principalUnidade = app.findFirstRecordByFilter('unidades', `tenant_id = '${tId}'`)
      } catch (_) {
        principalUnidade = null
      }

      if (!principalUnidade) {
        principalUnidade = new Record(unidades)
        principalUnidade.set('tenant_id', tId)
        principalUnidade.set('nome', 'Unidade Principal')
        principalUnidade.set('endereco', 'Av. Paulista, 1000 - Conjunto 101, São Paulo - SP')
        principalUnidade.set('telefone', '(11) 3214-5678')
        principalUnidade.set('ativa', true)
        principalUnidade.set('ordem', 1)
        app.save(principalUnidade)
      }

      // Criar as 3 salas padrão da Unidade Principal caso não existam
      const salasPadrao = [
        { nome: 'Consultório 1 - Ortodontia & Estética', cadeiras: 1, ordem: 1 },
        { nome: 'Consultório 2 - Cirurgia & Implantes', cadeiras: 1, ordem: 2 },
        { nome: 'Consultório 3 - Avaliação & Diagnóstico', cadeiras: 1, ordem: 3 },
      ]

      for (const sp of salasPadrao) {
        let salaRec
        try {
          salaRec = app.findFirstRecordByFilter(
            'salas',
            `tenant_id = '${tId}' && unidade_id = '${principalUnidade.id}' && nome = '${sp.nome}'`,
          )
        } catch (_) {
          salaRec = null
        }
        if (!salaRec) {
          salaRec = new Record(salas)
          salaRec.set('tenant_id', tId)
          salaRec.set('unidade_id', principalUnidade.id)
          salaRec.set('nome', sp.nome)
          salaRec.set('cadeiras_qtd', sp.cadeiras)
          salaRec.set('ativo', true)
          salaRec.set('ordem', sp.ordem)
          app.save(salaRec)
        }
      }

      // Vincular agendamentos existentes deste tenant à unidade principal
      try {
        app
          .db()
          .newQuery(`
        UPDATE agendamentos 
        SET unidade_id = {:unidadeId} 
        WHERE tenant_id = {:tenantId} AND (unidade_id IS NULL OR unidade_id = '')
      `)
          .bind({ unidadeId: principalUnidade.id, tenantId: tId })
          .execute()
      } catch (e) {
        console.warn('Erro ao atualizar unidade_id em agendamentos:', e)
      }
    }

    // 7. Atualizar usuários existentes para todas_unidades = true por padrão
    try {
      app
        .db()
        .newQuery(`
      UPDATE users 
      SET todas_unidades = 1 
      WHERE todas_unidades IS NULL
    `)
        .execute()
    } catch (e) {
      console.warn('Erro ao atualizar todas_unidades em users:', e)
    }
  },
  (app) => {
    // Reversão básica se necessário
  },
)
