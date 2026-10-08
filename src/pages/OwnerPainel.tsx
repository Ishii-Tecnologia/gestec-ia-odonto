import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { UserRecord, UserPerfil, ModuloId, UnidadeRecord, SalaRecord } from '@/types/gestec'
import { CATALOGO_MODULOS } from '@/services/entitlements'
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
  Lock,
  Edit2,
  MapPin,
  Phone,
  Power,
  ChevronRight,
  ArrowLeft,
  Building,
} from 'lucide-react'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'

export default function OwnerPainel() {
  const { tenant, toggleModuleEntitlement, refreshTenant, refreshUnidades } = useAuth()
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
  const [novoTodasUnidades, setNovoTodasUnidades] = useState(true)
  const [novoUnidadesIds, setNovoUnidadesIds] = useState<string[]>([])
  const [salvandoUser, setSalvandoUser] = useState(false)

  // Editar escopo de usuário
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [editTodasUnidades, setEditTodasUnidades] = useState(true)
  const [editUnidadesIds, setEditUnidadesIds] = useState<string[]>([])
  const [salvandoEscopo, setSalvandoEscopo] = useState(false)

  // Unidades do Tenant
  const [unidadesList, setUnidadesList] = useState<UnidadeRecord[]>([])
  const [loadingUnidades, setLoadingUnidades] = useState(false)

  // Modal Nova/Editar Unidade
  const [unidadeModalOpen, setUnidadeModalOpen] = useState(false)
  const [editingUnidade, setEditingUnidade] = useState<UnidadeRecord | null>(null)
  const [unidadeNome, setUnidadeNome] = useState('')
  const [unidadeEndereco, setUnidadeEndereco] = useState('')
  const [unidadeTelefone, setUnidadeTelefone] = useState('')
  const [unidadeAtiva, setUnidadeAtiva] = useState(true)
  const [salvandoUnidade, setSalvandoUnidade] = useState(false)

  // Unidade Selecionada para Gestão de Salas
  const [selectedUnidadeParaSalas, setSelectedUnidadeParaSalas] = useState<UnidadeRecord | null>(
    null,
  )
  const [salasList, setSalasList] = useState<SalaRecord[]>([])
  const [loadingSalas, setLoadingSalas] = useState(false)

  // Modal Nova/Editar Sala
  const [salaModalOpen, setSalaModalOpen] = useState(false)
  const [editingSala, setEditingSala] = useState<SalaRecord | null>(null)
  const [salaNome, setSalaNome] = useState('')
  const [salaDescricao, setSalaDescricao] = useState('')
  const [salaCadeiras, setSalaCadeiras] = useState('1')
  const [salaAtiva, setSalaAtiva] = useState(true)
  const [salvandoSala, setSalvandoSala] = useState(false)

  // Auditoria
  const [logsAuditoria, setLogsAuditoria] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Carregar usuários do tenant
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

  // Carregar Unidades do tenant
  const carregarUnidades = async () => {
    if (!tenant?.id) return
    setLoadingUnidades(true)
    try {
      const res = await pb.collection('unidades').getList<UnidadeRecord>(1, 50, {
        filter: `tenant_id = '${tenant.id}'`,
        sort: 'ordem,nome',
      })
      setUnidadesList(res.items)
      // Se tiver uma unidade selecionada no detalhe, atualizá-la
      if (selectedUnidadeParaSalas) {
        const found = res.items.find((u) => u.id === selectedUnidadeParaSalas.id)
        if (found) setSelectedUnidadeParaSalas(found)
      }
    } catch (err) {
      console.warn('Erro ao carregar unidades:', err)
    } finally {
      setLoadingUnidades(false)
    }
  }

  // Carregar Salas de uma Unidade
  const carregarSalasDaUnidade = async (unidadeId: string) => {
    if (!unidadeId) return
    setLoadingSalas(true)
    try {
      const res = await pb.collection('salas').getList<SalaRecord>(1, 50, {
        filter: `unidade_id = '${unidadeId}'`,
        sort: 'ordem,nome',
      })
      setSalasList(res.items)
    } catch (err) {
      console.warn('Erro ao carregar salas:', err)
    } finally {
      setLoadingSalas(false)
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
    carregarUnidades()
    carregarAuditoria()
  }, [tenant?.id])

  useEffect(() => {
    if (selectedUnidadeParaSalas) {
      carregarSalasDaUnidade(selectedUnidadeParaSalas.id)
    }
  }, [selectedUnidadeParaSalas])

  // Ações de Usuário
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
        todas_unidades: novoTodasUnidades,
        unidades_ids: novoTodasUnidades ? [] : novoUnidadesIds,
        verified: true,
      })

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
        detalhes: `Criado usuário ${novoNome} (${novoPerfil}) com e-mail ${novoEmail}. Escopo: ${novoTodasUnidades ? 'Todas unidades' : `${novoUnidadesIds.length} unidade(s)`}`,
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
      setNovoTodasUnidades(true)
      setNovoUnidadesIds([])
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

  const handleOpenEditEscopo = (u: UserRecord) => {
    setEditingUser(u)
    setEditTodasUnidades(u.todas_unidades !== false)
    setEditUnidadesIds(u.unidades_ids || [])
  }

  const handleSalvarEscopo = async () => {
    if (!editingUser) return
    setSalvandoEscopo(true)
    try {
      await pb.collection('users').update(editingUser.id, {
        todas_unidades: editTodasUnidades,
        unidades_ids: editTodasUnidades ? [] : editUnidadesIds,
      })

      await registrarAuditoria({
        tenantId: tenant?.id || '',
        acao: 'alterou_escopo_unidade',
        detalhes: `Escopo de unidade do usuário ${editingUser.name} alterado para: ${editTodasUnidades ? 'Todas unidades' : `${editUnidadesIds.length} unidade(s)`}`,
      })

      toast({
        title: 'Escopo atualizado',
        description: `Permissões de unidades de ${editingUser.name} salvas com sucesso.`,
      })
      setEditingUser(null)
      carregarUsuarios()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar escopo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoEscopo(false)
    }
  }

  // Gestão de Unidades
  const handleOpenNovaUnidade = () => {
    setEditingUnidade(null)
    setUnidadeNome('')
    setUnidadeEndereco('')
    setUnidadeTelefone('')
    setUnidadeAtiva(true)
    setUnidadeModalOpen(true)
  }

  const handleOpenEditarUnidade = (u: UnidadeRecord) => {
    setEditingUnidade(u)
    setUnidadeNome(u.nome)
    setUnidadeEndereco(u.endereco || '')
    setUnidadeTelefone(u.telefone || '')
    setUnidadeAtiva(u.ativa !== false)
    setUnidadeModalOpen(true)
  }

  const handleSalvarUnidade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unidadeNome.trim()) {
      toast({ title: 'Nome da unidade é obrigatório', variant: 'destructive' })
      return
    }

    setSalvandoUnidade(true)
    try {
      if (editingUnidade) {
        await pb.collection('unidades').update(editingUnidade.id, {
          nome: unidadeNome.trim(),
          endereco: unidadeEndereco.trim(),
          telefone: unidadeTelefone.trim(),
          ativa: unidadeAtiva,
        })
        toast({ title: 'Unidade atualizada com sucesso' })
      } else {
        const nova = await pb.collection('unidades').create({
          tenant_id: tenant?.id,
          nome: unidadeNome.trim(),
          endereco: unidadeEndereco.trim(),
          telefone: unidadeTelefone.trim(),
          ativa: unidadeAtiva,
          ordem: unidadesList.length + 1,
        })

        // Criar uma sala padrão automática na nova unidade
        try {
          await pb.collection('salas').create({
            tenant_id: tenant?.id,
            unidade_id: nova.id,
            nome: 'Consultório 1',
            cadeiras_qtd: 1,
            ativo: true,
            ordem: 1,
          })
        } catch (e) {
          console.warn('Erro ao criar sala padrão na unidade:', e)
        }

        toast({ title: 'Unidade criada com sucesso' })
      }

      await registrarAuditoria({
        tenantId: tenant?.id || '',
        acao: editingUnidade ? 'editou_unidade' : 'criou_unidade',
        detalhes: `Unidade: ${unidadeNome} (Ativa: ${unidadeAtiva})`,
      })

      setUnidadeModalOpen(false)
      carregarUnidades()
      refreshUnidades()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar unidade',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoUnidade(false)
    }
  }

  const handleToggleAtivaUnidade = async (u: UnidadeRecord) => {
    const novoStatus = !(u.ativa !== false)
    try {
      await pb.collection('unidades').update(u.id, { ativa: novoStatus })
      toast({
        title: novoStatus ? 'Unidade ativada' : 'Unidade desativada',
        description: `A unidade "${u.nome}" agora está ${novoStatus ? 'ativa' : 'inativa'}.`,
      })
      carregarUnidades()
      refreshUnidades()
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' })
    }
  }

  // Gestão de Salas da Unidade Selecionada
  const handleOpenNovaSala = () => {
    setEditingSala(null)
    setSalaNome('')
    setSalaDescricao('')
    setSalaCadeiras('1')
    setSalaAtiva(true)
    setSalaModalOpen(true)
  }

  const handleOpenEditarSala = (s: SalaRecord) => {
    setEditingSala(s)
    setSalaNome(s.nome)
    setSalaDescricao(s.descricao || '')
    setSalaCadeiras(String(s.cadeiras_qtd || 1))
    setSalaAtiva(s.ativo !== false)
    setSalaModalOpen(true)
  }

  const handleSalvarSala = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnidadeParaSalas) return
    if (!salaNome.trim()) {
      toast({ title: 'Identificação da sala é obrigatória', variant: 'destructive' })
      return
    }

    setSalvandoSala(true)
    try {
      if (editingSala) {
        await pb.collection('salas').update(editingSala.id, {
          nome: salaNome.trim(),
          descricao: salaDescricao.trim(),
          cadeiras_qtd: parseInt(salaCadeiras, 10) || 1,
          ativo: salaAtiva,
        })
        toast({ title: 'Sala atualizada com sucesso' })
      } else {
        await pb.collection('salas').create({
          tenant_id: tenant?.id,
          unidade_id: selectedUnidadeParaSalas.id,
          nome: salaNome.trim(),
          descricao: salaDescricao.trim(),
          cadeiras_qtd: parseInt(salaCadeiras, 10) || 1,
          ativo: salaAtiva,
          ordem: salasList.length + 1,
        })
        toast({ title: 'Sala adicionada à unidade' })
      }

      await registrarAuditoria({
        tenantId: tenant?.id || '',
        acao: editingSala ? 'editou_sala' : 'criou_sala',
        detalhes: `Sala: ${salaNome} na Unidade ${selectedUnidadeParaSalas.nome}`,
      })

      setSalaModalOpen(false)
      carregarSalasDaUnidade(selectedUnidadeParaSalas.id)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar sala', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoSala(false)
    }
  }

  const handleToggleAtivaSala = async (s: SalaRecord) => {
    if (!selectedUnidadeParaSalas) return
    const novoStatus = !(s.ativo !== false)
    try {
      await pb.collection('salas').update(s.id, { ativo: novoStatus })
      toast({
        title: novoStatus ? 'Sala ativada' : 'Sala desativada',
        description: `O consultório "${s.nome}" agora está ${novoStatus ? 'ativo' : 'inativo'}.`,
      })
      carregarSalasDaUnidade(selectedUnidadeParaSalas.id)
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err.message, variant: 'destructive' })
    }
  }

  // Módulos
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
        detalhes: `Módulo alterado no nível do tenant: ${moduloId}`,
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

  return (
    <div className="space-y-6">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Gestão da Clínica & Multi-Unidades
            </h1>
            <Badge className="bg-[#0E7490] text-white">Owner</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            <strong>{tenant?.nome || 'Consultório Principal'}</strong> • Razão Social:{' '}
            {tenant?.razao_social || tenant?.nome || '—'} • CNPJ: {tenant?.cnpj || 'Não informado'}{' '}
            • Plano:{' '}
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

      <Tabs defaultValue="unidades" className="space-y-4">
        <TabsList className="bg-white border border-slate-200 p-1 flex-wrap">
          <TabsTrigger value="unidades" className="text-xs flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-purple-600" />
            Unidades & Salas ({unidadesList.length})
          </TabsTrigger>
          <TabsTrigger value="equipe" className="text-xs flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            Equipe & Escopo ({usuarios.length})
          </TabsTrigger>
          <TabsTrigger value="modulos" className="text-xs flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#0E7490]" />
            Entitlements do Tenant
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Auditoria LGPD
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: UNIDADES E SALAS ANINHADAS */}
        <TabsContent value="unidades" className="space-y-4">
          {!selectedUnidadeParaSalas ? (
            /* Lista de Unidades do Tenant */
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                    <Building className="w-5 h-5 text-[#0E7490]" />
                    Unidades do CNPJ (Filiais & Consultórios)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    O Tenant representa a pessoa jurídica (CNPJ). Cada consultório ou filial física
                    é uma Unidade com salas próprias.
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenNovaUnidade}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Unidade
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingUnidades ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Carregando unidades...
                  </div>
                ) : unidadesList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhuma unidade cadastrada neste tenant.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {unidadesList.map((u) => {
                      const isAtiva = u.ativa !== false
                      return (
                        <div
                          key={u.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">{u.nome}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  isAtiva
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {isAtiva ? 'Ativa' : 'Inativa'}
                              </Badge>
                              {u.ordem === 1 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-cyan-50 text-cyan-800"
                                >
                                  Matriz / Principal
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                              {u.endereco && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  {u.endereco}
                                </span>
                              )}
                              {u.telefone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  {u.telefone}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 text-slate-700 hover:text-slate-900"
                              onClick={() => handleOpenEditarUnidade(u)}
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className={`text-xs h-8 ${isAtiva ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              onClick={() => handleToggleAtivaUnidade(u)}
                            >
                              <Power className="w-3.5 h-3.5 mr-1" />
                              {isAtiva ? 'Desativar' : 'Ativar'}
                            </Button>

                            <Button
                              size="sm"
                              className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 gap-1"
                              onClick={() => setSelectedUnidadeParaSalas(u)}
                            >
                              <DoorOpen className="w-3.5 h-3.5" />
                              Gerenciar Salas
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Visualização Aninhada: Salas da Unidade Selecionada */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-slate-600 hover:text-slate-900"
                    onClick={() => setSelectedUnidadeParaSalas(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Unidades
                  </Button>
                  <div className="h-4 w-px bg-slate-200" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Salas de: {selectedUnidadeParaSalas.nome}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {selectedUnidadeParaSalas.endereco || 'Sem endereço informado'}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleOpenNovaSala}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova Sala / Consultório
                </Button>
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Salas e Cadeiras Odontológicas Desta Unidade
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Consultórios físicos vinculados diretamente a esta filial.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSalas ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Carregando salas...
                    </div>
                  ) : salasList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Nenhuma sala cadastrada para esta unidade. Clique em "Nova Sala" para
                      adicionar.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {salasList.map((s) => {
                        const isAtiva = s.ativo !== false
                        return (
                          <Card key={s.id} className="border-slate-200 bg-white">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                  {s.nome}
                                </CardTitle>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    isAtiva
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {isAtiva ? 'Ativa' : 'Inativa'}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="text-xs text-slate-500 space-y-2">
                              <p>
                                Cadeiras operacionais:{' '}
                                <strong className="text-slate-700">{s.cadeiras_qtd || 1}</strong>
                              </p>
                              {s.descricao && (
                                <p className="text-[11px] text-slate-400">{s.descricao}</p>
                              )}

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleOpenEditarSala(s)}
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 text-xs px-2 ${isAtiva ? 'text-amber-600' : 'text-emerald-600'}`}
                                  onClick={() => handleToggleAtivaSala(s)}
                                >
                                  <Power className="w-3 h-3 mr-1" />
                                  {isAtiva ? 'Desativar' : 'Ativar'}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: EQUIPE, USUÁRIOS E ESCOPO DE UNIDADE */}
        <TabsContent value="equipe" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-slate-800">
                  Equipe da Clínica & Escopo de Unidade
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Defina se o membro atua em <strong>todas as unidades</strong> ou apenas em filiais
                  específicas.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={() => setNovoUserOpen(true)}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo Usuário
              </Button>
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

                  const isTodas = u.todas_unidades !== false
                  const unidadesAutorizadasNomes = (u.unidades_ids || [])
                    .map((id) => unidadesList.find((x) => x.id === id)?.nome)
                    .filter(Boolean)

                  return (
                    <div
                      key={u.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
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

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Escopo de Unidades */}
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">
                            Escopo de Unidade
                          </span>
                          {isTodas ? (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-slate-50 text-slate-700 border-slate-300"
                            >
                              Todas as Unidades
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[11px] bg-purple-50 text-purple-700 border-purple-200"
                            >
                              {unidadesAutorizadasNomes.length > 0
                                ? unidadesAutorizadasNomes.join(', ')
                                : `${(u.unidades_ids || []).length} unidade(s)`}
                            </Badge>
                          )}
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${perfilBadgeColors[u.perfil || 'dentista'] || ''}`}
                        >
                          {u.perfil}
                        </Badge>

                        {u.perfil !== 'owner' && u.perfil !== 'superadmin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleOpenEditEscopo(u)}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Escopo
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: MÓDULOS E ENTITLEMENTS (NÍVEL DO TENANT) */}
        <TabsContent value="modulos" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-slate-800">
                    Entitlements do Tenant (Válidos para Todas as Unidades)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    <strong>Importante:</strong> Entitlements são contratados e configurados
                    globalmente no nível do CNPJ (Tenant). Todas as filiais/unidades compartilham a
                    mesma suíte de módulos licenciados.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-slate-50 text-slate-600">
                    Plano do CNPJ:{' '}
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

        {/* TAB 4: AUDITORIA LGPD */}
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

      {/* MODAL: Nova / Editar Unidade */}
      <Dialog open={unidadeModalOpen} onOpenChange={setUnidadeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUnidade ? 'Editar Unidade' : 'Cadastrar Nova Unidade / Filial'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Uma unidade representa um consultório físico ou filial pertencente ao CNPJ{' '}
              {tenant?.cnpj || tenant?.nome}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarUnidade} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Unidade *</Label>
              <Input
                placeholder="Ex: Unidade Centro, Unidade Zona Sul"
                value={unidadeNome}
                onChange={(e) => setUnidadeNome(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Endereço Completo</Label>
              <Input
                placeholder="Rua, Número, Bairro, Cidade - UF"
                value={unidadeEndereco}
                onChange={(e) => setUnidadeEndereco(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Telefone / WhatsApp</Label>
              <Input
                placeholder="(11) 98765-4321"
                value={unidadeTelefone}
                onChange={(e) => setUnidadeTelefone(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Unidade Ativa</Label>
                <p className="text-[11px] text-slate-500">
                  Permite agendamentos e visualização na plataforma
                </p>
              </div>
              <Switch checked={unidadeAtiva} onCheckedChange={setUnidadeAtiva} />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUnidadeModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoUnidade}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoUnidade ? 'Salvando...' : 'Salvar Unidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Nova / Editar Sala */}
      <Dialog open={salaModalOpen} onOpenChange={setSalaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSala ? 'Editar Sala / Consultório' : 'Adicionar Sala / Consultório'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Espaço físico de atendimento na unidade{' '}
              <strong>{selectedUnidadeParaSalas?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarSala} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Identificação da Sala *</Label>
              <Input
                placeholder="Ex: Consultório 1 - Ortodontia"
                value={salaNome}
                onChange={(e) => setSalaNome(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição / Especialidade</Label>
              <Input
                placeholder="Ex: Equipado com raio-X periapical e motor rotatório"
                value={salaDescricao}
                onChange={(e) => setSalaDescricao(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Número de Cadeiras Odontológicas</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={salaCadeiras}
                onChange={(e) => setSalaCadeiras(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Sala Ativa</Label>
                <p className="text-[11px] text-slate-500">
                  Disponível para a grade de horários da agenda
                </p>
              </div>
              <Switch checked={salaAtiva} onCheckedChange={setSalaAtiva} />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSalaModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoSala}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoSala ? 'Salvando...' : 'Salvar Sala'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Convidar Novo Usuário com Escopo */}
      <Dialog open={novoUserOpen} onOpenChange={setNovoUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro para a Clínica</DialogTitle>
            <DialogDescription className="text-xs">
              O usuário será associado ao tenant <strong>{tenant?.nome}</strong> e terá escopo de
              atuação definido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarUsuario} className="space-y-3 py-2">
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
                <Select value={novoPerfil} onValueChange={(v: UserPerfil) => setNovoPerfil(v)}>
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

            {/* Configuração de Escopo de Unidade */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Atua em Todas as Unidades?
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Se desmarcado, selecione as filiais permitidas
                  </p>
                </div>
                <Switch checked={novoTodasUnidades} onCheckedChange={setNovoTodasUnidades} />
              </div>

              {!novoTodasUnidades && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-700">
                    Selecione as Unidades Autorizadas:
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {unidadesList.map((u) => {
                      const checked = novoUnidadesIds.includes(u.id)
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNovoUnidadesIds([...novoUnidadesIds, u.id])
                              } else {
                                setNovoUnidadesIds(novoUnidadesIds.filter((id) => id !== u.id))
                              }
                            }}
                            className="rounded text-[#0E7490]"
                          />
                          <span>{u.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
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

      {/* MODAL: Editar Escopo de Unidade do Usuário */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Escopo de Unidade</DialogTitle>
            <DialogDescription className="text-xs">
              Defina as unidades onde <strong>{editingUser?.name}</strong> pode visualizar e operar
              dados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-800">
                    Acesso a Todas as Unidades
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Acesso irrestrito a todas as filiais do tenant
                  </p>
                </div>
                <Switch checked={editTodasUnidades} onCheckedChange={setEditTodasUnidades} />
              </div>

              {!editTodasUnidades && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-700">
                    Selecione as Unidades Autorizadas:
                  </span>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {unidadesList.map((u) => {
                      const checked = editUnidadesIds.includes(u.id)
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditUnidadesIds([...editUnidadesIds, u.id])
                              } else {
                                setEditUnidadesIds(editUnidadesIds.filter((id) => id !== u.id))
                              }
                            }}
                            className="rounded text-[#0E7490]"
                          />
                          <span>{u.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvarEscopo}
                disabled={salvandoEscopo}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoEscopo ? 'Salvando...' : 'Salvar Escopo'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
