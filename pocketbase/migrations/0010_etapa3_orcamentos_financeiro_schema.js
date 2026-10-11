/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Procedimentos: garantir campos
    const procedimentos = app.findCollectionByNameOrId('procedimentos')
    const camposProcedimentos = [
      { name: 'tenant_id', type: 'text' },
      { name: 'codigo', type: 'text' },
      { name: 'nome', type: 'text' },
      { name: 'descricao', type: 'text' },
      { name: 'duracao_minutos', type: 'number' },
      { name: 'valor', type: 'number' },
      {
        name: 'categoria',
        type: 'select',
        values: [
          'diagnostico',
          'prevencao',
          'restauradora',
          'endodontia',
          'periodontia',
          'cirurgia',
          'ortodontia',
          'protese',
          'estetica',
        ],
        maxSelect: 1,
      },
    ]

    for (const c of camposProcedimentos) {
      if (!procedimentos.fields.getByName(c.name)) {
        if (c.type === 'text') {
          procedimentos.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          procedimentos.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'select') {
          procedimentos.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      }
    }
    procedimentos.listRule = "@request.auth.id != ''"
    procedimentos.viewRule = "@request.auth.id != ''"
    procedimentos.createRule = "@request.auth.id != ''"
    procedimentos.updateRule = "@request.auth.id != ''"
    procedimentos.deleteRule = "@request.auth.id != ''"
    app.save(procedimentos)

    // 2. Orçamentos (BL-008)
    const orcamentos = app.findCollectionByNameOrId('orcamentos')
    const camposOrcamentos = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'plano_id', type: 'text' },
      { name: 'numero_orcamento', type: 'text' },
      { name: 'valor_bruto', type: 'number' },
      { name: 'desconto_percentual', type: 'number' },
      { name: 'desconto_valor', type: 'number' },
      { name: 'valor_liquido', type: 'number' },
      { name: 'parcelas', type: 'number' },
      {
        name: 'status',
        type: 'select',
        values: ['rascunho', 'enviado', 'negociacao', 'aprovado', 'rejeitado', 'vencido'],
        maxSelect: 1,
      },
      { name: 'validade', type: 'text' },
      { name: 'itens', type: 'json' }, // [{ procedimento_id, procedimento, dente, face, quantidade, valor_unitario, valor_total }]
      { name: 'observacoes', type: 'text' },
      { name: 'motivo_rejeicao', type: 'text' },
      { name: 'assinatura', type: 'json' }, // { rubrica, data_hora, ip, documento_identidade, assinado: bool }
      { name: 'data_aprovacao', type: 'text' },
      { name: 'aprovado_por', type: 'text' },
    ]

    for (const c of camposOrcamentos) {
      if (!orcamentos.fields.getByName(c.name)) {
        if (c.type === 'text') {
          orcamentos.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          orcamentos.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'select') {
          orcamentos.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        } else if (c.type === 'json') {
          orcamentos.fields.add(new JSONField({ name: c.name }))
        }
      }
    }
    orcamentos.listRule = "@request.auth.id != ''"
    orcamentos.viewRule = "@request.auth.id != ''"
    orcamentos.createRule = "@request.auth.id != ''"
    orcamentos.updateRule = "@request.auth.id != ''"
    orcamentos.deleteRule = "@request.auth.id != ''"
    app.save(orcamentos)

    // 3. Lançamentos Financeiros (BL-009)
    const lancamentos = app.findCollectionByNameOrId('lancamentos_financeiros')
    const camposLancamentos = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'orcamento_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'descricao', type: 'text' },
      {
        name: 'tipo',
        type: 'select',
        values: ['receber', 'pagar'],
        maxSelect: 1,
      },
      {
        name: 'categoria',
        type: 'select',
        values: ['tratamento', 'consulta', 'procedimento', 'ortodontia', 'protese', 'outro'],
        maxSelect: 1,
      },
      { name: 'numero_parcela', type: 'number' },
      { name: 'total_parcelas', type: 'number' },
      { name: 'valor', type: 'number' },
      { name: 'valor_desconto', type: 'number' },
      { name: 'valor_juros_multa', type: 'number' },
      { name: 'valor_liquido', type: 'number' },
      { name: 'vencimento', type: 'text' },
      {
        name: 'status',
        type: 'select',
        values: ['aberto', 'pago', 'parcial', 'vencido', 'cancelado'],
        maxSelect: 1,
      },
      { name: 'modalidades', type: 'json' }, // [{ modalidade: 'pix'|'cartao_credito'|..., valor, comprovante, data }]
      { name: 'forma_pagamento_principal', type: 'text' },
      { name: 'data_pagamento', type: 'text' },
      { name: 'valor_pago', type: 'number' },
      { name: 'comprovante_transacao', type: 'text' },
      { name: 'observacoes', type: 'text' },
      { name: 'responsavel_baixa_email', type: 'text' },
    ]

    for (const c of camposLancamentos) {
      if (!lancamentos.fields.getByName(c.name)) {
        if (c.type === 'text') {
          lancamentos.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          lancamentos.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'select') {
          lancamentos.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        } else if (c.type === 'json') {
          lancamentos.fields.add(new JSONField({ name: c.name }))
        }
      }
    }
    lancamentos.listRule = "@request.auth.id != ''"
    lancamentos.viewRule = "@request.auth.id != ''"
    lancamentos.createRule = "@request.auth.id != ''"
    // Baixa de pagamento: auditada e controlada por perfil
    lancamentos.updateRule = "@request.auth.id != ''"
    lancamentos.deleteRule = "@request.auth.id != ''"
    app.save(lancamentos)
  },
  (app) => {
    // Reversão
  },
)
