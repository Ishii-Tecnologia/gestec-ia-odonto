/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const tenantId = 'iys37mfitzfls2a'

    // 1. Obter unidade principal
    let unidadeId = ''
    try {
      const u = app.findFirstRecordByFilter('unidades', `tenant_id = '${tenantId}'`)
      unidadeId = u.id
    } catch (_) {
      unidadeId = ''
    }

    // 2. Obter profissionais demo
    let drRenataId = ''
    let drMarceloId = ''
    try {
      const r = app.findFirstRecordByFilter('profissionais', `cro ~ '89234'`)
      drRenataId = r.id
    } catch (_) {}
    try {
      const m = app.findFirstRecordByFilter('profissionais', `cro ~ '104552'`)
      drMarceloId = m.id
    } catch (_) {}

    // 3. Obter pacientes demo
    let pLucas, pBeatriz, pEnzo, pMariana, pCarlos
    try {
      pLucas = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '52998224725'`,
      )
    } catch (_) {}
    try {
      pBeatriz = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '70281692004'`,
      )
    } catch (_) {}
    try {
      pEnzo = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '11144477735'`,
      )
    } catch (_) {}
    try {
      pMariana = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '88844411180'`,
      )
    } catch (_) {}
    try {
      pCarlos = app.findFirstRecordByFilter(
        'pacientes',
        `tenant_id = '${tenantId}' && cpf = '33399966601'`,
      )
    } catch (_) {}

    // 4. Catálogo de procedimentos com valores e categorias
    const procedimentosCol = app.findCollectionByNameOrId('procedimentos')
    const procsCatalogo = [
      {
        codigo: 'CLI-001',
        nome: 'Consulta Inicial / Avaliação Clínica',
        duracao_minutos: 30,
        valor: 150,
        categoria: 'diagnostico',
      },
      {
        codigo: 'PREV-001',
        nome: 'Profilaxia e Remoção de Tártaro (Jato Bicarbonato)',
        duracao_minutos: 45,
        valor: 220,
        categoria: 'prevencao',
      },
      {
        codigo: 'REST-001',
        nome: 'Restauração Resina Composta 1 Face',
        duracao_minutos: 45,
        valor: 180,
        categoria: 'restauradora',
      },
      {
        codigo: 'REST-002',
        nome: 'Restauração Resina Composta 2 ou mais Faces',
        duracao_minutos: 60,
        valor: 280,
        categoria: 'restauradora',
      },
      {
        codigo: 'ENDO-001',
        nome: 'Tratamento Endodôntico (Canal) Molar',
        duracao_minutos: 90,
        valor: 850,
        categoria: 'endodontia',
      },
      {
        codigo: 'CIR-001',
        nome: 'Exodontia Simples Dente Permanente',
        duracao_minutos: 45,
        valor: 250,
        categoria: 'cirurgia',
      },
      {
        codigo: 'CIR-002',
        nome: 'Exodontia Dente Incluso / Terceiro Molar',
        duracao_minutos: 60,
        valor: 650,
        categoria: 'cirurgia',
      },
      {
        codigo: 'ORTO-001',
        nome: 'Instalação Aparelho Autoligado Metálico',
        duracao_minutos: 60,
        valor: 1400,
        categoria: 'ortodontia',
      },
      {
        codigo: 'ORTO-002',
        nome: 'Manutenção Mensal Ortodôntica',
        duracao_minutos: 30,
        valor: 180,
        categoria: 'ortodontia',
      },
      {
        codigo: 'PROT-001',
        nome: 'Coroa Total Metalocerâmica',
        duracao_minutos: 60,
        valor: 1200,
        categoria: 'protese',
      },
      {
        codigo: 'PROT-002',
        nome: 'Implante Dentário Titânio Cone Morse',
        duracao_minutos: 75,
        valor: 2200,
        categoria: 'cirurgia',
      },
      {
        codigo: 'EST-001',
        nome: 'Clareamento Dental Combinado (Consultório + Caseiro)',
        duracao_minutos: 60,
        valor: 950,
        categoria: 'estetica',
      },
      {
        codigo: 'EST-002',
        nome: 'Faceta em Resina / Porcelana Unitária',
        duracao_minutos: 60,
        valor: 780,
        categoria: 'estetica',
      },
    ]

    for (const p of procsCatalogo) {
      let existe
      try {
        existe = app.findFirstRecordByFilter(
          'procedimentos',
          `tenant_id = '${tenantId}' && nome = '${p.nome}'`,
        )
      } catch (_) {
        existe = null
      }
      if (!existe) {
        const pr = new Record(procedimentosCol)
        pr.set('tenant_id', tenantId)
        pr.set('codigo', p.codigo)
        pr.set('nome', p.nome)
        pr.set('duracao_minutos', p.duracao_minutos)
        pr.set('valor', p.valor)
        pr.set('categoria', p.categoria)
        app.save(pr)
      }
    }

    // 5. Popular Orçamentos com Status Rascunho, Enviado, Aprovado, Rejeitado (BL-008)
    const orcamentosCol = app.findCollectionByNameOrId('orcamentos')
    const lancamentosCol = app.findCollectionByNameOrId('lancamentos_financeiros')

    const hoje = new Date()
    const hojeStr = hoje.toISOString().slice(0, 10)

    // A. Beatriz: Orçamento Aprovado e Assinado (Clareamento + Facetas + Restauração)
    if (pBeatriz) {
      let orcBea
      try {
        orcBea = app.findFirstRecordByFilter(
          'orcamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pBeatriz.id}' && numero_orcamento = 'ORC-2026-001'`,
        )
      } catch (_) {
        orcBea = null
      }

      if (!orcBea) {
        const o = new Record(orcamentosCol)
        o.set('tenant_id', tenantId)
        o.set('unidade_id', unidadeId)
        o.set('paciente_id', pBeatriz.id)
        if (drRenataId) o.set('profissional_id', drRenataId)
        o.set('numero_orcamento', 'ORC-2026-001')
        o.set('valor_bruto', 2960)
        o.set('desconto_percentual', 10)
        o.set('desconto_valor', 296)
        o.set('valor_liquido', 2664)
        o.set('parcelas', 4)
        o.set('status', 'aprovado')
        o.set('validade', '2026-12-15')
        o.set('data_aprovacao', `${hojeStr}T10:00:00Z`)
        o.set('aprovado_por', 'Beatriz Lima Mendonça')
        o.set('observacoes', 'Reabilitação estética anterior com faceta e profilaxia prévia.')
        o.set('assinatura', {
          rubrica: 'Beatriz Lima Mendonça',
          data_hora: `${hojeStr}T10:05:00Z`,
          ip: '189.120.45.12 (Tablet Recepção)',
          documento_identidade: 'RG 45.892.112-X SSP/SP',
          assinado: true,
        })
        o.set('itens', [
          {
            procedimento: 'Profilaxia e Remoção de Tártaro (Jato Bicarbonato)',
            dente: 'Geral',
            face: 'Todas',
            quantidade: 1,
            valor_unitario: 220,
            valor_total: 220,
          },
          {
            procedimento: 'Clareamento Dental Combinado (Consultório + Caseiro)',
            dente: 'Arcada Superior / Inferior',
            face: 'Vestibular',
            quantidade: 1,
            valor_unitario: 950,
            valor_total: 950,
          },
          {
            procedimento: 'Faceta em Resina / Porcelana Unitária',
            dente: '21',
            face: 'V',
            quantidade: 1,
            valor_unitario: 780,
            valor_total: 780,
          },
          {
            procedimento: 'Restauração Resina Composta 2 ou mais Faces',
            dente: '16',
            face: 'O, M',
            quantidade: 1,
            valor_unitario: 280,
            valor_total: 280,
          },
          {
            procedimento: 'Exodontia Dente Incluso / Terceiro Molar',
            dente: '48',
            face: 'Ocluso',
            quantidade: 1,
            valor_unitario: 650,
            valor_total: 650,
          },
        ])
        app.save(o)

        // Gerar 4 parcelas financeiras para Beatriz (BL-009: 1ª paga via Pix, 2ª a 4ª em aberto)
        const valorParcela = 2664 / 4 // 666.00
        for (let i = 1; i <= 4; i++) {
          const v = new Date(hoje)
          v.setDate(v.getDate() + (i - 1) * 30)
          const vStr = v.toISOString().slice(0, 10)

          const l = new Record(lancamentosCol)
          l.set('tenant_id', tenantId)
          l.set('unidade_id', unidadeId)
          l.set('paciente_id', pBeatriz.id)
          l.set('orcamento_id', o.id)
          if (drRenataId) l.set('profissional_id', drRenataId)
          l.set('descricao', `Tratamento Estético Integrado - Parcela ${i}/4`)
          l.set('tipo', 'receber')
          l.set('categoria', 'tratamento')
          l.set('numero_parcela', i)
          l.set('total_parcelas', 4)
          l.set('valor', valorParcela)
          l.set('valor_liquido', valorParcela)
          l.set('vencimento', vStr)

          if (i === 1) {
            l.set('status', 'pago')
            l.set('data_pagamento', `${hojeStr}T10:15:00Z`)
            l.set('valor_pago', valorParcela)
            l.set('forma_pagamento_principal', 'pix')
            l.set('comprovante_transacao', 'PIX-E202610119842145')
            l.set('responsavel_baixa_email', 'financeiro@gestecodonto.com.br')
            l.set('modalidades', [
              {
                modalidade: 'pix',
                valor: valorParcela,
                comprovante: 'PIX-E202610119842145',
                data: `${hojeStr}T10:15:00Z`,
              },
            ])
          } else {
            l.set('status', 'aberto')
          }
          app.save(l)
        }
      }
    }

    // B. Carlos: Orçamento Aprovado (Implante + Coroa Total)
    if (pCarlos) {
      let orcCar
      try {
        orcCar = app.findFirstRecordByFilter(
          'orcamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pCarlos.id}' && numero_orcamento = 'ORC-2026-002'`,
        )
      } catch (_) {
        orcCar = null
      }

      if (!orcCar) {
        const o = new Record(orcamentosCol)
        o.set('tenant_id', tenantId)
        o.set('unidade_id', unidadeId)
        o.set('paciente_id', pCarlos.id)
        if (drMarceloId) o.set('profissional_id', drMarceloId)
        o.set('numero_orcamento', 'ORC-2026-002')
        o.set('valor_bruto', 3680)
        o.set('desconto_percentual', 5)
        o.set('desconto_valor', 184)
        o.set('valor_liquido', 3496)
        o.set('parcelas', 2)
        o.set('status', 'aprovado')
        o.set('validade', '2026-11-20')
        o.set('data_aprovacao', `${hojeStr}T11:20:00Z`)
        o.set('aprovado_por', 'Carlos Eduardo Prado')
        o.set('observacoes', 'Implante Cone Morse no dente 36 e coroa definitiva.')
        o.set('assinatura', {
          rubrica: 'Carlos Eduardo Prado',
          data_hora: `${hojeStr}T11:25:00Z`,
          ip: '189.120.45.12 (Totem)',
          documento_identidade: 'CPF 333.999.666-01',
          assinado: true,
        })
        o.set('itens', [
          {
            procedimento: 'Implante Dentário Titânio Cone Morse',
            dente: '36',
            face: 'Oclusal',
            quantidade: 1,
            valor_unitario: 2200,
            valor_total: 2200,
          },
          {
            procedimento: 'Coroa Total Metalocerâmica',
            dente: '36',
            face: 'Coroa sobre Implante',
            quantidade: 1,
            valor_unitario: 1200,
            valor_total: 1200,
          },
          {
            procedimento: 'Restauração Resina Composta 2 ou mais Faces',
            dente: '14',
            face: 'O, D',
            quantidade: 1,
            valor_unitario: 280,
            valor_total: 280,
          },
        ])
        app.save(o)

        // Gerar 2 parcelas (1ª paga com Split: Pix R$ 1000 + Cartão Crédito R$ 748)
        const valorP1 = 1748
        const valorP2 = 1748

        const l1 = new Record(lancamentosCol)
        l1.set('tenant_id', tenantId)
        l1.set('unidade_id', unidadeId)
        l1.set('paciente_id', pCarlos.id)
        l1.set('orcamento_id', o.id)
        if (drMarceloId) l1.set('profissional_id', drMarceloId)
        l1.set('descricao', 'Implante & Prótese Dente 36 - Parcela 1/2 (Entrada)')
        l1.set('tipo', 'receber')
        l1.set('categoria', 'protese')
        l1.set('numero_parcela', 1)
        l1.set('total_parcelas', 2)
        l1.set('valor', valorP1)
        l1.set('valor_liquido', valorP1)
        l1.set('vencimento', hojeStr)
        l1.set('status', 'pago')
        l1.set('data_pagamento', `${hojeStr}T11:35:00Z`)
        l1.set('valor_pago', valorP1)
        l1.set('forma_pagamento_principal', 'split')
        l1.set('responsavel_baixa_email', 'financeiro@gestecodonto.com.br')
        l1.set('modalidades', [
          {
            modalidade: 'pix',
            valor: 1000,
            comprovante: 'PIX-E98124018241',
            data: `${hojeStr}T11:34:00Z`,
          },
          {
            modalidade: 'cartao_credito',
            valor: 748,
            comprovante: 'NSU-782136 (Mastercard 4x)',
            data: `${hojeStr}T11:35:00Z`,
          },
        ])
        app.save(l1)

        const l2 = new Record(lancamentosCol)
        const v2 = new Date(hoje)
        v2.setDate(v2.getDate() + 30)
        l2.set('tenant_id', tenantId)
        l2.set('unidade_id', unidadeId)
        l2.set('paciente_id', pCarlos.id)
        l2.set('orcamento_id', o.id)
        if (drMarceloId) l2.set('profissional_id', drMarceloId)
        l2.set('descricao', 'Implante & Prótese Dente 36 - Parcela 2/2')
        l2.set('tipo', 'receber')
        l2.set('categoria', 'protese')
        l2.set('numero_parcela', 2)
        l2.set('total_parcelas', 2)
        l2.set('valor', valorP2)
        l2.set('valor_liquido', valorP2)
        l2.set('vencimento', v2.toISOString().slice(0, 10))
        l2.set('status', 'aberto')
        app.save(l2)
      }
    }

    // C. Mariana: Orçamento Enviado / Negociação (Canal Dente 36 + Restauração)
    if (pMariana) {
      let orcMar
      try {
        orcMar = app.findFirstRecordByFilter(
          'orcamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pMariana.id}' && numero_orcamento = 'ORC-2026-003'`,
        )
      } catch (_) {
        orcMar = null
      }

      if (!orcMar) {
        const o = new Record(orcamentosCol)
        o.set('tenant_id', tenantId)
        o.set('unidade_id', unidadeId)
        o.set('paciente_id', pMariana.id)
        if (drMarceloId) o.set('profissional_id', drMarceloId)
        o.set('numero_orcamento', 'ORC-2026-003')
        o.set('valor_bruto', 1130)
        o.set('desconto_percentual', 0)
        o.set('desconto_valor', 0)
        o.set('valor_liquido', 1130)
        o.set('parcelas', 3)
        o.set('status', 'enviado')
        o.set('validade', '2026-11-25')
        o.set('observacoes', 'Tratamento urgente de dor no elemento 36 com endodontia e blindagem.')
        o.set('itens', [
          {
            procedimento: 'Tratamento Endodôntico (Canal) Molar',
            dente: '36',
            face: 'Oclusal / Raízes',
            quantidade: 1,
            valor_unitario: 850,
            valor_total: 850,
          },
          {
            procedimento: 'Restauração Resina Composta 2 ou mais Faces',
            dente: '36',
            face: 'O, M, D',
            quantidade: 1,
            valor_unitario: 280,
            valor_total: 280,
          },
        ])
        app.save(o)
      }
    }

    // D. Enzo: Orçamento em Rascunho (Odontopediatria e Selantes)
    if (pEnzo) {
      let orcEnzo
      try {
        orcEnzo = app.findFirstRecordByFilter(
          'orcamentos',
          `tenant_id = '${tenantId}' && paciente_id = '${pEnzo.id}' && numero_orcamento = 'ORC-2026-004'`,
        )
      } catch (_) {
        orcEnzo = null
      }

      if (!orcEnzo) {
        const o = new Record(orcamentosCol)
        o.set('tenant_id', tenantId)
        o.set('unidade_id', unidadeId)
        o.set('paciente_id', pEnzo.id)
        if (drMarceloId) o.set('profissional_id', drMarceloId)
        o.set('numero_orcamento', 'ORC-2026-004')
        o.set('valor_bruto', 580)
        o.set('desconto_percentual', 0)
        o.set('desconto_valor', 0)
        o.set('valor_liquido', 580)
        o.set('parcelas', 2)
        o.set('status', 'rascunho')
        o.set('validade', '2026-11-30')
        o.set(
          'observacoes',
          'Plano preventivo infantil com aplicação de selantes e restauração de cárie incipiente.',
        )
        o.set('itens', [
          {
            procedimento: 'Profilaxia e Remoção de Tártaro (Jato Bicarbonato)',
            dente: 'Geral',
            face: 'Arcadas Decíduas',
            quantidade: 1,
            valor_unitario: 220,
            valor_total: 220,
          },
          {
            procedimento: 'Restauração Resina Composta 1 Face',
            dente: '85',
            face: 'O',
            quantidade: 2,
            valor_unitario: 180,
            valor_total: 360,
          },
        ])
        app.save(o)
      }
    }
  },
  (app) => {
    // Reversão
  },
)
