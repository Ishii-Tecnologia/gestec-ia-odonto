import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  MessageLembreteRecord,
  AgendamentoRecord,
  PacienteRecord,
  UnidadeRecord,
} from '@/types/gestec'
import { ModuloGate } from '@/components/ModuloGate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Phone,
  RefreshCw,
  Search,
  Filter,
  CheckCheck,
  AlertTriangle,
  Info,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Copy,
} from 'lucide-react'

// Templates padrão para lembretes e comunicação (BL-010)
const TEMPLATES_PADRAO = [
  {
    id: 'conf_48h',
    titulo: 'Confirmação 48h antes da Consulta',
    gatilho: 'confirmacao_48h',
    canal: 'whatsapp',
    corpo:
      'Olá, {{paciente_nome}}! Sua consulta odontológica no GesTec-IA-Odonto está agendada para {{data_hora}} com {{profissional_nome}} na {{unidade_nome}}. Por favor, responda com 1 para CONFIRMAR ou 2 para REAGENDAR. Obrigado!',
  },
  {
    id: 'conf_24h',
    titulo: 'Lembrete Urgente 24h antes da Consulta',
    gatilho: 'confirmacao_24h',
    canal: 'whatsapp',
    corpo:
      'Lembrete GesTec: Olá {{paciente_nome}}, sua consulta é amanhã, {{data_hora}}, na {{unidade_nome}}. Caso precise reagendar, avise-nos com antecedência para liberarmos o horário. Aguardamos você!',
  },
  {
    id: 'retorno_prev',
    titulo: 'Retorno Preventivo Semestral (Recall)',
    gatilho: 'retorno_preventivo',
    canal: 'whatsapp',
    corpo:
      'Olá {{paciente_nome}}! A saúde do seu sorriso é prioridade. Já faz 6 meses da sua última limpeza e avaliação preventiva no GesTec-IA-Odonto. Vamos agendar seu retorno desta semana?',
  },
  {
    id: 'cobranca',
    titulo: 'Aviso Amigável de Vencimento / Cobrança',
    gatilho: 'cobranca_inadimplente',
    canal: 'whatsapp',
    corpo:
      'Prezado(a) {{paciente_nome}}, identificamos uma pendência financeira em aberto no seu plano odontológico. Acesse nosso setor financeiro ou responda a esta mensagem para obter sua chave Pix atualizada.',
  },
  {
    id: 'boas_vindas',
    titulo: 'Boas-vindas e Cadastro Concluído',
    gatilho: 'boas_vindas',
    canal: 'in_app',
    corpo:
      'Bem-vindo(a) ao GesTec-IA-Odonto, {{paciente_nome}}! Seu cadastro foi realizado com sucesso e seu prontuário digital está protegido conforme as diretrizes da LGPD.',
  },
]

export default function ComunicacaoPage() {
  const { tenantId, user, perfil, selectedUnidadeId, unidades } = useAuth()
  const { toast } = useToast()

  const [lembretes, setLembretes] = useState<MessageLembreteRecord[]>([])
  const [agendamentosPendentes, setAgendamentosPendentes] = useState<AgendamentoRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de busca
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCanal, setFiltroCanal] = useState<string>('todos')
  const [filtroGatilho, setFiltroGatilho] = useState<string>('todos')

  // Modal Novo Disparo / Lembrete Manual
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoDestinatarioNome, setNovoDestinatarioNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoCanal, setNovoCanal] = useState<'whatsapp' | 'sms' | 'in_app'>('whatsapp')
  const [novoGatilho, setNovoGatilho] = useState<
    | 'confirmacao_48h'
    | 'confirmacao_24h'
    | 'retorno_preventivo'
    | 'cobranca_inadimplente'
    | 'lembrete_manual'
    | 'boas_vindas'
  >('lembrete_manual')
  const [novoMensagem, setNovoMensagem] = useState('')
  const [novoPacienteId, setNovoPacienteId] = useState<string>('')
  const [novoAgendamentoId, setNovoAgendamentoId] = useState<string>('')
  const [enviando, setEnviando] = useState(false)

  // Modal Simulação de Resposta do Paciente
  const [modalSimularRespostaAberto, setModalSimularRespostaAberto] = useState(false)
  const [lembreteSelecionado, setLembreteSelecionado] = useState<MessageLembreteRecord | null>(null)
  const [respostaTexto, setRespostaTexto] = useState('')
  const [respostaTipo, setRespostaTipo] = useState<'confirmar' | 'reagendar'>('confirmar')

  // Carregar dados
  const carregarDados = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let filterLembretes = `tenant_id = '${tenantId}'`
      if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
        filterLembretes += ` && (unidade_id = '${selectedUnidadeId}' || unidade_id = '')`
      }

      const [resLemb, resAg, resPac] = await Promise.all([
        pb.collection('messages_lembretes').getList<MessageLembreteRecord>(1, 100, {
          filter: filterLembretes,
          sort: '-created',
        }),
        pb.collection('agendamentos').getList<AgendamentoRecord>(1, 100, {
          filter: `tenant_id = '${tenantId}' && status = 'pendente'`,
          sort: 'data_inicio',
          expand: 'paciente_id,profissional_id',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 100, {
          filter: `tenant_id = '${tenantId}'`,
          sort: 'nome',
        }),
      ])

      setLembretes(resLemb.items)
      setAgendamentosPendentes(resAg.items)
      setPacientes(resPac.items)
    } catch (err: any) {
      console.error('Erro ao carregar comunicação:', err)
      toast({
        title: 'Erro ao carregar dados de comunicação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId, selectedUnidadeId])

  // Aplicar template
  const aplicarTemplate = (tpl: (typeof TEMPLATES_PADRAO)[0]) => {
    setNovoGatilho(tpl.gatilho as any)
    setNovoCanal(tpl.canal as any)

    // Se houver paciente selecionado, substitui variáveis
    let texto = tpl.corpo
    if (novoDestinatarioNome) {
      texto = texto.replace(/{{paciente_nome}}/g, novoDestinatarioNome)
    }
    const unidadeNome =
      unidades.find((u) => u.id === selectedUnidadeId)?.nome || 'Unidade Principal'
    texto = texto.replace(/{{unidade_nome}}/g, unidadeNome)
    texto = texto.replace(/{{data_hora}}/g, 'horário agendado')
    texto = texto.replace(/{{profissional_nome}}/g, 'seu cirurgião-dentista')

    setNovoMensagem(texto)
  }

  // Preencher paciente no modal
  const handleSelecionarPacienteModal = (pacId: string) => {
    setNovoPacienteId(pacId)
    const pac = pacientes.find((p) => p.id === pacId)
    if (pac) {
      setNovoDestinatarioNome(pac.nome)
      setNovoTelefone(pac.telefone || '')

      // Se mensagem tiver {{paciente_nome}}, troca
      if (novoMensagem.includes('{{paciente_nome}}')) {
        setNovoMensagem((prev) => prev.replace(/{{paciente_nome}}/g, pac.nome))
      }
    }
  }

  // Disparar lembrete / Criar na fila
  const handleCriarLembrete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoDestinatarioNome || !novoTelefone || !novoMensagem) {
      toast({
        title: 'Preencha os campos obrigatórios',
        description: 'Nome, telefone e mensagem são necessários.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    try {
      // Como não existe gateway externo de WhatsApp/SMS ativo nesta fase MVP,
      // mensagens para canais externos são registradas como "pendente_integracao_externa"
      // ou "enviado" se for in_app, explicitando a lacuna técnica
      const statusFinal = novoCanal === 'in_app' ? 'entregue' : 'pendente_integracao_externa'
      const erroMotivo =
        novoCanal !== 'in_app'
          ? 'Gateway externo (WhatsApp/SMS API) pendente de contratação/integração nesta fase.'
          : ''

      const novo = await pb.collection('messages_lembretes').create<MessageLembreteRecord>({
        tenant_id: tenantId,
        unidade_id: selectedUnidadeId !== 'todas' ? selectedUnidadeId : '',
        agendamento_id: novoAgendamentoId || '',
        paciente_id: novoPacienteId || '',
        destinatario_nome: novoDestinatarioNome,
        telefone: novoTelefone,
        mensagem: novoMensagem,
        canal: novoCanal,
        tipo_gatilho: novoGatilho,
        status: statusFinal,
        data_envio: new Date().toISOString().replace('T', ' ').slice(0, 19),
        tentativas: 1,
        erro_motivo: erroMotivo,
        enviado_por: user?.email || 'operador',
      })

      // Registrar auditoria LGPD
      await registrarAuditoria({
        tenantId,
        acao: 'disparou_mensagem_lembrete',
        targetPatientId: novoPacienteId || '',
        detalhes: `Disparo de comunicação via canal ${novoCanal} (${novoGatilho}) para ${novoDestinatarioNome}. Status: ${statusFinal}.`,
      })

      toast({
        title:
          novoCanal === 'in_app' ? 'Notificação In-App Enviada!' : 'Mensagem Registrada na Fila!',
        description:
          novoCanal === 'in_app'
            ? 'Mensagem entregue na central in-app.'
            : 'Canal externo marcado como "Pendente Integração Externa" (transparência de roadmap).',
      })

      setModalNovoAberto(false)
      // Limpar form
      setNovoDestinatarioNome('')
      setNovoTelefone('')
      setNovoMensagem('')
      setNovoPacienteId('')
      setNovoAgendamentoId('')
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar lembrete',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  // Disparo Rápido para Agendamento Pendente (Fila de 48h/24h)
  const handleDisparoRapidoAgendamento = async (ag: AgendamentoRecord) => {
    try {
      const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'
      const pacTel = ag.expand?.paciente_id?.telefone || '(11) 99999-9999'
      const profNome = ag.expand?.profissional_id?.nome || 'Cirurgião-Dentista'
      const dataHoraFmt = `${ag.data_inicio.slice(8, 10)}/${ag.data_inicio.slice(5, 7)} às ${ag.data_inicio.slice(11, 16)}`

      const msg = `Olá, ${pacNome}! Lembramos da sua consulta de ${ag.procedimento} no GesTec-IA-Odonto no dia ${dataHoraFmt} com ${profNome}. Por favor, confirme respondendo 1 (Confirmar) ou 2 (Reagendar).`

      await pb.collection('messages_lembretes').create<MessageLembreteRecord>({
        tenant_id: tenantId,
        unidade_id: ag.unidade_id || (selectedUnidadeId !== 'todas' ? selectedUnidadeId : ''),
        agendamento_id: ag.id,
        paciente_id: ag.paciente_id,
        destinatario_nome: pacNome,
        telefone: pacTel,
        mensagem: msg,
        canal: 'whatsapp',
        tipo_gatilho: 'confirmacao_24h',
        status: 'pendente_integracao_externa',
        data_envio: new Date().toISOString().replace('T', ' ').slice(0, 19),
        tentativas: 1,
        erro_motivo:
          'Fila operacional: registro de lembrete gerado aguardando webhook de envio externo.',
        enviado_por: user?.email || 'recepcao',
      })

      // Atualizar agendamento para indicar que houve tentativa de confirmação
      await pb.collection('agendamentos').update(ag.id, {
        tentativa_confirmacao_em: new Date().toISOString(),
      })

      await registrarAuditoria({
        tenantId,
        acao: 'gerou_lembrete_agendamento',
        targetPatientId: ag.paciente_id,
        detalhes: `Lembrete gerado para a consulta de ${dataHoraFmt} (Agendamento ID: ${ag.id}).`,
      })

      toast({
        title: 'Lembrete Enfileirado com Sucesso!',
        description: `Lembrete de confirmação registrado para ${pacNome}. Status: Pendente Integração Externa.`,
      })

      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar lembrete',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Simulação de Resposta do Paciente (Validação do Fluxo Bidirecional)
  const handleAbrirSimulacaoResposta = (lembrete: MessageLembreteRecord) => {
    setLembreteSelecionado(lembrete)
    setRespostaTexto(
      lembrete.resposta_paciente || '1 - Olá, confirmo meu comparecimento na consulta!',
    )
    setRespostaTipo('confirmar')
    setModalSimularRespostaAberto(true)
  }

  const handleSalvarSimulacaoResposta = async () => {
    if (!lembreteSelecionado) return

    try {
      const novoStatus =
        respostaTipo === 'confirmar' ? 'respondido_confirmado' : 'respondido_reagendar'

      const dataAgora = new Date().toISOString().replace('T', ' ').slice(0, 19)

      // Atualizar registro de lembrete
      await pb.collection('messages_lembretes').update(lembreteSelecionado.id, {
        status: novoStatus,
        data_resposta: dataAgora,
        resposta_paciente: respostaTexto,
      })

      // Se houver agendamento vinculado e for confirmação, atualiza na agenda!
      if (lembreteSelecionado.agendamento_id) {
        if (respostaTipo === 'confirmar') {
          await pb.collection('agendamentos').update(lembreteSelecionado.agendamento_id, {
            status: 'confirmado',
            confirmacao_status: 'confirmado',
            confirmado_em: dataAgora,
          })
        } else {
          await pb.collection('agendamentos').update(lembreteSelecionado.agendamento_id, {
            confirmacao_status: 'nao_confirmou',
            motivo_cancelamento_ou_falta: 'Paciente solicitou reagendamento via mensagem.',
          })
        }
      }

      await registrarAuditoria({
        tenantId,
        acao: 'recebeu_resposta_paciente',
        targetPatientId: lembreteSelecionado.paciente_id || '',
        detalhes: `Paciente ${lembreteSelecionado.destinatario_nome} respondeu: "${respostaTexto}". Status atualizado para ${novoStatus}.`,
      })

      toast({
        title: 'Resposta do Paciente Registrada!',
        description:
          respostaTipo === 'confirmar'
            ? 'Agendamento atualizado para "Confirmado" automaticamente.'
            : 'Sinalizado pedido de reagendamento para a recepção.',
      })

      setModalSimularRespostaAberto(false)
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao processar resposta',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Marcar manualmente como entregue / simular envio
  const handleMarcarEntregue = async (lembrete: MessageLembreteRecord) => {
    try {
      await pb.collection('messages_lembretes').update(lembrete.id, {
        status: 'entregue',
        data_envio: new Date().toISOString().replace('T', ' ').slice(0, 19),
        erro_motivo: '',
      })

      await registrarAuditoria({
        tenantId,
        acao: 'atualizou_status_mensagem',
        targetPatientId: lembrete.paciente_id || '',
        detalhes: `Mensagem ${lembrete.id} marcada manualmente como ENTREGUE por ${user?.email}.`,
      })

      toast({
        title: 'Status Atualizado',
        description: 'Lembrete marcado como entregue.',
      })
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' })
    }
  }

  // Filtragem dos lembretes
  const lembretesFiltrados = lembretes.filter((l) => {
    const matchBusca =
      !termoBusca ||
      l.destinatario_nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      l.telefone.includes(termoBusca) ||
      l.mensagem.toLowerCase().includes(termoBusca.toLowerCase())

    const matchStatus = filtroStatus === 'todos' || l.status === filtroStatus
    const matchCanal = filtroCanal === 'todos' || l.canal === filtroCanal
    const matchGatilho = filtroGatilho === 'todos' || l.tipo_gatilho === filtroGatilho

    return matchBusca && matchStatus && matchCanal && matchGatilho
  })

  // Estatísticas do painel
  const totalLembretes = lembretes.length
  const totalEntregues = lembretes.filter(
    (l) => l.status === 'entregue' || l.status === 'respondido_confirmado',
  ).length
  const totalConfirmados = lembretes.filter((l) => l.status === 'respondido_confirmado').length
  const totalPendentesIntegracao = lembretes.filter(
    (l) => l.status === 'pendente_integracao_externa',
  ).length

  return (
    <ModuloGate modulo="comunicacao">
      <div className="space-y-6">
        {/* Banner de Transparência da Fase 1 MVP */}
        <div className="bg-gradient-to-r from-amber-50 via-cyan-50 to-amber-50 border border-amber-200/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <span>Comunicação & Lembretes — Etapa 4 (BL-010)</span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-100 text-amber-800 border-amber-300"
                >
                  Fase 1 • Operacional Interno
                </Badge>
              </div>
              <p className="text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Nesta fase MVP, o GesTec opera com <strong>central de notificações in-app</strong>,
                templates estruturados, fila de lembretes auditada e fluxo bidirecional de
                confirmação. Os canais de disparo para{' '}
                <strong>WhatsApp Oficial e SMS externo</strong> registram o status explícito de{' '}
                <span className="font-mono font-medium text-amber-800 bg-amber-100 px-1 py-0.5 rounded">
                  pendente_integracao_externa
                </span>{' '}
                até a contratação do gateway de mensageria na Fase 2.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setModalNovoAberto(true)}
            className="bg-[#0E7490] hover:bg-[#155E75] text-white shrink-0 h-9 gap-1.5 text-xs shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Novo Disparo de Mensagem</span>
          </Button>
        </div>

        {/* Cards de Métricas de Comunicação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Total de Mensagens na Fila
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalLembretes}</div>
              <p className="text-[11px] text-slate-400 mt-1">Disparos registrados no tenant</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Respostas de Confirmação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCheck className="w-6 h-6" />
                <span>{totalConfirmados}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Presenças confirmadas pelo paciente</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Pendente Integração Externa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{totalPendentesIntegracao}</div>
              <p className="text-[11px] text-slate-400 mt-1">Aguardando gateway WhatsApp/SMS</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Consultas Aguardando Lembrete
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-700">{agendamentosPendentes.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Janela de 48h/24h na agenda</p>
            </CardContent>
          </Card>
        </div>

        {/* Abas: Fila e Histórico vs. Consultas a Confirmar vs. Templates */}
        <Tabs defaultValue="historico" className="space-y-4">
          <TabsList className="bg-slate-100 p-1 border border-slate-200">
            <TabsTrigger value="historico" className="text-xs flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Histórico & Fila de Disparos ({lembretesFiltrados.length})
            </TabsTrigger>
            <TabsTrigger value="pendentes" className="text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Consultas Pendentes de Lembrete ({agendamentosPendentes.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Catálogo de Templates Oficiais
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: Histórico de Disparos */}
          <TabsContent value="historico" className="space-y-4">
            {/* Barra de Filtros */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <div className="relative lg:col-span-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      placeholder="Buscar por paciente, telefone ou texto..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <div>
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Status</SelectItem>
                        <SelectItem value="respondido_confirmado">
                          Confirmado pelo Paciente
                        </SelectItem>
                        <SelectItem value="respondido_reagendar">
                          Reagendamento Solicitado
                        </SelectItem>
                        <SelectItem value="entregue">Entregue</SelectItem>
                        <SelectItem value="pendente_integracao_externa">
                          Pendente Integração Externa
                        </SelectItem>
                        <SelectItem value="agendado">Agendado</SelectItem>
                        <SelectItem value="falhou">Falhou</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Canais</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="in_app">Notificação In-App</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Select value={filtroGatilho} onValueChange={setFiltroGatilho}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Gatilhos</SelectItem>
                        <SelectItem value="confirmacao_48h">Confirmação 48h</SelectItem>
                        <SelectItem value="confirmacao_24h">Confirmação 24h</SelectItem>
                        <SelectItem value="retorno_preventivo">Retorno Preventivo</SelectItem>
                        <SelectItem value="cobranca_inadimplente">Cobrança</SelectItem>
                        <SelectItem value="lembrete_manual">Lembrete Manual</SelectItem>
                        <SelectItem value="boas_vindas">Boas-vindas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Mensagens */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                {loading ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Carregando fila de comunicação...
                  </div>
                ) : lembretesFiltrados.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Nenhuma mensagem encontrada com os filtros selecionados.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Destinatário & Contato</th>
                          <th className="py-3 px-4">Gatilho & Canal</th>
                          <th className="py-3 px-4">Mensagem / Conteúdo</th>
                          <th className="py-3 px-4">Status & Resposta</th>
                          <th className="py-3 px-4">Data Envio</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lembretesFiltrados.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {item.destinatario_nome}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {item.telefone}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800 capitalize">
                                {item.tipo_gatilho.replace(/_/g, ' ')}
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] uppercase font-semibold ${
                                    item.canal === 'whatsapp'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : item.canal === 'sms'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}
                                >
                                  {item.canal}
                                </Badge>
                              </div>
                            </td>

                            <td className="py-3 px-4 max-w-xs">
                              <p className="text-slate-700 line-clamp-2 text-[11px] leading-relaxed">
                                {item.mensagem}
                              </p>
                              {item.erro_motivo && (
                                <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{item.erro_motivo}</span>
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {item.status === 'respondido_confirmado' ? (
                                <div>
                                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 text-[10px] flex items-center gap-1 w-fit">
                                    <CheckCheck className="w-3 h-3" />
                                    Confirmado
                                  </Badge>
                                  {item.resposta_paciente && (
                                    <p className="text-[10px] text-slate-600 mt-1 italic line-clamp-1">
                                      "{item.resposta_paciente}"
                                    </p>
                                  )}
                                </div>
                              ) : item.status === 'respondido_reagendar' ? (
                                <div>
                                  <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-300 text-[10px] flex items-center gap-1 w-fit">
                                    <AlertCircle className="w-3 h-3" />
                                    Reagendar
                                  </Badge>
                                  {item.resposta_paciente && (
                                    <p className="text-[10px] text-slate-600 mt-1 italic line-clamp-1">
                                      "{item.resposta_paciente}"
                                    </p>
                                  )}
                                </div>
                              ) : item.status === 'pendente_integracao_externa' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                >
                                  Pendente Integração
                                </Badge>
                              ) : item.status === 'entregue' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-cyan-50 text-cyan-800 border-cyan-200 text-[10px]"
                                >
                                  Entregue
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {item.status.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {item.data_envio || item.created?.slice(0, 16) || '—'}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.status === 'pendente_integracao_externa' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarcarEntregue(item)}
                                    className="h-7 text-[10px] px-2 text-cyan-700 hover:bg-cyan-50"
                                    title="Marcar manualmente como Entregue"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Entregar
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAbrirSimulacaoResposta(item)}
                                  className="h-7 text-[10px] px-2 text-slate-700 hover:bg-slate-100"
                                  title="Simular resposta do paciente (Confirmação bidirecional)"
                                >
                                  <MessageCircle className="w-3 h-3 mr-1 text-[#0E7490]" />
                                  Resposta
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: Consultas que Precisam de Confirmação (Fila Ativa) */}
          <TabsContent value="pendentes" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0E7490]" />
                  Consultas com Confirmação Pendente (Janela 48h / 24h)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Agendamentos pendentes na agenda que podem receber lembretes imediatos com
                  atualização em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {agendamentosPendentes.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Todas as consultas agendadas já possuem confirmação ativa ou foram concluídas.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Paciente</th>
                          <th className="py-3 px-4">Data & Horário</th>
                          <th className="py-3 px-4">Procedimento</th>
                          <th className="py-3 px-4">Profissional</th>
                          <th className="py-3 px-4">Tentativa Anterior</th>
                          <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agendamentosPendentes.map((ag) => (
                          <tr key={ag.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {ag.expand?.paciente_id?.nome || 'Paciente'}
                              <div className="text-[11px] text-slate-400 font-normal">
                                {ag.expand?.paciente_id?.telefone || 'Sem telefone'}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-800">
                              {ag.data_inicio.slice(8, 10)}/{ag.data_inicio.slice(5, 7)} às{' '}
                              {ag.data_inicio.slice(11, 16)}
                            </td>
                            <td className="py-3 px-4 text-slate-700">{ag.procedimento}</td>
                            <td className="py-3 px-4 text-slate-700">
                              {ag.expand?.profissional_id?.nome || 'Cirurgião-Dentista'}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500">
                              {ag.tentativa_confirmacao_em ? (
                                <span className="text-amber-700 font-mono">
                                  {ag.tentativa_confirmacao_em.slice(0, 16).replace('T', ' ')}
                                </span>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-slate-400">
                                  Nenhum disparo
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                onClick={() => handleDisparoRapidoAgendamento(ag)}
                                className="h-7 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>Enviar Lembrete</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: Catálogo de Templates Oficiais */}
          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES_PADRAO.map((tpl) => (
                <Card
                  key={tpl.id}
                  className="border-slate-200 shadow-sm flex flex-col justify-between"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          tpl.canal === 'whatsapp'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {tpl.canal}
                      </Badge>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {tpl.gatilho}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-semibold text-slate-900 mt-2">
                      {tpl.titulo}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                      {tpl.corpo}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        aplicarTemplate(tpl)
                        setModalNovoAberto(true)
                      }}
                      className="w-full text-xs text-[#0E7490] border-cyan-200 hover:bg-cyan-50 h-8 gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Usar Este Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* MODAL: Novo Disparo de Mensagem Manual */}
        <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-[#0E7490]" />
                Novo Disparo de Mensagem / Lembrete
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Gere lembretes de agendamento, retornos preventivos ou avisos in-app com auditoria
                LGPD
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarLembrete} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vincular a Paciente Existente</Label>
                  <Select value={novoPacienteId} onValueChange={handleSelecionarPacienteModal}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione o paciente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pacientes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Canal de Comunicação *</Label>
                  <Select value={novoCanal} onValueChange={(val: any) => setNovoCanal(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp (Externo)</SelectItem>
                      <SelectItem value="sms">SMS (Externo)</SelectItem>
                      <SelectItem value="in_app">Notificação In-App (Interno)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nome do Destinatário *</Label>
                  <Input
                    required
                    value={novoDestinatarioNome}
                    onChange={(e) => setNovoDestinatarioNome(e.target.value)}
                    placeholder="Nome completo do paciente"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Telefone / WhatsApp *</Label>
                  <Input
                    required
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Gatilho / Finalidade *</Label>
                <Select value={novoGatilho} onValueChange={(val: any) => setNovoGatilho(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmacao_48h">
                      Confirmação de Agendamento (48h)
                    </SelectItem>
                    <SelectItem value="confirmacao_24h">Lembrete Urgente (24h)</SelectItem>
                    <SelectItem value="retorno_preventivo">Retorno Preventivo (Recall)</SelectItem>
                    <SelectItem value="cobranca_inadimplente">Cobrança / Título Vencido</SelectItem>
                    <SelectItem value="lembrete_manual">Lembrete Manual Avulso</SelectItem>
                    <SelectItem value="boas_vindas">Boas-vindas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Conteúdo da Mensagem *</Label>
                  <span className="text-[10px] text-slate-400">
                    Variáveis: {'{{paciente_nome}}'}, {'{{unidade_nome}}'}
                  </span>
                </div>
                <Textarea
                  required
                  rows={4}
                  value={novoMensagem}
                  onChange={(e) => setNovoMensagem(e.target.value)}
                  placeholder="Escreva a mensagem ou escolha um template acima..."
                  className="text-xs resize-none"
                />
              </div>

              {novoCanal !== 'in_app' && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Aviso de Integração Externa:</strong> Este canal registrará o status{' '}
                    <code className="bg-amber-100 px-1 rounded">pendente_integracao_externa</code>{' '}
                    na fila, respeitando os limites e integridade da Fase 1 MVP.
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovoAberto(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={enviando}
                  className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
                >
                  {enviando ? 'Enfileirando...' : 'Confirmar Enfileiramento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: Simular Resposta do Paciente */}
        <Dialog open={modalSimularRespostaAberto} onOpenChange={setModalSimularRespostaAberto}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#0E7490]" />
                Simular Resposta do Paciente (Validação de Fluxo)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Testa a confirmação de presença bidirecional e o reflexo automático na agenda
                operacional
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border text-slate-700 space-y-1">
                <p>
                  <strong>Destinatário:</strong> {lembreteSelecionado?.destinatario_nome}
                </p>
                <p>
                  <strong>Mensagem Original:</strong> {lembreteSelecionado?.mensagem}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Resposta do Paciente</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRespostaTipo('confirmar')
                      setRespostaTexto('1 - Confirmo com certeza meu comparecimento!')
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                      respostaTipo === 'confirmar'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Confirmar Presença</div>
                      <div className="text-[10px] text-slate-500">Agenda passa para Confirmado</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRespostaTipo('reagendar')
                      setRespostaTexto('2 - Preciso reagendar para outro dia por favor.')
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                      respostaTipo === 'reagendar'
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-semibold">Pedir Reagendamento</div>
                      <div className="text-[10px] text-slate-500">Sinaliza alerta à recepção</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Texto da Mensagem Recebida</Label>
                <Textarea
                  rows={2}
                  value={respostaTexto}
                  onChange={(e) => setRespostaTexto(e.target.value)}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalSimularRespostaAberto(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvarSimulacaoResposta}
                className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                Processar Resposta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
