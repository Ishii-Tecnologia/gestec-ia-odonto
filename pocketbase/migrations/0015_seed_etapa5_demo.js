/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Obter tenant demo
    let demoTenant
    try {
      demoTenant = app.findFirstRecordByFilter('tenants', "cnpj = '12.345.678/0001-90'")
    } catch (_) {
      try {
        demoTenant = app.findFirstRecordByFilter('tenants', "nome ~ 'OdontoDemo'")
      } catch (__) {
        return
      }
    }
    if (!demoTenant) return
    const tenantId = demoTenant.id

    // Obter unidade demo
    let unidadeId = ''
    try {
      const uRec = app.findFirstRecordByFilter('unidades', `tenant_id = '${tenantId}'`)
      unidadeId = uRec.id
    } catch (_) {}

    // Obter pacientes demo
    let pacLucas, pacBeatriz, pacEnzo, pacMariana
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
      pacEnzo = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && (nome ~ 'Enzo' || nome ~ 'Thiago')`,
      )
    } catch (_) {}
    try {
      pacMariana = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && nome ~ 'Mariana'`,
      )
    } catch (_) {}

    // Obter profissionais demo
    let profRenata, profMarcelo
    try {
      profRenata = app.findFirstRecordByFilter(
        'profissionais',
        `tenant_id = '${tenantId}' && nome ~ 'Renata'`,
      )
    } catch (_) {}
    try {
      profMarcelo = app.findFirstRecordByFilter(
        'profissionais',
        `tenant_id = '${tenantId}' && nome ~ 'Marcelo'`,
      )
    } catch (_) {}

    const profRenataId = profRenata ? profRenata.id : ''
    const profMarceloId = profMarcelo ? profMarcelo.id : ''

    // 1. Seed Fila de Espera (BL-013)
    const filaCol = app.findCollectionByNameOrId('filas_espera')
    const seedFila = [
      {
        paciente: pacBeatriz,
        profissional_id: profRenataId,
        procedimento: 'Clareamento Dental de Consultório',
        periodo_preferencia: 'tarde',
        dias_semana: ['ter', 'qui'],
        data_desejada: '2026-10-15',
        prioridade: 3,
        status: 'aguardando',
        contato_telefone: '(11) 98234-5678',
        observacoes: 'Deseja antecipar caso haja desistência às terças ou quintas à tarde.',
      },
      {
        paciente: pacMariana,
        profissional_id: profMarceloId,
        procedimento: 'Tratamento Endodôntico Multirradicular',
        periodo_preferencia: 'manha',
        dias_semana: ['seg', 'qua', 'sex'],
        data_desejada: '2026-10-12',
        prioridade: 5, // Urgência alta
        status: 'aguardando',
        contato_telefone: '(11) 96456-7890',
        observacoes: 'Paciente com dor intermitente no elemento 46; alta prioridade de encaixe.',
      },
    ]

    for (const item of seedFila) {
      if (!item.paciente) continue
      try {
        app.findFirstRecordByFilter(
          'filas_espera',
          `tenant_id = '${tenantId}' && paciente_id = '${item.paciente.id}' && procedimento = '${item.procedimento}'`,
        )
      } catch (_) {
        const r = new Record(filaCol)
        r.set('tenant_id', tenantId)
        r.set('unidade_id', unidadeId)
        r.set('paciente_id', item.paciente.id)
        r.set('profissional_id', item.profissional_id)
        r.set('procedimento', item.procedimento)
        r.set('periodo_preferencia', item.periodo_preferencia)
        r.set('dias_semana', item.dias_semana)
        r.set('data_desejada', item.data_desejada)
        r.set('prioridade', item.prioridade)
        r.set('status', item.status)
        r.set('contato_telefone', item.contato_telefone)
        r.set('observacoes', item.observacoes)
        app.save(r)
      }
    }

    // 2. Seed Vínculos Familiares (BL-020)
    const vinculosCol = app.findCollectionByNameOrId('vinculos_familiares')
    if (pacEnzo) {
      try {
        app.findFirstRecordByFilter(
          'vinculos_familiares',
          `tenant_id = '${tenantId}' && paciente_id = '${pacEnzo.id}'`,
        )
      } catch (_) {
        const v = new Record(vinculosCol)
        v.set('tenant_id', tenantId)
        v.set('paciente_id', pacEnzo.id)
        v.set('responsavel_id', pacLucas ? pacLucas.id : '')
        v.set('responsavel_nome', 'Fernanda Castro')
        v.set('responsavel_cpf', '222.555.888-20')
        v.set('responsavel_telefone', '(11) 97345-6789')
        v.set('parentesco', 'mae')
        v.set('financeiro_responsavel', true)
        v.set('observacoes', 'Mãe e responsável legal e financeira pelo menor Enzo.')
        app.save(v)
      }
    }

    // 3. Seed Exames & Anexos (BL-015)
    const examesCol = app.findCollectionByNameOrId('exames_anexos')
    const seedExames = [
      {
        paciente: pacLucas,
        tipo: 'panoramica',
        titulo: 'Radiografia Panorâmica Inicial',
        descricao:
          'Avaliação de inclusão de terceiros molares e posicionamento de arcada ortodôntica.',
        data_exame: '2026-09-10',
        url_arquivo: 'https://img.usecurling.com/p/800/600?q=dental+xray',
        dente_referencia: 'Arcada Completa',
        tags: ['Ortodontia', 'Panorâmica', 'Documentação Inicial'],
      },
      {
        paciente: pacBeatriz,
        tipo: 'foto_clinica',
        titulo: 'Fotografia Clínica Pré-Clareamento',
        descricao:
          'Registro fotográfico intraoral com escala Vita A3.5 para acompanhamento estético.',
        data_exame: '2026-09-25',
        url_arquivo: 'https://img.usecurling.com/p/800/600?q=smile+teeth',
        dente_referencia: '11, 21, 12, 22',
        tags: ['Estética', 'Antes', 'Escala Vita'],
      },
      {
        paciente: pacMariana,
        tipo: 'periapical',
        titulo: 'Radiografia Periapical Molar 46',
        descricao:
          'Verificação da anatomia radicular e lesão periapical em dente 46 para conduta endodôntica.',
        data_exame: '2026-10-01',
        url_arquivo: 'https://img.usecurling.com/p/800/600?q=xray+teeth',
        dente_referencia: '46',
        tags: ['Endodontia', 'Periapical'],
      },
    ]

    for (const ex of seedExames) {
      if (!ex.paciente) continue
      try {
        app.findFirstRecordByFilter(
          'exames_anexos',
          `tenant_id = '${tenantId}' && paciente_id = '${ex.paciente.id}' && titulo = '${ex.titulo}'`,
        )
      } catch (_) {
        const r = new Record(examesCol)
        r.set('tenant_id', tenantId)
        r.set('unidade_id', unidadeId)
        r.set('paciente_id', ex.paciente.id)
        r.set('profissional_id', profRenataId)
        r.set('tipo', ex.tipo)
        r.set('titulo', ex.titulo)
        r.set('descricao', ex.descricao)
        r.set('data_exame', ex.data_exame)
        r.set('url_arquivo', ex.url_arquivo)
        r.set('dente_referencia', ex.dente_referencia)
        r.set('tags', ex.tags)
        app.save(r)
      }
    }

    // 4. Seed Prescrições & Documentos Clínicos (BL-019)
    const prescCol = app.findCollectionByNameOrId('prescricoes')
    const seedPresc = [
      {
        paciente: pacLucas,
        tipo_documento: 'receituario_simples',
        data: '2026-10-02',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        cro_uf: 'SP',
        cid10: 'K07.2',
        medicamentos: [
          {
            medicamento: 'Ibuprofeno 600mg',
            dosagem: '600mg',
            via: 'Oral',
            posologia:
              'Tomar 1 comprimido de 8 em 8 horas se dor ou desconforto após ajuste de aparelho.',
            duracao: '3 dias',
            quantidade: '1 caixa com 10 comprimidos',
          },
        ],
        instrucoes:
          'Manter higiene cuidadosa com escova interdental e uso de cera ortodôntica protetora.',
        assinatura_digital_hash: 'HASH-SHA256-RV-89234-884A91E0',
        emitido_em: '2026-10-02T15:30:00Z',
      },
      {
        paciente: pacMariana,
        tipo_documento: 'receituario_controle_especial',
        data: '2026-10-05',
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        cro_uf: 'SP',
        cid10: 'K04.0',
        medicamentos: [
          {
            medicamento: 'Amoxicilina + Clavulanato de Potássio 875/125mg',
            dosagem: '875mg + 125mg',
            via: 'Oral',
            posologia: 'Tomar 1 comprimido a cada 12 horas rigorosamente nos horários prescritos.',
            duracao: '7 dias',
            quantidade: '14 comprimidos revestidos',
          },
          {
            medicamento: 'Dipirona Sódica 500mg',
            dosagem: '500mg',
            via: 'Oral',
            posologia: 'Tomar 1 comprimido a cada 6 horas em caso de dor moderada.',
            duracao: '4 dias',
            quantidade: '1 cartela com 10 comprimidos',
          },
        ],
        instrucoes:
          'Não interromper o tratamento antimicrobiano antes do término dos 7 dias prescritos.',
        assinatura_digital_hash: 'HASH-SHA256-MS-104552-33F17BC9',
        emitido_em: '2026-10-05T11:15:00Z',
      },
      {
        paciente: pacMariana,
        tipo_documento: 'atestado_afastamento',
        data: '2026-10-05',
        dias_afastamento: 2,
        cid10: 'K04.0',
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        cro_uf: 'SP',
        medicamentos: [],
        instrucoes:
          'Paciente submetida a intervenção endodôntica de urgência. Necessita de 2 (dois) dias de repouso de suas atividades laborais.',
        assinatura_digital_hash: 'HASH-SHA256-MS-104552-ATEST-9031',
        emitido_em: '2026-10-05T11:45:00Z',
      },
    ]

    for (const p of seedPresc) {
      if (!p.paciente) continue
      try {
        app.findFirstRecordByFilter(
          'prescricoes',
          `tenant_id = '${tenantId}' && paciente_id = '${p.paciente.id}' && data = '${p.data}' && tipo_documento = '${p.tipo_documento}'`,
        )
      } catch (_) {
        const r = new Record(prescCol)
        r.set('tenant_id', tenantId)
        r.set('unidade_id', unidadeId)
        r.set('paciente_id', p.paciente.id)
        r.set('profissional_id', profRenataId)
        r.set('tipo_documento', p.tipo_documento)
        r.set('data', p.data)
        if (p.dias_afastamento) r.set('dias_afastamento', p.dias_afastamento)
        r.set('cid10', p.cid10)
        r.set('medicamentos', p.medicamentos)
        r.set('instrucoes', p.instrucoes)
        r.set('dentista_nome', p.dentista_nome)
        r.set('cro', p.cro)
        r.set('cro_uf', p.cro_uf)
        r.set('assinatura_digital_hash', p.assinatura_digital_hash)
        r.set('emitido_em', p.emitido_em)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reversão
  },
)
