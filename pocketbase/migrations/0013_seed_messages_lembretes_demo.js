/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Buscar tenant demo
    let tenant
    try {
      tenant = app.findFirstRecordByFilter('tenants', "cnpj = '12.345.678/0001-90'")
    } catch (_) {
      try {
        tenant = app.findFirstRecordByFilter('tenants', 'ativo = true')
      } catch (__) {
        return
      }
    }
    const tenantId = tenant.id

    // Buscar unidade demo
    let unidadeId = ''
    try {
      const u = app.findFirstRecordByFilter('unidades', `tenant_id = '${tenantId}'`)
      unidadeId = u.id
    } catch (_) {}

    // Buscar pacientes demo
    let pacLucas, pacBeatriz, pacThiago, pacMariana
    try {
      pacLucas = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && nome ~ 'Lucas'`,
      )
    } catch (_) {}
    try {
      pacBeatriz = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && nome ~ 'Beatriz'`,
      )
    } catch (_) {}
    try {
      pacThiago = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && nome ~ 'Thiago'`,
      )
    } catch (_) {}
    try {
      pacMariana = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && nome ~ 'Mariana'`,
      )
    } catch (_) {}

    // Buscar alguns agendamentos
    let agLucas = null
    try {
      if (pacLucas) {
        agLucas = app.findFirstRecordByFilter(
          'agendamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pacLucas.id}'`,
        )
      }
    } catch (_) {}

    let agBeatriz = null
    try {
      if (pacBeatriz) {
        agBeatriz = app.findFirstRecordByFilter(
          'agendamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pacBeatriz.id}'`,
        )
      }
    } catch (_) {}

    const lembretes = app.findCollectionByNameOrId('messages_lembretes')

    const seedLembretes = [
      {
        tenant_id: tenantId,
        unidade_id: unidadeId,
        agendamento_id: agLucas ? agLucas.id : '',
        paciente_id: pacLucas ? pacLucas.id : '',
        destinatario_nome: pacLucas ? pacLucas.getString('nome') : 'Lucas Ferreira Alencar',
        telefone: pacLucas ? pacLucas.getString('telefone') : '(11) 99123-4567',
        mensagem:
          'Olá Lucas! Lembramos da sua consulta de Manutenção Ortodôntica amanhã às 09:00 com a Dra. Renata na Unidade Principal. Por favor, responda 1 para CONFIRMAR ou 2 para REAGENDAR.',
        canal: 'whatsapp',
        tipo_gatilho: 'confirmacao_24h',
        status: 'respondido_confirmado',
        data_envio: '2026-10-09 10:00:00',
        data_resposta: '2026-10-09 14:20:00',
        resposta_paciente: '1 - Confirmado com certeza! Estarei aí no horário.',
        tentativas: 1,
        enviado_por: 'sistema_automatico',
      },
      {
        tenant_id: tenantId,
        unidade_id: unidadeId,
        agendamento_id: agBeatriz ? agBeatriz.id : '',
        paciente_id: pacBeatriz ? pacBeatriz.id : '',
        destinatario_nome: pacBeatriz ? pacBeatriz.getString('nome') : 'Beatriz Helena Guimarães',
        telefone: pacBeatriz ? pacBeatriz.getString('telefone') : '(11) 98234-5678',
        mensagem:
          'Olá Beatriz! Sua 2ª sessão de Clareamento Dental está agendada para amanhã às 10:30 na Cadeira 1. Responda 1 para CONFIRMAR sua presença.',
        canal: 'whatsapp',
        tipo_gatilho: 'confirmacao_48h',
        status: 'entregue',
        data_envio: '2026-10-09 11:15:00',
        tentativas: 1,
        enviado_por: 'sistema_automatico',
      },
      {
        tenant_id: tenantId,
        unidade_id: unidadeId,
        destinatario_nome: pacThiago ? pacThiago.getString('nome') : 'Thiago Ribeiro de Castro',
        telefone: pacThiago ? pacThiago.getString('telefone') : '(11) 97345-6789',
        mensagem:
          'Olá Thiago! Já faz 6 meses da sua última limpeza preventiva. A saúde do seu sorriso é prioridade! Responda para agendar seu retorno preventivo semestral.',
        canal: 'whatsapp',
        tipo_gatilho: 'retorno_preventivo',
        status: 'pendente_integracao_externa',
        data_envio: '2026-10-08 15:30:00',
        tentativas: 1,
        erro_motivo:
          'Gateway WhatsApp API não conectado nesta fase (Fase 1 MVP). Mensagem retida na fila.',
        enviado_por: 'recepcao@gestecodonto.com.br',
      },
      {
        tenant_id: tenantId,
        unidade_id: unidadeId,
        destinatario_nome: pacMariana ? pacMariana.getString('nome') : 'Mariana Souza Santos',
        telefone: pacMariana ? pacMariana.getString('telefone') : '(11) 96456-7890',
        mensagem:
          'Olá Mariana, identificamos pendência financeira referente ao seu tratamento reabilitador. Entre em contato com nossa equipe para opções de parcelamento.',
        canal: 'sms',
        tipo_gatilho: 'cobranca_inadimplente',
        status: 'pendente_integracao_externa',
        data_envio: '2026-10-07 09:00:00',
        tentativas: 1,
        erro_motivo: 'Gateway SMS não conectado nesta fase (Fase 1 MVP). Mensagem retida na fila.',
        enviado_por: 'financeiro@gestecodonto.com.br',
      },
      {
        tenant_id: tenantId,
        unidade_id: unidadeId,
        destinatario_nome: pacLucas ? pacLucas.getString('nome') : 'Lucas Ferreira Alencar',
        telefone: pacLucas ? pacLucas.getString('telefone') : '(11) 99123-4567',
        mensagem:
          'Seja bem-vindo ao GesTec-IA-Odonto! Seu prontuário e histórico odontológico foram cadastrados com segurança.',
        canal: 'in_app',
        tipo_gatilho: 'boas_vindas',
        status: 'entregue',
        data_envio: '2026-10-05 14:00:00',
        tentativas: 1,
        enviado_por: 'sistema_automatico',
      },
    ]

    for (const item of seedLembretes) {
      try {
        const jaExiste = app.findFirstRecordByFilter(
          'messages_lembretes',
          `tenant_id = '${tenantId}' && destinatario_nome = '${item.destinatario_nome}' && tipo_gatilho = '${item.tipo_gatilho}'`,
        )
        if (jaExiste) continue
      } catch (_) {}

      const rec = new Record(lembretes)
      rec.set('tenant_id', item.tenant_id)
      rec.set('unidade_id', item.unidade_id || '')
      rec.set('agendamento_id', item.agendamento_id || '')
      rec.set('paciente_id', item.paciente_id || '')
      rec.set('destinatario_nome', item.destinatario_nome)
      rec.set('telefone', item.telefone)
      rec.set('mensagem', item.mensagem)
      rec.set('canal', item.canal)
      rec.set('tipo_gatilho', item.tipo_gatilho)
      rec.set('status', item.status)
      rec.set('data_envio', item.data_envio || '')
      rec.set('data_resposta', item.data_resposta || '')
      rec.set('resposta_paciente', item.resposta_paciente || '')
      rec.set('tentativas', item.tentativas || 1)
      rec.set('erro_motivo', item.erro_motivo || '')
      rec.set('enviado_por', item.enviado_por || '')
      app.save(rec)
    }
  },
  (app) => {
    // Reversão
  },
)
