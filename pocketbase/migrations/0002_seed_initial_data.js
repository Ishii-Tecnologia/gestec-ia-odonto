/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Criar Tenant Demonstração
  const tenants = app.findCollectionByNameOrId('tenants')
  let demoTenant
  try {
    demoTenant = app.findFirstRecordByFilter('tenants', "nome = 'Clínica OdontoDemo Matriz'")
  } catch (e) {
    demoTenant = null
  }

  if (!demoTenant) {
    demoTenant = new Record(tenants)
    demoTenant.set('nome', 'Clínica OdontoDemo Matriz')
    demoTenant.set('razao_social', 'OdontoDemo Gestão e Saúde Bucal Ltda')
    demoTenant.set('cnpj', '12.345.678/0001-90')
    demoTenant.set('plano', 'suite-completa')
    demoTenant.set('modulos_ativos', {
      core: true,
      agenda: true,
      pacientes: true,
      prontuario: true,
      orcamentos: true,
      financeiro: true,
      relatorios: true,
      lembretes: true,
    })
    demoTenant.set('limites', {
      profissionais_max: 10,
      cadeiras_max: 4,
      mensagens_mes: 500,
    })
    demoTenant.set('ativo', true)
    app.save(demoTenant)
  }

  const tenantId = demoTenant.id

  // 2. Criar Usuários padrão com senha Skip@Pass123
  const users = app.findCollectionByNameOrId('users')

  const seedUsers = [
    {
      email: 'owner@gestecodonto.com.br',
      name: 'Dra. Renata Vasconcelos',
      perfil: 'owner',
      cro: 'CRO-SP 89234',
    },
    {
      email: 'dentista@gestecodonto.com.br',
      name: 'Dr. Marcelo Siqueira',
      perfil: 'dentista',
      cro: 'CRO-SP 104552',
    },
    { email: 'recepcao@gestecodonto.com.br', name: 'Camila Nogueira', perfil: 'recepcao', cro: '' },
    {
      email: 'financeiro@gestecodonto.com.br',
      name: 'Eduardo Ribeiro',
      perfil: 'financeiro',
      cro: '',
    },
    { email: 'asb@gestecodonto.com.br', name: 'Juliana Mendes', perfil: 'asb', cro: '' },
  ]

  const createdUserRecords = {}

  for (const u of seedUsers) {
    let rec
    try {
      rec = app.findAuthRecordByEmail('users', u.email)
    } catch (e) {
      rec = null
    }
    if (!rec) {
      rec = new Record(users)
      rec.set('email', u.email)
      rec.set('name', u.name)
      rec.setPassword('Skip@Pass123')
      rec.set('verified', true)
      rec.set('tenant_id', tenantId)
      rec.set('perfil', u.perfil)
      rec.set('cro', u.cro)
      app.save(rec)
    }
    createdUserRecords[u.perfil] = rec
  }

  // 3. Criar Profissionais
  const profissionais = app.findCollectionByNameOrId('profissionais')
  const seedProfs = [
    {
      nome: 'Dra. Renata Vasconcelos',
      cro: 'CRO-SP 89234',
      especialidade: 'Ortodontia e Reabilitação Oral',
      email: 'owner@gestecodonto.com.br',
      telefone: '(11) 98765-4321',
      comissao: 50,
      cor: '#0E7490',
      userRecord: createdUserRecords['owner'],
    },
    {
      nome: 'Dr. Marcelo Siqueira',
      cro: 'CRO-SP 104552',
      especialidade: 'Endodontia e Cirurgia',
      email: 'dentista@gestecodonto.com.br',
      telefone: '(11) 97654-3210',
      comissao: 45,
      cor: '#0284C7',
      userRecord: createdUserRecords['dentista'],
    },
  ]

  const profRecords = []
  for (const p of seedProfs) {
    let prof
    try {
      prof = app.findFirstRecordByFilter(
        'profissionais',
        `tenant_id = '${tenantId}' && cro = '${p.cro}'`,
      )
    } catch (e) {
      prof = null
    }
    if (!prof) {
      prof = new Record(profissionais)
      prof.set('tenant_id', tenantId)
      if (p.userRecord) prof.set('user_id', p.userRecord.id)
      prof.set('nome', p.nome)
      prof.set('cro', p.cro)
      prof.set('especialidade', p.especialidade)
      prof.set('email', p.email)
      prof.set('telefone', p.telefone)
      prof.set('comissao_percentual', p.comissao)
      prof.set('cor_agenda', p.cor)
      prof.set('ativo', true)
      app.save(prof)
    }
    profRecords.push(prof)
  }

  // 4. Procedimentos Clínicos Típicos
  const procedimentos = app.findCollectionByNameOrId('procedimentos')
  const seedProcs = [
    {
      codigo: 'OD-001',
      nome: 'Avaliação Inicial e Diagnóstico',
      categoria: 'diagnostico',
      duracao: 30,
      valor: 150,
    },
    {
      codigo: 'OD-002',
      nome: 'Profilaxia e Remoção de Tártaro',
      categoria: 'prevencao',
      duracao: 45,
      valor: 220,
    },
    {
      codigo: 'OD-003',
      nome: 'Restauração em Resina Composta (1 Face)',
      categoria: 'restauradora',
      duracao: 45,
      valor: 280,
    },
    {
      codigo: 'OD-004',
      nome: 'Restauração em Resina Composta (2 Faces)',
      categoria: 'restauradora',
      duracao: 60,
      valor: 360,
    },
    {
      codigo: 'OD-005',
      nome: 'Tratamento Endodôntico Unirradicular',
      categoria: 'endodontia',
      duracao: 90,
      valor: 750,
    },
    {
      codigo: 'OD-006',
      nome: 'Tratamento Endodôntico Multirradicular',
      categoria: 'endodontia',
      duracao: 90,
      valor: 1200,
    },
    {
      codigo: 'OD-007',
      nome: 'Exodontia Simples de Dente Permanente',
      categoria: 'cirurgia',
      duracao: 45,
      valor: 320,
    },
    {
      codigo: 'OD-008',
      nome: 'Exodontia de Terceiro Molar Incluso',
      categoria: 'cirurgia',
      duracao: 75,
      valor: 650,
    },
    {
      codigo: 'OD-009',
      nome: 'Clareamento Dental de Consultório',
      categoria: 'estetica',
      duracao: 60,
      valor: 900,
    },
    {
      codigo: 'OD-010',
      nome: 'Instalação de Aparelho Ortodôntico Metálico',
      categoria: 'ortodontia',
      duracao: 60,
      valor: 800,
    },
  ]

  for (const pr of seedProcs) {
    let proc
    try {
      proc = app.findFirstRecordByFilter(
        'procedimentos',
        `tenant_id = '${tenantId}' && codigo = '${pr.codigo}'`,
      )
    } catch (e) {
      proc = null
    }
    if (!proc) {
      proc = new Record(procedimentos)
      proc.set('tenant_id', tenantId)
      proc.set('codigo', pr.codigo)
      proc.set('nome', pr.nome)
      proc.set('descricao', pr.nome)
      proc.set('categoria', pr.categoria)
      proc.set('duracao_minutos', pr.duracao)
      proc.set('valor', pr.valor)
      app.save(proc)
    }
  }

  // 5. Pacientes Iniciais
  const pacientes = app.findCollectionByNameOrId('pacientes')
  const seedPacientes = [
    {
      nome: 'Lucas Ferreira Alencar',
      cpf: '123.456.789-01',
      data_nascimento: '1992-05-14',
      telefone: '(11) 99123-4567',
      email: 'lucas.alencar@exemplo.com',
      endereco: 'Av. Paulista, 1500, Ap 42, Bela Vista, São Paulo - SP',
      status: 'ativo',
      score_evasao: 12,
      tags: ['Ortodontia', 'Retorno Semestral'],
    },
    {
      nome: 'Beatriz Helena Guimarães',
      cpf: '234.567.890-12',
      data_nascimento: '1988-11-20',
      telefone: '(11) 98234-5678',
      email: 'beatriz.guimaraes@exemplo.com',
      endereco: 'Rua Vergueiro, 980, Aclimação, São Paulo - SP',
      status: 'em-tratamento',
      score_evasao: 25,
      tags: ['Estética', 'Alto Valor'],
    },
    {
      nome: 'Thiago Ribeiro de Castro',
      cpf: '345.678.901-23',
      data_nascimento: '2010-02-08',
      telefone: '(11) 97345-6789',
      email: 'pais.thiago@exemplo.com',
      responsavel_legal: 'Fernanda Castro (Mãe)',
      endereco: 'Rua Pamplona, 450, Jardim Paulista, São Paulo - SP',
      status: 'ativo',
      score_evasao: 5,
      tags: ['Odontopediatria', 'Preventivo'],
    },
    {
      nome: 'Mariana Souza Santos',
      cpf: '456.789.012-34',
      data_nascimento: '1975-08-30',
      telefone: '(11) 96456-7890',
      email: 'mariana.santos@exemplo.com',
      endereco: 'Rua Augusta, 1200, Consolação, São Paulo - SP',
      status: 'inativo',
      score_evasao: 88, // Alto risco de evasão (inativo)
      tags: ['Risco de Evasão', 'Reabilitação'],
    },
  ]

  const pacRecords = []
  for (const pc of seedPacientes) {
    let p
    try {
      p = app.findFirstRecordByFilter('pacientes', `tenant_id = '${tenantId}' && cpf = '${pc.cpf}'`)
    } catch (e) {
      p = null
    }
    if (!p) {
      p = new Record(pacientes)
      p.set('tenant_id', tenantId)
      p.set('nome', pc.nome)
      p.set('cpf', pc.cpf)
      p.set('data_nascimento', pc.data_nascimento)
      p.set('telefone', pc.telefone)
      p.set('email', pc.email)
      p.set('endereco', pc.endereco)
      p.set('responsavel_legal', pc.responsavel_legal || '')
      p.set('status', pc.status)
      p.set('score_evasao', pc.score_evasao)
      p.set('tags', pc.tags)
      app.save(p)
    }
    pacRecords.push(p)
  }

  // 6. Agendamentos Iniciais
  const agendamentos = app.findCollectionByNameOrId('agendamentos')
  const today = new Date().toISOString().slice(0, 10)

  const seedAgendamentos = [
    {
      paciente: pacRecords[0],
      prof: profRecords[0],
      procedimento: 'Manutenção Ortodôntica Mensal',
      duracao: 45,
      data_inicio: `${today}T09:00:00`,
      data_fim: `${today}T09:45:00`,
      sala: 'Cadeira 1 - Ortodontia',
      status: 'confirmado',
      origem: 'recepcao',
    },
    {
      paciente: pacRecords[1],
      prof: profRecords[0],
      procedimento: 'Clareamento Dental de Consultório',
      duracao: 60,
      data_inicio: `${today}T10:00:00`,
      data_fim: `${today}T11:00:00`,
      sala: 'Cadeira 1 - Ortodontia',
      status: 'presente',
      origem: 'recepcao',
    },
    {
      paciente: pacRecords[2],
      prof: profRecords[1],
      procedimento: 'Profilaxia e Aplicação Tópica de Flúor',
      duracao: 45,
      data_inicio: `${today}T11:00:00`,
      data_fim: `${today}T11:45:00`,
      sala: 'Cadeira 2 - Clínica Geral',
      status: 'pendente',
      origem: 'online',
    },
    {
      paciente: pacRecords[0],
      prof: profRecords[1],
      procedimento: 'Avaliação de Extração Sisos',
      duracao: 30,
      data_inicio: `${today}T14:00:00`,
      data_fim: `${today}T14:30:00`,
      sala: 'Cadeira 2 - Clínica Geral',
      status: 'confirmado',
      origem: 'recepcao',
    },
  ]

  for (const ag of seedAgendamentos) {
    if (!ag.paciente || !ag.prof) continue
    let rec
    try {
      rec = app.findFirstRecordByFilter(
        'agendamentos',
        `tenant_id = '${tenantId}' && paciente_id = '${ag.paciente.id}' && data_inicio = '${ag.data_inicio}'`,
      )
    } catch (e) {
      rec = null
    }
    if (!rec) {
      rec = new Record(agendamentos)
      rec.set('tenant_id', tenantId)
      rec.set('paciente_id', ag.paciente.id)
      rec.set('profissional_id', ag.prof.id)
      rec.set('procedimento', ag.procedimento)
      rec.set('duracao_minutos', ag.duracao)
      rec.set('data_inicio', ag.data_inicio)
      rec.set('data_fim', ag.data_fim)
      rec.set('sala', ag.sala)
      rec.set('status', ag.status)
      rec.set('origem', ag.origem)
      app.save(rec)
    }
  }

  // 7. Odontograma Snapshot Inicial (Dente 16, 21, 36 com intervenções no paciente 1)
  const odontogramas = app.findCollectionByNameOrId('odontogramas_snapshots')
  if (pacRecords[1]) {
    let snap
    try {
      snap = app.findFirstRecordByFilter(
        'odontogramas_snapshots',
        `paciente_id = '${pacRecords[1].id}'`,
      )
    } catch (e) {
      snap = null
    }
    if (!snap) {
      snap = new Record(odontogramas)
      snap.set('tenant_id', tenantId)
      snap.set('paciente_id', pacRecords[1].id)
      snap.set('data', today)
      snap.set('dentista_nome', 'Dra. Renata Vasconcelos')
      snap.set('payload', {
        16: {
          status: 'restauracao',
          faces: ['O', 'M'],
          cor: '#2563EB',
          detalhe: 'Resina composta O/M',
        },
        21: {
          status: 'facetas',
          faces: ['V'],
          cor: '#7C3AED',
          detalhe: 'Faceta estética cerâmica',
        },
        36: {
          status: 'endodontia',
          faces: ['O'],
          cor: '#DC2626',
          detalhe: 'Canal tratado satisfatório',
        },
      })
      app.save(snap)
    }
  }

  // 8. Evolução Clínica Inicial (Append-only)
  const evolucoes = app.findCollectionByNameOrId('evolucoes_clinicas')
  if (pacRecords[1]) {
    let ev
    try {
      ev = app.findFirstRecordByFilter('evolucoes_clinicas', `paciente_id = '${pacRecords[1].id}'`)
    } catch (e) {
      ev = null
    }
    if (!ev) {
      ev = new Record(evolucoes)
      ev.set('tenant_id', tenantId)
      ev.set('paciente_id', pacRecords[1].id)
      ev.set('data', `${today} 10:45`)
      ev.set('especialidade', 'estetica')
      ev.set('dentista_nome', 'Dra. Renata Vasconcelos')
      ev.set('cro', 'CRO-SP 89234')
      ev.set(
        'descricao',
        'Realizada 1ª sessão de clareamento dental de consultório com Peróxido de Hidrogênio a 35%. Paciente não referiu sensibilidade durante a aplicação. Orientada dieta sem corantes por 48 horas.',
      )
      app.save(ev)
    }
  }

  // 9. Orçamento Inicial
  const orcamentos = app.findCollectionByNameOrId('orcamentos')
  if (pacRecords[0]) {
    let orc
    try {
      orc = app.findFirstRecordByFilter('orcamentos', `paciente_id = '${pacRecords[0].id}'`)
    } catch (e) {
      orc = null
    }
    if (!orc) {
      orc = new Record(orcamentos)
      orc.set('tenant_id', tenantId)
      orc.set('paciente_id', pacRecords[0].id)
      orc.set('valor_bruto', 2800)
      orc.set('desconto_percentual', 10)
      orc.set('valor_liquido', 2520)
      orc.set('parcelas', 6)
      orc.set('status', 'aprovado')
      orc.set('validade', '2026-11-30')
      orc.set('assinatura', {
        rubrica: 'Lucas Ferreira Alencar',
        data_hora: `${today}T09:40:00Z`,
        ip: '189.120.45.12',
        valido: true,
      })
      orc.set('itens', [
        {
          dente: 'Arcada Superior',
          procedimento: 'Aparelho Ortodôntico Fixo Autoligado',
          valor: 1400,
        },
        {
          dente: 'Arcada Inferior',
          procedimento: 'Aparelho Ortodôntico Fixo Autoligado',
          valor: 1400,
        },
      ])
      app.save(orc)
    }
  }

  // 10. Lançamentos Financeiros Iniciais
  const lancamentos = app.findCollectionByNameOrId('lancamentos_financeiros')
  if (pacRecords[0]) {
    let lanc
    try {
      lanc = app.findFirstRecordByFilter(
        'lancamentos_financeiros',
        `paciente_id = '${pacRecords[0].id}'`,
      )
    } catch (e) {
      lanc = null
    }
    if (!lanc) {
      lanc = new Record(lancamentos)
      lanc.set('tenant_id', tenantId)
      lanc.set('paciente_id', pacRecords[0].id)
      lanc.set('descricao', 'Tratamento Ortodôntico - Parcela 1/6')
      lanc.set('tipo', 'receber')
      lanc.set('valor', 420)
      lanc.set('vencimento', today)
      lanc.set('status', 'pago')
      lanc.set('data_pagamento', `${today}T10:15:00Z`)
      lanc.set('valor_pago', 420)
      lanc.set('modalidades', [
        { modalidade: 'pix', valor: 420, comprovante: 'E904008239042398402' },
      ])
      app.save(lanc)

      // Parcela 2 em aberto
      const lanc2 = new Record(lancamentos)
      lanc2.set('tenant_id', tenantId)
      lanc2.set('paciente_id', pacRecords[0].id)
      lanc2.set('descricao', 'Tratamento Ortodôntico - Parcela 2/6')
      lanc2.set('tipo', 'receber')
      lanc2.set('valor', 420)
      lanc2.set('vencimento', '2026-11-15')
      lanc2.set('status', 'aberto')
      app.save(lanc2)
    }
  }

  // 11. Auditoria LGPD Inicial
  const auditoria = app.findCollectionByNameOrId('auditoria_acesso')
  let aud
  try {
    aud = app.findFirstRecordByFilter('auditoria_acesso', `tenant_id = '${tenantId}'`)
  } catch (e) {
    aud = null
  }
  if (!aud) {
    aud = new Record(auditoria)
    aud.set('tenant_id', tenantId)
    aud.set('user_email', 'owner@gestecodonto.com.br')
    aud.set('perfil', 'owner')
    aud.set('target_patient_id', pacRecords[1]?.id || '')
    aud.set('acao', 'visualizou_prontuario')
    aud.set('detalhes', 'Acesso ao prontuário e odontograma clínico do paciente')
    aud.set('ip', '189.120.45.12')
    aud.set('timestamp', new Date().toISOString())
    app.save(aud)
  }
})
