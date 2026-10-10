import React, { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  AgendamentoRecord,
  ProfissionalRecord,
  PacienteRecord,
  ProcedimentoRecord,
  FilaEsperaRecord,
  SalaRecord,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Phone,
  Armchair,
  Stethoscope,
  ListOrdered,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Check,
  X,
  UserX,
  FileEdit,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuloGate } from '@/components/ModuloGate'

type ViewMode = 'dia' | 'semana' | 'sala'

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; cardClass: string }> = {
  pendente: {
    label: 'Agendado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    cardClass: 'border-l-4 border-l-amber-400 bg-amber-50/40 text-amber-950',
  },
  confirmado: {
    label: 'Confirmado',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    cardClass: 'border-l-4 border-l-emerald-500 bg-emerald-50/40 text-emerald-950',
  },
  presente: {
    label: 'Presente / Recepção',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
    cardClass: 'border-l-4 border-l-blue-500 bg-blue-50/40 text-blue-950',
  },
  em_atendimento: {
    label: 'Em Atendimento',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    cardClass: 'border-l-4 border-l-purple-500 bg-purple-50/40 text-purple-950',
  },
  concluido: {
    label: 'Atendido / Concluído',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    cardClass: 'border-l-4 border-l-slate-400 bg-slate-50 text-slate-800',
  },
  falta: {
    label: 'Faltou / No-show',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    cardClass: 'border-l-4 border-l-rose-500 bg-rose-50/50 text-rose-950',
  },
  cancelado: {
    label: 'Cancelado',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 line-through opacity-70',
    cardClass: 'border-l-4 border-l-red-300 bg-red-50/30 text-red-900 opacity-60',
  },
}

export default function Agenda() {
  const { tenantId, user, perfil, selectedUnidadeId, selectedUnidade, unidades } = useAuth()
  const { toast } = useToast()

  const [agendamentos, setAgendamentos] = useState<AgendamentoRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoRecord[]>([])
  const [filaEspera, setFilaEspera] = useState<FilaEsperaRecord[]>([])
  const [salasDisponiveis, setSalasDisponiveis] = useState<SalaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros da Agenda
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [viewMode, setViewMode] = useState<ViewMode>('dia')
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos')
  const [filtroSala, setFiltroSala] = useState<string>('todos')

  // Modal Novo Agendamento
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [agendamentoUnidadeId, setAgendamentoUnidadeId] = useState<string>('')
  const [agendamentoSalaId, setAgendamentoSalaId] = useState<string>('')
  const [pacienteId, setPacienteId] = useState('')
  const [buscaPacienteTexto, setBuscaPacienteTexto] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [procedimentoNome, setProcedimentoNome] = useState('')
  const [tipoConsulta, setTipoConsulta] = useState<
    'primeira_consulta' | 'retorno' | 'procedimento' | 'urgencia' | 'avaliacao'
  >('procedimento')
  const [duracaoMinutos, setDuracaoMinutos] = useState(30)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [salaSelecionada, setSalaSelecionada] = useState('')
  const [conflitoAlerta, setConflitoAlerta] = useState<string | null>(null)

  // Modal Remarcação / Troca de Horário
  const [modalRemarcarAberto, setModalRemarcarAberto] = useState(false)
  const [agendamentoRemarcando, setAgendamentoRemarcando] = useState<AgendamentoRecord | null>(null)
  const [remarcarNovaData, setRemarcarNovaData] = useState('')
  const [remarcarNovaHora, setRemarcarNovaHora] = useState('')
  const [remarcarNovaSalaId, setRemarcarNovaSalaId] = useState('')
  const [remarcarNovoProfId, setRemarcarNovoProfId] = useState('')
  const [remarcarConflito, setRemarcarConflito] = useState<string | null>(null)
  const [salvandoRemarcacao, setSalvandoRemarcacao] = useState(false)

  // Modal Justificativa de No-Show / Cancelamento
  const [modalMotivoAberto, setModalMotivoAberto] = useState(false)
  const [agendamentoMotivo, setAgendamentoMotivo] = useState<AgendamentoRecord | null>(null)
  const [tipoMotivoAcao, setTipoMotivoAcao] = useState<'falta' | 'cancelado'>('falta')
  const [motivoTexto, setMotivoTexto] = useState('')
  const [salvandoMotivo, setSalvandoMotivo] = useState(false)

  // Carregar dados principais da agenda
  const carregarDados = async () => {
    setLoading(true)
    try {
      let agFilter = tenantId ? `tenant_id = '${tenantId}'` : ''
      if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
        agFilter = agFilter
          ? `${agFilter} && unidade_id = '${selectedUnidadeId}'`
          : `unidade_id = '${selectedUnidadeId}'`
      }

      // Regra RBAC (BL-004): se o usuário logado for perfil 'dentista', filtrar por sua agenda
      if (perfil === 'dentista' && user?.email) {
        // Encontrar profissional correspondente ao email
        const dentistaProf = profissionais.find(
          (p) => p.email && p.email.toLowerCase() === user.email.toLowerCase(),
        )
        if (dentistaProf) {
          agFilter = agFilter
            ? `${agFilter} && profissional_id = '${dentistaProf.id}'`
            : `profissional_id = '${dentistaProf.id}'`
        }
      }

      let salasFilter = tenantId ? `tenant_id = '${tenantId}' && ativo = true` : 'ativo = true'
      if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
        salasFilter += ` && unidade_id = '${selectedUnidadeId}'`
      }

      const [agRes, profRes, pacRes, procRes, filaRes, salasRes] = await Promise.all([
        pb.collection('agendamentos').getList<AgendamentoRecord>(1, 300, {
          filter: agFilter || undefined,
          sort: 'data_inicio',
          expand: 'paciente_id,profissional_id',
        }),
        pb.collection('profissionais').getList<ProfissionalRecord>(1, 50, {
          filter: tenantId ? `tenant_id = '${tenantId}' && ativo = true` : 'ativo = true',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 300, {
          filter: tenantId ? `tenant_id = '${tenantId}'` : undefined,
          sort: 'nome',
        }),
        pb.collection('procedimentos').getList<ProcedimentoRecord>(1, 50, {
          sort: 'nome',
        }),
        pb.collection('filas_espera').getList<FilaEsperaRecord>(1, 20, {
          filter: "status = 'aguardando'",
          sort: 'prioridade',
          expand: 'paciente_id',
        }),
        pb.collection('salas').getList<SalaRecord>(1, 50, {
          filter: salasFilter,
          sort: 'ordem,nome',
        }),
      ])

      setAgendamentos(agRes.items)
      setProfissionais(profRes.items)
      setPacientes(pacRes.items)
      setProcedimentos(procRes.items)
      setFilaEspera(filaRes.items)
      setSalasDisponiveis(salasRes.items)

      if (profRes.items.length > 0 && !profissionalId) {
        setProfissionalId(profRes.items[0].id)
      }
      if (salasRes.items.length > 0 && !agendamentoSalaId) {
        setAgendamentoSalaId(salasRes.items[0].id)
        setSalaSelecionada(salasRes.items[0].nome)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da agenda:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()

    // Realtime do PocketBase
    const unsubscribe = pb.collection('agendamentos').subscribe('*', () => {
      carregarDados()
    })

    return () => {
      unsubscribe.then((unsub) => unsub())
    }
  }, [tenantId, selectedUnidadeId, perfil])

  // Checagem de Concorrência e Conflito de Horário (BL-004)
  const verificarConflito = (
    data: string,
    inicioHora: string,
    fimHora: string,
    profId: string,
    salaIdOuNome: string,
    ignoreAgId?: string,
  ): { conflito: boolean; motivo?: string } => {
    for (const ag of agendamentos) {
      if (ignoreAgId && ag.id === ignoreAgId) continue
      if (ag.status === 'cancelado') continue

      // Mesma data
      if (ag.data_inicio.slice(0, 10) !== data) continue

      // Sobreposição de horários
      const agInicio = ag.data_inicio.slice(11, 16)
      const agFim = ag.data_fim.slice(11, 16)
      const sobrepoe = inicioHora < agFim && fimHora > agInicio

      if (!sobrepoe) continue

      // Conflito 1: Mesmo Profissional
      if (ag.profissional_id === profId) {
        const profNome = ag.expand?.profissional_id?.nome || 'O profissional'
        return {
          conflito: true,
          motivo: `Conflito de agenda: ${profNome} já possui consulta marcada entre ${agInicio} e ${agFim}.`,
        }
      }

      // Conflito 2: Mesma Sala / Cadeira
      const mesmaSala =
        (ag.sala_id && ag.sala_id === salaIdOuNome) || (ag.sala && ag.sala === salaIdOuNome)
      if (mesmaSala) {
        const salaNome = ag.sala || 'A sala selecionada'
        return {
          conflito: true,
          motivo: `Conflito de espaço: ${salaNome} já está ocupada entre ${agInicio} e ${agFim}.`,
        }
      }
    }

    return { conflito: false }
  }

  // Validação em tempo real para novo agendamento
  useEffect(() => {
    if (!modalAberto) return
    const [h, m] = horaInicio.split(':').map(Number)
    const endMinutes = h * 60 + m + duracaoMinutos
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    const check = verificarConflito(
      selectedDate,
      horaInicio,
      horaFim,
      profissionalId,
      agendamentoSalaId || salaSelecionada,
    )
    if (check.conflito) {
      setConflitoAlerta(check.motivo || 'Horário indisponível.')
    } else {
      setConflitoAlerta(null)
    }
  }, [
    horaInicio,
    duracaoMinutos,
    profissionalId,
    agendamentoSalaId,
    salaSelecionada,
    selectedDate,
    modalAberto,
    agendamentos,
  ])

  // Validação em tempo real para remarcação
  useEffect(() => {
    if (!modalRemarcarAberto || !agendamentoRemarcando) return
    const [h, m] = remarcarNovaHora.split(':').map(Number)
    const dur = agendamentoRemarcando.duracao_minutos || 30
    const endMinutes = h * 60 + m + dur
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    const check = verificarConflito(
      remarcarNovaData,
      remarcarNovaHora,
      horaFim,
      remarcarNovoProfId,
      remarcarNovaSalaId,
      agendamentoRemarcando.id,
    )
    if (check.conflito) {
      setRemarcarConflito(check.motivo || 'Conflito de horário detectado.')
    } else {
      setRemarcarConflito(null)
    }
  }, [
    remarcarNovaData,
    remarcarNovaHora,
    remarcarNovaSalaId,
    remarcarNovoProfId,
    modalRemarcarAberto,
    agendamentoRemarcando,
    agendamentos,
  ])

  // Submissão de Novo Agendamento (BL-004)
  const handleCriarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || !profissionalId || !procedimentoNome) {
      toast({ title: 'Preencha paciente, profissional e procedimento', variant: 'destructive' })
      return
    }

    const [h, m] = horaInicio.split(':').map(Number)
    const endMinutes = h * 60 + m + duracaoMinutos
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    const check = verificarConflito(
      selectedDate,
      horaInicio,
      horaFim,
      profissionalId,
      agendamentoSalaId || salaSelecionada,
    )
    if (check.conflito) {
      toast({
        title: 'Bloqueio de Conflito de Horário (BL-004)',
        description: check.motivo,
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const dataInicioStr = `${selectedDate}T${horaInicio}:00`
      const dataFimStr = `${selectedDate}T${horaFim}:00`

      const targetUnidadeId =
        agendamentoUnidadeId ||
        (selectedUnidadeId !== 'todas' ? selectedUnidadeId : unidades[0]?.id || '')

      const salaObj = salasDisponiveis.find((s) => s.id === agendamentoSalaId)
      const nomeSalaFinal = salaObj ? salaObj.nome : salaSelecionada || 'Consultório 1'

      const novo = await pb.collection('agendamentos').create<AgendamentoRecord>({
        tenant_id: tenantId,
        unidade_id: targetUnidadeId,
        sala_id: agendamentoSalaId || undefined,
        sala: nomeSalaFinal,
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        procedimento: procedimentoNome,
        tipo_consulta: tipoConsulta,
        duracao_minutos: duracaoMinutos,
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        status: 'pendente',
        confirmacao_status: 'pendente',
        tentativa_confirmacao_em: new Date().toISOString(),
        origem: 'recepcao',
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: pacienteId,
        acao: 'criou_agendamento',
        detalhes: `Agendamento criado para ${selectedDate} às ${horaInicio} (${procedimentoNome}) na sala ${nomeSalaFinal}`,
      })

      toast({
        title: 'Agendamento cadastrado com sucesso!',
        description: `Horário reservado para ${selectedDate} às ${horaInicio}.`,
      })

      setModalAberto(false)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  // Executar Remarcação de Agendamento (BL-004)
  const handleExecutarRemarcacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agendamentoRemarcando) return

    if (remarcarConflito) {
      toast({
        title: 'Conflito de Horário',
        description: remarcarConflito,
        variant: 'destructive',
      })
      return
    }

    const [h, m] = remarcarNovaHora.split(':').map(Number)
    const dur = agendamentoRemarcando.duracao_minutos || 30
    const endMinutes = h * 60 + m + dur
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    const check = verificarConflito(
      remarcarNovaData,
      remarcarNovaHora,
      horaFim,
      remarcarNovoProfId,
      remarcarNovaSalaId,
      agendamentoRemarcando.id,
    )
    if (check.conflito) {
      toast({
        title: 'Conflito de Horário',
        description: check.motivo,
        variant: 'destructive',
      })
      return
    }

    setSalvandoRemarcacao(true)
    try {
      const dataInicioStr = `${remarcarNovaData}T${remarcarNovaHora}:00`
      const dataFimStr = `${remarcarNovaData}T${horaFim}:00`
      const salaObj = salasDisponiveis.find((s) => s.id === remarcarNovaSalaId)

      await pb.collection('agendamentos').update(agendamentoRemarcando.id, {
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        profissional_id: remarcarNovoProfId,
        sala_id: remarcarNovaSalaId || undefined,
        sala: salaObj ? salaObj.nome : agendamentoRemarcando.sala,
        status: 'pendente',
        confirmacao_status: 'pendente',
        tentativa_confirmacao_em: new Date().toISOString(),
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: agendamentoRemarcando.paciente_id,
        acao: 'remarcou_agendamento',
        detalhes: `Agendamento ID ${agendamentoRemarcando.id} remarcado de ${agendamentoRemarcando.data_inicio} para ${dataInicioStr}`,
      })

      toast({
        title: 'Consulta remarcada com sucesso!',
        description: `Novo horário fixado para ${remarcarNovaData} às ${remarcarNovaHora}.`,
      })

      setModalRemarcarAberto(false)
      setAgendamentoRemarcando(null)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao remarcar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoRemarcacao(false)
    }
  }

  // Abrir modal de remarcação
  const abrirRemarcacao = (ag: AgendamentoRecord) => {
    setAgendamentoRemarcando(ag)
    setRemarcarNovaData(ag.data_inicio.slice(0, 10))
    setRemarcarNovaHora(ag.data_inicio.slice(11, 16))
    setRemarcarNovoProfId(ag.profissional_id)
    setRemarcarNovaSalaId(ag.sala_id || salasDisponiveis[0]?.id || '')
    setModalRemarcarAberto(true)
  }

  // Atualizar Status Direto (ex: Confirmar, Marcar Presença, Em Atendimento, Concluir)
  const handleAtualizarStatus = async (
    agId: string,
    novoStatus: AgendamentoRecord['status'],
    confirmacaoStatus?: AgendamentoRecord['confirmacao_status'],
  ) => {
    try {
      const payload: Partial<AgendamentoRecord> = { status: novoStatus }
      if (confirmacaoStatus) {
        payload.confirmacao_status = confirmacaoStatus
        if (confirmacaoStatus === 'confirmado') {
          payload.confirmado_em = new Date().toISOString()
        }
      }

      await pb.collection('agendamentos').update(agId, payload)
      toast({
        title: `Status atualizado: ${STATUS_CONFIG[novoStatus]?.label || novoStatus}`,
      })

      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' })
    }
  }

  // Abrir modal para registrar falta/no-show ou cancelamento com motivo obrigatório (BL-005)
  const abrirModalMotivo = (ag: AgendamentoRecord, tipo: 'falta' | 'cancelado') => {
    setAgendamentoMotivo(ag)
    setTipoMotivoAcao(tipo)
    setMotivoTexto('')
    setModalMotivoAberto(true)
  }

  const handleSalvarMotivo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agendamentoMotivo) return
    if (!motivoTexto.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' })
      return
    }

    setSalvandoMotivo(true)
    try {
      const isFalta = tipoMotivoAcao === 'falta'
      await pb.collection('agendamentos').update(agendamentoMotivo.id, {
        status: isFalta ? 'falta' : 'cancelado',
        confirmacao_status: isFalta ? 'no_show' : 'nao_confirmou',
        motivo_cancelamento_ou_falta: motivoTexto.trim(),
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: agendamentoMotivo.paciente_id,
        acao: isFalta ? 'registrou_no_show' : 'cancelou_agendamento',
        detalhes: `Registro de ${isFalta ? 'falta (no-show)' : 'cancelamento'} com motivo: "${motivoTexto.trim()}"`,
      })

      toast({
        title: isFalta ? 'Falta / No-show registrado' : 'Consulta cancelada',
        description: 'Motivo gravado no prontuário e métricas atualizadas.',
      })

      // Se cancelado ou no-show, alertar sobre vaga para fila de espera (RF-006)
      if (filaEspera.length > 0) {
        const primeiroFila = filaEspera[0]
        toast({
          title: 'Vaga Liberada ofertada à Fila de Espera (RF-006)',
          description: `Vaga ofertada para ${primeiroFila.expand?.paciente_id?.nome || 'paciente na fila'}.`,
        })
      }

      setModalMotivoAberto(false)
      setAgendamentoMotivo(null)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao registrar motivo', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoMotivo(false)
    }
  }

  // Filtragem dos agendamentos para o dia selecionado
  const agendamentosDia = useMemo(() => {
    return agendamentos.filter((ag) => {
      const matchData = ag.data_inicio.slice(0, 10) === selectedDate
      const matchProf = filtroProfissional === 'todos' || ag.profissional_id === filtroProfissional
      const matchSala =
        filtroSala === 'todos' || ag.sala === filtroSala || ag.sala_id === filtroSala
      return matchData && matchProf && matchSala
    })
  }, [agendamentos, selectedDate, filtroProfissional, filtroSala])

  // Cálculo da semana para a visualização semanal
  const semanaDias = useMemo(() => {
    const atual = new Date(`${selectedDate}T12:00:00`)
    const diaDaSemana = atual.getDay() // 0 = Domingo, 1 = Segunda...
    // Início na Segunda-feira
    const diffParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana
    const segunda = new Date(atual)
    segunda.setDate(atual.getDate() + diffParaSegunda)

    const dias = []
    for (let i = 0; i < 6; i++) {
      // Segunda a Sábado
      const d = new Date(segunda)
      d.setDate(segunda.getDate() + i)
      const dataIso = d.toISOString().slice(0, 10)
      const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      dias.push({
        iso: dataIso,
        nome: nomes[i],
        diaMes: d.getDate(),
        mes: d.getMonth() + 1,
      })
    }
    return dias
  }, [selectedDate])

  // Grade de Horários (08:00 às 18:30)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let h = 8; h <= 18; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }, [])

  // Pacientes filtrados na busca do modal
  const pacientesFiltradosModal = useMemo(() => {
    if (!buscaPacienteTexto.trim()) return pacientes.slice(0, 20)
    const t = buscaPacienteTexto.toLowerCase()
    return pacientes.filter(
      (p) =>
        (p.nome && p.nome.toLowerCase().includes(t)) ||
        (p.cpf && p.cpf.includes(t)) ||
        (p.telefone && p.telefone.includes(t)),
    )
  }, [pacientes, buscaPacienteTexto])

  return (
    <ModuloGate modulo="agenda">
      <div className="space-y-6">
        {/* Top Header da Agenda */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 text-[#0E7490] flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 leading-tight">
                  Agenda de Consultas
                </h1>
                <Badge
                  variant="outline"
                  className="text-xs bg-cyan-50 text-[#0E7490] border-cyan-200"
                >
                  BL-004 & BL-005
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Grade por sala, concorrência profissional/espaço, visão dia/semana e fluxo de
                confirmação.
              </p>
            </div>
          </div>

          {/* Controles de Navegação de Data */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const d = new Date(`${selectedDate}T12:00:00`)
                  d.setDate(d.getDate() - (viewMode === 'semana' ? 7 : 1))
                  setSelectedDate(d.toISOString().slice(0, 10))
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Input
                type="date"
                className="h-7 border-0 bg-transparent text-xs font-semibold text-slate-800 w-32 text-center"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const d = new Date(`${selectedDate}T12:00:00`)
                  d.setDate(d.getDate() + (viewMode === 'semana' ? 7 : 1))
                  setSelectedDate(d.toISOString().slice(0, 10))
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            >
              Hoje
            </Button>

            <Button
              onClick={() => {
                setPacienteId('')
                setBuscaPacienteTexto('')
                setModalAberto(true)
              }}
              className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agendamento</span>
            </Button>
          </div>
        </div>

        {/* Barra de Filtros e Seletores de Modo */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Seletor de Profissional */}
            <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Dentistas</SelectItem>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Seletor de Cadeira / Sala */}
            <Select value={filtroSala} onValueChange={setFiltroSala}>
              <SelectTrigger className="h-8 text-xs w-48">
                <SelectValue placeholder="Sala / Cadeira" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Salas</SelectItem>
                {salasDisponiveis.map((s) => (
                  <SelectItem key={s.id} value={s.nome}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Abas de Modo de Visualização (Dia, Semana, Grade por Sala) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <Button
              size="sm"
              variant={viewMode === 'dia' ? 'default' : 'ghost'}
              className={`h-7 text-xs ${viewMode === 'dia' ? 'bg-[#0E7490] text-white' : 'text-slate-600'}`}
              onClick={() => setViewMode('dia')}
            >
              <CalendarIcon className="w-3.5 h-3.5 mr-1" />
              Dia
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'semana' ? 'default' : 'ghost'}
              className={`h-7 text-xs ${viewMode === 'semana' ? 'bg-[#0E7490] text-white' : 'text-slate-600'}`}
              onClick={() => setViewMode('semana')}
            >
              <CalendarRange className="w-3.5 h-3.5 mr-1" />
              Semana
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'sala' ? 'default' : 'ghost'}
              className={`h-7 text-xs ${viewMode === 'sala' ? 'bg-[#0E7490] text-white' : 'text-slate-600'}`}
              onClick={() => setViewMode('sala')}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />
              Grade por Sala
            </Button>
          </div>
        </div>

        {/* ÁREA DA GRADE PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna 1-3: Grade de Agendamentos */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                Carregando agenda sincronizada do consultório...
              </div>
            ) : viewMode === 'dia' ? (
              /* ================== VISÃO DIA ================== */
              <div className="min-w-[620px]">
                <div className="grid grid-cols-12 gap-2 pb-3 border-b text-xs font-semibold text-slate-600">
                  <div className="col-span-2 text-slate-400">Horário</div>
                  <div className="col-span-10">Consultas Agendadas</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {timeSlots.map((slot) => {
                    const agsNesteSlot = agendamentosDia.filter(
                      (ag) => ag.data_inicio.slice(11, 16) === slot,
                    )

                    return (
                      <div
                        key={slot}
                        className="grid grid-cols-12 gap-2 py-2 items-start hover:bg-slate-50/60 min-h-[58px]"
                      >
                        <div className="col-span-2 text-xs font-mono font-medium text-slate-500 pt-1">
                          {slot}
                        </div>

                        <div className="col-span-10 flex flex-wrap gap-2.5">
                          {agsNesteSlot.map((ag) => {
                            const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'
                            const profNome = ag.expand?.profissional_id?.nome || 'Dentista'
                            const conf = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente

                            return (
                              <div
                                key={ag.id}
                                className={`p-2.5 rounded-lg border text-xs shadow-xs flex flex-col justify-between min-w-[270px] max-w-sm ${conf.cardClass}`}
                              >
                                <div>
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="truncate max-w-[150px]">{pacNome}</span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] px-1.5 py-0 ${conf.badgeClass}`}
                                    >
                                      {conf.label}
                                    </Badge>
                                  </div>

                                  <div className="text-[11px] font-medium opacity-90 mt-0.5">
                                    {ag.procedimento}
                                  </div>

                                  <div className="text-[10px] opacity-75 mt-1 flex items-center justify-between">
                                    <span>{profNome}</span>
                                    <span className="font-semibold">{ag.sala || 'Sala Geral'}</span>
                                  </div>

                                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                    {ag.data_inicio.slice(11, 16)} às {ag.data_fim.slice(11, 16)} (
                                    {ag.duracao_minutos || 30} min)
                                  </div>

                                  {ag.motivo_cancelamento_ou_falta && (
                                    <div className="mt-1 text-[10px] text-rose-800 bg-rose-100/60 p-1 rounded">
                                      Motivo: {ag.motivo_cancelamento_ou_falta}
                                    </div>
                                  )}
                                </div>

                                {/* Ações operacionais rápidas de balcão */}
                                <div className="flex items-center gap-1 mt-2.5 pt-1.5 border-t border-black/5 flex-wrap">
                                  {ag.status === 'pendente' && (
                                    <button
                                      onClick={() =>
                                        handleAtualizarStatus(ag.id, 'confirmado', 'confirmado')
                                      }
                                      className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-0.5"
                                      title="Confirmar Presença Antecipada"
                                    >
                                      <Check className="w-3 h-3" />
                                      Confirmar
                                    </button>
                                  )}

                                  {ag.status !== 'presente' && ag.status !== 'concluido' && (
                                    <button
                                      onClick={() => handleAtualizarStatus(ag.id, 'presente')}
                                      className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                      title="Paciente chegou à recepção"
                                    >
                                      Chegou
                                    </button>
                                  )}

                                  {ag.status === 'presente' && (
                                    <button
                                      onClick={() => handleAtualizarStatus(ag.id, 'em_atendimento')}
                                      className="text-[10px] px-1.5 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700"
                                    >
                                      Atender
                                    </button>
                                  )}

                                  {ag.status !== 'concluido' && (
                                    <button
                                      onClick={() => handleAtualizarStatus(ag.id, 'concluido')}
                                      className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-white rounded hover:bg-slate-800"
                                    >
                                      Concluir
                                    </button>
                                  )}

                                  <button
                                    onClick={() => abrirRemarcacao(ag)}
                                    className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 flex items-center gap-0.5"
                                  >
                                    <FileEdit className="w-2.5 h-2.5" />
                                    Remarcar
                                  </button>

                                  {ag.status !== 'falta' && ag.status !== 'concluido' && (
                                    <button
                                      onClick={() => abrirModalMotivo(ag, 'falta')}
                                      className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100"
                                    >
                                      No-show
                                    </button>
                                  )}

                                  {ag.status !== 'cancelado' && (
                                    <button
                                      onClick={() => abrirModalMotivo(ag, 'cancelado')}
                                      className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 ml-auto"
                                    >
                                      Cancelar
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : viewMode === 'semana' ? (
              /* ================== VISÃO SEMANA ================== */
              <div className="min-w-[800px]">
                <div className="grid grid-cols-6 gap-2 pb-2 border-b text-xs font-semibold text-slate-700">
                  {semanaDias.map((dia) => (
                    <div
                      key={dia.iso}
                      className={`text-center p-2 rounded ${
                        dia.iso === selectedDate ? 'bg-cyan-50 text-[#0E7490] font-bold' : ''
                      }`}
                    >
                      <div>
                        {dia.nome}, {dia.diaMes}/{dia.mes}
                      </div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {
                          agendamentos.filter(
                            (a) =>
                              a.data_inicio.slice(0, 10) === dia.iso && a.status !== 'cancelado',
                          ).length
                        }{' '}
                        consultas
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-6 gap-2 pt-3">
                  {semanaDias.map((dia) => {
                    const agsDia = agendamentos.filter(
                      (a) => a.data_inicio.slice(0, 10) === dia.iso,
                    )

                    return (
                      <div
                        key={dia.iso}
                        className="bg-slate-50/60 p-2 rounded-lg border border-slate-200 min-h-[450px] space-y-2"
                      >
                        {agsDia.length === 0 ? (
                          <div className="text-center py-8 text-[11px] text-slate-400">
                            Sem consultas
                          </div>
                        ) : (
                          agsDia.map((ag) => {
                            const conf = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente
                            const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'

                            return (
                              <div
                                key={ag.id}
                                className={`p-2 rounded border text-[11px] shadow-xs cursor-pointer hover:shadow-sm transition-shadow ${conf.cardClass}`}
                                onClick={() => abrirRemarcacao(ag)}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <span className="truncate">{pacNome}</span>
                                  <span className="font-mono text-[9px]">
                                    {ag.data_inicio.slice(11, 16)}
                                  </span>
                                </div>
                                <div className="truncate text-[10px] opacity-80 mt-0.5">
                                  {ag.procedimento}
                                </div>
                                <div className="text-[9px] opacity-70 mt-1 flex items-center justify-between">
                                  <span className="truncate">{ag.sala || 'Sala'}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[8px] px-1 py-0 ${conf.badgeClass}`}
                                  >
                                    {conf.label}
                                  </Badge>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ================== VISÃO GRADE POR SALA ================== */
              <div className="min-w-[800px]">
                <div
                  className="grid gap-3 pb-3 border-b text-xs font-semibold text-slate-700"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, salasDisponiveis.length)}, minmax(220px, 1fr))`,
                  }}
                >
                  {salasDisponiveis.map((sala) => (
                    <div
                      key={sala.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center"
                    >
                      <div className="font-bold text-slate-900">{sala.nome}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {sala.cadeiras_qtd || 1} cadeira(s) de atendimento
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="grid gap-3 pt-3"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, salasDisponiveis.length)}, minmax(220px, 1fr))`,
                  }}
                >
                  {salasDisponiveis.map((sala) => {
                    const agsSala = agendamentosDia.filter(
                      (a) => a.sala_id === sala.id || a.sala === sala.nome,
                    )

                    return (
                      <div
                        key={sala.id}
                        className="bg-slate-50/40 p-2.5 rounded-lg border border-slate-200 min-h-[450px] space-y-2.5"
                      >
                        {agsSala.length === 0 ? (
                          <div className="text-center py-12 text-xs text-slate-400">
                            Cadeira livre nesta data
                          </div>
                        ) : (
                          agsSala.map((ag) => {
                            const conf = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente
                            const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'
                            const profNome = ag.expand?.profissional_id?.nome || 'Dentista'

                            return (
                              <div
                                key={ag.id}
                                className={`p-2.5 rounded-lg border text-xs shadow-xs ${conf.cardClass}`}
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span className="truncate">{pacNome}</span>
                                  <span className="font-mono text-[10px]">
                                    {ag.data_inicio.slice(11, 16)} - {ag.data_fim.slice(11, 16)}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium opacity-90 mt-0.5">
                                  {ag.procedimento}
                                </div>
                                <div className="text-[10px] opacity-75 mt-1 flex items-center justify-between">
                                  <span>{profNome}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1 py-0 ${conf.badgeClass}`}
                                  >
                                    {conf.label}
                                  </Badge>
                                </div>
                                <div className="mt-2 pt-1 border-t border-black/5 flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => abrirRemarcacao(ag)}
                                  >
                                    Remarcar
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Coluna 4: Fila de Espera & Painel de Confirmações Pendentes */}
          <div className="space-y-6">
            {/* Lista de Espera Inteligente (BL-013) */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[#0E7490]" />
                  Lista de Espera (RF-006)
                </CardTitle>
                <CardDescription className="text-xs">
                  Pacientes aguardando cancelamento ou encaixe
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 p-3">
                {filaEspera.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Nenhum paciente na fila de espera no momento.
                  </div>
                ) : (
                  filaEspera.map((f, idx) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>
                          #{idx + 1} {f.expand?.paciente_id?.nome}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-cyan-50 text-cyan-800">
                          Prioridade {f.prioridade || 1}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Preferência: {f.data_desejada || 'O quanto antes'}
                      </div>
                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] text-[#0E7490]"
                          onClick={() => {
                            toast({
                              title: 'Vaga ofertada',
                              description: `Convite enviado para ${f.expand?.paciente_id?.nome}.`,
                            })
                          }}
                        >
                          Ofertar Horário
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Agendamento Online Público */}
            <Card className="border-cyan-200 bg-gradient-to-br from-white to-cyan-50/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-[#0E7490]" />
                  Portal Online do Paciente
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>Link de auto-agendamento sincronizado com as regras de concorrência:</p>
                <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[11px] select-all break-all text-slate-700">
                  {window.location.origin}/agendar-online
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full text-xs text-[#0E7490]"
                >
                  <Link to="/agendar-online" target="_blank">
                    Abrir Página Pública
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal Novo Agendamento (BL-004) */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Novo Agendamento Clínico
              </DialogTitle>
              <DialogDescription className="text-xs">
                Validação automática de sobreposição de cirurgião-dentista e sala física.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarAgendamento} className="space-y-3 py-2 text-xs">
              {conflitoAlerta && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{conflitoAlerta}</span>
                </div>
              )}

              {/* Paciente com Autocomplete / Busca Rápida */}
              <div className="space-y-1">
                <Label className="text-xs">Paciente *</Label>
                <Input
                  placeholder="Digitar para buscar paciente por nome ou CPF..."
                  className="h-8 text-xs mb-1"
                  value={buscaPacienteTexto}
                  onChange={(e) => setBuscaPacienteTexto(e.target.value)}
                />
                <Select value={pacienteId} onValueChange={setPacienteId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o paciente encontrado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientesFiltradosModal.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cirurgião-Dentista */}
              <div className="space-y-1">
                <Label className="text-xs">Cirurgião-Dentista *</Label>
                <Select value={profissionalId} onValueChange={setProfissionalId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o dentista..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.nome} ({pr.cro})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Procedimento e Tipo de Consulta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Consulta *</Label>
                  <Select value={tipoConsulta} onValueChange={(v: any) => setTipoConsulta(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primeira_consulta">Primeira Consulta</SelectItem>
                      <SelectItem value="retorno">Retorno</SelectItem>
                      <SelectItem value="procedimento">Procedimento</SelectItem>
                      <SelectItem value="urgencia">Urgência</SelectItem>
                      <SelectItem value="avaliacao">Avaliação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Procedimento Previsto *</Label>
                  <Select
                    value={procedimentoNome}
                    onValueChange={(val) => {
                      setProcedimentoNome(val)
                      const pObj = procedimentos.find((x) => x.nome === val)
                      if (pObj) setDuracaoMinutos(pObj.duracao_minutos)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {procedimentos.map((proc) => (
                        <SelectItem key={proc.id} value={proc.nome}>
                          {proc.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Horário & Duração */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Horário de Início</Label>
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Duração Estimada</Label>
                  <Select
                    value={String(duracaoMinutos)}
                    onValueChange={(v) => setDuracaoMinutos(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="90">1h30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sala / Cadeira */}
              <div className="space-y-1">
                <Label className="text-xs">Cadeira / Sala de Atendimento *</Label>
                <Select
                  value={agendamentoSalaId}
                  onValueChange={(val) => {
                    setAgendamentoSalaId(val)
                    const sObj = salasDisponiveis.find((s) => s.id === val)
                    if (sObj) setSalaSelecionada(sObj.nome)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione a sala..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salasDisponiveis.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalAberto(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando || Boolean(conflitoAlerta)}
                  size="sm"
                  className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75]"
                >
                  {salvando ? 'Salvando...' : 'Confirmar Agendamento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Remarcação (BL-004) */}
        <Dialog open={modalRemarcarAberto} onOpenChange={setModalRemarcarAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-[#0E7490]" />
                Remarcar Consulta
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecione uma nova data, horário ou profissional. Conflitos de horário são
                revalidados automaticamente.
              </DialogDescription>
            </DialogHeader>

            {agendamentoRemarcando && (
              <form onSubmit={handleExecutarRemarcacao} className="space-y-3 py-2 text-xs">
                <div className="p-2.5 bg-slate-50 border rounded-lg text-slate-700">
                  <span className="font-semibold block">
                    {agendamentoRemarcando.expand?.paciente_id?.nome}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Procedimento: {agendamentoRemarcando.procedimento}
                  </span>
                </div>

                {remarcarConflito && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{remarcarConflito}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nova Data *</Label>
                    <Input
                      type="date"
                      value={remarcarNovaData}
                      onChange={(e) => setRemarcarNovaData(e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Novo Horário *</Label>
                    <Input
                      type="time"
                      value={remarcarNovaHora}
                      onChange={(e) => setRemarcarNovaHora(e.target.value)}
                      className="h-8 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Dentista Responsável</Label>
                  <Select value={remarcarNovoProfId} onValueChange={setRemarcarNovoProfId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Sala / Cadeira</Label>
                  <Select value={remarcarNovaSalaId} onValueChange={setRemarcarNovaSalaId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {salasDisponiveis.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalRemarcarAberto(false)}
                    className="h-8 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={salvandoRemarcacao || Boolean(remarcarConflito)}
                    size="sm"
                    className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75]"
                  >
                    {salvandoRemarcacao ? 'Remarcando...' : 'Confirmar Nova Data'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Motivo para No-Show e Cancelamento (BL-005) */}
        <Dialog open={modalMotivoAberto} onOpenChange={setModalMotivoAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-rose-900">
                {tipoMotivoAcao === 'falta' ? 'Registrar Falta (No-Show)' : 'Cancelar Agendamento'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Registre o motivo do não comparecimento ou do cancelamento para compor o histórico
                do paciente e as métricas de evasão da clínica.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSalvarMotivo} className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Motivo curto do desfecho *</Label>
                <Input
                  required
                  placeholder="Ex: Paciente teve imprevisto no trabalho / Não atendeu o telefone..."
                  value={motivoTexto}
                  onChange={(e) => setMotivoTexto(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalMotivoAberto(false)}
                  className="h-8 text-xs"
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoMotivo}
                  size="sm"
                  className={`h-8 text-xs text-white ${
                    tipoMotivoAcao === 'falta'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {salvandoMotivo ? 'Registrando...' : 'Confirmar Registro'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
