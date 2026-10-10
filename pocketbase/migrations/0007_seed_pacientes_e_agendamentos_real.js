/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir campos do tenant: nome, razao_social, cnpj, plano, modulos_ativos, limites, ativo
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const camposTenants = [
      { name: 'nome', type: 'text' },
      { name: 'razao_social', type: 'text' },
      { name: 'cnpj', type: 'text' },
      {
        name: 'plano',
        type: 'select',
        values: [
          'consultorio-essencial',
          'suite-clinica',
          'suite-gestao',
          'suite-completa',
          'custom',
        ],
        maxSelect: 1,
      },
      { name: 'modulos_ativos', type: 'json' },
      { name: 'limites', type: 'json' },
      { name: 'ativo', type: 'bool' },
    ]

    for (const c of camposTenants) {
      if (!tenantsCol.fields.getByName(c.name)) {
        if (c.type === 'text') tenantsCol.fields.add(new TextField({ name: c.name }))
        else if (c.type === 'bool') tenantsCol.fields.add(new BoolField({ name: c.name }))
        else if (c.type === 'json') tenantsCol.fields.add(new JSONField({ name: c.name }))
        else if (c.type === 'select')
          tenantsCol.fields.add(
            new SelectField({ name: c.name, values: c.values, maxSelect: c.maxSelect }),
          )
      }
    }
    app.save(tenantsCol)

    // Atualizar o tenant existente iys37mfitzfls2a via raw SQL para garantir dados válidos
    app
      .db()
      .newQuery(`
      UPDATE tenants 
      SET nome = 'Clínica OdontoDemo Matriz',
          razao_social = 'OdontoDemo Gestão e Saúde Bucal Ltda',
          cnpj = '12.345.678/0001-90',
          plano = 'suite-completa',
          situacao = 'ativa',
          ativo = 1
      WHERE id = 'iys37mfitzfls2a'
    `)
      .execute()

    const tenantId = 'iys37mfitzfls2a'

    // 2. Garantir Unidade Principal do tenant
    const unidadesCol = app.findCollectionByNameOrId('unidades')
    let principalUnidade
    try {
      principalUnidade = app.findFirstRecordByFilter('unidades', `tenant_id = '${tenantId}'`)
    } catch (_) {
      principalUnidade = null
    }

    if (!principalUnidade) {
      principalUnidade = new Record(unidadesCol)
      principalUnidade.set('tenant_id', tenantId)
      principalUnidade.set('nome', 'Unidade Principal')
      principalUnidade.set('endereco', 'Av. Paulista, 1000 - Conjunto 101, São Paulo - SP')
      principalUnidade.set('telefone', '(11) 3214-5678')
      principalUnidade.set('ativa', true)
      principalUnidade.set('ordem', 1)
      app.save(principalUnidade)
    }

    // 3. Garantir Salas da Unidade
    const salasCol = app.findCollectionByNameOrId('salas')
    const salasConfig = [
      { nome: 'Consultório 1 - Ortodontia & Estética', cadeiras: 1, ordem: 1 },
      { nome: 'Consultório 2 - Cirurgia & Implantes', cadeiras: 1, ordem: 2 },
      { nome: 'Consultório 3 - Avaliação & Diagnóstico', cadeiras: 1, ordem: 3 },
    ]

    const salasRecs = []
    for (const sc of salasConfig) {
      let s
      try {
        s = app.findFirstRecordByFilter('salas', `tenant_id = '${tenantId}' && nome = '${sc.nome}'`)
      } catch (_) {
        s = null
      }
      if (!s) {
        s = new Record(salasCol)
        s.set('tenant_id', tenantId)
        s.set('unidade_id', principalUnidade.id)
        s.set('nome', sc.nome)
        s.set('cadeiras_qtd', sc.cadeiras)
        s.set('ativo', true)
        s.set('ordem', sc.ordem)
        app.save(s)
      }
      salasRecs.push(s)
    }

    // 4. Garantir Profissionais
    const profCol = app.findCollectionByNameOrId('profissionais')
    const profsConfig = [
      {
        nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        especialidade: 'Ortodontia e Reabilitação Oral',
        email: 'owner@gestecodonto.com.br',
        telefone: '(11) 98765-4321',
        cor: '#0E7490',
      },
      {
        nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        especialidade: 'Endodontia e Cirurgia',
        email: 'dentista@gestecodonto.com.br',
        telefone: '(11) 97654-3210',
        cor: '#0284C7',
      },
    ]

    const profRecs = []
    for (const pc of profsConfig) {
      let p
      try {
        p = app.findFirstRecordByFilter(
          'profissionais',
          `tenant_id = '${tenantId}' && cro = '${pc.cro}'`,
        )
      } catch (_) {
        p = null
      }
      if (!p) {
        p = new Record(profCol)
        p.set('tenant_id', tenantId)
        p.set('nome', pc.nome)
        p.set('cro', pc.cro)
        p.set('especialidade', pc.especialidade)
        p.set('email', pc.email)
        p.set('telefone', pc.telefone)
        p.set('cor_agenda', pc.cor)
        p.set('ativo', true)
        app.save(p)
      }
      profRecs.push(p)
    }

    // 5. Garantir Pacientes
    const pacientesCol = app.findCollectionByNameOrId('pacientes')
    const seedPacientes = [
      {
        nome: 'Lucas Ferreira Alencar',
        cpf: '52998224725',
        data_nascimento: '1992-05-14',
        telefone: '(11) 99123-4567',
        email: 'lucas.alencar@exemplo.com',
        endereco: 'Av. Paulista, 1500, Ap 42, Bela Vista, São Paulo - SP',
        genero: 'masculino',
        convenio: 'Amil Dental',
        status: 'ativo',
        score_evasao: 12,
        tags: ['Ortodontia', 'Retorno Semestral'],
        observacoes: 'Paciente pontual, prefere atendimento pela manhã.',
      },
      {
        nome: 'Beatriz Helena Guimarães',
        cpf: '70281692004',
        data_nascimento: '1988-11-20',
        telefone: '(11) 98234-5678',
        email: 'beatriz.guimaraes@exemplo.com',
        endereco: 'Rua Vergueiro, 980, Aclimação, São Paulo - SP',
        genero: 'feminino',
        convenio: 'Particular',
        status: 'em-tratamento',
        score_evasao: 25,
        tags: ['Estética', 'Alto Valor'],
        observacoes: 'Em tratamento estético clareador.',
      },
      {
        nome: 'Enzo Gabriel Castro',
        cpf: '11144477735',
        data_nascimento: '2015-08-10',
        telefone: '(11) 97345-6789',
        email: 'pais.enzo@exemplo.com',
        endereco: 'Rua Pamplona, 450, Jardim Paulista, São Paulo - SP',
        genero: 'masculino',
        convenio: 'Bradesco Dental',
        responsavel_legal: 'Fernanda Castro (Mãe)',
        responsavel_cpf: '22255588820',
        status: 'ativo',
        score_evasao: 5,
        tags: ['Odontopediatria', 'Preventivo'],
        observacoes: 'Menor de idade. Alérgico a penicilina.',
      },
      {
        nome: 'Mariana Souza Santos',
        cpf: '88844411180',
        data_nascimento: '1975-08-30',
        telefone: '(11) 96456-7890',
        email: 'mariana.santos@exemplo.com',
        endereco: 'Rua Augusta, 1200, Consolação, São Paulo - SP',
        genero: 'feminino',
        convenio: 'SulAmérica Odonto',
        status: 'ativo',
        score_evasao: 40,
        tags: ['Endodontia', 'Urgência'],
        observacoes: 'Histórico de sensibilidade pós-restauração.',
      },
      {
        nome: 'Carlos Eduardo Nogueira',
        cpf: '33399966601',
        data_nascimento: '1982-03-22',
        telefone: '(11) 95555-1234',
        email: 'carlos.nogueira@exemplo.com',
        endereco: 'Rua Oscar Freire, 500, Cerqueira César, São Paulo - SP',
        genero: 'masculino',
        convenio: 'Particular',
        status: 'ativo',
        score_evasao: 15,
        tags: ['Implantodontia'],
        observacoes: 'Planejando implante unitário elemento 36.',
      },
    ]

    const pacRecords = []
    for (const sp of seedPacientes) {
      let pRec
      try {
        pRec = app.findFirstRecordByFilter(
          'pacientes',
          `tenant_id = '${tenantId}' && cpf = '${sp.cpf}'`,
        )
      } catch (_) {
        pRec = null
      }

      if (!pRec) {
        pRec = new Record(pacientesCol)
      }
      pRec.set('tenant_id', tenantId)
      pRec.set('unidade_id', principalUnidade.id)
      pRec.set('nome', sp.nome)
      pRec.set('cpf', sp.cpf)
      pRec.set('data_nascimento', sp.data_nascimento)
      pRec.set('telefone', sp.telefone)
      pRec.set('email', sp.email)
      pRec.set('endereco', sp.endereco)
      pRec.set('genero', sp.genero)
      pRec.set('convenio', sp.convenio)
      pRec.set('responsavel_legal', sp.responsavel_legal || '')
      pRec.set('responsavel_cpf', sp.responsavel_cpf || '')
      pRec.set('score_evasao', sp.score_evasao)
      pRec.set('status', sp.status)
      pRec.set('tags', sp.tags)
      pRec.set('observacoes', sp.observacoes)
      app.save(pRec)
      pacRecords.push(pRec)
    }

    // 6. Garantir Agendamentos da Semana
    const agendamentosCol = app.findCollectionByNameOrId('agendamentos')
    const now = new Date()
    function getDateOffset(days) {
      const d = new Date(now)
      d.setDate(d.getDate() + days)
      return d.toISOString().slice(0, 10)
    }

    const hoje = getDateOffset(0)
    const amanha = getDateOffset(1)
    const depoisAmanha = getDateOffset(2)
    const ontem = getDateOffset(-1)

    const seedAgendamentosSemana = [
      {
        paciente: pacRecords[0],
        prof: profRecs[0],
        salaRec: salasRecs[0],
        procedimento: 'Manutenção Ortodôntica Mensal',
        tipo_consulta: 'retorno',
        duracao: 45,
        data_inicio: `${hoje}T09:00:00`,
        data_fim: `${hoje}T09:45:00`,
        status: 'confirmado',
        confirmacao_status: 'confirmado',
        tentativa_confirmacao_em: `${ontem}T10:00:00`,
        confirmado_em: `${ontem}T14:20:00`,
      },
      {
        paciente: pacRecords[1],
        prof: profRecs[0],
        salaRec: salasRecs[0],
        procedimento: 'Clareamento Dental de Consultório',
        tipo_consulta: 'procedimento',
        duracao: 60,
        data_inicio: `${hoje}T10:30:00`,
        data_fim: `${hoje}T11:30:00`,
        status: 'presente',
        confirmacao_status: 'confirmado',
        tentativa_confirmacao_em: `${ontem}T10:00:00`,
        confirmado_em: `${ontem}T11:15:00`,
      },
      {
        paciente: pacRecords[2],
        prof: profRecs[1],
        salaRec: salasRecs[1],
        procedimento: 'Profilaxia e Aplicação de Flúor',
        tipo_consulta: 'retorno',
        duracao: 30,
        data_inicio: `${hoje}T14:00:00`,
        data_fim: `${hoje}T14:30:00`,
        status: 'pendente',
        confirmacao_status: 'pendente',
        tentativa_confirmacao_em: `${ontem}T16:00:00`,
      },
      {
        paciente: pacRecords[3],
        prof: profRecs[1],
        salaRec: salasRecs[1],
        procedimento: 'Avaliação Inicial e Diagnóstico',
        tipo_consulta: 'primeira_consulta',
        duracao: 45,
        data_inicio: `${hoje}T15:00:00`,
        data_fim: `${hoje}T15:45:00`,
        status: 'confirmado',
        confirmacao_status: 'confirmado',
        tentativa_confirmacao_em: `${ontem}T10:00:00`,
        confirmado_em: `${ontem}T18:00:00`,
      },
      {
        paciente: pacRecords[4],
        prof: profRecs[0],
        salaRec: salasRecs[0],
        procedimento: 'Avaliação para Implante Unitário',
        tipo_consulta: 'avaliacao',
        duracao: 45,
        data_inicio: `${amanha}T09:30:00`,
        data_fim: `${amanha}T10:15:00`,
        status: 'pendente',
        confirmacao_status: 'pendente',
        tentativa_confirmacao_em: `${hoje}T08:30:00`,
      },
      {
        paciente: pacRecords[0],
        prof: profRecs[1],
        salaRec: salasRecs[2] || salasRecs[1],
        procedimento: 'Restauração em Resina Composta',
        tipo_consulta: 'procedimento',
        duracao: 45,
        data_inicio: `${amanha}T14:00:00`,
        data_fim: `${amanha}T14:45:00`,
        status: 'pendente',
        confirmacao_status: 'pendente',
        tentativa_confirmacao_em: `${hoje}T09:00:00`,
      },
      {
        paciente: pacRecords[1],
        prof: profRecs[0],
        salaRec: salasRecs[0],
        procedimento: 'Polimento e Sessão 2 Clareamento',
        tipo_consulta: 'procedimento',
        duracao: 45,
        data_inicio: `${depoisAmanha}T11:00:00`,
        data_fim: `${depoisAmanha}T11:45:00`,
        status: 'confirmado',
        confirmacao_status: 'confirmado',
        confirmado_em: `${hoje}T10:00:00`,
      },
      {
        paciente: pacRecords[2],
        prof: profRecs[1],
        salaRec: salasRecs[1],
        procedimento: 'Exodontia Simples',
        tipo_consulta: 'procedimento',
        duracao: 45,
        data_inicio: `${ontem}T11:00:00`,
        data_fim: `${ontem}T11:45:00`,
        status: 'concluido',
        confirmacao_status: 'confirmado',
      },
      {
        paciente: pacRecords[3],
        prof: profRecs[0],
        salaRec: salasRecs[0],
        procedimento: 'Instalação de Aparelho Fixo',
        tipo_consulta: 'procedimento',
        duracao: 60,
        data_inicio: `${ontem}T16:00:00`,
        data_fim: `${ontem}T17:00:00`,
        status: 'falta',
        confirmacao_status: 'no_show',
        motivo_cancelamento_ou_falta:
          'Paciente não compareceu nem atendeu as tentativas de contato.',
      },
    ]

    for (const ag of seedAgendamentosSemana) {
      if (!ag.paciente || !ag.prof) continue
      let rec
      try {
        rec = app.findFirstRecordByFilter(
          'agendamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${ag.paciente.id}' && data_inicio = '${ag.data_inicio}'`,
        )
      } catch (_) {
        rec = null
      }

      if (!rec) {
        rec = new Record(agendamentosCol)
        rec.set('tenant_id', tenantId)
        rec.set('unidade_id', principalUnidade.id)
        if (ag.salaRec) {
          rec.set('sala_id', ag.salaRec.id)
          rec.set('sala', ag.salaRec.getString('nome'))
        }
        rec.set('paciente_id', ag.paciente.id)
        rec.set('profissional_id', ag.prof.id)
        rec.set('procedimento', ag.procedimento)
        rec.set('tipo_consulta', ag.tipo_consulta || 'procedimento')
        rec.set('duracao_minutos', ag.duracao)
        rec.set('data_inicio', ag.data_inicio)
        rec.set('data_fim', ag.data_fim)
        rec.set('status', ag.status)
        rec.set('confirmacao_status', ag.confirmacao_status || 'pendente')
        if (ag.tentativa_confirmacao_em)
          rec.set('tentativa_confirmacao_em', ag.tentativa_confirmacao_em)
        if (ag.confirmado_em) rec.set('confirmado_em', ag.confirmado_em)
        if (ag.motivo_cancelamento_ou_falta)
          rec.set('motivo_cancelamento_ou_falta', ag.motivo_cancelamento_ou_falta)
        rec.set('origem', 'recepcao')
        app.save(rec)
      }
    }
  },
  (app) => {
    // Reversão
  },
)
