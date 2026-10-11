/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir campos e regras na coleção `filas_espera` (BL-013)
    const filaEspera = app.findCollectionByNameOrId('filas_espera')
    const camposFila = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      { name: 'procedimento', type: 'text' },
      {
        name: 'periodo_preferencia',
        type: 'select',
        values: ['manha', 'tarde', 'noite', 'qualquer'],
        maxSelect: 1,
      },
      { name: 'dias_semana', type: 'json' }, // ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
      { name: 'data_desejada', type: 'text' },
      { name: 'prioridade', type: 'number' }, // 1 (normal) a 5 (urgente)
      {
        name: 'status',
        type: 'select',
        values: ['aguardando', 'ofertado', 'atendido', 'cancelado'],
        maxSelect: 1,
      },
      { name: 'observacoes', type: 'text' },
      { name: 'contato_telefone', type: 'text' },
      { name: 'oferta_enviada_em', type: 'text' },
    ]

    for (const c of camposFila) {
      const existing = filaEspera.fields.getByName(c.name)
      if (!existing) {
        if (c.type === 'text') filaEspera.fields.add(new TextField({ name: c.name }))
        else if (c.type === 'number') filaEspera.fields.add(new NumberField({ name: c.name }))
        else if (c.type === 'json') filaEspera.fields.add(new JSONField({ name: c.name }))
        else if (c.type === 'select') {
          filaEspera.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      } else if (c.type === 'select' && c.values) {
        existing.values = c.values
      }
    }
    filaEspera.listRule = "@request.auth.id != ''"
    filaEspera.viewRule = "@request.auth.id != ''"
    filaEspera.createRule = "@request.auth.id != ''"
    filaEspera.updateRule = "@request.auth.id != ''"
    filaEspera.deleteRule = "@request.auth.id != ''"
    app.save(filaEspera)

    // 2. Garantir campos e regras na coleção `vinculos_familiares` (BL-020)
    const vinculos = app.findCollectionByNameOrId('vinculos_familiares')
    const camposVinculos = [
      { name: 'tenant_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'responsavel_id', type: 'text' },
      { name: 'responsavel_nome', type: 'text' },
      { name: 'responsavel_cpf', type: 'text' },
      { name: 'responsavel_telefone', type: 'text' },
      {
        name: 'parentesco',
        type: 'select',
        values: [
          'pai',
          'mae',
          'filho',
          'filha',
          'conjuge',
          'irmao',
          'irma',
          'avo',
          'tutor',
          'outro',
        ],
        maxSelect: 1,
      },
      { name: 'financeiro_responsavel', type: 'bool' },
      { name: 'observacoes', type: 'text' },
    ]

    for (const c of camposVinculos) {
      const existing = vinculos.fields.getByName(c.name)
      if (!existing) {
        if (c.type === 'text') vinculos.fields.add(new TextField({ name: c.name }))
        else if (c.type === 'bool') vinculos.fields.add(new BoolField({ name: c.name }))
        else if (c.type === 'select') {
          vinculos.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      } else if (c.type === 'select' && c.values) {
        existing.values = c.values
      }
    }
    vinculos.listRule = "@request.auth.id != ''"
    vinculos.viewRule = "@request.auth.id != ''"
    vinculos.createRule = "@request.auth.id != ''"
    vinculos.updateRule = "@request.auth.id != ''"
    vinculos.deleteRule = "@request.auth.id != ''"
    app.save(vinculos)

    // 3. Garantir campos e regras na coleção `exames_anexos` (BL-015)
    const exames = app.findCollectionByNameOrId('exames_anexos')
    const camposExames = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      {
        name: 'tipo',
        type: 'select',
        values: [
          'raiox',
          'panoramica',
          'periapical',
          'tomografia',
          'foto_clinica',
          'documento',
          'laudo',
          'outro',
        ],
        maxSelect: 1,
      },
      { name: 'titulo', type: 'text' },
      { name: 'descricao', type: 'text' },
      { name: 'data_exame', type: 'text' },
      { name: 'url_arquivo', type: 'text' },
      { name: 'tamanho_bytes', type: 'number' },
      { name: 'tags', type: 'json' },
      { name: 'dente_referencia', type: 'text' },
    ]

    for (const c of camposExames) {
      const existing = exames.fields.getByName(c.name)
      if (!existing) {
        if (c.type === 'text') exames.fields.add(new TextField({ name: c.name }))
        else if (c.type === 'number') exames.fields.add(new NumberField({ name: c.name }))
        else if (c.type === 'json') exames.fields.add(new JSONField({ name: c.name }))
        else if (c.type === 'select') {
          exames.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      } else if (c.type === 'select' && c.values) {
        existing.values = c.values
      }
    }
    exames.listRule = "@request.auth.id != ''"
    exames.viewRule = "@request.auth.id != ''"
    exames.createRule = "@request.auth.id != ''"
    exames.updateRule = "@request.auth.id != ''"
    exames.deleteRule = "@request.auth.id != ''"
    app.save(exames)

    // 4. Garantir campos e regras na coleção `prescricoes` (BL-019)
    const prescricoes = app.findCollectionByNameOrId('prescricoes')
    const camposPrescricoes = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'profissional_id', type: 'text' },
      {
        name: 'tipo_documento',
        type: 'select',
        values: [
          'receituario_simples',
          'receituario_controle_especial',
          'atestado_comparecimento',
          'atestado_afastamento',
          'orientacao_pos_operatoria',
        ],
        maxSelect: 1,
      },
      { name: 'data', type: 'text' },
      { name: 'dias_afastamento', type: 'number' },
      { name: 'cid10', type: 'text' },
      { name: 'medicamentos', type: 'json' }, // [{ medicamento, dosagem, via, posologia, duracao, quantidade }]
      { name: 'instrucoes', type: 'text' },
      { name: 'dentista_nome', type: 'text' },
      { name: 'cro', type: 'text' },
      { name: 'cro_uf', type: 'text' },
      { name: 'assinatura_digital_hash', type: 'text' },
      { name: 'emitido_em', type: 'text' },
    ]

    for (const c of camposPrescricoes) {
      const existing = prescricoes.fields.getByName(c.name)
      if (!existing) {
        if (c.type === 'text') prescricoes.fields.add(new TextField({ name: c.name }))
        else if (c.type === 'number') prescricoes.fields.add(new NumberField({ name: c.name }))
        else if (c.type === 'json') prescricoes.fields.add(new JSONField({ name: c.name }))
        else if (c.type === 'select') {
          prescricoes.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      } else if (c.type === 'select' && c.values) {
        existing.values = c.values
      }
    }
    prescricoes.listRule = "@request.auth.id != ''"
    prescricoes.viewRule = "@request.auth.id != ''"
    prescricoes.createRule = "@request.auth.id != ''"
    prescricoes.updateRule = "@request.auth.id != ''"
    prescricoes.deleteRule = "@request.auth.id != ''"
    app.save(prescricoes)
  },
  (app) => {
    // Reversão
  },
)
