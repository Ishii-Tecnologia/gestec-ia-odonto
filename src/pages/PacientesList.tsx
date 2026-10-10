import React, { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { PacienteRecord } from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Building,
  UserCheck,
  Stethoscope,
  Sparkles,
} from 'lucide-react'
import { ModuloGate } from '@/components/ModuloGate'
import { validarCPF, formatarCPF, formatarTelefone, calcularIdade } from '@/lib/validadores'

const ITENS_POR_PAGINA = 8

export default function PacientesList() {
  const { tenantId, user, perfil, unidades, selectedUnidadeId, canAccessClinical, hasModule } =
    useAuth()
  const { toast } = useToast()

  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroUnidade, setFiltroUnidade] = useState<string>('todas')
  const [paginaAtual, setPaginaAtual] = useState(1)

  // Modal Novo Paciente
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Campos do formulário completo (BL-003)
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoNasc, setNovoNasc] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoGenero, setNovoGenero] = useState<
    'masculino' | 'feminino' | 'outro' | 'nao_informado'
  >('nao_informado')
  const [novoConvenio, setNovoConvenio] = useState('Particular')
  const [novoResponsavelNome, setNovoResponsavelNome] = useState('')
  const [novoResponsavelCpf, setNovoResponsavelCpf] = useState('')
  const [novaUnidadeId, setNovaUnidadeId] = useState('')
  const [novoStatus, setNovoStatus] = useState<'ativo' | 'inativo' | 'em-tratamento'>('ativo')
  const [novasObservacoes, setNovasObservacoes] = useState('')
  const [novasTags, setNovasTags] = useState('Ortodontia, Preventivo')

  // Inicializar unidade padrão do modal quando abrir
  useEffect(() => {
    if (modalNovoAberto) {
      if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
        setNovaUnidadeId(selectedUnidadeId)
      } else if (unidades.length > 0) {
        setNovaUnidadeId(unidades[0].id)
      }
    }
  }, [modalNovoAberto, selectedUnidadeId, unidades])

  // Ajustar filtro de unidade quando seletor global do header mudar
  useEffect(() => {
    if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
      setFiltroUnidade(selectedUnidadeId)
    } else {
      setFiltroUnidade('todas')
    }
  }, [selectedUnidadeId])

  const carregarPacientes = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      // Buscar pacientes do tenant atual
      const res = await pb.collection('pacientes').getList<PacienteRecord>(1, 200, {
        filter: `tenant_id = '${tenantId}'`,
        sort: '-created',
      })
      setPacientes(res.items)
    } catch (err: any) {
      console.error('Erro ao listar pacientes:', err)
      toast({
        title: 'Erro ao carregar pacientes',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPacientes()
  }, [tenantId])

  // Cálculo da idade em tempo real para controle do responsável legal
  const idadeCalculada = useMemo(() => {
    return calcularIdade(novoNasc)
  }, [novoNasc])

  const isMenorIdade = idadeCalculada !== null && idadeCalculada < 18

  // Submissão de novo paciente com validação rigorosa (BL-003)
  const handleCriarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!novoNome.trim()) {
      toast({ title: 'Nome completo é obrigatório', variant: 'destructive' })
      return
    }

    // Validação de CPF com dígitos verificadores
    const cpfLimpo = novoCpf.replace(/\D/g, '')
    if (cpfLimpo) {
      if (!validarCPF(cpfLimpo)) {
        toast({
          title: 'CPF do paciente inválido',
          description:
            'O CPF informado não possui dígitos verificadores válidos segundo o algoritmo oficial (módulo-11).',
          variant: 'destructive',
        })
        return
      }
    }

    // Se paciente menor de idade, validar responsável legal
    if (isMenorIdade) {
      if (!novoResponsavelNome.trim()) {
        toast({
          title: 'Responsável legal obrigatório',
          description:
            'Para pacientes menores de 18 anos, é obrigatório informar o nome do responsável legal.',
          variant: 'destructive',
        })
        return
      }
      const respCpfLimpo = novoResponsavelCpf.replace(/\D/g, '')
      if (respCpfLimpo && !validarCPF(respCpfLimpo)) {
        toast({
          title: 'CPF do responsável inválido',
          description:
            'O CPF do responsável legal informado não possui dígitos verificadores válidos.',
          variant: 'destructive',
        })
        return
      }
    }

    const unidadeFinal = novaUnidadeId || (unidades[0]?.id ?? '')

    setSalvando(true)
    try {
      const tagsArray = novasTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const payload: Partial<PacienteRecord> = {
        tenant_id: tenantId,
        unidade_id: unidadeFinal,
        nome: novoNome.trim(),
        cpf: cpfLimpo ? formatarCPF(cpfLimpo) : '',
        data_nascimento: novoNasc || '',
        telefone: novoTelefone.trim() || '',
        email: novoEmail.trim() || '',
        endereco: novoEndereco.trim() || '',
        genero: novoGenero,
        convenio: novoConvenio.trim() || 'Particular',
        responsavel_legal: isMenorIdade ? novoResponsavelNome.trim() : '',
        responsavel_cpf: isMenorIdade && novoResponsavelCpf ? formatarCPF(novoResponsavelCpf) : '',
        status: novoStatus,
        score_evasao: 10,
        tags: tagsArray,
        observacoes: novasObservacoes.trim() || '',
      }

      const novo = await pb.collection('pacientes').create<PacienteRecord>(payload)

      // Registrar auditoria append-only LGPD (BL-003)
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: novo.id,
        acao: 'cadastrou_paciente',
        detalhes: `Novo paciente cadastrado: ${novo.nome} (CPF: ${novo.cpf || 'N/A'}, Unidade: ${unidadeFinal})`,
      })

      toast({
        title: 'Paciente cadastrado com sucesso!',
        description: `${novo.nome} foi adicionado à base cadastral.`,
      })

      // Limpar formulário e fechar
      setNovoNome('')
      setNovoCpf('')
      setNovoNasc('')
      setNovoTelefone('')
      setNovoEmail('')
      setNovoEndereco('')
      setNovoGenero('nao_informado')
      setNovoConvenio('Particular')
      setNovoResponsavelNome('')
      setNovoResponsavelCpf('')
      setNovasObservacoes('')
      setModalNovoAberto(false)
      carregarPacientes()
    } catch (err: any) {
      console.error('Erro ao salvar paciente:', err)
      toast({
        title: 'Erro ao cadastrar paciente',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Filtragem composta: texto (nome ou CPF), status e unidade selecionada
  const pacientesFiltrados = useMemo(() => {
    return pacientes.filter((p) => {
      // 1. Filtro de unidade (seletor global ou filtro de tela)
      if (filtroUnidade !== 'todas' && p.unidade_id && p.unidade_id !== filtroUnidade) {
        return false
      }

      // 2. Filtro de status
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) {
        return false
      }

      // 3. Busca por texto (nome, CPF, telefone ou email)
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim()
        const cpfSemPontuacao = (p.cpf || '').replace(/\D/g, '')
        const termoSemPontuacao = termo.replace(/\D/g, '')

        const matchNome = (p.nome || '').toLowerCase().includes(termo)
        const matchCpf =
          (p.cpf && p.cpf.toLowerCase().includes(termo)) ||
          (cpfSemPontuacao && termoSemPontuacao && cpfSemPontuacao.includes(termoSemPontuacao))
        const matchTel = p.telefone && p.telefone.includes(termo)
        const matchEmail = (p.email || '').toLowerCase().includes(termo)

        return Boolean(matchNome || matchCpf || matchTel || matchEmail)
      }

      return true
    })
  }, [pacientes, filtroUnidade, filtroStatus, busca])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(pacientesFiltrados.length / ITENS_POR_PAGINA))
  const pacientesPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA
    return pacientesFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [pacientesFiltrados, paginaAtual])

  const unidadeNomeMap = useMemo(() => {
    const map = new Map<string, string>()
    unidades.forEach((u) => map.set(u.id, u.nome))
    return map
  }, [unidades])

  return (
    <ModuloGate modulo="pacientes">
      <div className="space-y-6">
        {/* Header da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-[#0E7490]" />
                Cadastro de Pacientes
              </h1>
              <Badge
                variant="outline"
                className="text-xs bg-cyan-50 text-[#0E7490] border-cyan-200"
              >
                BL-003 • LGPD Ready
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gestão de cadastros de pacientes com validação de CPF, dados civis, controle de
              menores e histórico seguro.
            </p>
          </div>

          <Button
            onClick={() => setModalNovoAberto(true)}
            className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Paciente</span>
          </Button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por nome completo, CPF, telefone ou e-mail..."
              className="pl-9 h-9 text-xs"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPaginaAtual(1)
              }}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={filtroUnidade}
              onValueChange={(v) => {
                setFiltroUnidade(v)
                setPaginaAtual(1)
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filtrar Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-40">
            <Select
              value={filtroStatus}
              onValueChange={(v) => {
                setFiltroStatus(v)
                setPaginaAtual(1)
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em-tratamento">Em Tratamento</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Listagem em Tabela com Paginação */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Carregando base de pacientes do consultório...
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-500 text-xs">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Nenhum paciente encontrado com os filtros aplicados.</p>
              {busca && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBusca('')
                    setFiltroStatus('todos')
                    setFiltroUnidade('todas')
                  }}
                  className="text-xs text-[#0E7490]"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Paciente</th>
                      <th className="py-3 px-4">CPF / Idade</th>
                      <th className="py-3 px-4">Contatos</th>
                      <th className="py-3 px-4">Unidade / Convênio</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pacientesPaginados.map((paciente) => {
                      const idade = calcularIdade(paciente.data_nascimento || '')
                      const unidadeNome = paciente.unidade_id
                        ? unidadeNomeMap.get(paciente.unidade_id) || 'Unidade Principal'
                        : 'Unidade Principal'

                      return (
                        <tr key={paciente.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <Link
                              to={`/pacientes/${paciente.id}`}
                              className="hover:text-[#0E7490] hover:underline flex items-center gap-2"
                            >
                              <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-xs flex items-center justify-center shrink-0">
                                {paciente.nome ? paciente.nome[0].toUpperCase() : 'P'}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{paciente.nome}</div>
                                {paciente.responsavel_legal ? (
                                  <div className="text-[10px] text-amber-600 flex items-center gap-1 font-normal">
                                    <UserCheck className="w-3 h-3" />
                                    <span>Resp: {paciente.responsavel_legal}</span>
                                  </div>
                                ) : (
                                  paciente.genero &&
                                  paciente.genero !== 'nao_informado' && (
                                    <div className="text-[10px] text-slate-400 capitalize">
                                      {paciente.genero}
                                    </div>
                                  )
                                )}
                              </div>
                            </Link>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-800">
                              {paciente.cpf || 'Não informado'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {paciente.data_nascimento
                                ? `${paciente.data_nascimento} ${idade !== null ? `(${idade} anos)` : ''}`
                                : '—'}
                            </div>
                          </td>

                          <td className="py-3 px-4 space-y-0.5">
                            {paciente.telefone && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{paciente.telefone}</span>
                              </div>
                            )}
                            {paciente.email && (
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[160px]">{paciente.email}</span>
                              </div>
                            )}
                            {!paciente.telefone && !paciente.email && (
                              <span className="text-slate-400 italic">Sem contato</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 text-slate-700">
                              <Building className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{unidadeNome}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {paciente.convenio || 'Particular'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize font-medium ${
                                paciente.status === 'ativo'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : paciente.status === 'em-tratamento'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {paciente.status}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5"
                              >
                                <Link to={`/pacientes/${paciente.id}`}>Ficha</Link>
                              </Button>

                              {canAccessClinical() && (
                                <Button
                                  asChild
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-[#0E7490] hover:text-[#155E75]"
                                >
                                  <Link to={`/prontuario/${paciente.id}`}>
                                    <Stethoscope className="w-3 h-3 mr-1" />
                                    Prontuário
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 bg-slate-50/50">
                <div>
                  Mostrando{' '}
                  <span className="font-medium text-slate-700">
                    {Math.min(pacientesFiltrados.length, (paginaAtual - 1) * ITENS_POR_PAGINA + 1)}
                  </span>{' '}
                  a{' '}
                  <span className="font-medium text-slate-700">
                    {Math.min(pacientesFiltrados.length, paginaAtual * ITENS_POR_PAGINA)}
                  </span>{' '}
                  de <span className="font-medium text-slate-700">{pacientesFiltrados.length}</span>{' '}
                  pacientes
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={paginaAtual <= 1}
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="px-2 font-medium text-slate-700">
                    {paginaAtual} / {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={paginaAtual >= totalPaginas}
                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Cadastro Completo de Paciente (BL-003) */}
        <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0E7490]" />
                Cadastrar Novo Paciente
              </DialogTitle>
              <DialogDescription className="text-xs">
                Preencha os dados cadastrais obrigatórios e complementares conforme a conformidade
                LGPD.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarPaciente} className="space-y-4 py-2 text-xs">
              {/* Unidade & Situação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Unidade de Cadastro *</Label>
                  <Select value={novaUnidadeId} onValueChange={setNovaUnidadeId}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Situação Cadastral</Label>
                  <Select value={novoStatus} onValueChange={(v: any) => setNovoStatus(v)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="em-tratamento">Em Tratamento</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dados Civis */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nome Completo *</Label>
                <Input
                  required
                  placeholder="Ex: Carlos Eduardo Silveira"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">CPF (com validação Módulo-11)</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(formatarCPF(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Data de Nascimento{' '}
                    {idadeCalculada !== null && (
                      <span className="text-[#0E7490] font-semibold">({idadeCalculada} anos)</span>
                    )}
                  </Label>
                  <Input
                    type="date"
                    value={novoNasc}
                    onChange={(e) => setNovoNasc(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Gênero</Label>
                  <Select value={novoGenero} onValueChange={(v: any) => setNovoGenero(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao_informado">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Se for menor de idade, bloco do Responsável Legal */}
              {isMenorIdade && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span>Paciente menor de 18 anos — Responsável Legal Obrigatório</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-900">Nome do Responsável Legal *</Label>
                      <Input
                        required
                        placeholder="Ex: Fernanda Castro (Mãe)"
                        value={novoResponsavelNome}
                        onChange={(e) => setNovoResponsavelNome(e.target.value)}
                        className="h-8 text-xs bg-white border-amber-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-900">CPF do Responsável Legal</Label>
                      <Input
                        placeholder="000.000.000-00"
                        value={novoResponsavelCpf}
                        onChange={(e) => setNovoResponsavelCpf(formatarCPF(e.target.value))}
                        className="h-8 text-xs bg-white border-amber-300 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contatos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Telefone / WhatsApp (com DDD)</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(formatarTelefone(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="paciente@exemplo.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Convênio & Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Convênio / Plano</Label>
                  <Input
                    placeholder="Ex: Amil Dental ou Particular"
                    value={novoConvenio}
                    onChange={(e) => setNovoConvenio(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs font-medium">Endereço Residencial</Label>
                  <Input
                    placeholder="Rua, número, complemento, bairro, cidade - UF"
                    value={novoEndereco}
                    onChange={(e) => setNovoEndereco(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Tags & Observações */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Tags Clínicas (separadas por vírgula)</Label>
                <Input
                  placeholder="Ex: Ortodontia, Alto Valor, Preventivo"
                  value={novasTags}
                  onChange={(e) => setNovasTags(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Observações Gerais</Label>
                <Input
                  placeholder="Observações administrativas ou de atendimento..."
                  value={novasObservacoes}
                  onChange={(e) => setNovasObservacoes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNovoAberto(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  size="sm"
                  className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75]"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar Paciente'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
