import React, { useEffect, useState } from 'react'
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
  Filter,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  MoreVertical,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function PacientesList() {
  const { tenantId, user, perfil } = useAuth()
  const { toast } = useToast()

  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Modal Novo Paciente
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [novoNasc, setNovoNasc] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoEndereco, setNovoEndereco] = useState('')
  const [novoResponsavel, setNovoResponsavel] = useState('')
  const [novoStatus, setNovoStatus] = useState<'ativo' | 'inativo' | 'em-tratamento'>('ativo')
  const [novasTags, setNovasTags] = useState('Ortodontia, Preventivo')

  const carregarPacientes = async () => {
    setLoading(true)
    try {
      const res = await pb.collection('pacientes').getList<PacienteRecord>(1, 100, {
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

  // Submissão de novo paciente (RF-010 / CA-Usabilidade: < 3 min)
  const handleCriarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }

    setSalvando(true)
    try {
      const tagsArray = novasTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const novo = await pb.collection('pacientes').create<PacienteRecord>({
        tenant_id: tenantId,
        nome: novoNome.trim(),
        cpf: novoCpf.trim() || undefined,
        data_nascimento: novoNasc || undefined,
        telefone: novoTelefone.trim() || undefined,
        email: novoEmail.trim() || undefined,
        endereco: novoEndereco.trim() || undefined,
        responsavel_legal: novoResponsavel.trim() || undefined,
        status: novoStatus,
        score_evasao: 10, // Score inicial padrão baixo
        tags: tagsArray,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: novo.id,
        acao: 'cadastrou_paciente',
        detalhes: `Novo paciente cadastrado: ${novo.nome} (CPF: ${novo.cpf || 'N/A'})`,
      })

      toast({
        title: 'Paciente cadastrado com sucesso!',
        description: `${novo.nome} foi adicionado à base da clínica.`,
      })

      // Limpar formulário e fechar
      setNovoNome('')
      setNovoCpf('')
      setNovoNasc('')
      setNovoTelefone('')
      setNovoEmail('')
      setNovoEndereco('')
      setNovoResponsavel('')
      setModalNovoAberto(false)
      carregarPacientes()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Filtragem
  const pacientesFiltrados = pacientes.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.cpf && p.cpf.includes(busca)) ||
      (p.telefone && p.telefone.includes(busca)) ||
      (p.email && p.email.toLowerCase().includes(busca.toLowerCase()))

    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus

    return matchBusca && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0E7490]" />
            Pacientes & CRM Clínico
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Base unificada de pacientes, histórico de vínculos, score de evasão e prontuário
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
            placeholder="Buscar por nome, CPF, telefone ou e-mail..."
            className="pl-9 h-9 text-xs"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status do paciente" />
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

      {/* Listagem em Tabela com Responsividade */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Carregando pacientes...</div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Nenhum paciente encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">CPF / Nasc.</th>
                  <th className="py-3 px-4">Contatos</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score de Evasão</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pacientesFiltrados.map((paciente) => {
                  const score = paciente.score_evasao || 0
                  let scoreBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  if (score > 40 && score <= 70) {
                    scoreBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200'
                  } else if (score > 70) {
                    scoreBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200'
                  }

                  return (
                    <tr key={paciente.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <Link
                          to={`/pacientes/${paciente.id}`}
                          className="hover:text-[#0E7490] hover:underline flex items-center gap-2"
                        >
                          <div className="w-7 h-7 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-xs flex items-center justify-center shrink-0">
                            {paciente.nome[0].toUpperCase()}
                          </div>
                          <span>{paciente.nome}</span>
                        </Link>
                        {paciente.responsavel_legal && (
                          <div className="text-[10px] text-slate-400 pl-9">
                            Resp: {paciente.responsavel_legal}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono">{paciente.cpf || '—'}</div>
                        <div className="text-[11px] text-slate-400">
                          {paciente.data_nascimento || '—'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 space-y-0.5">
                        {paciente.telefone && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{paciente.telefone}</span>
                          </div>
                        )}
                        {paciente.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{paciente.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
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

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${scoreBadgeColor}`}
                          >
                            {score}%
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            {score > 70 ? 'Crítico' : score > 40 ? 'Médio' : 'Saudável'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                          >
                            <Link to={`/pacientes/${paciente.id}`}>Ficha</Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#0E7490] hover:text-[#155E75]"
                          >
                            <Link to={`/prontuario/${paciente.id}`}>Prontuário</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cadastro de Paciente (RF-010: Ágil em menos de 3 min) */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Cadastro de Paciente</DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados civis e de contato básicos para abertura imediata do prontuário
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarPaciente} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nome Completo *</Label>
              <Input
                required
                placeholder="Ex: Carlos Eduardo Silveira"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={novoCpf}
                  onChange={(e) => setNovoCpf(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Data de Nascimento</Label>
                <Input
                  type="date"
                  value={novoNasc}
                  onChange={(e) => setNovoNasc(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Telefone / WhatsApp</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  placeholder="paciente@exemplo.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Endereço Completo</Label>
              <Input
                placeholder="Rua, número, bairro, cidade - UF"
                value={novoEndereco}
                onChange={(e) => setNovoEndereco(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Responsável Legal (se menor)</Label>
                <Input
                  placeholder="Ex: Maria Silveira (Mãe)"
                  value={novoResponsavel}
                  onChange={(e) => setNovoResponsavel(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Situação Cadastral</Label>
                <Select value={novoStatus} onValueChange={(v: any) => setNovoStatus(v)}>
                  <SelectTrigger className="h-8 text-xs">
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

            <div className="space-y-1">
              <Label className="text-xs">Tags Clínicas (separadas por vírgula)</Label>
              <Input
                placeholder="Ex: Ortodontia, Alto Valor, Implante"
                value={novasTags}
                onChange={(e) => setNovasTags(e.target.value)}
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
  )
}
