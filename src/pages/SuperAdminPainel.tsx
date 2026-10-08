import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { TenantRecord, PlanoTenant, TenantSituacao } from '@/types/gestec'
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
  Plus,
  Power,
  Users,
  Calendar,
  Activity,
  Layers,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react'
import { MODULOS_POR_PLANO } from '@/services/entitlements'

// Função auxiliar de formatação de CNPJ
function formatCNPJ(val: string) {
  const digits = val.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export default function SuperAdminPainel() {
  const { switchTenant } = useAuth()
  const { toast } = useToast()

  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Telemetria básica
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [totalAgendamentos, setTotalAgendamentos] = useState(0)
  const [totalPacientes, setTotalPacientes] = useState(0)
  const [totalUnidades, setTotalUnidades] = useState(0)

  // Modal Novo Tenant
  const [novoTenantOpen, setNovoTenantOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaRazao, setNovaRazao] = useState('')
  const [novoCnpj, setNovoCnpj] = useState('')
  const [novoPlano, setNovoPlano] = useState<PlanoTenant>('suite-clinica')
  const [novaSituacao, setNovaSituacao] = useState<TenantSituacao>('ativa')
  const [salvando, setSalvando] = useState(false)

  // Modal Editar Tenant
  const [editingTenant, setEditingTenant] = useState<TenantRecord | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editRazao, setEditRazao] = useState('')
  const [editCnpj, setEditCnpj] = useState('')
  const [editPlano, setEditPlano] = useState<PlanoTenant>('suite-clinica')
  const [editSituacao, setEditSituacao] = useState<TenantSituacao>('ativa')
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const carregarDadosPlataforma = async () => {
    setLoading(true)
    try {
      // 1. Tenants
      const tRes = await pb.collection('tenants').getList<TenantRecord>(1, 100, {
        sort: '-created',
      })
      setTenants(tRes.items)

      // 2. Telemetria
      const [uRes, agRes, pacRes, unRes] = await Promise.all([
        pb.collection('users').getList(1, 1),
        pb.collection('agendamentos').getList(1, 1),
        pb.collection('pacientes').getList(1, 1),
        pb.collection('unidades').getList(1, 1),
      ])
      setTotalUsuarios(uRes.totalItems)
      setTotalAgendamentos(agRes.totalItems)
      setTotalPacientes(pacRes.totalItems)
      setTotalUnidades(unRes.totalItems)
    } catch (err) {
      console.warn('Erro ao carregar telemetria:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosPlataforma()
  }, [])

  // Verificar se CNPJ já existe na plataforma
  const checkCnpjExistente = async (
    cnpjFormatado: string,
    ignoreTenantId?: string,
  ): Promise<boolean> => {
    const rawCnpj = cnpjFormatado.trim()
    if (!rawCnpj) return false
    try {
      const filter = ignoreTenantId
        ? `cnpj = '${rawCnpj}' && id != '${ignoreTenantId}'`
        : `cnpj = '${rawCnpj}'`
      const res = await pb.collection('tenants').getList(1, 1, { filter })
      return res.items.length > 0
    } catch (e) {
      return false
    }
  }

  // Provisionar Novo Tenant
  const handleCriarTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) {
      toast({ title: 'Nome Fantasia é obrigatório', variant: 'destructive' })
      return
    }

    const cnpjLimpo = novoCnpj.trim()
    if (cnpjLimpo) {
      const existe = await checkCnpjExistente(cnpjLimpo)
      if (existe) {
        toast({
          title: 'CNPJ já cadastrado',
          description: `O CNPJ "${cnpjLimpo}" já pertence a outro tenant ativo nesta plataforma. Tenants devem possuir CNPJs distintos.`,
          variant: 'destructive',
        })
        return
      }
    }

    setSalvando(true)
    try {
      const modulosIniciais =
        MODULOS_POR_PLANO[novoPlano] || MODULOS_POR_PLANO['consultorio-essencial']

      const isAtiva = novaSituacao === 'ativa'

      // 1. Criar o Tenant (Pessoa Jurídica)
      const novoTenant = await pb.collection('tenants').create<TenantRecord>({
        nome: novoNome.trim(),
        razao_social: novaRazao.trim() || novoNome.trim(),
        cnpj: cnpjLimpo,
        plano: novoPlano,
        situacao: novaSituacao,
        modulos_ativos: modulosIniciais,
        limites: {
          profissionais_max: novoPlano === 'suite-completa' ? 20 : 5,
          cadeiras_max: novoPlano === 'suite-completa' ? 8 : 2,
          mensagens_mes: 500,
          unidades_max: novoPlano === 'suite-completa' ? 10 : 3,
        },
        ativo: isAtiva,
      })

      // 2. Criar automaticamente a "Unidade Principal" obrigatória do novo Tenant
      try {
        const principalUnidade = await pb.collection('unidades').create({
          tenant_id: novoTenant.id,
          nome: 'Unidade Principal',
          endereco: 'Matriz - Consultório Central',
          telefone: '',
          ativa: true,
          ordem: 1,
        })

        // Criar salas padrão na Unidade Principal
        await pb.collection('salas').create({
          tenant_id: novoTenant.id,
          unidade_id: principalUnidade.id,
          nome: 'Consultório 1',
          cadeiras_qtd: 1,
          ativo: true,
          ordem: 1,
        })
      } catch (errUnidade) {
        console.warn('Erro ao criar unidade automática:', errUnidade)
      }

      toast({
        title: 'Tenant Provisionado com Sucesso',
        description: `Pessoa jurídica ${novoNome} criada e Unidade Principal configurada.`,
      })

      setNovoTenantOpen(false)
      setNovoNome('')
      setNovaRazao('')
      setNovoCnpj('')
      setNovaSituacao('ativa')
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

  // Abrir Modal de Edição de Tenant
  const handleOpenEdit = (t: TenantRecord) => {
    setEditingTenant(t)
    setEditNome(t.nome)
    setEditRazao(t.razao_social || t.nome)
    setEditCnpj(t.cnpj || '')
    setEditPlano(t.plano)
    setEditSituacao(t.situacao || (t.ativo ? 'ativa' : 'suspensa'))
  }

  // Salvar Edição de Tenant
  const handleSalvarEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTenant) return
    if (!editNome.trim()) {
      toast({ title: 'Nome Fantasia é obrigatório', variant: 'destructive' })
      return
    }

    const cnpjLimpo = editCnpj.trim()
    if (cnpjLimpo) {
      const existe = await checkCnpjExistente(cnpjLimpo, editingTenant.id)
      if (existe) {
        toast({
          title: 'CNPJ já cadastrado',
          description: `O CNPJ "${cnpjLimpo}" já pertence a outro tenant nesta plataforma.`,
          variant: 'destructive',
        })
        return
      }
    }

    setSalvandoEdit(true)
    try {
      const isAtiva = editSituacao === 'ativa'

      await pb.collection('tenants').update(editingTenant.id, {
        nome: editNome.trim(),
        razao_social: editRazao.trim(),
        cnpj: cnpjLimpo,
        plano: editPlano,
        situacao: editSituacao,
        ativo: isAtiva,
      })

      toast({
        title: 'Tenant Atualizado',
        description: `Dados cadastrais de ${editNome} salvos com sucesso.`,
      })

      setEditingTenant(null)
      carregarDadosPlataforma()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar tenant',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoEdit(false)
    }
  }

  // Alternar Status / Situação (Ativa / Suspensa)
  const handleToggleStatusTenant = async (t: TenantRecord) => {
    const isAtualmenteAtivo = t.situacao ? t.situacao === 'ativa' : t.ativo
    const novoStatusAtivo = !isAtualmenteAtivo
    const novaSituacao: TenantSituacao = novoStatusAtivo ? 'ativa' : 'suspensa'

    try {
      await pb.collection('tenants').update(t.id, {
        ativo: novoStatusAtivo,
        situacao: novaSituacao,
      })
      toast({
        title: novoStatusAtivo ? 'Tenant Ativado' : 'Tenant Suspenso',
        description: `A clínica ${t.nome} foi colocada na situação ${novaSituacao.toUpperCase()}.`,
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
              Painel Super Admin — Plataforma Odonto
            </h1>
            <Badge className="bg-red-500 text-white text-xs">Governança Multi-Tenant</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Gestão de Tenants (CNPJ/Pessoa Jurídica), conformidade regulatória, telemetria global e
            ativação de planos.
          </p>
        </div>

        <Dialog open={novoTenantOpen} onOpenChange={setNovoTenantOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9">
              <Plus className="w-4 h-4 mr-1.5" />
              Provisionar Nova Clínica (CNPJ)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provisionar Novo Tenant / CNPJ</DialogTitle>
              <DialogDescription className="text-xs">
                O Tenant representa a pessoa jurídica contratante. Cada CNPJ possui suas próprias
                filiais (Unidades) e salas.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarTenant} className="space-y-3 py-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome Fantasia *</Label>
                <Input
                  placeholder="Ex: Odonto Prime Alphaville"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Razão Social (PJ)</Label>
                <Input
                  placeholder="Ex: Prime Odontologia Especializada Ltda"
                  value={novaRazao}
                  onChange={(e) => setNovaRazao(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ (Único na plataforma)</Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={novoCnpj}
                  onChange={(e) => setNovoCnpj(formatCNPJ(e.target.value))}
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Validação automática contra duplicidade entre tenants.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Plano de Assinatura *</Label>
                  <Select value={novoPlano} onValueChange={(v: PlanoTenant) => setNovoPlano(v)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Selecione o plano..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultorio-essencial">Consultório Essencial</SelectItem>
                      <SelectItem value="suite-clinica">Suíte Clínica</SelectItem>
                      <SelectItem value="suite-gestao">Suíte Gestão</SelectItem>
                      <SelectItem value="suite-completa">Suíte Completa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Situação Cadastral *</Label>
                  <Select
                    value={novaSituacao}
                    onValueChange={(v: TenantSituacao) => setNovaSituacao(v)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Situação..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="suspensa">Suspensa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-2.5 bg-cyan-50/60 rounded border border-cyan-100 text-[11px] text-[#0E7490] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Uma "Unidade Principal" será criada automaticamente ao provisionar.</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Tenants (CNPJs)</CardTitle>
            <Building2 className="w-4 h-4 text-[#0E7490]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{tenants.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              {tenants.filter((t) => (t.situacao ? t.situacao === 'ativa' : t.ativo)).length} PJ
              ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Unidades (Filiais)</CardTitle>
            <Building className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalUnidades}</div>
            <p className="text-[11px] text-slate-500 mt-1">Consultórios físicos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Usuários Cadastrados
            </CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalUsuarios}</div>
            <p className="text-[11px] text-slate-500 mt-1">Dentistas e equipe</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Pacientes em Banco</CardTitle>
            <Activity className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalPacientes}</div>
            <p className="text-[11px] text-slate-500 mt-1">Isolados por tenant</p>
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
            <p className="text-[11px] text-slate-500 mt-1">Volume global</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tenants e Ciclo de Vida */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-800">
            Ciclo de Vida de Tenants (Pessoas Jurídicas)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Controle de situação (ativa/suspensa), razão social, CNPJ e módulos no nível
            corporativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {tenants.map((t) => {
              const isAtiva = t.situacao ? t.situacao === 'ativa' : Boolean(t.ativo)
              const totalModsAtivos = Object.values(t.modulos_ativos || {}).filter(Boolean).length

              return (
                <div
                  key={t.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{t.nome}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          isAtiva
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {isAtiva ? 'Ativa' : 'Suspensa'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                        {t.plano || 'Custom'}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>
                        Razão Social: <strong>{t.razao_social || t.nome}</strong>
                      </span>
                      <span>
                        • CNPJ:{' '}
                        <strong className="font-mono text-slate-700">
                          {t.cnpj || 'Não informado'}
                        </strong>
                      </span>
                      <span>
                        • Módulos habilitados: <strong>{totalModsAtivos}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-slate-700"
                      onClick={() => handleOpenEdit(t)}
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-[#0E7490] hover:bg-cyan-50"
                      onClick={() => handleAcessarComoTenant(t.id)}
                    >
                      Entrar no Tenant
                    </Button>

                    <Button
                      variant={isAtiva ? 'ghost' : 'outline'}
                      size="sm"
                      className={`text-xs h-8 ${isAtiva ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                      onClick={() => handleToggleStatusTenant(t)}
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      {isAtiva ? 'Suspender' : 'Reativar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* MODAL: Editar Tenant */}
      <Dialog
        open={Boolean(editingTenant)}
        onOpenChange={(open) => !open && setEditingTenant(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Dados do Tenant (Pessoa Jurídica)</DialogTitle>
            <DialogDescription className="text-xs">
              Atualize razão social, CNPJ e situação operacional do tenant.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdit} className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome Fantasia *</Label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Razão Social</Label>
              <Input
                value={editRazao}
                onChange={(e) => setEditRazao(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">CNPJ (Único na plataforma)</Label>
              <Input
                value={editCnpj}
                onChange={(e) => setEditCnpj(formatCNPJ(e.target.value))}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Plano de Assinatura</Label>
                <Select value={editPlano} onValueChange={(v: PlanoTenant) => setEditPlano(v)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultorio-essencial">Consultório Essencial</SelectItem>
                    <SelectItem value="suite-clinica">Suíte Clínica</SelectItem>
                    <SelectItem value="suite-gestao">Suíte Gestão</SelectItem>
                    <SelectItem value="suite-completa">Suíte Completa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Situação Cadastral</Label>
                <Select
                  value={editSituacao}
                  onValueChange={(v: TenantSituacao) => setEditSituacao(v)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="suspensa">Suspensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingTenant(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoEdit}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
