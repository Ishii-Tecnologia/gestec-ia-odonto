/// <reference path="../pb_data/types.d.ts" />
/**
 * Etapa 6 (Hardening) — coleção de bloqueios de login (força bruta).
 *
 * Cada registro rastreia o acumulado de tentativas malsucedidas de um e-mail:
 *   - tentativas_falhas: contador corrente
 *   - bloqueado_ate: ISO date; se no futuro, novas tentativas de auth com este
 *     e-mail são rejeitadas pelo hook de login antes mesmo de validar a senha
 *   - bloqueios_total: quantas vezes a conta já foi bloqueada (crescimento
 *     progressivo da janela: 15, 30, 45... minutos via fator do hook)
 *
 * Sem regras de API (null em todas): a manipulação dos registros acontece
 * SOMENTE no servidor, nos pb_hooks — o frontend acessa via endpoint dedicado
 * /backend/v1/gestec/bloqueios (somente leitura, superadmin).
 */
migrate(
  (app) => {
    let col
    try {
      app.findCollectionByNameOrId('bloqueios_login')
      return // já existe — migration idempotente
    } catch (_) {
      col = new Collection({
        name: 'bloqueios_login',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      })

      col.fields.add(new TextField({ name: 'email', required: true, max: 255 }))
      col.fields.add(new NumberField({ name: 'tentativas_falhas', onlyInt: true, min: 0 }))
      col.fields.add(new TextField({ name: 'primeira_tentativa_em' }))
      col.fields.add(new TextField({ name: 'ultima_tentativa_em' }))
      col.fields.add(new TextField({ name: 'bloqueado_ate' }))
      col.fields.add(new NumberField({ name: 'bloqueios_total', onlyInt: true, min: 0 }))
      col.fields.add(new TextField({ name: 'ips_tentantes', max: 500 }))

      col.addIndex('idx_bloqueios_login_email', true, 'email')

      app.save(col)
      console.log('Coleção bloqueios_login criada (Etapa 6 — bloqueio de força bruta).')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bloqueios_login')
      app.delete(col)
    } catch (_) {}
  },
)
