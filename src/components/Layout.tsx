import React, { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { ModuloId, UserPerfil } from '@/types/gestec'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  FileSpreadsheet,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  ShieldAlert,
  Sparkles,
  Building2,
  Server,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface NavItem {
  name: string
  path: string
  icon: React.ElementType
  modulo: ModuloId
  clinicalOnly?: boolean
  financialOnly?: boolean
  ownerOnly?: boolean
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, modulo: 'core' },
  { name: 'Agenda', path: '/agenda', icon: Calendar, modulo: 'agenda' },
  { name: 'Pacientes', path: '/pacientes', icon: Users, modulo: 'pacientes' },
  {
    name: 'Prontuário',
    path: '/prontuario',
    icon: Stethoscope,
    modulo: 'prontuario',
    clinicalOnly: true,
  },
  { name: 'Orçamentos', path: '/orcamentos', icon: FileSpreadsheet, modulo: 'orcamentos' },
  {
    name: 'Financeiro',
    path: '/financeiro',
    icon: DollarSign,
    modulo: 'financeiro',
    financialOnly: true,
  },
  { name: 'Relatórios & BI', path: '/relatorios', icon: BarChart3, modulo: 'bi' },
  {
    name: 'Gestão da Clínica',
    path: '/configuracoes',
    icon: Settings,
    modulo: 'core',
    ownerOnly: true,
  },
  {
    name: 'Super Admin',
    path: '/superadmin',
    icon: Server,
    modulo: 'core',
    superAdminOnly: true,
  },
]

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const {
    user,
    tenant,
    perfil,
    logout,
    hasModule,
    canAccessClinical,
    canAccessFinancialReports,
    isSuperAdmin,
    isOwner,
    switchPerfilSimulado,
  } = useAuth()

  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col justify-between
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'lg:w-[72px]' : 'w-[260px]'}`}
      >
        <div>
          {/* Logo Brand */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
            <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-[#0E7490] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Stethoscope className="w-5 h-5" />
              </div>
              {!collapsed && (
                <div className="truncate">
                  <div className="font-bold text-sm tracking-tight text-slate-900 flex items-center gap-1">
                    GesTec-IA
                    <span className="text-[10px] font-semibold text-[#0E7490] bg-cyan-50 px-1.5 py-0.2 rounded">
                      v2.0
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {tenant?.nome || 'Consultório Odonto'}
                  </div>
                </div>
              )}
            </Link>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Seletor Rápido de Perfil para Demonstração de RBAC */}
          {!collapsed && (
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[#0E7490]" />
                  Perfil em Uso (RBAC)
                </span>
              </div>
              <Select value={perfil} onValueChange={(val: UserPerfil) => switchPerfilSimulado(val)}>
                <SelectTrigger className="h-7 text-[11px] bg-white border-slate-200">
                  <SelectValue placeholder="Selecione o perfil..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin (Plataforma)</SelectItem>
                  <SelectItem value="owner">Owner (Dra. Renata)</SelectItem>
                  <SelectItem value="dentista">Dentista (Dr. Marcelo)</SelectItem>
                  <SelectItem value="recepcao">Recepção (Camila)</SelectItem>
                  <SelectItem value="financeiro">Financeiro (Eduardo)</SelectItem>
                  <SelectItem value="asb">ASB (Juliana)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              // Filtrar itens específicos de privilégio
              if (item.superAdminOnly && !isSuperAdmin()) return null
              if (item.ownerOnly && !isOwner()) return null

              const active =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))
              const isModuleActive = hasModule(item.modulo)
              const isClinicalBlocked = item.clinicalOnly && !canAccessClinical()
              const isFinancialBlocked = item.financialOnly && !canAccessFinancialReports()

              const Icon = item.icon

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${active ? 'bg-cyan-50 text-[#0E7490] font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    ${collapsed ? 'justify-center' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${active ? 'text-[#0E7490]' : 'text-slate-400 group-hover:text-slate-600'}`}
                  />

                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1">
                      <span>{item.name}</span>
                      {!isModuleActive && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Pro
                        </span>
                      )}
                      {(isClinicalBlocked || isFinancialBlocked) && (
                        <span
                          className="text-[10px] text-slate-400"
                          title="Acesso restrito por perfil"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 inline text-amber-500" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tooltip quando colapsado */}
                  {collapsed && (
                    <div className="hidden group-hover:block absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow whitespace-nowrap z-50">
                      {item.name} {!isModuleActive && '(Plano Pro)'}
                    </div>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-100">
          <div
            className={`flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-xs flex items-center justify-center shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'OD'}
            </div>
            {!collapsed && (
              <div className="flex-1 truncate">
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {user?.name || 'Dra. Renata'}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 capitalize">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-slate-300">
                    {perfil}
                  </Badge>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-slate-400 hover:text-red-600 h-8 w-8 shrink-0"
              title="Encerrar Sessão"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'}`}
      >
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur sticky top-0 z-30 border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
              title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Global Search Bar */}
            <div className="relative w-64 md:w-80 hidden sm:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar paciente, prontuário..."
                className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2">
            {/* Quick Online Booking Link */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden md:inline-flex text-xs h-8 gap-1.5 text-[#0E7490] border-cyan-200 bg-cyan-50/50 hover:bg-cyan-100"
            >
              <Link to="/agendar-online" target="_blank">
                <Calendar className="w-3.5 h-3.5" />
                Agendamento Público
              </Link>
            </Button>

            {/* Notificações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-500">
                  <Bell className="w-4 h-4" />
                  <span className="w-2 h-2 rounded-full bg-cyan-600 absolute top-2 right-2"></span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                <DropdownMenuLabel className="text-xs text-slate-500">
                  Notificações Operacionais
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1 text-xs text-slate-600 py-1">
                  <div className="p-2 rounded bg-cyan-50/60 border border-cyan-100">
                    <p className="font-medium text-slate-800">Conformidade LGPD</p>
                    <p className="text-[11px] text-slate-500">
                      Trilha de auditoria append-only operando normalmente.
                    </p>
                  </div>
                  <div className="p-2 rounded hover:bg-slate-50">
                    <p className="font-medium text-slate-800">Prontuário Imutável</p>
                    <p className="text-[11px] text-slate-500">
                      Evoluções gravadas com hash cronológico.
                    </p>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-2.5 h-9">
                  <div className="w-7 h-7 rounded-full bg-[#0E7490] text-white font-bold text-xs flex items-center justify-center">
                    {user?.name ? user.name[0].toUpperCase() : 'R'}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-semibold text-slate-800 leading-none">
                      {user?.name || 'Dra. Renata'}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize leading-none mt-1">
                      {perfil}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-normal text-xs text-slate-500">Logado como</div>
                  <div className="font-semibold text-xs text-slate-800 truncate">
                    {user?.email || 'owner@gestecodonto.com.br'}
                  </div>
                  {user?.cro && (
                    <div className="text-[10px] text-cyan-700 font-mono mt-0.5">{user.cro}</div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes" className="text-xs cursor-pointer">
                    <Settings className="w-3.5 h-3.5 mr-2" />
                    Gestão & Entitlements
                  </Link>
                </DropdownMenuItem>
                {isSuperAdmin() && (
                  <DropdownMenuItem asChild>
                    <Link to="/superadmin" className="text-xs cursor-pointer text-red-600">
                      <Server className="w-3.5 h-3.5 mr-2" />
                      Painel Super Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-xs text-red-600 focus:text-red-700 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children || <Outlet />}</main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-400">
          <span>
            GesTec-IA-Odonto v2.0 Modular — Plataforma em conformidade com LGPD (Lei 13.709/18) e
            CFO
          </span>
        </footer>
      </div>
    </div>
  )
}
