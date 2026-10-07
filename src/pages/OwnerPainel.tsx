import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { UserRecord, UserPerfil, ModuloId, PlanoTenant } from '@/types/gestec'
import {
  CATALOGO_MODULOS,
  MODULOS_POR_PLANO,
  validarDependenciasModulo,
} from '@/services/entitlements'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
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
  Users,
  Layers,
  DoorOpen,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  HelpCircle,
  FileCheck2,
} from 'lucide-react'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'

export default function OwnerPainel() {
  const { user, tenant, isOwner, perfil, toggleModuleEntitlement, refreshTenant } = useAuth()
  const { toast } = useToast()

  // Usuários da clínica
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Novo usuário modal
  const [novoUserOpen, setNovoUserOpen] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoPerfil, setNovoPerfil] = useState<UserPerfil>('dentista')
  const [novoCro, setNovoCro] = useState('')
  const [salvandoUser, setSalvandoUser] = useState(false)

  // Salas da Unidade
  const [salas, setSalas] = useState<
    Array<{ id: string; nome: string; cadeiras: number; ativo: boolean }>
  >([
    { id: 'sala-1', nome: 'Consultório 1 - Ortodontia & Estética', cadeiras: 1, ativo: true },
    { id: 'sala-2', nome: 'Consultório 2 - Cirurgia & Implantes', cadeiras: 1, ativo: true },
    { id: 'sala-3', nome: 'Consultório 3 - Avaliação & Diagnóstico', cadeiras: 1, ativo: true },
  ])
  const [novaSalaNome, setNovaSalaNome] = useState('')
  const [novaSalaCadeiras, setNovaSalaCadeiras] = useState('1')
  const [novaSalaOpen, setNovaSalaOpen] = useState(false)

  // Auditoria
  const [logsAuditoria, setLogsAuditoria] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Carregar dados de usuários do tenant
  const carregarUsuarios = async () => {
    if (!tenant?.id) return
    setLoadingUsers(true)
    try {
      const res = await pb.collection('users').getList<UserRecord>(1, 50, {
        filter: `tenant_id = '${tenant.id}'`,
        sort: 'name',
      })
      setUsuarios(res.items)
    } catch (err) {
      console.warn('Erro ao carregar usuários:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  // Carregar logs de auditoria
  const carregarAuditoria = async () => {
    if (!tenant?.id) return
    setLoadingLogs(true)
    try {
      const res = await pb.collection('auditoria_acesso').getList(1, 20, {
        filter: `tenant_id = '${tenant.id}'`,
        sort: '-timestamp',
      })
      setLogsAuditoria(res.items)
    } catch (err) {
      console.warn('Erro ao carregar auditoria:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
    carregarAuditoria()
  }, [tenant?.id])

  const handleCriarUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome || !novoEmail) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    if (novoPerfil === 'dentista' && !novoCro) {
      toast({
        title: 'CRO Obrigatório',
        description: 'Dentistas precisam ter CRO cadastrado conforme norma do CFO.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoUser(true)
    try {
      const novo = await pb.collection('users').create<UserRecord>({
        email: novoEmail,
        password: 'Skip@Pass123',
        passwordConfirm: 'Skip@Pass123',
        name: novoNome,
        tenant_id: tenant?.id,
        perfil: novoPerfil,
        cro: novoCro || '',
        verified: true,
      })

      // Se for dentista, criar também no catálogo de profissionais
      if (novoPerfil === 'dentista') {
        try {
          await pb.collection('profissionais').create({
            tenant_id: tenant?.id,
            user_id: novo.id,
            nome: novoNome,
            cro: novoCro,
            email: novoEmail,
            ativo: true,
            cor_agenda: '#0E7490',
          })
        } catch (err) {
          console.warn('Profissional criado via users hook ou paralelo:', err)
        }
      }

      await registrarAuditoria({
        tenantId: tenant?.id || '',
        acao: 'criou_usuario',
        detalhes: `Criado usuário ${novoNome} (${novoPerfil}) com e-mail ${novoEmail}`,
      })

      toast({
        title: 'Membro adicionado com sucesso',
        description: `Senha padrão provisória definida: Skip@Pass123`,
      })

      setNovoUserOpen(false)
      setNovoNome('')
      setNovoEmail('')
      setNovoCro('')
      setNovoPerfil('dentista')
      carregarUsuarios()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: err.message || 'Verifique se o e-mail já não está em uso.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoUser(false)
    }
  }

  const handleToggleModulo = async (moduloId: ModuloId, ativoAtual: boolean) => {
    try {
      await toggleModuleEntitlement(moduloId, !ativoAtual)
      toast({
        title: !ativoAtual ? 'Módulo Ativado' : 'Módulo Desativado',
        description: `O módulo foi ${!ativoAtual ? 'habilitado' : 'desabilitado'} para esta clínica com sucesso.`,
      })
      await registrarAuditoria({
        tenantId: tenant?.id || '',
        acao: !ativoAtual ? 'ativou_modulo' : 'desativou_modulo',
        detalhes: `Módulo alterado: ${moduloId}`,
      })
      await refreshTenant()
    } catch (err: any) {
      toast({
        title: 'Dependência não atendida',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleCriarSala = () => {
    if (!novaSalaNome) return
    const nova = {
      id: `sala-${Date.now()}`,
      nome: novaSalaNome,
      cadeiras: parseInt(novaSalaCadeiras, 10) || 1,
      ativo: true,
    }
    setSalas([...salas, nova])
    setNovaSalaNome('')
    setNovaSalaOpen(false)
    toast({ title: 'Sala adicionada', description: `${nova.nome} pronta para agendamentos.` })
  }

  return (
    <div className="space-y-6">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Gestão da Clínica & Entitlements
            </h1>
            <Badge className="bg-[#0E7490] text-white">Owner</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {tenant?.nome || 'Consultório Principal'} • CNPJ: {tenant?.cnpj || 'Não informado'} •
            Plano:{' '}
            <span className="font-semibold capitalize text-slate-700">
              {tenant?.plano?.replace('-', ' ') || 'Consultório Essencial'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs py-1 px-3 border-emerald-300 text-emerald-700 bg-emerald-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Conformidade LGPD Ativa
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="modulos" className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="modulos" className="text-xs flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#0E7490]" />
            Módulos & Feature Flags
          </TabsTrigger>
          <TabsTrigger value="equipe" className="text-xs flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            Equipe & Permissões ({usuarios.length})
          </TabsTrigger>
          <TabsTrigger value="salas" className="text-xs flex items-center gap-1.5">
            <DoorOpen className="w-4 h-4 text-purple-600" />
            Unidades & Salas ({salas.length})
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Auditoria LGPD
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MÓDULOS E ENTITLEMENTS (BL-002) */}
        <TabsContent value="modulos" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-slate-800">
                    Catálogo de Módulos e Feature Flags
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ative ou desative recursos em tempo real (&lt;1 min sem deploy). O sistema
                    aplica degradação graciosa.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-slate-50 text-slate-600">
                    Plano Atual:{' '}
                    <strong className="ml-1 capitalize">{tenant?.plano || 'Custom'}</strong>
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CATALOGO_MODULOS.map((mod) => {
                  const isAtivo = Boolean(tenant?.modulos_ativos?.[mod.id])
                  const isBloqueadoFase1 = Boolean(mod.bloqueadoFase1)
                  const isObrigatorio = Boolean(mod.obrigatorio)

                  return (
                    <Card
                      key={mod.id}
                      className={`relative border transition-all ${
                        isAtivo
                          ? 'border-cyan-200 bg-white shadow-sm'
                          : isBloqueadoFase1
                            ? 'border-slate-200 bg-slate-50/60 opacity-80'
                            : 'border-slate-200 bg-slate-50/40'
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">
                                {mod.nome}
                              </span>
                              {isObrigatorio && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-slate-100 text-slate-600"
                                >
                                  Base
                                </Badge>
                              )}
                              {isBloqueadoFase1 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Fase Futura
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              id: {mod.id}
                            </span>
                          </div>

                          {!isBloqueadoFase1 && !isObrigatorio && (
                            <Switch
                              checked={isAtivo}
                              onCheckedChange={() => handleToggleModulo(mod.id, isAtivo)}
                            />
                          )}

                          {isObrigatorio && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                            </span>
                          )}

                          {isBloqueadoFase1 && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Bloqueado
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs text-slate-600">
                        <p className="line-clamp-2">{mod.descricao}</p>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-400">
                            Depende de:{' '}
                            <strong className="text-slate-600 font-mono">
                              {mod.dependencias.length > 0 ? mod.dependencias.join(', ') : 'nenhum'}
                            </strong>
                          </span>
                          <span className="text-cyan-700 font-medium">
                            Plano min: {mod.planoMinimo}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: EQUIPE E USUÁRIOS (RBAC) */}
        <TabsContent value="equipe" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-slate-800">Equipe da Clínica (RBAC)</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Perfis com acesso restrito: Dentistas (com CRO obrigatório), Recepção, Financeiro
                  e ASB.
                </CardDescription>
              </div>

              <Dialog open={novoUserOpen} onOpenChange={setNovoUserOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Convidar Membro para a Clínica</DialogTitle>
                    <DialogDescription className="text-xs">
                      O usuário será associado ao tenant <strong>{tenant?.nome}</strong> e receberá
                      credenciais de acesso.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCriarUsuario} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="nome" className="text-xs">
                        Nome Completo *
                      </Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Dra. Juliana Santos"
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                        required
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">
                        E-mail Corporativo *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="juliana@clinica.com.br"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        required
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="perfil" className="text-xs">
                          Perfil RBAC *
                        </Label>
                        <Select
                          value={novoPerfil}
                          onValueChange={(v: UserPerfil) => setNovoPerfil(v)}
                        >
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner (Administrador)</SelectItem>
                            <SelectItem value="dentista">Dentista (Clínico)</SelectItem>
                            <SelectItem value="recepcao">Recepção / Agenda</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="asb">ASB / Auxiliar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cro" className="text-xs">
                          CRO {novoPerfil === 'dentista' && '* (Obrigatório)'}
                        </Label>
                        <Input
                          id="cro"
                          placeholder="CRO-SP 123456"
                          value={novoCro}
                          onChange={(e) => setNovoCro(e.target.value)}
                          required={novoPerfil === 'dentista'}
                          className="text-xs h-9"
                        />
                      </div>
                    </div>

                    <DialogFooter className="pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNovoUserOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={salvandoUser}
                        className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                      >
                        {salvandoUser ? 'Cadastrando...' : 'Cadastrar Membro'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {usuarios.map((u) => {
                  const perfilBadgeColors: Record<string, string> = {
                    owner: 'bg-purple-50 text-purple-700 border-purple-200',
                    dentista: 'bg-blue-50 text-blue-700 border-blue-200',
                    recepcao: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    financeiro: 'bg-amber-50 text-amber-700 border-amber-200',
                    asb: 'bg-slate-100 text-slate-700 border-slate-200',
                    superadmin: 'bg-red-50 text-red-700 border-red-200',
                  }

                  return (
                    <div
                      key={u.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {u.name ? u.name.slice(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-900">
                            {u.name}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          {u.cro && (
                            <div className="text-[11px] text-cyan-700 font-mono font-medium mt-0.5">
                              {u.cro}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${perfilBadgeColors[u.perfil || 'dentista'] || ''}`}
                        >
                          {u.perfil}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SALAS E UNIDADES */}
        <TabsContent value="salas" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-slate-800">
                  Salas & Cadeiras Odontológicas
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Gerenciamento de consultórios físicos para a alocação da grade multi-cadeiras.
                </CardDescription>
              </div>

              <Dialog open={novaSalaOpen} onOpenChange={setNovaSalaOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nova Sala / Cadeira
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Sala / Consultório</DialogTitle>
                    <DialogDescription className="text-xs">
                      Cadastre um novo espaço físico de atendimento nesta unidade.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Identificação da Sala *</Label>
                      <Input
                        placeholder="Ex: Consultório 4 - Odontopediatria"
                        value={novaSalaNome}
                        onChange={(e) => setNovaSalaNome(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Número de Cadeiras *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={novaSalaCadeiras}
                        onChange={(e) => setNovaSalaCadeiras(e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setNovaSalaOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCriarSala}
                      className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                    >
                      Salvar Sala
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {salas.map((s) => (
                  <Card key={s.id} className="border-slate-200 bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-800">
                          {s.nome}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Ativa
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500 space-y-1">
                      <p>
                        Cadeiras operacionais:{' '}
                        <strong className="text-slate-700">{s.cadeiras}</strong>
                      </p>
                      <p>Agendamento simultâneo habilitado</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: AUDITORIA LGPD (BL-011) */}
        <TabsContent value="auditoria" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Trilha de Auditoria LGPD (Append-Only)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Registros cronológicos de acessos, alterações de permissão e visualização de
                  prontuários. Coleção imutável sem permissão de exclusão ou edição.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={carregarAuditoria}
                className="text-xs h-8"
              >
                Atualizar Trilha
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {logsAuditoria.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhum registro de auditoria disponível no momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 font-mono text-xs">
                  {logsAuditoria.map((log) => (
                    <div key={log.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{log.acao}</span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.timestamp || log.created).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-slate-600 mt-1 flex flex-wrap gap-2 text-[11px]">
                        <span>
                          Usuário: <strong>{log.user_email || log.user_id}</strong>
                        </span>
                        {log.perfil && <span>• Perfil: {log.perfil}</span>}
                        {log.target_patient_id && (
                          <span>• Paciente Alvo: {log.target_patient_id}</span>
                        )}
                        <span>• IP: {log.ip || '127.0.0.1'}</span>
                      </div>
                      {log.detalhes && (
                        <div className="text-[11px] text-slate-500 mt-1 bg-slate-50 p-1.5 rounded">
                          {log.detalhes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
