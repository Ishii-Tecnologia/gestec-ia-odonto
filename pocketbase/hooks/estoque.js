/// <reference path="../pb_data/types.d.ts" />
// BL-025 — Controle de Estoque & Insumos: validações server-side.
//
// - Saldo atual do insumo = soma das movimentações (entrada soma; consumo/perda
//   subtraem; ajuste define pelo valor informado). Consumo/perda/ajuste que
//   deixem o saldo negativo são BLOQUEADOS (400).
// - Regras de perfil reforçadas no servidor:
//     insumo/lote (entrada): owner, financeiro, superadmin
//     movimentação: owner/financeiro/superadmin (qualquer tipo)
//       + dentista/asb (somente consumo)
// - Auditoria LGPD: toda entrada, consumo, ajuste, perda e mudança de cadastro
//   de insumo gera registro append-only na coleção auditoria_acesso.
//
// ATENÇÃO (padrão do projeto): callbacks 100% inline, sem constantes/funções
// top-level compartilhadas entre callbacks (limitação de scoping da JSVM).

// ---------- Normalização de tenant/unidade + perfis ----------
onRecordCreateRequest(
  (e) => {
    const perfil = e.auth ? String(e.auth.get('perfil') || '') : ''

    // Isolamento por tenant: registro sempre fica no tenant do usuário
    // (superadmin pode atuar em qualquer tenant explicitamente informado).
    if (e.auth && perfil !== 'superadmin') {
      e.record.set('tenant_id', String(e.auth.get('tenant_id') || ''))
    }

    e.next()
  },
  'insumos',
  'lotes_estoque',
  'movimentacoes_estoque',
)

// ---------- Lote (entrada): perfil gestor ----------
onRecordCreateRequest((e) => {
  const perfil = e.auth ? String(e.auth.get('perfil') || '') : ''
  const podeGerenciar = ['owner', 'financeiro', 'superadmin'].includes(perfil)
  if (!podeGerenciar) {
    return e.json(403, {
      status: 403,
      message: 'Apenas Owner, Financeiro ou Super Admin registram entradas de lote.',
    })
  }
  e.next()
}, 'lotes_estoque')

// ---------- Bloqueio de saldo negativo + perfis por tipo ----------
onRecordCreateRequest((e) => {
  const perfil = e.auth ? String(e.auth.get('perfil') || '') : ''
  const tipo = String(e.record.get('tipo') || '')
  const qtd = Number(e.record.get('quantidade') || 0)
  const insumoId = String(e.record.get('insumo_id') || '')

  if (qtd <= 0) {
    return e.json(400, {
      status: 400,
      message: 'A quantidade da movimentação deve ser maior que zero.',
    })
  }

  const podeGerenciar = ['owner', 'financeiro', 'superadmin'].includes(perfil)

  // Dentista e ASB só registram consumo clínico/manual
  if ((perfil === 'dentista' || perfil === 'asb') && tipo !== 'consumo') {
    return e.json(403, {
      status: 403,
      message: 'Dentista e ASB podem registrar apenas consumos de insumos.',
    })
  }

  // Consumo manual exige motivo obrigatório
  if (tipo === 'consumo' && !String(e.record.get('motivo') || '').trim()) {
    const temVinculo = String(e.record.get('atendimento_id') || '').trim()
    if (!temVinculo) {
      return e.json(400, {
        status: 400,
        message: 'Consumo manual exige o preenchimento do motivo.',
      })
    }
  }

  // Consumo/perda exigem saldo suficiente; ajuste define o saldo e não pode ser negativo
  let insumo = null
  try {
    insumo = e.app.findRecordById('insumos', insumoId)
  } catch (_) {
    insumo = null
  }
  if (!insumo) {
    return e.json(400, {
      status: 400,
      message: 'Insumo não encontrado para esta movimentação.',
    })
  }

  // Saldo atual = soma das movimentações existentes do insumo (por tenant)
  let saldo = 0
  try {
    const movs = e.app.findRecordsByFilter(
      'movimentacoes_estoque',
      `tenant_id = '${e.record.get('tenant_id')}' && insumo_id = '${insumoId}'`,
      '',
      0,
      0,
    )
    for (const m of movs) {
      const t = String(m.get('tipo') || '')
      const q = Number(m.get('quantidade') || 0)
      if (t === 'entrada') saldo += q
      else if (t === 'consumo' || t === 'perda') saldo -= q
      else if (t === 'ajuste') saldo = q
    }
  } catch (_) {
    saldo = 0
  }

  if (tipo === 'consumo' || tipo === 'perda') {
    if (qtd > saldo) {
      return e.json(400, {
        status: 400,
        message:
          'Operação bloqueada: o insumo não possui saldo suficiente (saldo atual: ' + saldo + ').',
      })
    }
  } else if (tipo === 'ajuste' && qtd < 0) {
    return e.json(400, {
      status: 400,
      message: 'O ajuste deve informar o saldo final (valor não negativo).',
    })
  }

  // Ajuste e perda: apenas perfis gestores
  if ((tipo === 'ajuste' || tipo === 'perda') && !podeGerenciar) {
    return e.json(403, {
      status: 403,
      message: 'Apenas Owner, Financeiro ou Super Admin registram ajustes e perdas.',
    })
  }

  e.next()
}, 'movimentacoes_estoque')

// ---------- Auditoria LGPD (append-only) ----------
onRecordCreateRequest((e) => {
  const res = e.next()
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('tenant_id', e.record.get('tenant_id') || 'sistema')
    audit.set('user_id', e.auth ? String(e.auth.get('id') || '') : '')
    audit.set('user_email', e.auth ? String(e.auth.get('email') || '') : 'sistema')
    audit.set('perfil', e.auth ? String(e.auth.get('perfil') || '') : 'sistema')
    audit.set('target_patient_id', String(e.record.get('paciente_id') || ''))
    audit.set('acao', 'estoque_movimentacao')
    audit.set(
      'detalhes',
      'Movimentação de estoque: ' +
        e.record.get('tipo') +
        ' de ' +
        e.record.get('quantidade') +
        ' (insumo ' +
        e.record.get('insumo_id') +
        ')' +
        (e.record.get('motivo') ? ' — motivo: ' + e.record.get('motivo') : ''),
    )
    audit.set('ip', e.realIP ? e.realIP() : 'desconhecido')
    audit.set('timestamp', new Date().toISOString())
    e.app.save(audit)
  } catch (err) {
    console.warn('Falha ao auditar movimentação de estoque:', err)
  }
  return res
}, 'movimentacoes_estoque')

onRecordCreateRequest((e) => {
  const res = e.next()
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('tenant_id', e.record.get('tenant_id') || 'sistema')
    audit.set('user_id', e.auth ? String(e.auth.get('id') || '') : '')
    audit.set('user_email', e.auth ? String(e.auth.get('email') || '') : 'sistema')
    audit.set('perfil', e.auth ? String(e.auth.get('perfil') || '') : 'sistema')
    audit.set('target_patient_id', '')
    audit.set('acao', 'estoque_entrada_lote')
    audit.set(
      'detalhes',
      'Entrada de lote: ' +
        e.record.get('quantidade') +
        ' un. do insumo ' +
        e.record.get('insumo_id') +
        ' (custo unit. R$ ' +
        e.record.get('custo_unitario') +
        ').',
    )
    audit.set('ip', e.realIP ? e.realIP() : 'desconhecido')
    audit.set('timestamp', new Date().toISOString())
    e.app.save(audit)
  } catch (err) {
    console.warn('Falha ao auditar entrada de lote:', err)
  }
  return res
}, 'lotes_estoque')

onRecordCreateRequest((e) => {
  const res = e.next()
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('tenant_id', e.record.get('tenant_id') || 'sistema')
    audit.set('user_id', e.auth ? String(e.auth.get('id') || '') : '')
    audit.set('user_email', e.auth ? String(e.auth.get('email') || '') : 'sistema')
    audit.set('perfil', e.auth ? String(e.auth.get('perfil') || '') : 'sistema')
    audit.set('target_patient_id', '')
    audit.set('acao', 'estoque_insumo_cadastro')
    audit.set(
      'detalhes',
      'Insumo "' +
        e.record.get('nome') +
        '" cadastrado (categoria ' +
        e.record.get('categoria') +
        ', mínimo ' +
        e.record.get('estoque_minimo') +
        ').',
    )
    audit.set('ip', e.realIP ? e.realIP() : 'desconhecido')
    audit.set('timestamp', new Date().toISOString())
    e.app.save(audit)
  } catch (err) {
    console.warn('Falha ao auditar cadastro de insumo:', err)
  }
  return res
}, 'insumos')

onRecordUpdateRequest((e) => {
  const res = e.next()
  try {
    const audit = new Record(e.app.findCollectionByNameOrId('auditoria_acesso'))
    audit.set('tenant_id', e.record.get('tenant_id') || 'sistema')
    audit.set('user_id', e.auth ? String(e.auth.get('id') || '') : '')
    audit.set('user_email', e.auth ? String(e.auth.get('email') || '') : 'sistema')
    audit.set('perfil', e.auth ? String(e.auth.get('perfil') || '') : 'sistema')
    audit.set('target_patient_id', '')
    audit.set('acao', 'estoque_insumo_edicao')
    audit.set(
      'detalhes',
      'Cadastro do insumo "' + e.record.get('nome') + '" atualizado (mínimo/custo/fornecedor).',
    )
    audit.set('ip', e.realIP ? e.realIP() : 'desconhecido')
    audit.set('timestamp', new Date().toISOString())
    e.app.save(audit)
  } catch (err) {
    console.warn('Falha ao auditar edição de insumo:', err)
  }
  return res
}, 'insumos')
