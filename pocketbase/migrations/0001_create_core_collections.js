/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Atualizar a coleção users com campos de tenant_id e perfil (owner, dentista, recepcao, financeiro, asb)
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(
    new TextField({
      name: 'tenant_id',
      required: false,
    }),
  )
  users.fields.add(
    new SelectField({
      name: 'perfil',
      values: ['owner', 'dentista', 'recepcao', 'financeiro', 'asb'],
      maxSelect: 1,
      required: false,
    }),
  )
  users.fields.add(
    new TextField({
      name: 'cro',
      required: false,
    }),
  )
  app.save(users)

  // 2. Tenants (base)
  const tenants = new Collection({
    name: 'tenants',
    type: 'base',
    fields: [
      new TextField({ name: 'nome', required: true }),
      new TextField({ name: 'razao_social', required: false }),
      new TextField({ name: 'cnpj', required: false }),
      new SelectField({
        name: 'plano',
        values: ['consultorio-essencial', 'suite-clinica', 'suite-gestao', 'suite-completa'],
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'modulos_ativos', required: false }),
      new JSONField({ name: 'limites', required: false }),
      new BoolField({ name: 'ativo', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: null,
  })
  app.save(tenants)

  // 3. Profissionais
  const profissionais = new Collection({
    name: 'profissionais',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'user_id',
        collectionId: users.id,
        maxSelect: 1,
        required: false,
      }),
      new TextField({ name: 'nome', required: true }),
      new TextField({ name: 'cro', required: true }),
      new TextField({ name: 'especialidade', required: false }),
      new TextField({ name: 'telefone', required: false }),
      new TextField({ name: 'email', required: false }),
      new NumberField({ name: 'comissao_percentual', required: false }),
      new TextField({ name: 'cor_agenda', required: false }),
      new BoolField({ name: 'ativo', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(profissionais)

  // 4. Pacientes
  const pacientes = new Collection({
    name: 'pacientes',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new TextField({ name: 'nome', required: true }),
      new TextField({ name: 'cpf', required: false }),
      new TextField({ name: 'data_nascimento', required: false }),
      new TextField({ name: 'telefone', required: false }),
      new TextField({ name: 'email', required: false }),
      new TextField({ name: 'endereco', required: false }),
      new TextField({ name: 'responsavel_legal', required: false }),
      new NumberField({ name: 'score_evasao', required: false }),
      new SelectField({
        name: 'status',
        values: ['ativo', 'inativo', 'em-tratamento'],
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'tags', required: false }),
      new TextField({ name: 'observacoes', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(pacientes)

  // 5. Vínculos Familiares (BL-020)
  const vinculos = new Collection({
    name: 'vinculos_familiares',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new RelationField({
        name: 'responsavel_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new SelectField({
        name: 'parentesco',
        values: ['pai', 'mae', 'conjuge', 'filho', 'tutor', 'outro'],
        maxSelect: 1,
        required: true,
      }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(vinculos)

  // 6. Procedimentos Clínicos (Catálogo/Tabela Própria)
  const procedimentos = new Collection({
    name: 'procedimentos',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new TextField({ name: 'codigo', required: false }),
      new TextField({ name: 'nome', required: true }),
      new TextField({ name: 'descricao', required: false }),
      new NumberField({ name: 'duracao_minutos', required: true }),
      new NumberField({ name: 'valor', required: true }),
      new SelectField({
        name: 'categoria',
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
        required: false,
      }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(procedimentos)

  // 7. Agendamentos
  const agendamentos = new Collection({
    name: 'agendamentos',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new RelationField({
        name: 'profissional_id',
        collectionId: profissionais.id,
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'procedimento', required: true }),
      new NumberField({ name: 'duracao_minutos', required: false }),
      new TextField({ name: 'data_inicio', required: true }), // ISO String YYYY-MM-DDTHH:mm:ss
      new TextField({ name: 'data_fim', required: true }),
      new TextField({ name: 'sala', required: false }), // Cadeira 1, Cadeira 2, etc.
      new SelectField({
        name: 'status',
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
        required: true,
      }),
      new SelectField({
        name: 'origem',
        values: ['recepcao', 'online', 'retorno'],
        maxSelect: 1,
        required: false,
      }),
      new JSONField({ name: 'recorrencia', required: false }),
      new TextField({ name: 'observacoes', required: false }),
    ],
    listRule: '', // Permite leitura pública filtrada ou autenticada
    viewRule: '',
    createRule: '', // Agendamento online público cria sem auth
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(agendamentos)

  // 8. Fila de Espera
  const filaEspera = new Collection({
    name: 'filas_espera',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new RelationField({
        name: 'profissional_id',
        collectionId: profissionais.id,
        maxSelect: 1,
        required: false,
      }),
      new TextField({ name: 'data_desejada', required: false }),
      new NumberField({ name: 'prioridade', required: false }),
      new SelectField({
        name: 'status',
        values: ['aguardando', 'ofertado', 'atendido', 'cancelado'],
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'observacoes', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(filaEspera)

  // 9. Odontogramas Snapshots (Append-only histórico de dentes/faces)
  const odontogramas = new Collection({
    name: 'odontogramas_snapshots',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'data', required: true }),
      new TextField({ name: 'atendimento_id', required: false }),
      new JSONField({ name: 'payload', required: true }), // Mapa de dente -> faces -> procedimento
      new TextField({ name: 'dentista_nome', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null, // Imutável! Snapshot não se edita
    deleteRule: null,
    indexes: [],
  })
  app.save(odontogramas)

  // 10. Evoluções Clínicas (Append-only)
  const evolucoes = new Collection({
    name: 'evolucoes_clinicas',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'data', required: true }),
      new SelectField({
        name: 'especialidade',
        values: [
          'geral',
          'exodontia',
          'endodontia',
          'ortodontia',
          'periodontia',
          'protese',
          'implantodontia',
        ],
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'descricao', required: true }),
      new TextField({ name: 'dentista_nome', required: false }),
      new TextField({ name: 'cro', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null, // Imutável: nunca sobrescrever evolução clínica
    deleteRule: null,
    indexes: [],
  })
  app.save(evolucoes)

  // 11. Anamneses Digitais (Versionadas / congeladas)
  const anamneses = new Collection({
    name: 'anamneses',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'perguntas', required: true }),
      new JSONField({ name: 'respostas', required: false }),
      new SelectField({
        name: 'status',
        values: ['pendente', 'respondida', 'assinada'],
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'token', required: false }),
      new TextField({ name: 'data_resposta', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: '', // Leitura pública via token
    createRule: "@request.auth.id != ''",
    updateRule: '', // Paciente atualiza via link seguro com token
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(anamneses)

  // 12. Planos de Tratamento
  const planos = new Collection({
    name: 'planos_tratamento',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'titulo', required: true }),
      new SelectField({
        name: 'status',
        values: ['rascunho', 'aprovado', 'em_andamento', 'concluido', 'recusado'],
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'fases', required: true }), // Fases e itens de procedimento
      new NumberField({ name: 'valor_total', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(planos)

  // 13. Orçamentos
  const orcamentos = new Collection({
    name: 'orcamentos',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new RelationField({
        name: 'plano_id',
        collectionId: planos.id,
        maxSelect: 1,
        required: false,
      }),
      new NumberField({ name: 'valor_bruto', required: true }),
      new NumberField({ name: 'desconto_percentual', required: false }),
      new NumberField({ name: 'valor_liquido', required: true }),
      new NumberField({ name: 'parcelas', required: true }),
      new SelectField({
        name: 'status',
        values: ['rascunho', 'negociacao', 'aprovado', 'recusado', 'vencido'],
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'itens', required: true }),
      new JSONField({ name: 'assinatura', required: false }), // Timestamp, IP, nome rubricado
      new TextField({ name: 'validade', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(orcamentos)

  // 14. Lançamentos Financeiros (A receber, Pix, Cartão, Split de pagamento)
  const lancamentos = new Collection({
    name: 'lancamentos_financeiros',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: false,
      }),
      new RelationField({
        name: 'orcamento_id',
        collectionId: orcamentos.id,
        maxSelect: 1,
        required: false,
      }),
      new TextField({ name: 'descricao', required: true }),
      new SelectField({
        name: 'tipo',
        values: ['receber', 'pagar'],
        maxSelect: 1,
        required: true,
      }),
      new NumberField({ name: 'valor', required: true }),
      new TextField({ name: 'vencimento', required: true }),
      new SelectField({
        name: 'status',
        values: ['aberto', 'pago', 'parcial', 'vencido', 'cancelado'],
        maxSelect: 1,
        required: true,
      }),
      new JSONField({ name: 'modalidades', required: false }), // Split: [{ modalidade: 'pix', valor: 200 }, ...]
      new TextField({ name: 'data_pagamento', required: false }),
      new NumberField({ name: 'valor_pago', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(lancamentos)

  // 15. Mensagens / Lembretes WhatsApp (Simulação e Fila da Etapa 4)
  const lembretes = new Collection({
    name: 'messages_lembretes',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'agendamento_id',
        collectionId: agendamentos.id,
        maxSelect: 1,
        required: false,
      }),
      new TextField({ name: 'destinatario_nome', required: true }),
      new TextField({ name: 'telefone', required: true }),
      new TextField({ name: 'mensagem', required: true }),
      new SelectField({
        name: 'canal',
        values: ['whatsapp', 'sms'],
        maxSelect: 1,
        required: true,
      }),
      new SelectField({
        name: 'tipo_gatilho',
        values: [
          'confirmacao_48h',
          'confirmacao_24h',
          'retorno_preventivo',
          'cobranca_inadimplente',
        ],
        maxSelect: 1,
        required: true,
      }),
      new SelectField({
        name: 'status',
        values: [
          'agendado',
          'enviado',
          'entregue',
          'respondido_confirmado',
          'respondido_reagendar',
          'falhou',
        ],
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'data_envio', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(lembretes)

  // 16. Exames e Anexos (BL-015)
  const anexos = new Collection({
    name: 'exames_anexos',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new FileField({
        name: 'arquivo',
        maxSelect: 1,
        maxSize: 52428800, // 50MB
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        required: false,
      }),
      new SelectField({
        name: 'tipo',
        values: ['raiox', 'foto_clinica', 'documento', 'laudo'],
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'descricao', required: true }),
      new TextField({ name: 'data_exame', required: false }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    indexes: [],
  })
  app.save(anexos)

  // 17. Prescrições de Medicamentos (BL-019)
  const prescricoes = new Collection({
    name: 'prescricoes',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new RelationField({
        name: 'paciente_id',
        collectionId: pacientes.id,
        maxSelect: 1,
        required: true,
      }),
      new TextField({ name: 'data', required: true }),
      new JSONField({ name: 'medicamentos', required: true }),
      new TextField({ name: 'instrucoes', required: false }),
      new TextField({ name: 'dentista_nome', required: true }),
      new TextField({ name: 'cro', required: true }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  })
  app.save(prescricoes)

  // 18. Auditoria de Acesso LGPD (BL-011 - Imutável)
  const auditoria = new Collection({
    name: 'auditoria_acesso',
    type: 'base',
    fields: [
      new TextField({ name: 'tenant_id', required: true }),
      new TextField({ name: 'user_id', required: false }),
      new TextField({ name: 'user_email', required: false }),
      new TextField({ name: 'perfil', required: false }),
      new TextField({ name: 'target_patient_id', required: false }),
      new TextField({ name: 'acao', required: true }), // ex: 'visualizou_prontuario', 'criou_evolucao'
      new TextField({ name: 'detalhes', required: false }),
      new TextField({ name: 'ip', required: false }),
      new TextField({ name: 'timestamp', required: true }),
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: null, // Proibido atualizar log de auditoria
    deleteRule: null, // Proibido deletar log de auditoria
    indexes: [],
  })
  app.save(auditoria)
})
