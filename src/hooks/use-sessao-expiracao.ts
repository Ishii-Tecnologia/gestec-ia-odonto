import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { SessaoExpiracaoWatcher } from '@/lib/sessao-expiracao'
import { useAuth } from '@/lib/pocketbase/auth-context'

/**
 * Etapa 6 (Hardening) — Ativa a expiração de sessão por inatividade.
 *
 * Só roda com usuário autenticado e fora das telas públicas. Ao expirar:
 * 1. chama o endpoint POST /backend/v1/gestec/logout (invalida o token no
 *    servidor — logout real, não só frontend);
 * 2. limpa o authStore local;
 * 3. redireciona ao /login com a mensagem leiga de sessão expirada.
 */
export const useSessaoExpiracao = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const watcherRef = useRef<SessaoExpiracaoWatcher | null>(null)

  const isRotaPublica =
    ['/login', '/recuperar-senha', '/redefinir-senha', '/agendamento-publico'].some((r) =>
      location.pathname.startsWith(r),
    ) || !user

  useEffect(() => {
    if (isRotaPublica) {
      watcherRef.current?.parar()
      watcherRef.current = null
      return
    }

    const watcher = new SessaoExpiracaoWatcher({
      onExpirar: async () => {
        // 1. Logout REAL no servidor (invalida o token)
        try {
          await pb.send('/backend/v1/gestec/logout', { method: 'POST' })
        } catch (err) {
          console.warn('Logout servidor-side falhou (seguindo com logout local):', err)
        }
        // 2. Logout local (limpa authStore) sem redirecionar por conta própria
        logout()
      },
    })

    watcherRef.current = watcher
    watcher.iniciar()

    return () => {
      watcher.parar()
      watcherRef.current = null
    }
  }, [isRotaPublica, user?.id, logout])
}

export default useSessaoExpiracao
