/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir campos e regras imutáveis em `evolucoes_clinicas` (BL-006)
    const evolucoes = app.findCollectionByNameOrId('evolucoes_clinicas')
    const camposEvolucoes = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'data', type: 'text' },
      {
        name: 'tipo',
        type: 'select',
        values: ['anamnese', 'evolucao', 'prescricao', 'observacao', 'retificacao', 'procedimento'],
        maxSelect: 1,
      },
      {
        name: 'especialidade',
        type: 'select',
        values: [
          'geral',
          'exodontia',
          'endodontia',
          'ortodontia',
          'periodontia',
          'protese',
          'implantodontia',
          'odontopediatria',
          'estetica',
        ],
        maxSelect: 1,
      },
      { name: 'descricao', type: 'text' },
      { name: 'dentista_nome', type: 'text' },
      { name: 'cro', type: 'text' },
      { name: 'retifica_evolucao_id', type: 'text' }, // Encadeamento de versões se for retificação
      { name: 'motivo_retificacao', type: 'text' },
      { name: 'procedimento_relacionado', type: 'text' },
    ]

    for (const c of camposEvolucoes) {
      if (!evolucoes.fields.getByName(c.name)) {
        if (c.type === 'text') {
          evolucoes.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'select') {
          evolucoes.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      }
    }

    // Regras de acesso: criável e listável por autenticados, IMUTÁVEL (sem update nem delete)
    evolucoes.listRule = "@request.auth.id != ''"
    evolucoes.viewRule = "@request.auth.id != ''"
    evolucoes.createRule = "@request.auth.id != ''"
    evolucoes.updateRule = null // Append-only estrito: nunca sobrescrever evolução clínica
    evolucoes.deleteRule = null // Proibido deletar
    app.save(evolucoes)

    // 2. Garantir campos e regras imutáveis em `odontogramas_snapshots` (BL-007)
    const odontogramas = app.findCollectionByNameOrId('odontogramas_snapshots')
    const camposOdonto = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'data', type: 'text' },
      { name: 'atendimento_id', type: 'text' },
      { name: 'payload', type: 'json' },
      { name: 'dentista_nome', type: 'text' },
      { name: 'cro', type: 'text' },
      { name: 'versao', type: 'number' },
      { name: 'descricao_alteracao', type: 'text' },
    ]

    for (const c of camposOdonto) {
      if (!odontogramas.fields.getByName(c.name)) {
        if (c.type === 'text') {
          odontogramas.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'json') {
          odontogramas.fields.add(new JSONField({ name: c.name }))
        } else if (c.type === 'number') {
          odontogramas.fields.add(new NumberField({ name: c.name }))
        }
      }
    }

    odontogramas.listRule = "@request.auth.id != ''"
    odontogramas.viewRule = "@request.auth.id != ''"
    odontogramas.createRule = "@request.auth.id != ''"
    odontogramas.updateRule = null // Imutável: nunca sobrescrever versões do odontograma
    odontogramas.deleteRule = null
    app.save(odontogramas)

    // 3. Garantir campos e regras em `anamneses`
    const anamneses = app.findCollectionByNameOrId('anamneses')
    const camposAnamnese = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'perguntas', type: 'json' },
      { name: 'respostas', type: 'json' },
      {
        name: 'status',
        type: 'select',
        values: ['pendente', 'respondida', 'assinada'],
        maxSelect: 1,
      },
      { name: 'token', type: 'text' },
      { name: 'data_resposta', type: 'text' },
      { name: 'dentista_nome', type: 'text' },
      { name: 'cro', type: 'text' },
    ]

    for (const c of camposAnamnese) {
      if (!anamneses.fields.getByName(c.name)) {
        if (c.type === 'text') {
          anamneses.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'json') {
          anamneses.fields.add(new JSONField({ name: c.name }))
        } else if (c.type === 'select') {
          anamneses.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      }
    }

    anamneses.listRule = "@request.auth.id != ''"
    anamneses.viewRule = "@request.auth.id != ''"
    anamneses.createRule = "@request.auth.id != ''"
    anamneses.updateRule = "@request.auth.id != ''"
    anamneses.deleteRule = null
    app.save(anamneses)
  },
  (app) => {
    // Reversão
  },
)
