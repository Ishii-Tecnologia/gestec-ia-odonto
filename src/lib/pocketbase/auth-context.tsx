import React, { createContext, useContext, useEffect, useState } from 'react'
import { pb } from './client'
import { TenantRecord, UserPerfil, UserRecord, ModuloId } from '@/types/gestec'

interface AuthContextType {
  user: UserRecord | null
  tenant: TenantRecord | null
  perfil: UserPerfil
  tenantId: string
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  hasModule: (modulo: ModuloId) => boolean
  hasProfile: (allowed: UserPerfil[]) => boolean
  canAccessClinical: () => boolean
  canAccessFinancialReports: () => boolean
  toggleModuleEntitlement: (modulo: ModuloId, active: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [tenant, setTenant] = useState<TenantRecord | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Carregar dados de tenant e autenticação
  const loadTenantAndUser = async () => {
    setIsLoading(true)
    try {
      const authModel = pb.authStore.model
      if (authModel) {
        const u = authModel as unknown as UserRecord
        setUser(u)

        // Se o usuário tiver tenant_id, buscar os dados do tenant
        if (u.tenant_id) {
          try {
            const t = await pb.collection('tenants').getOne<TenantRecord>(u.tenant_id)
            setTenant(t)
          } catch {
            // Se falhar buscar pelo ID, tentar primeiro tenant
            const list = await pb.collection('tenants').getList<TenantRecord>(1, 1)
            if (list.items.length > 0) setTenant(list.items[0])
          }
        } else {
          // Buscar primeiro tenant padrão
          const list = await pb.collection('tenants').getList<TenantRecord>(1, 1)
          if (list.items.length > 0) setTenant(list.items[0])
        }
      } else {
        setUser(null)
        // Tenant fallback demo mesmo sem login para rotas de agendamento online público
        const list = await pb.collection('tenants').getList<TenantRecord>(1, 1)
        if (list.items.length > 0) setTenant(list.items[0])
      }
    } catch (err) {
      console.error('Erro ao carregar tenant e usuário:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTenantAndUser()
    return pb.authStore.onChange(() => {
      loadTenantAndUser()
    })
  }, [])

  const login = async (email: string, pass: string) => {
    await pb.collection('users').authWithPassword(email, pass)
    await loadTenantAndUser()
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  // Verificação de Entitlements (BL-002)
  const hasModule = (modulo: ModuloId): boolean => {
    if (!tenant) return true // Graceful
    if (modulo === 'core' || modulo === 'agenda' || modulo === 'pacientes') return true
    const modulos = tenant.modulos_ativos
    if (!modulos) return true
    return Boolean(modulos[modulo as keyof typeof modulos])
  }

  // Alternar módulo dinamicamente para validar CA-MOD-2 (<1 min sem deploy)
  const toggleModuleEntitlement = async (modulo: ModuloId, active: boolean) => {
    if (!tenant) return
    const currentMods = { ...(tenant.modulos_ativos || {}) }
    currentMods[modulo as keyof typeof currentMods] = active

    const updated = await pb.collection('tenants').update<TenantRecord>(tenant.id, {
      modulos_ativos: currentMods,
    })
    setTenant(updated)
  }

  const perfil: UserPerfil = (user?.perfil as UserPerfil) || 'dentista'

  // Regra RBAC / LGPD: Apenas clínicos (owner e dentista) acessam dados de prontuário e diagnóstico
  const canAccessClinical = (): boolean => {
    return perfil === 'owner' || perfil === 'dentista'
  }

  // Dentistas não veem relatórios financeiros consolidados globais por padrão
  const canAccessFinancialReports = (): boolean => {
    return perfil === 'owner' || perfil === 'financeiro'
  }

  const hasProfile = (allowed: UserPerfil[]): boolean => {
    if (!user) return false
    return allowed.includes(perfil)
  }

  const tenantId = tenant?.id || user?.tenant_id || 'demo-tenant'

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        perfil,
        tenantId,
        isLoading,
        login,
        logout,
        hasModule,
        hasProfile,
        canAccessClinical,
        canAccessFinancialReports,
        toggleModuleEntitlement,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
