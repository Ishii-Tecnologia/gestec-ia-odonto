/// <reference path="../pb_data/types.d.ts" />
// BL-025 — Controle de Estoque & Insumos (módulo vendável atrás de feature flag)
// Coleções: insumos, lotes_estoque, movimentacoes_estoque (append-only)
// + seed mínimo de demonstração no tenant demo (Etapa 7 / BL-025)
migrate(
  (app) => {
    // ---------- 1. Coleção `insumos` ----------
    let insumos
    try {
      insumos = app.findCollectionByNameOrId('insumos')
    } catch (_) {
      insumos = new Collection({
        name: 'insumos',
        type: 'base',
        fields: [
          { name: 'tenant_id', type: 'text', required: true },
          { name: 'unidade_id', type: 'text', required: true },
          { name: 'nome', type: 'text', required: true },
          {
            name: 'categoria',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: [
              'anestesicos',
              'resinas',
              'descartaveis',
              'epi',
              'instrumentais',
              'moldagem',
              'limpeza',
              'outros',
            ],
          },
          { name: 'unidade_medida', type: 'text', required: true },
          { name: 'estoque_minimo', type: 'number', required: false, onlyInt: false },
          { name: 'custo_referencia', type: 'number', required: false, onlyInt: false },
          { name: 'fornecedor', type: 'text', required: false },
          { name: 'ativo', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner' || @request.auth.perfil = 'financeiro')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner' || @request.auth.perfil = 'financeiro')",
        deleteRule: null,
        indexes: [
          'CREATE INDEX idx_insumos_tenant ON insumos (tenant_id, unidade_id)',
          'CREATE INDEX idx_insumos_nome ON insumos (tenant_id, nome)',
        ],
      })
      app.save(insumos)
    }

    // ---------- 2. Coleção `lotes_estoque` (entradas) ----------
    let lotes
    try {
      lotes = app.findCollectionByNameOrId('lotes_estoque')
    } catch (_) {
      lotes = new Collection({
        name: 'lotes_estoque',
        type: 'base',
        fields: [
          { name: 'tenant_id', type: 'text', required: true },
          { name: 'unidade_id', type: 'text', required: true },
          { name: 'insumo_id', type: 'text', required: true },
          { name: 'quantidade', type: 'number', required: true, onlyInt: false },
          { name: 'custo_unitario', type: 'number', required: false, onlyInt: false },
          { name: 'validade', type: 'date', required: false },
          { name: 'lote', type: 'text', required: false },
          { name: 'fabricante', type: 'text', required: false },
          { name: 'data_entrada', type: 'date', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner' || @request.auth.perfil = 'financeiro')",
        updateRule: null,
        deleteRule: null,
        indexes: [
          'CREATE INDEX idx_lotes_insumo ON lotes_estoque (tenant_id, insumo_id)',
          'CREATE INDEX idx_lotes_validade ON lotes_estoque (tenant_id, validade)',
        ],
      })
      app.save(lotes)
    }

    // ---------- 3. Coleção `movimentacoes_estoque` (histórico append-only) ----------
    let movs
    try {
      movs = app.findCollectionByNameOrId('movimentacoes_estoque')
    } catch (_) {
      movs = new Collection({
        name: 'movimentacoes_estoque',
        type: 'base',
        fields: [
          { name: 'tenant_id', type: 'text', required: true },
          { name: 'unidade_id', type: 'text', required: true },
          { name: 'insumo_id', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['entrada', 'consumo', 'ajuste', 'perda'],
          },
          { name: 'quantidade', type: 'number', required: true, onlyInt: false },
          { name: 'motivo', type: 'text', required: false },
          { name: 'atendimento_id', type: 'text', required: false },
          { name: 'paciente_id', type: 'text', required: false },
          { name: 'profissional', type: 'text', required: false },
          { name: 'lote_id', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        listRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || tenant_id = @request.auth.tenant_id)",
        // Dentista e ASB registram consumo; Owner/Financeiro/Super Admin podem tudo
        createRule:
          "@request.auth.id != '' && (@request.auth.perfil = 'superadmin' || @request.auth.perfil = 'owner' || @request.auth.perfil = 'financeiro' || @request.auth.perfil = 'dentista' || @request.auth.perfil = 'asb')",
        // Append-only: sem edição nem exclusão (correções por movimentação de ajuste)
        updateRule: null,
        deleteRule: null,
        indexes: [
          'CREATE INDEX idx_movs_insumo ON movimentacoes_estoque (tenant_id, insumo_id, created)',
          'CREATE INDEX idx_movs_tipo ON movimentacoes_estoque (tenant_id, tipo)',
        ],
      })
      app.save(movs)
    }

    // ---------- 4. Entitlement do módulo `estoque` no tenant demo ----------
    let demoTenant = null
    try {
      demoTenant = app.findFirstRecordByFilter('tenants', "nome ~ 'OdontoDemo' || nome ~ 'Matriz'")
    } catch (_) {
      demoTenant = null
    }
    if (!demoTenant) {
      try {
        demoTenant = app.findFirstRecordByFilter('tenants', 'id != ""')
      } catch (_) {
        demoTenant = null
      }
    }

    let unidadePrincipal = null
    if (demoTenant) {
      try {
        unidadePrincipal = app.findFirstRecordByFilter('unidades', `tenant_id = '${demoTenant.id}'`)
      } catch (_) {
        unidadePrincipal = null
      }
    }

    if (demoTenant && unidadePrincipal) {
      const tenantId = demoTenant.id
      const unidadeId = unidadePrincipal.id

      // 4a. Ativar o módulo `estoque` no tenant demo (idempotente)
      const mods = demoTenant.get('modulos_ativos')
      let modulos = {}
      if (mods && typeof mods === 'object') {
        modulos = JSON.parse(JSON.stringify(mods))
      }
      if (!modulos.core) modulos.core = true
      if (modulos.estoque !== true) {
        modulos.estoque = true
        demoTenant.set('modulos_ativos', modulos)
        app.save(demoTenant)
      }

      // 4b. Seed mínimo de insumos/lotes/movimentações (idempotente, apenas estoque)
      const seedInsumos = [
        {
          nome: 'Anestésico Mepivacaína 2% (caixa 50)',
          categoria: 'anestesicos',
          unidade_medida: 'caixa',
          estoque_minimo: 2,
          custo_referencia: 89.9,
          fornecedor: 'Dental Vip',
          qtdEntrada: 6,
          qtdConsumo: 1,
        },
        {
          nome: 'Resina Composta Z350 A2 (seringa)',
          categoria: 'resinas',
          unidade_medida: 'unidade',
          estoque_minimo: 4,
          custo_referencia: 74.5,
          fornecedor: 'Dental Vip',
          qtdEntrada: 8,
          qtdConsumo: 5,
        },
        {
          nome: 'Luva de Procedimento M (caixa 100)',
          categoria: 'epi',
          unidade_medida: 'caixa',
          estoque_minimo: 5,
          custo_referencia: 42.0,
          fornecedor: 'MedSupply',
          qtdEntrada: 12,
          qtdConsumo: 2,
        },
        {
          nome: 'Máscara PFF2 (caixa 20)',
          categoria: 'epi',
          unidade_medida: 'caixa',
          estoque_minimo: 3,
          custo_referencia: 38.0,
          fornecedor: 'MedSupply',
          qtdEntrada: 4,
          qtdConsumo: 0,
        },
      ]

      const hoje = new Date()
      function dataIsoOffset(dias) {
        const d = new Date(hoje)
        d.setDate(d.getDate() + dias)
        return d.toISOString()
      }
      const dataEntradaIso = dataIsoOffset(-20)

      for (const si of seedInsumos) {
        let insumoRec
        try {
          insumoRec = app.findFirstRecordByFilter(
            'insumos',
            `tenant_id = '${tenantId}' && unidade_id = '${unidadeId}' && nome = '${si.nome}'`,
          )
        } catch (_) {
          insumoRec = null
        }
        if (!insumoRec) {
          insumoRec = new Record(insumos)
          insumoRec.set('tenant_id', tenantId)
          insumoRec.set('unidade_id', unidadeId)
          insumoRec.set('nome', si.nome)
          insumoRec.set('categoria', si.categoria)
          insumoRec.set('unidade_medida', si.unidade_medida)
          insumoRec.set('estoque_minimo', si.estoque_minimo)
          insumoRec.set('custo_referencia', si.custo_referencia)
          insumoRec.set('fornecedor', si.fornecedor)
          insumoRec.set('ativo', true)
          app.save(insumoRec)

          // Lote de entrada + movimentação correspondente
          const loteRec = new Record(lotes)
          loteRec.set('tenant_id', tenantId)
          loteRec.set('unidade_id', unidadeId)
          loteRec.set('insumo_id', insumoRec.id)
          loteRec.set('quantidade', si.qtdEntrada)
          loteRec.set('custo_unitario', si.custo_referencia)
          // Último insumo (máscara) com lote vencido; demais com validade futura
          if (si.categoria === 'epi' && si.qtdConsumo === 0) {
            loteRec.set('validade', dataIsoOffset(-5)) // vencido — dispara alerta de validade
          } else {
            loteRec.set('validade', dataIsoOffset(200))
          }
          loteRec.set('lote', 'L' + Math.floor(Math.random() * 900000 + 100000))
          loteRec.set('fabricante', si.fornecedor)
          loteRec.set('data_entrada', dataEntradaIso)
          app.save(loteRec)

          const movEntrada = new Record(movs)
          movEntrada.set('tenant_id', tenantId)
          movEntrada.set('unidade_id', unidadeId)
          movEntrada.set('insumo_id', insumoRec.id)
          movEntrada.set('tipo', 'entrada')
          movEntrada.set('quantidade', si.qtdEntrada)
          movEntrada.set('motivo', 'Compra inicial de demonstração (BL-025)')
          movEntrada.set('profissional', 'Seed Estoque')
          movEntrada.set('lote_id', loteRec.id)
          movEntrada.set('created', dataEntradaIso)
          app.save(movEntrada)

          if (si.qtdConsumo > 0) {
            const movConsumo = new Record(movs)
            movConsumo.set('tenant_id', tenantId)
            movConsumo.set('unidade_id', unidadeId)
            movConsumo.set('insumo_id', insumoRec.id)
            movConsumo.set('tipo', 'consumo')
            movConsumo.set('quantidade', si.qtdConsumo)
            movConsumo.set('motivo', 'Consumo clínico de demonstração')
            movConsumo.set('profissional', 'Seed Estoque')
            movConsumo.set('created', dataIsoOffset(-2))
            app.save(movConsumo)
          }
        }
      }
      // Máscara PFF2: 4 entradas e 0 consumos — acima do mínimo; para o alerta de
      // estoque baixo, criar uma perda que deixa o saldo (4-2=2) abaixo do mínimo (3)
      try {
        const mascara = app.findFirstRecordByFilter(
          'insumos',
          `tenant_id = '${tenantId}' && unidade_id = '${unidadeId}' && nome = 'Máscara PFF2 (caixa 20)'`,
        )
        if (mascara) {
          let temPerda = false
          try {
            app.findFirstRecordByFilter(
              'movimentacoes_estoque',
              `tenant_id = '${tenantId}' && insumo_id = '${mascara.id}' && tipo = 'perda'`,
            )
            temPerda = true
          } catch (_) {
            temPerda = false
          }
          if (!temPerda) {
            const movPerda = new Record(movs)
            movPerda.set('tenant_id', tenantId)
            movPerda.set('unidade_id', unidadeId)
            movPerda.set('insumo_id', mascara.id)
            movPerda.set('tipo', 'perda')
            movPerda.set('quantidade', 2)
            movPerda.set('motivo', 'Perda por vencimento de lote (demonstração)')
            movPerda.set('profissional', 'Seed Estoque')
            movPerda.set('created', dataIsoOffset(-1))
            app.save(movPerda)
          }
        }
      } catch (e) {
        console.warn('Aviso seed perda máscara:', e)
      }
    }
  },
  (app) => {
    // Reversão: sem-op (dados operacionais do usuário nunca são apagados)
  },
)
