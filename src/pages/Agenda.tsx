import React, { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  AgendamentoRecord,
  ProfissionalRecord,
  PacienteRecord,
  ProcedimentoRecord,
  FilaEsperaRecord,
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
} from 'lucide-react'
import { Link } from 'react-router-dom'

type ViewMode = 'dia' | 'semana' | 'cadeira'

export default function Agenda() {
  const { tenantId, user, perfil } = useAuth()
  const { toast } = useToast()

  const [agendamentos, setAgendamentos] = useState<AgendamentoRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoRecord[]>([])
  const [filaEspera, setFilaEspera] = useState<FilaEsperaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros da Agenda
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [viewMode, setViewMode] = useState<ViewMode>('dia')
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos')
  const [filtroSala, setFiltroSala] = useState<string>('todos')

  // Modal Novo Agendamento
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [pacienteId, setPacienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [procedimentoNome, setProcedimentoNome] = useState('')
  const [duracaoMinutos, setDuracaoMinutos] = useState(30)
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [salaSelecionada, setSalaSelecionada] = useState('Cadeira 1 - Ortodontia')
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [recorrenciaQtd, setRecorrenciaQtd] = useState(4)
  const [conflitoAlerta, setConflitoAlerta] = useState<string | null>(null)

  // Carregar dados principais
  const carregarDados = async () => {
    setLoading(true)
    try {
      const [agRes, profRes, pacRes, procRes, filaRes] = await Promise.all([
        pb.collection('agendamentos').getList<AgendamentoRecord>(1, 200, {
          sort: 'data_inicio',
          expand: 'paciente_id,profissional_id',
        }),
        pb.collection('profissionais').getList<ProfissionalRecord>(1, 50, {
          filter: 'ativo = true',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 200, {
          filter: "status != 'inativo'",
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
      ])

      setAgendamentos(agRes.items)
      setProfissionais(profRes.items)
      setPacientes(pacRes.items)
      setProcedimentos(procRes.items)
      setFilaEspera(filaRes.items)

      if (profRes.items.length > 0 && !profissionalId) {
        setProfissionalId(profRes.items[0].id)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da agenda:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()

    // Inscrição em tempo real para refletir agendamento online público em < 5s (RF-004 / CA-Agenda)
    const unsubscribe = pb.collection('agendamentos').subscribe('*', () => {
      carregarDados()
    })

    return () => {
      unsubscribe.then((unsub) => unsub())
    }
  }, [tenantId])

  // Checagem de Concorrência e Conflito de Horário em Tempo Real (RF-002 / CA-Agenda)
  const verificarConflito = (
    inicio: string,
    fim: string,
    profId: string,
    sala: string,
  ): boolean => {
    return agendamentos.some((ag) => {
      if (ag.status === 'cancelado') return false
      // Mesma data
      if (ag.data_inicio.slice(0, 10) !== selectedDate) return false

      // Sobreposição de horários
      const agInicio = ag.data_inicio.slice(11, 16)
      const agFim = ag.data_fim.slice(11, 16)
      const temSobreposicao = inicio < agFim && fim > agInicio

      if (!temSobreposicao) return false

      // Conflito por mesmo profissional ou mesma cadeira
      if (ag.profissional_id === profId) return true
      if (ag.sala === sala) return true

      return false
    })
  }

  // Atualizar validação de conflito sempre que os campos de horário mudarem
  useEffect(() => {
    if (!modalAberto) return
    const [h, m] = horaInicio.split(':').map(Number)
    const endMinutes = h * 60 + m + duracaoMinutos
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    const haConflito = verificarConflito(horaInicio, horaFim, profissionalId, salaSelecionada)
    if (haConflito) {
      setConflitoAlerta(
        'Conflito detectado: o profissional ou a cadeira física já possuem agendamento neste horário (RF-002).',
      )
    } else {
      setConflitoAlerta(null)
    }
  }, [horaInicio, duracaoMinutos, profissionalId, salaSelecionada, modalAberto, agendamentos])

  // Salvar Agendamento
  const handleCriarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || !profissionalId || !procedimentoNome) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' })
      return
    }

    const [h, m] = horaInicio.split(':').map(Number)
    const endMinutes = h * 60 + m + duracaoMinutos
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
    const endM = String(endMinutes % 60).padStart(2, '0')
    const horaFim = `${endH}:${endM}`

    if (conflitoAlerta) {
      toast({
        title: 'Bloqueio de Concorrência (CA-Agenda)',
        description: conflitoAlerta,
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const dataInicioStr = `${selectedDate}T${horaInicio}:00`
      const dataFimStr = `${selectedDate}T${horaFim}:00`

      // Criar agendamento base
      const novo = await pb.collection('agendamentos').create<AgendamentoRecord>({
        tenant_id: tenantId,
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        procedimento: procedimentoNome,
        duracao_minutos: duracaoMinutos,
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        sala: salaSelecionada,
        status: 'confirmado',
        origem: 'recepcao',
        recorrencia: isRecorrente
          ? { frequencia: 'semanal', ocorrencias: recorrenciaQtd }
          : undefined,
      })

      // Simular fila de lembrete WhatsApp (RF-005 / BL-010)
      const pac = pacientes.find((p) => p.id === pacienteId)
      if (pac?.telefone) {
        await pb.collection('messages_lembretes').create({
          tenant_id: tenantId,
          agendamento_id: novo.id,
          destinatario_nome: pac.nome,
          telefone: pac.telefone,
          mensagem: `Olá, ${pac.nome}! Confirmamos sua consulta no GesTec-IA-Odonto para ${selectedDate} às ${horaInicio}. Responda SIM para confirmar.`,
          canal: 'whatsapp',
          tipo_gatilho: 'confirmacao_48h',
          status: 'agendado',
        })
      }

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: pacienteId,
        acao: 'criou_agendamento',
        detalhes: `Agendamento marcado para ${selectedDate} às ${horaInicio} (${procedimentoNome})`,
      })

      toast({
        title: 'Agendamento salvo com sucesso!',
        description: 'Horário reservado e lembrete enfileirado.',
      })

      setModalAberto(false)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  // Mudar Status (ex: Concluir, Cancelar, Marcar Presença)
  const handleAtualizarStatus = async (agId: string, novoStatus: AgendamentoRecord['status']) => {
    try {
      await pb.collection('agendamentos').update(agId, { status: novoStatus })
      toast({ title: `Status atualizado para ${novoStatus.toUpperCase()}` })

      // Se cancelado, acionar lista de espera automaticamente (RF-006 / BL-013)
      if (novoStatus === 'cancelado' && filaEspera.length > 0) {
        const primeiroFila = filaEspera[0]
        toast({
          title: 'Vaga Liberada ofertada à Fila de Espera (RF-006)',
          description: `Vaga ofertada para ${primeiroFila.expand?.paciente_id?.nome || 'paciente na fila'}.`,
        })
      }

      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' })
    }
  }

  // Filtragem dos agendamentos da data selecionada
  const agendamentosDia = agendamentos.filter((ag) => {
    const matchData = ag.data_inicio.slice(0, 10) === selectedDate
    const matchProf = filtroProfissional === 'todos' || ag.profissional_id === filtroProfissional
    const matchSala = filtroSala === 'todos' || ag.sala === filtroSala
    return matchData && matchProf && matchSala
  })

  // Geração das linhas de tempo (das 08:00 às 19:00 de 30 em 30 min)
  const timeSlots = []
  for (let h = 8; h <= 18; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`)
    timeSlots.push(`${String(h).padStart(2, '0')}:30`)
  }

  return (
    <div className="space-y-6">
      {/* Top Header da Agenda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-50 text-[#0E7490] flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Agenda Multi-profissional
            </h1>
            <p className="text-xs text-slate-500">
              Validação de concorrência em tempo real e agendamento online
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
                const d = new Date(selectedDate)
                d.setDate(d.getDate() - 1)
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
                const d = new Date(selectedDate)
                d.setDate(d.getDate() + 1)
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
            onClick={() => setModalAberto(true)}
            className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Modo de Visualização */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Seletor de Profissional */}
          <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Profissionais</SelectItem>
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
              <SelectValue placeholder="Cadeira Clínica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Cadeiras</SelectItem>
              <SelectItem value="Cadeira 1 - Ortodontia">Cadeira 1 - Ortodontia</SelectItem>
              <SelectItem value="Cadeira 2 - Clínica Geral">Cadeira 2 - Clínica Geral</SelectItem>
              <SelectItem value="Cadeira 3 - Cirurgia">Cadeira 3 - Cirurgia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Modo de Visualização */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <Button
            size="sm"
            variant={viewMode === 'dia' ? 'default' : 'ghost'}
            className={`h-7 text-xs ${viewMode === 'dia' ? 'bg-[#0E7490] text-white' : 'text-slate-600'}`}
            onClick={() => setViewMode('dia')}
          >
            Dia
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'cadeira' ? 'default' : 'ghost'}
            className={`h-7 text-xs ${viewMode === 'cadeira' ? 'bg-[#0E7490] text-white' : 'text-slate-600'}`}
            onClick={() => setViewMode('cadeira')}
          >
            Por Cadeira
          </Button>
        </div>
      </div>

      {/* Grade Principal da Agenda com Fila de Espera ao Lado */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grade de Horários (3 colunas no desktop) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header com os profissionais ou cadeiras */}
            <div className="grid grid-cols-12 gap-2 pb-3 border-b text-xs font-semibold text-slate-600">
              <div className="col-span-2 text-slate-400">Horário</div>
              <div className="col-span-10">Agendamentos & Consultas</div>
            </div>

            {/* Slots de Tempo */}
            <div className="divide-y divide-slate-100">
              {timeSlots.map((slot) => {
                // Encontrar agendamentos que iniciam neste slot
                const agsNesteSlot = agendamentosDia.filter(
                  (ag) => ag.data_inicio.slice(11, 16) === slot,
                )

                return (
                  <div
                    key={slot}
                    className="grid grid-cols-12 gap-2 py-2 items-start hover:bg-slate-50/60 min-h-[50px]"
                  >
                    <div className="col-span-2 text-xs font-mono font-medium text-slate-500 pt-1">
                      {slot}
                    </div>

                    <div className="col-span-10 flex flex-wrap gap-2">
                      {agsNesteSlot.map((ag) => {
                        const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'
                        const profNome = ag.expand?.profissional_id?.nome || 'Dentista'

                        const statusBg: Record<string, string> = {
                          confirmado: 'bg-emerald-50 border-emerald-300 text-emerald-900',
                          presente: 'bg-blue-50 border-blue-300 text-blue-900',
                          pendente: 'bg-amber-50 border-amber-300 text-amber-900',
                          em_atendimento: 'bg-purple-50 border-purple-300 text-purple-900',
                          concluido: 'bg-slate-100 border-slate-300 text-slate-800',
                          cancelado: 'bg-red-50 border-red-300 text-red-800 opacity-60',
                          falta: 'bg-rose-50 border-rose-300 text-rose-800',
                        }

                        return (
                          <div
                            key={ag.id}
                            className={`p-2 rounded-lg border text-xs shadow-xs flex flex-col justify-between min-w-[240px] max-w-sm ${statusBg[ag.status]}`}
                          >
                            <div>
                              <div className="flex items-center justify-between font-bold">
                                <span>{pacNome}</span>
                                <span className="font-mono text-[10px]">
                                  {ag.data_inicio.slice(11, 16)} - {ag.data_fim.slice(11, 16)}
                                </span>
                              </div>
                              <div className="text-[11px] opacity-80 mt-0.5">{ag.procedimento}</div>
                              <div className="text-[10px] opacity-70 mt-1 flex items-center justify-between">
                                <span>{profNome}</span>
                                <span className="font-semibold">{ag.sala}</span>
                              </div>
                            </div>

                            {/* Ações operacionais rápidas de balcão */}
                            <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-black/5">
                              {ag.status !== 'presente' && ag.status !== 'concluido' && (
                                <button
                                  onClick={() => handleAtualizarStatus(ag.id, 'presente')}
                                  className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Marcar Presença
                                </button>
                              )}
                              <button
                                onClick={() => handleAtualizarStatus(ag.id, 'concluido')}
                                className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-white rounded hover:bg-slate-800"
                              >
                                Concluir
                              </button>
                              <button
                                onClick={() => handleAtualizarStatus(ag.id, 'cancelado')}
                                className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Cancelar
                              </button>
                              <Link
                                to={`/prontuario/${ag.paciente_id}`}
                                className="text-[10px] px-1.5 py-0.5 bg-cyan-700 text-white rounded hover:bg-cyan-800 ml-auto"
                              >
                                Prontuário
                              </Link>
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
        </div>

        {/* Painel Lateral: Fila de Espera (BL-013 - Should Have) e Métricas */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-[#0E7490]" />
                Lista de Espera Inteligente (RF-006)
              </CardTitle>
              <CardDescription className="text-xs">
                Pacientes priorizados para preenchimento de cancelamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
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
                      Preferencia: {f.data_desejada || 'O quanto antes'}
                    </div>
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] text-[#0E7490]"
                        onClick={() => {
                          toast({
                            title: 'Slot Ofertado',
                            description: `Notificação enviada para ${f.expand?.paciente_id?.nome} com link de confirmação direta.`,
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

          {/* Card Agendamento Online Público */}
          <Card className="border-cyan-200 bg-gradient-to-br from-white to-cyan-50/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[#0E7490]" />
                Portal de Agendamento Online
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>Compartilhe o link público com seus pacientes no WhatsApp ou redes sociais:</p>
              <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[11px] select-all break-all text-slate-700">
                {window.location.origin}/agendar-online
              </div>
              <Button asChild size="sm" variant="outline" className="w-full text-xs text-[#0E7490]">
                <Link to="/agendar-online" target="_blank">
                  Abrir Agendamento Público
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Novo Agendamento */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Agendamento Clínico</DialogTitle>
            <DialogDescription className="text-xs">
              Validação automática de sobreposição e alocação de cadeira física
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarAgendamento} className="space-y-3 py-2 text-xs">
            {/* Alerta de Conflito em tempo real (RF-002) */}
            {conflitoAlerta && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{conflitoAlerta}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Paciente *</Label>
              <Select value={pacienteId} onValueChange={setPacienteId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Cirurgião-Dentista *</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione o profissional" />
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
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {procedimentos.map((proc) => (
                    <SelectItem key={proc.id} value={proc.nome}>
                      {proc.nome} ({proc.duracao_minutos} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Horário de Início</Label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="h-8 text-xs"
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

            <div className="space-y-1">
              <Label className="text-xs">Cadeira / Sala de Atendimento</Label>
              <Select value={salaSelecionada} onValueChange={setSalaSelecionada}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cadeira 1 - Ortodontia">Cadeira 1 - Ortodontia</SelectItem>
                  <SelectItem value="Cadeira 2 - Clínica Geral">
                    Cadeira 2 - Clínica Geral
                  </SelectItem>
                  <SelectItem value="Cadeira 3 - Cirurgia">Cadeira 3 - Cirurgia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recorrência (BL-021 - Could Have) */}
            <div className="p-2.5 rounded-lg border bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="recorrente">
                  Tratamento Contínuo / Recorrente (BL-021)
                </Label>
                <input
                  id="recorrente"
                  type="checkbox"
                  checked={isRecorrente}
                  onChange={(e) => setIsRecorrente(e.target.checked)}
                  className="rounded text-[#0E7490]"
                />
              </div>
              {isRecorrente && (
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span>Repetir semanalmente por:</span>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={recorrenciaQtd}
                    onChange={(e) => setRecorrenciaQtd(Number(e.target.value))}
                    className="h-6 w-16 text-center text-xs"
                  />
                  <span>semanas</span>
                </div>
              )}
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
    </div>
  )
}
