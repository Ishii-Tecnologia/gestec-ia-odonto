import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from './client'
import { TenantRecord, UserPerfil, UserRecord, ModuloId } from '@/types/gestec'
import { validarDependenciasModulo } from '@/services/entitlements'

interface AuthContextType {
  user: UserRecord | null
  tenant: TenantRecord | null
  perfil: UserPerfil
  tenantId: string
  isLoading: boolean
  allTenants: TenantRecord[]
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  switchTenant: (newTenantId: string) => Promise<void>
  switchPerfilSimulado: (novoPerfil: UserPerfil) => void
  hasModule: (modulo: ModuloId) => boolean
  hasProfile: (allowed: UserPerfil[]) => boolean
  canAccessClinical: () => boolean
  canAccessFinancialReports: () => boolean
  isSuperAdmin: () => boolean
  isOwner: () => boolean
  toggleModuleEntitlement: (modulo: ModuloId, active: boolean) => Promise<void>
  refreshTenant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [tenant, setTenant] = useState<TenantRecord | null>(null)
  const [allTenants, setAllTenants] = useState<TenantRecord[]>([])
  const [simulatedPerfil, setSimulatedPerfil] = useState<UserPerfil | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Carregar dados de tenant e autenticação
  const loadTenantAndUser = async () => {
    setIsLoading(true)
    try {
      const authModel = pb.authStore.model
      let currentTenant: TenantRecord | null = null

      // Carregar lista de tenants disponíveis
      try {
        const list = await pb.collection('tenants').getList<TenantRecord>(1, 50, {
          sort: 'nome',
        })
        setAllTenants(list.items)
        if (list.items.length > 0) {
          currentTenant = list.items[0]
        }
      } catch (err) {
        console.warn('Não foi possível listar tenants:', err)
      }

      if (authModel) {
        const u = authModel as unknown as UserRecord
        setUser(u)

        if (u.tenant_id) {
          try {
            const t = await pb.collection('tenants').getOne<TenantRecord>(u.tenant_id)
            setTenant(t)
          } catch {
            if (currentTenant) setTenant(currentTenant)
          }
        } else if (currentTenant) {
          setTenant(currentTenant)
        }
      } else {
        setUser(null)
        if (currentTenant) setTenant(currentTenant)
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
    setSimulatedPerfil(null)
    await loadTenantAndUser()
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setSimulatedPerfil(null)
  }

  const switchTenant = async (newTenantId: string) => {
    try {
      const t = await pb.collection('tenants').getOne<TenantRecord>(newTenantId)
      setTenant(t)
    } catch (err) {
      console.error('Erro ao alternar tenant:', err)
    }
  }

  const switchPerfilSimulado = (novoPerfil: UserPerfil) => {
    setSimulatedPerfil(novoPerfil)
  }

  const refreshTenant = async () => {
    if (!tenant) return
    try {
      const refreshed = await pb.collection('tenants').getOne<TenantRecord>(tenant.id)
      setTenant(refreshed)
    } catch (err) {
      console.warn('Erro ao atualizar tenant:', err)
    }
  }

  // Verificação de Entitlements (BL-002)
  const hasModule = (modulo: ModuloId): boolean => {
    if (!tenant) return true
    if (modulo === 'core' || modulo === 'agenda' || modulo === 'pacientes') return true
    const modulos = tenant.modulos_ativos
    if (!modulos) return false
    return Boolean(modulos[modulo as keyof typeof modulos])
  }

  // Alternar módulo dinamicamente para validar CA-MOD-2 (<1 min sem deploy)
  const toggleModuleEntitlement = async (modulo: ModuloId, active: boolean) => {
    if (!tenant) return
    const currentMods = {
      ...(tenant.modulos_ativos || { core: true, agenda: true, pacientes: true }),
    }

    if (active) {
      const depCheck = validarDependenciasModulo(modulo, currentMods)
      if (!depCheck.satisfeito) {
        throw new Error(
          `Para ativar ${modulo}, é necessário ativar previamente: ${depCheck.faltando.join(', ')}`,
        )
      }
    }

    currentMods[modulo as keyof typeof currentMods] = active

    const updated = await pb.collection('tenants').update<TenantRecord>(tenant.id, {
      modulos_ativos: currentMods,
    })
    setTenant(updated)
  }

  const perfilReal: UserPerfil = (user?.perfil as UserPerfil) || 'owner'
  const perfil: UserPerfil = simulatedPerfil || perfilReal

  const isSuperAdmin = (): boolean => perfil === 'superadmin'
  const isOwner = (): boolean => perfil === 'owner' || perfil === 'superadmin'

  // Regra RBAC / LGPD: Apenas clínicos (owner, dentista, superadmin) acessam dados de prontuário e diagnóstico
  const canAccessClinical = (): boolean => {
    return perfil === 'superadmin' || perfil === 'owner' || perfil === 'dentista'
  }

  // Apenas gestores acessam relatórios financeiros consolidados globais por padrão
  const canAccessFinancialReports = (): boolean => {
    return perfil === 'superadmin' || perfil === 'owner' || perfil === 'financeiro'
  }

  const hasProfile = (allowed: UserPerfil[]): boolean => {
    if (perfil === 'superadmin') return true
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
        allTenants,
        login,
        logout,
        switchTenant,
        switchPerfilSimulado,
        hasModule,
        hasProfile,
        canAccessClinical,
        canAccessFinancialReports,
        isSuperAdmin,
        isOwner,
        toggleModuleEntitlement,
        refreshTenant,
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
