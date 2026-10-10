/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantId = 'iys37mfitzfls2a'

    // Obter pacientes demo
    const pacientesCol = app.findCollectionByNameOrId('pacientes')
    let pLucas, pBeatriz, pEnzo, pMariana, pCarlos

    try {
      pLucas = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '52998224725'`,
      )
    } catch (_) {
      pLucas = null
    }

    try {
      pBeatriz = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '70281692004'`,
      )
    } catch (_) {
      pBeatriz = null
    }

    try {
      pEnzo = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '11144477735'`,
      )
    } catch (_) {
      pEnzo = null
    }

    try {
      pMariana = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '88844411180'`,
      )
    } catch (_) {
      pMariana = null
    }

    try {
      pCarlos = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '33399966601'`,
      )
    } catch (_) {
      pCarlos = null
    }

    // Obter profissionais
    let drRenata, drMarcelo
    try {
      drRenata = app.findFirstRecordByFilter(
        'profissionais',
        `tenant_id = '${tenantId}' && cro = 'CRO-SP 89234'`,
      )
    } catch (_) {
      drRenata = null
    }

    try {
      drMarcelo = app.findFirstRecordByFilter(
        'profissionais',
        `tenant_id = '${tenantId}' && cro = 'CRO-SP 104552'`,
      )
    } catch (_) {
      drMarcelo = null
    }

    const evolucoesCol = app.findCollectionByNameOrId('evolucoes_clinicas')
    const odontogramasCol = app.findCollectionByNameOrId('odontogramas_snapshots')
    const anamnesesCol = app.findCollectionByNameOrId('anamneses')

    const now = new Date()
    const hoje = now.toISOString().slice(0, 10)
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const semanaPassada = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const mesPassado = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    // 1. Popular Anamneses Demo
    const demoAnamneses = [
      {
        paciente: pLucas,
        respostas: {
          alergias: 'Nenhuma alergia conhecida a medicamentos ou látex.',
          medicamentos: 'Não faz uso contínuo de medicamentos.',
          doencas: 'Não relata hipertensão ou diabetes. Boa saúde geral.',
          queixa: 'Acompanhamento ortodôntico e sensação de atrito no arco superior.',
          gravidez: 'Não',
          fumante: 'Não',
          sangramento_gengival: 'Às vezes ao passar fio dental na região posterior.',
        },
        status: 'assinada',
        data_resposta: `${mesPassado}T10:00:00Z`,
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
      },
      {
        paciente: pBeatriz,
        respostas: {
          alergias: 'Sensibilidade gástrica a anti-inflamatórios não esteroidais (AINEs).',
          medicamentos: 'Anticoncepcional oral.',
          doencas: 'Pressão arterial normal (110x70 mmHg). Sem histórico de cardiopatias.',
          queixa: 'Desejo de clareamento dental estético e troca de restaurações amareladas.',
          gravidez: 'Não',
          fumante: 'Não',
          bruxismo: 'Relata apertamento diurno em períodos de estresse no trabalho.',
        },
        status: 'assinada',
        data_resposta: `${semanaPassada}T09:30:00Z`,
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
      },
      {
        paciente: pEnzo,
        respostas: {
          alergias: 'ALERGIA SEVERA A PENICILINA E DERIVADOS (Amoxicilina). Apresenta urticária.',
          medicamentos: 'Uso esporádico de broncodilatador (Salbutamol) em crises asmáticas.',
          doencas: 'Asma leve controlada.',
          queixa:
            'Consulta de prevenção infantil, mãe relata dente de leite mole na arcada inferior.',
          gravidez: 'Não aplicável',
          responsavel: 'Fernanda Castro (Mãe presente na consulta)',
        },
        status: 'assinada',
        data_resposta: `${ontem}T14:15:00Z`,
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
      },
      {
        paciente: pMariana,
        respostas: {
          alergias: 'Alergia a Dipirona (edema labial). Tolera Paracetamol.',
          medicamentos: 'Losartana 50mg/dia (controle de hipertensão arterial).',
          doencas: 'Hipertensão arterial sistêmica controlada com medicação.',
          queixa:
            'Dor aguda ao mastigar e sensibilidade térmica no primeiro molar inferior esquerdo (dente 36).',
          fumante: 'Ex-fumante há 5 anos.',
          anestesico_obs: 'Usar anestésico sem vasoconstritor adrenérgico ou com Felipressina.',
        },
        status: 'assinada',
        data_resposta: `${semanaPassada}T15:00:00Z`,
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
      },
      {
        paciente: pCarlos,
        respostas: {
          alergias: 'Nenhuma alergia relatada.',
          medicamentos: 'Não faz uso contínuo.',
          doencas: 'Diabetes tipo 2 controlado por dieta e Metformina 500mg.',
          queixa: 'Ausência do dente 36 extraído há 2 anos, deseja colocação de implante.',
          glicemia_recente: 'Último exame de hemoglobina glicada: 6.2%.',
        },
        status: 'assinada',
        data_resposta: `${hoje}T08:45:00Z`,
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
      },
    ]

    for (const an of demoAnamneses) {
      if (!an.paciente) continue
      let existe
      try {
        existe = app.findFirstRecordByFilter('anamneses', `paciente_id = '${an.paciente.id}'`)
      } catch (_) {
        existe = null
      }

      if (!existe) {
        const rec = new Record(anamnesesCol)
        rec.set('tenant_id', tenantId)
        rec.set('paciente_id', an.paciente.id)
        if (drRenata) rec.set('profissional_id', drRenata.id)
        rec.set('dentista_nome', an.dentista_nome)
        rec.set('cro', an.cro)
        rec.set('status', an.status)
        rec.set('data_resposta', an.data_resposta)
        rec.set('respostas', an.respostas)
        rec.set('perguntas', [
          {
            id: '1',
            pergunta: 'Possui alergia a medicamentos, anestésicos ou látex?',
            tipo: 'texto',
          },
          { id: '2', pergunta: 'Faz uso diário de alguma medicação contínua?', tipo: 'texto' },
          {
            id: '3',
            pergunta: 'Apresenta histórico de hipertensão, diabetes ou cardiopatias?',
            tipo: 'texto',
          },
          { id: '4', pergunta: 'Está grávida ou amamentando?', tipo: 'texto' },
          { id: '5', pergunta: 'Queixa principal ou motivo da consulta:', tipo: 'texto' },
          { id: '6', pergunta: 'Observações de risco e histórico adicional:', tipo: 'texto' },
        ])
        app.save(rec)
      }
    }

    // 2. Popular Odontogramas com versões históricas imutáveis
    // Beatriz: Versão 1 (Inicial) e Versão 2 (Pós-clareamento e restauração)
    if (pBeatriz) {
      let snap1
      try {
        snap1 = app.findFirstRecordByFilter(
          'odontogramas_snapshots',
          `paciente_id = '${pBeatriz.id}' && versao = 1`,
        )
      } catch (_) {
        snap1 = null
      }

      if (!snap1) {
        const s1 = new Record(odontogramasCol)
        s1.set('tenant_id', tenantId)
        s1.set('paciente_id', pBeatriz.id)
        if (drRenata) s1.set('profissional_id', drRenata.id)
        s1.set('data', mesPassado)
        s1.set('versao', 1)
        s1.set('dentista_nome', 'Dra. Renata Vasconcelos')
        s1.set('cro', 'CRO-SP 89234')
        s1.set('descricao_alteracao', 'Mapeamento odontológico inicial da paciente.')
        s1.set('payload', {
          16: {
            status: 'carie',
            faces: ['O', 'M'],
            cor: '#EF4444',
            detalhe: 'Lesão cariosa em esmalte e dentina média',
          },
          21: {
            status: 'restauracao',
            faces: ['V'],
            cor: '#3B82F6',
            detalhe: 'Restauração antiga manchada',
          },
          36: {
            status: 'endodontia',
            faces: ['O'],
            cor: '#DC2626',
            detalhe: 'Canal obturado há 3 anos',
          },
          48: {
            status: 'extracao',
            faces: ['O'],
            cor: '#F59E0B',
            detalhe: 'Siso incluso com indicação de extração',
          },
        })
        app.save(s1)
      }

      let snap2
      try {
        snap2 = app.findFirstRecordByFilter(
          'odontogramas_snapshots',
          `paciente_id = '${pBeatriz.id}' && versao = 2`,
        )
      } catch (_) {
        snap2 = null
      }

      if (!snap2) {
        const s2 = new Record(odontogramasCol)
        s2.set('tenant_id', tenantId)
        s2.set('paciente_id', pBeatriz.id)
        if (drRenata) s2.set('profissional_id', drRenata.id)
        s2.set('data', semanaPassada)
        s2.set('versao', 2)
        s2.set('dentista_nome', 'Dra. Renata Vasconcelos')
        s2.set('cro', 'CRO-SP 89234')
        s2.set(
          'descricao_alteracao',
          'Restauração estética do 16 concluída e faceta em resina no 21.',
        )
        s2.set('payload', {
          16: {
            status: 'restauracao',
            faces: ['O', 'M'],
            cor: '#3B82F6',
            detalhe: 'Restauração em resina composta cor A2',
          },
          21: {
            status: 'facetas',
            faces: ['V'],
            cor: '#8B5CF6',
            detalhe: 'Faceta estética cerâmica/resina estratificada',
          },
          36: {
            status: 'protese',
            faces: ['O', 'V', 'L'],
            cor: '#10B981',
            detalhe: 'Coroa total metalocerâmica adaptada',
          },
          48: {
            status: 'ausente',
            faces: [],
            cor: '#64748B',
            detalhe: 'Exodontia realizada com sucesso',
          },
        })
        app.save(s2)
      }
    }

    // Enzo (Menor de Idade - Dentes Decíduos)
    if (pEnzo) {
      let snapEnzo
      try {
        snapEnzo = app.findFirstRecordByFilter(
          'odontogramas_snapshots',
          `paciente_id = '${pEnzo.id}'`,
        )
      } catch (_) {
        snapEnzo = null
      }

      if (!snapEnzo) {
        const sEnzo = new Record(odontogramasCol)
        sEnzo.set('tenant_id', tenantId)
        sEnzo.set('paciente_id', pEnzo.id)
        if (drMarcelo) sEnzo.set('profissional_id', drMarcelo.id)
        sEnzo.set('data', ontem)
        sEnzo.set('versao', 1)
        sEnzo.set('dentista_nome', 'Dr. Marcelo Siqueira')
        sEnzo.set('cro', 'CRO-SP 104552')
        sEnzo.set('descricao_alteracao', 'Odontograma infantil decíduo - Exame preventivo.')
        sEnzo.set('payload', {
          54: {
            status: 'restauracao',
            faces: ['O'],
            cor: '#3B82F6',
            detalhe: 'Selante oclusal preventivo',
          },
          55: { status: 'sadio', faces: [], cor: '#E2E8F0', detalhe: 'Hígido' },
          64: { status: 'sadio', faces: [], cor: '#E2E8F0', detalhe: 'Hígido' },
          71: {
            status: 'ausente',
            faces: [],
            cor: '#64748B',
            detalhe: 'Dente de leite esfoliado naturalmente',
          },
          85: {
            status: 'carie',
            faces: ['O'],
            cor: '#EF4444',
            detalhe: 'Cárie incipiente em fóssula',
          },
        })
        app.save(sEnzo)
      }
    }

    // Carlos (Adulto Implante)
    if (pCarlos) {
      let snapCarlos
      try {
        snapCarlos = app.findFirstRecordByFilter(
          'odontogramas_snapshots',
          `paciente_id = '${pCarlos.id}'`,
        )
      } catch (_) {
        snapCarlos = null
      }

      if (!snapCarlos) {
        const sCar = new Record(odontogramasCol)
        sCar.set('tenant_id', tenantId)
        sCar.set('paciente_id', pCarlos.id)
        if (drMarcelo) sCar.set('profissional_id', drMarcelo.id)
        sCar.set('data', hoje)
        sCar.set('versao', 1)
        sCar.set('dentista_nome', 'Dr. Marcelo Siqueira')
        sCar.set('cro', 'CRO-SP 104552')
        sCar.set('descricao_alteracao', 'Planejamento de implante osteointegrado.')
        sCar.set('payload', {
          36: {
            status: 'implante',
            faces: ['O'],
            cor: '#06B6D4',
            detalhe: 'Espaço protético para implante Cone Morse 4.0x10',
          },
          14: {
            status: 'restauracao',
            faces: ['O', 'D'],
            cor: '#3B82F6',
            detalhe: 'Resina composta O/D',
          },
          46: {
            status: 'protese',
            faces: ['O'],
            cor: '#10B981',
            detalhe: 'Coroa cerâmica sobre dente íntegro',
          },
        })
        app.save(sCar)
      }
    }

    // 3. Popular Evoluções Clínicas Imutáveis com cadeia de retificação/versões
    const demoEvolucoes = [
      {
        paciente: pBeatriz,
        data: `${mesPassado} 10:30`,
        tipo: 'anamnese',
        especialidade: 'geral',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        descricao:
          'Realizada anamnese digital e exame clínico detalhado. Paciente sem queixas álgicas. Constatada necessidade de profilaxia, substituição de restauração com infiltração no elemento 16 e plano de clareamento supervisionado.',
        procedimento_relacionado: 'Avaliação Inicial e Diagnóstico',
      },
      {
        paciente: pBeatriz,
        data: `${semanaPassada} 11:15`,
        tipo: 'evolucao',
        especialidade: 'geral',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        descricao:
          'Anestesia infiltrativa terminal com Mepivacaína 2%. Isolamento absoluto com dique de borracha e grampo 200. Remoção de tecido cariado no elemento 16 (faces O e M). Condicionamento ácido por 15s em dentina e 30s em esmalte, aplicação de sistema adesivo de 2 passos e restauração com resina Filtek Z350 cor A2. Ajuste oclusal em máxima intercuspidação e movimentos excursivos. Polimento fino com discos Sof-Lex.',
        procedimento_relacionado: 'Restauração em Resina Composta (2 Faces)',
      },
      {
        paciente: pBeatriz,
        data: `${hoje} 10:45`,
        tipo: 'evolucao',
        especialidade: 'estetica',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        descricao:
          'Segunda sessão de clareamento de consultório. Aplicação de dessensibilizante prévio à base de nitrato de potássio. Aplicação de gel clareador peróxido de hidrogênio a 35% por 3 ciclos de 15 minutos. Paciente relatou sensibilidade mínima grau 1. Cor final atingida: escala Vita B1.',
        procedimento_relacionado: 'Clareamento Dental de Consultório',
      },
      {
        paciente: pLucas,
        data: `${mesPassado} 09:15`,
        tipo: 'evolucao',
        especialidade: 'ortodontia',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        descricao:
          'Manutenção ortodôntica de rotina. Remoção das ligaduras elásticas superiores e inferiores. Instalação de fio de aço 0.018 superior com dobras de finalização. Paciente colaborativo com a higiene bucal. Próximo retorno agendado em 30 dias.',
        procedimento_relacionado: 'Manutenção Ortodôntica Mensal',
      },
      {
        paciente: pLucas,
        data: `${hoje} 09:30`,
        tipo: 'evolucao',
        especialidade: 'ortodontia',
        dentista_nome: 'Dra. Renata Vasconcelos',
        cro: 'CRO-SP 89234',
        descricao:
          'Consulta de manutenção mensal. Verificado alinhamento e nivelamento adequados. Troca do arco inferior para aço 0.019x0.025 para controle de torque. Ajuste de ligaduras em cadeia na arcada superior para fechamento de diastema residual de 0.5mm.',
        procedimento_relacionado: 'Manutenção Ortodôntica Mensal',
      },
      {
        paciente: pMariana,
        data: `${semanaPassada} 15:30`,
        tipo: 'evolucao',
        especialidade: 'endodontia',
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        descricao:
          'Atendimento de urgência por dor espontânea pulsátil no elemento 36. Diagnóstico de pulpite irreversível sintomática. Anestesia por bloqueio do nervo alveolar inferior com Articaína 4% e vasoconstritor diluído 1:200.000 devido ao histórico de hipertensão. Isolamento absoluto, abertura coronária, odontometria eletrônica (localizador apical). Instrumentação rotatória dos canais mesiovestibular, mesiolingual e distal. Curativo de demora com pasta de hidróxido de cálcio (Calen) e selamento com cimento provisório Coltosol. Prescrito Paracetamol 750mg de 6/6h em caso de dor (evitada dipirona por alergia).',
        procedimento_relacionado: 'Tratamento Endodôntico Multirradicular',
      },
      {
        paciente: pEnzo,
        data: `${ontem} 14:30`,
        tipo: 'evolucao',
        especialidade: 'odontopediatria',
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        descricao:
          'Atendimento odontopediátrico com manejo comportamental afetuoso. Profilaxia com escova de Robinson e pasta profilática infantil de tutti-frutti. Aplicação tópica de verniz fluoretado a 5% em todos os quadrantes. Orientada a mãe sobre a transição para dentição mista e reforçada técnica de escovação supervisionada.',
        procedimento_relacionado: 'Profilaxia e Aplicação Tópica de Flúor',
      },
      {
        paciente: pCarlos,
        data: `${hoje} 09:00`,
        tipo: 'observacao',
        especialidade: 'implantodontia',
        dentista_nome: 'Dr. Marcelo Siqueira',
        cro: 'CRO-SP 104552',
        descricao:
          'Avaliação tomográfica (Cone Beam) da região do elemento 36. Altura óssea remanescente de 13.5mm e espessura de 7.8mm. Densidade óssea tipo II favorável para implante imediato sem necessidade de enxerto ósseo prévio. Exames laboratoriais de glicemia e coagulograma aprovados. Cirurgia agendada para próxima semana.',
        procedimento_relacionado: 'Avaliação para Implante Unitário',
      },
    ]

    for (const ev of demoEvolucoes) {
      if (!ev.paciente) continue
      let existe
      try {
        existe = app.findFirstRecordByFilter(
          'evolucoes_clinicas',
          `paciente_id = '${ev.paciente.id}' && data = '${ev.data}'`,
        )
      } catch (_) {
        existe = null
      }

      if (!existe) {
        const rec = new Record(evolucoesCol)
        rec.set('tenant_id', tenantId)
        rec.set('paciente_id', ev.paciente.id)
        if (drRenata) rec.set('profissional_id', drRenata.id)
        rec.set('data', ev.data)
        rec.set('tipo', ev.tipo)
        rec.set('especialidade', ev.especialidade)
        rec.set('dentista_nome', ev.dentista_nome)
        rec.set('cro', ev.cro)
        rec.set('descricao', ev.descricao)
        rec.set('procedimento_relacionado', ev.procedimento_relacionado)
        app.save(rec)
      }
    }
  },
  (app) => {
    // Reversão
  },
)
