/// <reference path="../pb_data/types.d.ts" />
// 0021 — Novo Super Admin de plataforma: consultoriaedesenvolvimentoia@gmail.com
// Mesmo padrão da migração 0003 (seção 10): perfil 'superadmin', SEM tenant clínico,
// senha provisória e precisa_trocar_senha = true (1º acesso força troca de senha + MFA).
// Idempotente: se o e-mail já existir, a migração é no-op (não sobrescreve senha nem flags).
migrate(
  (app) => {
    const email = 'consultoriaedesenvolvimentoia@gmail.com'

    // Idempotência: se o usuário já existe, não faz nada (evita redefinir senha
    // ou rearmar a flag caso a conta já esteja em uso)
    try {
      app.findAuthRecordByEmail('users', email)
      return
    } catch (_) {}

    const users = app.findCollectionByNameOrId('users')

    const superAdmin = new Record(users)
    superAdmin.set('email', email)
    superAdmin.set('name', 'Consultoria e Desenvolvimento IA (Super Admin)')
    superAdmin.setPassword('Skip@Pass123')
    superAdmin.set('verified', true)
    superAdmin.set('perfil', 'superadmin')
    // Conta de plataforma: sem tenant clínico e sem unidade
    superAdmin.set('precisa_trocar_senha', true)
    superAdmin.set('mfa_ativo', false)
    app.save(superAdmin)

    console.log('[0021] Super Admin criado: ' + email + ' (precisa_trocar_senha=true, sem tenant)')
  },
  (app) => {
    // Reversão: remove a conta criada (apenas se ainda existir)
    try {
      const rec = app.findAuthRecordByEmail('users', 'consultoriaedesenvolvimentoia@gmail.com')
      app.delete(rec)
    } catch (_) {}
  },
)
