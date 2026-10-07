import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { TenantRecord, PlanoTenant } from '@/types/gestec'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Building2,
  ShieldAlert,
  Plus,
  Power,
  Users,
  Calendar,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react'
import { MODULOS_POR_PLANO } from '@/services/entitlements'

export default function SuperAdminPainel() {
  const { user, isSuperAdmin, switchTenant } = useAuth()
  const { toast } = useToast()

  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Telemetria básica
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [totalAgendamentos, setTotalAgendamentos] = useState(0)
  const [totalPacientes, setTotalPacientes] = useState(0)

  // Novo Tenant Modal
  const [novoTenantOpen, setNovoTenantOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaRazao, setNovaRazao] = useState('')
  const [novoCnpj, setNovoCnpj] = useState('')
  const [novoPlano, setNovoPlano] = useState<PlanoTenant>('suite-clinica')
  const [salvando, setSalvando] = useState(false)

  const carregarDadosPlataforma = async () => {
    setLoading(true)
    try {
      // 1. Tenants
      const tRes = await pb.collection('tenants').getList<TenantRecord>(1, 100, {
        sort: '-created',
      })
      setTenants(tRes.items)

      // 2. Telemetria
      const [uRes, agRes, pacRes] = await Promise.all([
        pb.collection('users').getList(1, 1),
        pb.collection('agendamentos').getList(1, 1),
        pb.collection('pacientes').getList(1, 1),
      ])
      setTotalUsuarios(uRes.totalItems)
      setTotalAgendamentos(agRes.totalItems)
      setTotalPacientes(pacRes.totalItems)
    } catch (err) {
      console.warn('Erro ao carregar telemetria:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosPlataforma()
  }, [])

  const handleCriarTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }

    setSalvando(true)
    try {
      const modulosIniciais =
        MODULOS_POR_PLANO[novoPlano] || MODULOS_POR_PLANO['consultorio-essencial']

      await pb.collection('tenants').create({
        nome: novoNome,
        razao_social: novaRazao || novoNome,
        cnpj: novoCnpj || '',
        plano: novoPlano,
        modulos_ativos: modulosIniciais,
        limites: {
          profissionais_max: novoPlano === 'suite-completa' ? 20 : 5,
          cadeiras_max: novoPlano === 'suite-completa' ? 8 : 2,
          mensagens_mes: 500,
        },
        ativo: true,
      })

      toast({
        title: 'Tenant Provisionado com Sucesso',
        description: `Clínica ${novoNome} ativada no plano ${novoPlano}.`,
      })

      setNovoTenantOpen(false)
      setNovoNome('')
      setNovaRazao('')
      setNovoCnpj('')
      carregarDadosPlataforma()
    } catch (err: any) {
      toast({
        title: 'Erro ao provisionar tenant',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleStatusTenant = async (t: TenantRecord) => {
    const novoStatus = !t.ativo
    try {
      await pb.collection('tenants').update(t.id, {
        ativo: novoStatus,
      })
      toast({
        title: novoStatus ? 'Tenant Ativado' : 'Tenant Suspenso',
        description: `O status da clínica ${t.nome} foi atualizado.`,
      })
      carregarDadosPlataforma()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleAcessarComoTenant = async (tenantId: string) => {
    await switchTenant(tenantId)
    toast({
      title: 'Contexto Alternado',
      description: 'Agora você está operando dentro deste tenant.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-xl shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Painel de Controle Super Admin
            </h1>
            <Badge className="bg-red-500 text-white text-xs">Plataforma SaaS</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Gestão do ciclo de vida de tenants (clínicas odontológicas), telemetria multi-tenant e
            governança.
          </p>
        </div>

        <Dialog open={novoTenantOpen} onOpenChange={setNovoTenantOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9">
              <Plus className="w-4 h-4 mr-1.5" />
              Provisionar Nova Clínica
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Tenant / Clínica</DialogTitle>
              <DialogDescription className="text-xs">
                Provisione uma nova organização multi-tenant com isolamento lógico de banco de
                dados.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarTenant} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome Fantasia da Clínica *</Label>
                <Input
                  placeholder="Ex: Odonto Prime Alphaville"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Razão Social</Label>
                <Input
                  placeholder="Ex: Prime Odontologia Especializada Ltda"
                  value={novaRazao}
                  onChange={(e) => setNovaRazao(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={novoCnpj}
                  onChange={(e) => setNovoCnpj(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Plano de Assinatura Inicial *</Label>
                <Select value={novoPlano} onValueChange={(v: PlanoTenant) => setNovoPlano(v)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecione o plano..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultorio-essencial">
                      Consultório Essencial (Core + Agenda + Pacientes)
                    </SelectItem>
                    <SelectItem value="suite-clinica">
                      Suíte Clínica (+ Prontuário + Orçamentos)
                    </SelectItem>
                    <SelectItem value="suite-gestao">Suíte Gestão (+ Financeiro + BI)</SelectItem>
                    <SelectItem value="suite-completa">
                      Suíte Completa (Todos os módulos ativos)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoTenantOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={salvando}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                >
                  {salvando ? 'Provisionando...' : 'Criar Tenant'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid de Telemetria Geral da Plataforma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Tenants Cadastrados
            </CardTitle>
            <Building2 className="w-4 h-4 text-[#0E7490]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{tenants.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              {tenants.filter((t) => t.ativo).length} clínicas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Usuários da Plataforma
            </CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalUsuarios}</div>
            <p className="text-[11px] text-slate-500 mt-1">Profissionais e operadores</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Pacientes em Banco</CardTitle>
            <Activity className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalPacientes}</div>
            <p className="text-[11px] text-slate-500 mt-1">Isolados por tenant_id</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Consultas Agendadas
            </CardTitle>
            <Calendar className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalAgendamentos}</div>
            <p className="text-[11px] text-slate-500 mt-1">Volume global registrado</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tenants e Ciclo de Vida */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-800">
            Ciclo de Vida de Tenants (Clínicas)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Controle de ativação, suspensão e inspeção de módulos contratados por cada consultório.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const totalModsAtivos = Object.values(t.modulos_ativos || {}).filter(Boolean).length

              return (
                <div
                  key={t.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{t.nome}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          t.ativo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {t.ativo ? 'Ativo' : 'Suspenso'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {t.plano || 'Custom'}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                      <span>
                        ID: <code className="font-mono text-slate-600">{t.id}</code>
                      </span>
                      {t.cnpj && <span>• CNPJ: {t.cnpj}</span>}
                      <span>
                        • Módulos habilitados: <strong>{totalModsAtivos}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleAcessarComoTenant(t.id)}
                    >
                      Entrar no Tenant
                    </Button>

                    <Button
                      variant={t.ativo ? 'ghost' : 'outline'}
                      size="sm"
                      className={`text-xs h-8 ${t.ativo ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      onClick={() => handleToggleStatusTenant(t)}
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      {t.ativo ? 'Suspender' : 'Reativar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
