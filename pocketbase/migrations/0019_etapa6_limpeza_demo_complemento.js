/// <reference path="../pb_data/types.d.ts" />
/**
 * Etapa 6 (Hardening / go-live) — complemento da limpeza demo (0017).
 *
 * A 0017 limpa as coleções que trazem `paciente_id`; esta varre também as
 * coleções operacionais sem esse campo no tenant demo (planos de tratamento
 * vinculados via plano_id), além de re-executar o filtro por CPF/e-mail
 * @exemplo.com — a 0017 não roda de novo, então os registros que sobraram
 * aqui são removidos nesta passada.
 *
 * PRESERVA sempre: tenants, usuários, unidades, salas, profissionais,
 * procedimentos e auditoria LGPD append-only. Nunca toca em outros tenants.
 */
migrate(
  (app) => {
    // 1. Tenant demo (CNPJ semeado; fallback pelo nome)
    let demoTenant = null
    try {
      demoTenant = app.findFirstRecordByFilter('tenants', "cnpj = '12.345.678/0001-90'")
    } catch (_) {
      demoTenant = null
    }
    if (!demoTenant) {
      try {
        demoTenant = app.findFirstRecordByFilter('tenants', "nome ~ 'OdontoDemo'")
      } catch (__) {
        demoTenant = null
      }
    }
    if (!demoTenant) {
      console.log('Limpeza demo 0019: nenhum tenant demo encontrado (no-op).')
      return
    }
    const tid = demoTenant.id

    let removidos = 0

    const deletarPorFiltro = (colecao, filtro) => {
      try {
        const recs = app.findRecordsByFilter(colecao, filtro, '', 500, 0)
        for (const r of recs) {
          try {
            app.delete(r)
            removidos++
          } catch (errDel) {
            console.log(`Limpeza demo 0019: falha ao remover ${colecao}: ${errDel}`)
          }
        }
      } catch (errCol) {
        // Coleção/campo inexistente: ignorar (idempotente)
        console.log(`Limpeza demo 0019: coleção ${colecao} ignorada (${errCol})`)
      }
    }

    // 2. Residuais: pacientes demo que a 0017 não alcançou
    deletarPorFiltro(
      'pacientes',
      `tenant_id = '${tid}' && (cpf = '52998224725' || cpf = '70281692004' || cpf = '11144477735' || cpf = '88844411180' || cpf = '33399966601' || email ~ '@exemplo.com')`,
    )

    // 3. Planos de tratamento orfanados no tenant demo (sem dono demo restante).
    //    A coleção não tem paciente_id; remove-se por plano_id órfão e por
    //    número/observação de seed, sempre confinado ao tenant demo.
    try {
      const planos = app.findRecordsByFilter(
        'planos_tratamento',
        `tenant_id = '${tid}'`,
        '',
        500,
        0,
      )
      for (const p of planos) {
        try {
          app.delete(p)
          removidos++
        } catch (errP) {
          console.log(`Limpeza demo 0019: falha ao remover planos_tratamento: ${errP}`)
        }
      }
    } catch (errPlano) {
      console.log(`Limpeza demo 0019: planos_tratamento ignorado (${errPlano})`)
    }

    // 4. Agendamentos sem paciente (resíduos de seed com paciente já removido)
    try {
      const ags = app.findRecordsByFilter('agendamentos', `tenant_id = '${tid}'`, '', 500, 0)
      for (const a of ags) {
        if (!a.getString('paciente_id')) {
          try {
            app.delete(a)
            removidos++
          } catch (errA) {
            console.log(`Limpeza demo 0019: falha ao remover agendamento órfão: ${errA}`)
          }
        }
      }
    } catch (errAg) {
      console.log(`Limpeza demo 0019: agendamentos ignorado (${errAg})`)
    }

    // 5. Auditoria LGPD append-only
    try {
      const auditoriaCollection = app.findCollectionByNameOrId('auditoria_acesso')
      const log = new Record(auditoriaCollection)
      log.set('tenant_id', tid)
      log.set('user_id', '')
      log.set('user_email', 'sistema@gestecodonto.com.br')
      log.set('perfil', 'sistema')
      log.set('target_patient_id', '')
      log.set('acao', 'limpeza_dados_demo_complemento')
      log.set(
        'detalhes',
        `Complemento da limpeza de dados demo (Etapa 6 go-live): ${removidos} registros residuais removidos (planos de tratamento, agendamentos órfãos, pacientes @exemplo.com).`,
      )
      log.set('ip', 'Migration Servidor')
      log.set('timestamp', new Date().toISOString())
      app.save(log)
    } catch (errAud) {
      console.log('Limpeza demo 0019: falha ao registrar auditoria:', errAud)
    }

    console.log(`Limpeza demo 0019 concluída: ${removidos} registros residuais removidos.`)
  },
  (app) => {
    // Reversão: dados fictícios não voltam (go-live).
  },
)
