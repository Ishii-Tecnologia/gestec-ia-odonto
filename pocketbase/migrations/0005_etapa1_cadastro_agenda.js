/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Inspecionar e restaurar/garantir todos os campos de `pacientes`
    const pacientes = app.findCollectionByNameOrId('pacientes')

    const camposPacientes = [
      { name: 'tenant_id', type: 'text', required: false },
      { name: 'unidade_id', type: 'text', required: false },
      { name: 'nome', type: 'text', required: false },
      { name: 'cpf', type: 'text', required: false },
      { name: 'data_nascimento', type: 'text', required: false },
      { name: 'telefone', type: 'text', required: false },
      { name: 'email', type: 'text', required: false },
      { name: 'endereco', type: 'text', required: false },
      {
        name: 'genero',
        type: 'select',
        values: ['masculino', 'feminino', 'outro', 'nao_informado'],
        maxSelect: 1,
        required: false,
      },
      { name: 'convenio', type: 'text', required: false },
      { name: 'responsavel_legal', type: 'text', required: false },
      { name: 'responsavel_cpf', type: 'text', required: false },
      { name: 'score_evasao', type: 'number', required: false },
      {
        name: 'status',
        type: 'select',
        values: ['ativo', 'inativo', 'em-tratamento'],
        maxSelect: 1,
        required: false,
      },
      { name: 'tags', type: 'json', required: false },
      { name: 'observacoes', type: 'text', required: false },
    ]

    for (const c of camposPacientes) {
      if (!pacientes.fields.getByName(c.name)) {
        if (c.type === 'text') {
          pacientes.fields.add(new TextField({ name: c.name, required: c.required }))
        } else if (c.type === 'number') {
          pacientes.fields.add(new NumberField({ name: c.name, required: c.required }))
        } else if (c.type === 'select') {
          pacientes.fields.add(
            new SelectField({
              name: c.name,
              values: c.values,
              maxSelect: c.maxSelect,
              required: c.required,
            }),
          )
        } else if (c.type === 'json') {
          pacientes.fields.add(new JSONField({ name: c.name, required: c.required }))
        }
      }
    }

    pacientes.listRule = "@request.auth.id != ''"
    pacientes.viewRule = "@request.auth.id != ''"
    pacientes.createRule = "@request.auth.id != ''"
    pacientes.updateRule = "@request.auth.id != ''"
    pacientes.deleteRule = "@request.auth.id != ''"

    app.save(pacientes)

    // 2. Inspecionar e restaurar/garantir todos os campos de `agendamentos`
    const agendamentos = app.findCollectionByNameOrId('agendamentos')

    const camposAgendamentos = [
      { name: 'tenant_id', type: 'text', required: false },
      { name: 'unidade_id', type: 'text', required: false },
      { name: 'sala_id', type: 'text', required: false },
      { name: 'paciente_id', type: 'text', required: false },
      { name: 'profissional_id', type: 'text', required: false },
      { name: 'procedimento', type: 'text', required: false },
      { name: 'duracao_minutos', type: 'number', required: false },
      { name: 'data_inicio', type: 'text', required: false },
      { name: 'data_fim', type: 'text', required: false },
      { name: 'sala', type: 'text', required: false },
      {
        name: 'tipo_consulta',
        type: 'select',
        values: ['primeira_consulta', 'retorno', 'procedimento', 'urgencia', 'avaliacao'],
        maxSelect: 1,
        required: false,
      },
      {
        name: 'status',
        type: 'select',
        values: [
          'pendente',
          'confirmado',
          'presente',
          'em_atendimento',
          'concluido',
          'cancelado',
          'falta',
        ],
        maxSelect: 1,
        required: false,
      },
      {
        name: 'confirmacao_status',
        type: 'select',
        values: ['pendente', 'confirmado', 'nao_confirmou', 'no_show'],
        maxSelect: 1,
        required: false,
      },
      { name: 'tentativa_confirmacao_em', type: 'text', required: false },
      { name: 'confirmado_em', type: 'text', required: false },
      { name: 'motivo_cancelamento_ou_falta', type: 'text', required: false },
      {
        name: 'origem',
        type: 'select',
        values: ['recepcao', 'online', 'retorno'],
        maxSelect: 1,
        required: false,
      },
      { name: 'recorrencia', type: 'json', required: false },
      { name: 'observacoes', type: 'text', required: false },
    ]

    for (const c of camposAgendamentos) {
      if (!agendamentos.fields.getByName(c.name)) {
        if (c.type === 'text') {
          agendamentos.fields.add(new TextField({ name: c.name, required: c.required }))
        } else if (c.type === 'number') {
          agendamentos.fields.add(new NumberField({ name: c.name, required: c.required }))
        } else if (c.type === 'select') {
          agendamentos.fields.add(
            new SelectField({
              name: c.name,
              values: c.values,
              maxSelect: c.maxSelect,
              required: c.required,
            }),
          )
        } else if (c.type === 'json') {
          agendamentos.fields.add(new JSONField({ name: c.name, required: c.required }))
        }
      }
    }

    agendamentos.listRule = "@request.auth.id != ''"
    agendamentos.viewRule = "@request.auth.id != ''"
    agendamentos.createRule = "@request.auth.id != ''"
    agendamentos.updateRule = "@request.auth.id != ''"
    agendamentos.deleteRule = "@request.auth.id != ''"

    app.save(agendamentos)
  },
  (app) => {
    // Reversão
  },
)
