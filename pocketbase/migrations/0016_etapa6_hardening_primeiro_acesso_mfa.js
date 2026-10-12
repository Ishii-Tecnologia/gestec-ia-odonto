/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1. Campo precisa_trocar_senha (bool)
    if (!users.fields.getByName('precisa_trocar_senha')) {
      users.fields.add(
        new BoolField({
          name: 'precisa_trocar_senha',
          required: false,
        }),
      )
    }

    // 2. Campo mfa_ativo (bool)
    if (!users.fields.getByName('mfa_ativo')) {
      users.fields.add(
        new BoolField({
          name: 'mfa_ativo',
          required: false,
        }),
      )
    }

    // 3. Campo mfa_config (JSON com segredo TOTP criptografado/armazenado, data de ativação, recovery_codes com hashes ou tokens)
    if (!users.fields.getByName('mfa_config')) {
      users.fields.add(
        new JSONField({
          name: 'mfa_config',
          required: false,
        }),
      )
    }

    // 4. Campo senha_modificada_em (text ISO string)
    if (!users.fields.getByName('senha_modificada_em')) {
      users.fields.add(
        new TextField({
          name: 'senha_modificada_em',
          required: false,
        }),
      )
    }

    app.save(users)

    // 5. Atualizar os usuários de demonstração existentes para exigir troca de senha inicial (precisa_trocar_senha = true)
    // Conforme o pedido: "O seed/dados de demonstração devem marcar todos os usuários com a flag ativa"
    try {
      app
        .db()
        .newQuery(`
        UPDATE users
        SET precisa_trocar_senha = 1
        WHERE email IN (
          'superadmin@gestecodonto.com.br',
          'owner@gestecodonto.com.br',
          'dentista@gestecodonto.com.br',
          'recepcao@gestecodonto.com.br',
          'financeiro@gestecodonto.com.br',
          'asb@gestecodonto.com.br',
          'ishii7883@gmail.com'
        )
      `)
        .execute()
    } catch (e) {
      console.log('Aviso ao atualizar precisa_trocar_senha dos usuários de seed:', e)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('precisa_trocar_senha')) {
      users.fields.removeByName('precisa_trocar_senha')
    }
    if (users.fields.getByName('mfa_ativo')) {
      users.fields.removeByName('mfa_ativo')
    }
    if (users.fields.getByName('mfa_config')) {
      users.fields.removeByName('mfa_config')
    }
    if (users.fields.getByName('senha_modificada_em')) {
      users.fields.removeByName('senha_modificada_em')
    }
    app.save(users)
  },
)
