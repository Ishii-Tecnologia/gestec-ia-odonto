/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const lembretes = app.findCollectionByNameOrId('messages_lembretes')

    // Garantir campos para comunicação e lembretes (BL-010)
    const camposLembretes = [
      { name: 'tenant_id', type: 'text' },
      { name: 'unidade_id', type: 'text' },
      { name: 'agendamento_id', type: 'text' },
      { name: 'paciente_id', type: 'text' },
      { name: 'destinatario_nome', type: 'text' },
      { name: 'telefone', type: 'text' },
      { name: 'mensagem', type: 'text' },
      {
        name: 'canal',
        type: 'select',
        values: ['whatsapp', 'sms', 'in_app'],
        maxSelect: 1,
      },
      {
        name: 'tipo_gatilho',
        type: 'select',
        values: [
          'confirmacao_48h',
          'confirmacao_24h',
          'retorno_preventivo',
          'cobranca_inadimplente',
          'lembrete_manual',
          'boas_vindas',
        ],
        maxSelect: 1,
      },
      {
        name: 'status',
        type: 'select',
        values: [
          'agendado',
          'enviado',
          'entregue',
          'respondido_confirmado',
          'respondido_reagendar',
          'pendente_integracao_externa',
          'falhou',
        ],
        maxSelect: 1,
      },
      { name: 'data_envio', type: 'text' },
      { name: 'data_resposta', type: 'text' },
      { name: 'resposta_paciente', type: 'text' },
      { name: 'tentativas', type: 'number' },
      { name: 'erro_motivo', type: 'text' },
      { name: 'enviado_por', type: 'text' },
    ]

    for (const c of camposLembretes) {
      const existingField = lembretes.fields.getByName(c.name)
      if (!existingField) {
        if (c.type === 'text') {
          lembretes.fields.add(new TextField({ name: c.name }))
        } else if (c.type === 'number') {
          lembretes.fields.add(new NumberField({ name: c.name }))
        } else if (c.type === 'select') {
          lembretes.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
        }
      } else if (c.type === 'select') {
        // Atualizar lista de valores do select se expandida
        existingField.values = c.values
      }
    }

    // Regras de acesso para messages_lembretes: autenticados para list, view, create, update e delete
    lembretes.listRule = "@request.auth.id != ''"
    lembretes.viewRule = "@request.auth.id != ''"
    lembretes.createRule = "@request.auth.id != ''"
    lembretes.updateRule = "@request.auth.id != ''"
    lembretes.deleteRule = "@request.auth.id != ''"

    app.save(lembretes)
  },
  (app) => {
    // Reversão
  },
)
