/// <reference path="../pb_data/types.d.ts" />
/**
 * Etapa 6 (Hardening / go-live) — Limpeza idempotente dos dados de demonstração.
 *
 * Remove APENAS os registros fictícios semeados pelas migrations 0006/0007/0009/
 * 0011/0013/0015 (pacientes de exemplo e seus agendamentos, orçamentos, lançamentos,
 * lembretes, mensagens, exames, prescrições, fila de espera, vínculos familiares,
 * odontogramas, evoluções e anamneses).
 *
 * PRESERVA de forma intocada: tenants, usuários (com precisa_trocar_senha/MFA
 * atuais), unidades, salas, profissionais, procedimentos (catálogo base),
 * entitlements e auditoria LGPD append-only.
 *
 * Seguro rodar várias vezes: quando não há mais dados demo, é um no-op.
 * Critério de identificação dos demo: CPFs semeados OU e-mails @exemplo.com,
 * sempre dentro do tenant demo — dados criados pelo usuário real nunca casam.
 */
migrate(
  (app) => {
    // 1. Localizar o tenant demo (CNPJ semeado; fallback pelo nome)
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
      console.log('Limpeza demo: nenhum tenant demo encontrado (no-op).')
      return
    }
    const tid = demoTenant.id

    // 2. Coletar pacientes demo do tenant demo
    let demoPacientes = []
    try {
      demoPacientes = app.findRecordsByFilter(
        'pacientes',
        `tenant_id = '${tid}' && (cpf = '52998224725' || cpf = '70281692004' || cpf = '11144477735' || cpf = '88844411180' || cpf = '33399966601' || email ~ '@exemplo.com')`,
        '',
        500,
        0,
      )
    } catch (_) {
      demoPacientes = []
    }

    const ids = demoPacientes.map((p) => p.id)
    let removidos = 0

    const deletarPorFiltro = (colecao, filtro) => {
      try {
        const recs = app.findRecordsByFilter(colecao, filtro, '', 500, 0)
        for (const r of recs) {
          try {
            app.delete(r)
            removidos++
          } catch (errDel) {
            console.log(`Limpeza demo: falha ao remover registro de ${colecao}: ${errDel}`)
          }
        }
      } catch (errCol) {
        // Coleção não existe ou campo não existe: ignorar (idempotente)
        console.log(`Limpeza demo: coleção ${colecao} ignorada (${errCol})`)
      }
    }

    // 3. Remover primeiro os dependentes (registros vinculados aos pacientes demo)
    if (ids.length > 0) {
      const filtroPacientes = ids.map((i) => `paciente_id = '${i}'`).join(' || ')
      const colecoesDependentes = [
        'agendamentos',
        'orcamentos',
        'lancamentos_financeiros',
        'lembretes',
        'mensagens',
        'exames_anexos',
        'prescricoes',
        'filas_espera',
        'vinculos_familiares',
        'odontogramas_snapshots',
        'evolucoes_clinicas',
        'anamneses',
      ]
      for (const c of colecoesDependentes) {
        deletarPorFiltro(c, `tenant_id = '${tid}' && (${filtroPacientes})`)
      }
    }

    // 4. Remover os pacientes demo por último
    for (const p of demoPacientes) {
      try {
        app.delete(p)
        removidos++
      } catch (errPac) {
        console.log(`Limpeza demo: falha ao remover paciente demo: ${errPac}`)
      }
    }

    // 5. Registrar na auditoria LGPD append-only
    try {
      const auditoriaCollection = app.findCollectionByNameOrId('auditoria_acesso')
      const log = new Record(auditoriaCollection)
      log.set('tenant_id', tid)
      log.set('user_id', '')
      log.set('user_email', 'sistema@gestecodonto.com.br')
      log.set('perfil', 'sistema')
      log.set('target_patient_id', '')
      log.set('acao', 'limpeza_dados_demo')
      log.set(
        'detalhes',
        `Limpeza idempotente dos dados de demonstração (Etapa 6 go-live): ${removidos} registros removidos. Estrutura (tenants, usuários, unidades, salas, procedimentos) preservada.`,
      )
      log.set('ip', 'Migration Servidor')
      log.set('timestamp', new Date().toISOString())
      app.save(log)
    } catch (errAud) {
      console.log('Limpeza demo: falha ao registrar auditoria:', errAud)
    }

    console.log(`Limpeza de dados demo concluída: ${removidos} registros removidos do tenant demo.`)
  },
  (app) => {
    // Reversão: não recria dados demo (dados fictícios não devem voltar em produção).
  },
)
