import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/pocketbase/auth-context'
import TrocarSenhaPage from '@/pages/TrocarSenhaPage'
import MfaSetupPage from '@/pages/MfaSetupPage'
import MfaVerifyPage from '@/pages/MfaVerifyPage'

/**
 * Gate de Hardening (Etapa 6):
 * 1. Se o usuário precisa trocar a senha no primeiro acesso (precisa_trocar_senha = true),
 *    ele é retido obrigatoriamente na tela TrocarSenhaPage. Nenhuma rota protegida é acessível.
 * 2. Se o usuário já trocou a senha e pertence a perfis obrigatórios (superadmin, owner)
 *    mas ainda não configurou MFA (mfa_ativo = false), ele é retido na tela MfaSetupPage.
 * 3. Se o usuário tem MFA ativo, mas ainda não informou o token TOTP nesta sessão do navegador,
 *    ele é retido na tela MfaVerifyPage.
 * 4. Passados todos os passos de segurança, o conteúdo protegido é renderizado via <Outlet /> ou children.
 */
export const SecurityGate: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, mustChangePassword, mustSetupMfa, mfaPendingVerification } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono">Carregando credenciais de acesso seguro...</p>
        </div>
      </div>
    )
  }

  // Se não estiver autenticado, redireciona para login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // 1. Passo obrigatório de troca de senha no primeiro acesso
  if (mustChangePassword) {
    return <TrocarSenhaPage />
  }

  // 2. Passo obrigatório de configuração de MFA (perfis superadmin e owner)
  if (mustSetupMfa) {
    return <MfaSetupPage />
  }

  // 3. Passo obrigatório de verificação TOTP no login
  if (mfaPendingVerification) {
    return <MfaVerifyPage />
  }

  return <>{children || <Outlet />}</>
}
