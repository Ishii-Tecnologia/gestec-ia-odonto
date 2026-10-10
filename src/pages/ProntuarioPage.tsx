import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  PacienteRecord,
  OdontogramaSnapshotRecord,
  EvolucaoClinicaRecord,
  AnamneseRecord,
  AgendamentoRecord,
  DenteFaceStatus,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { OdontogramaInterativo } from '@/components/OdontogramaInterativo'
import { ModuloGate } from '@/components/ModuloGate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { calcularIdade } from '@/lib/validadores'
import {
  Stethoscope,
  ShieldCheck,
  History,
  Save,
  Plus,
  Clock,
  ArrowLeft,
  Calendar,
  Lock,
  FileCheck,
  ClipboardList,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

const TEMPLATES_EVOLUCAO: Record<string, string> = {
  geral:
    'Realizada consulta de avaliação clínica geral e profilaxia com ultrassom e jato de bicarbonato. Sem queixas álgicas agudas relatadas pelo paciente. Gengiva com aspecto saudável.',
  exodontia:
    'Anestesia infiltrativa com Articaína 4% com epinefrina 1:100.000. Realizada sindesmotomia e exodontia do elemento dentário por fórceps sem intercorrências. Sutura com fio de seda 3-0. Prescrita medicação pós-operatória e orientações de repouso e gelo.',
  endodontia:
    'Isolamento absoluto com dique de borracha. Acesso coronário e odontometria eletrônica. Instrumentação rotatória com limas reciprocantes. Irrigação com NaOCl a 2,5%. Curativo de demora com hidróxido de cálcio e selamento provisório.',
  ortodontia:
    'Atendimento de manutenção ortodôntica mensal. Troca de arcos de NiTi para aço 0.018. Ajuste de torque e substituição das ligaduras elásticas. Próxima consulta em 30 dias.',
  protese:
    'Moldagem de precisão com silicone de condensação (pasta pesada e fluida) para coroa cerâmica sobre dente preparado. Realizada checagem de oclusão e cor pelo guia Vita.',
  implantodontia:
    'Anestesia infiltrativa local. Incisão intrassulcular e descolamento mucoperiosteal. Fresagem sequencial e instalação de implante Cone Morse. Torque final atingido: 35 N.cm. Sutura com fio de nylon 5-0.',
  odontopediatria:
    'Atendimento odontopediátrico com manejo comportamental afetuoso. Profilaxia com pasta infantil, remoção de biofilme e aplicação tópica de verniz fluoretado a 5%. Reforçada orientação de higiene bucal com o responsável.',
  estetica:
    'Sessão de clareamento dental de consultório com Peróxido de Hidrogênio a 35%. Proteção gengival com barreira fotopolimerizável. Três ciclos de 15 minutos sem hipersensibilidade relatada.',
  prescricao:
    'Receituário emitido: 1) Paracetamol 750mg - Tomar 1 comprimido de 6/6 horas por até 3 dias se houver dor; 2) Amoxicilina 500mg (se aplicável). Orientações detalhadas repassadas.',
  observacao:
    'Paciente compareceu para esclarecimento de dúvidas sobre o pós-operatório. Cicatrização dentro dos padrões esperados.',
}

export default function ProntuarioPage() {
  const { pacienteId, id: legacyId } = useParams<{ pacienteId?: string; id?: string }>()
  const targetId = pacienteId || legacyId
  const navigate = useNavigate()

  const { tenantId, user, perfil, canAccessClinical, selectedUnidadeId } = useAuth()
  const { toast } = useToast()

  // Lista de pacientes para o seletor / busca rápida
  const [pacientesLista, setPacientesLista] = useState<PacienteRecord[]>([])
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [pacienteSelecionadoId, setPacienteSelecionadoId] = useState<string>(targetId || '')

  // Paciente atual
  const [paciente, setPaciente] = useState<PacienteRecord | null>(null)
  const [loading, setLoading] = useState(true)

  // Snapshots do Odontograma (Append-Only)
  const [snapshots, setSnapshots] = useState<OdontogramaSnapshotRecord[]>([])
  const [currentPayload, setCurrentPayload] = useState<Record<string, DenteFaceStatus>>({})
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('novo')
  const [descricaoSnapshot, setDescricaoSnapshot] = useState('')
  const [salvandoSnapshot, setSalvandoSnapshot] = useState(false)

  // Evoluções Clínicas (Append-Only)
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinicaRecord[]>([])
  const [novaEvolucaoTexto, setNovaEvolucaoTexto] = useState(TEMPLATES_EVOLUCAO.geral)
  const [novoTipo, setNovoTipo] = useState<EvolucaoClinicaRecord['tipo']>('evolucao')
  const [novaEspecialidade, setNovaEspecialidade] =
    useState<EvolucaoClinicaRecord['especialidade']>('geral')
  const [novoProcedimentoRelacionado, setNovoProcedimentoRelacionado] = useState('')
  const [salvandoEvolucao, setSalvandoEvolucao] = useState(false)

  // Modal de Retificação / Adendo (Append-Only Encadeado)
  const [modalRetificacaoAberto, setModalRetificacaoAberto] = useState(false)
  const [evolucaoAlvoRetificacao, setEvolucaoAlvoRetificacao] =
    useState<EvolucaoClinicaRecord | null>(null)
  const [textoRetificacao, setTextoRetificacao] = useState('')
  const [motivoRetificacao, setMotivoRetificacao] = useState('')
  const [salvandoRetificacao, setSalvandoRetificacao] = useState(false)

  // Anamnese
  const [anamnese, setAnamnese] = useState<AnamneseRecord | null>(null)
  const [respostasAnamnese, setRespostasAnamnese] = useState<Record<string, string>>({})
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false)

  // Procedimentos / Agendamentos concluídos do paciente para linha do tempo unificada
  const [agendamentosHistorico, setAgendamentosHistorico] = useState<AgendamentoRecord[]>([])

  // Filtros da Linha do Tempo
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos')

  // 1. Carregar lista de pacientes do tenant para o seletor rápido
  useEffect(() => {
    if (!tenantId) return
    const carregarPacientes = async () => {
      try {
        let filter = `tenant_id = '${tenantId}'`
        if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
          filter += ` && (unidade_id = '${selectedUnidadeId}' || unidade_id = '')`
        }
        const res = await pb.collection('pacientes').getList<PacienteRecord>(1, 100, {
          filter,
          sort: 'nome',
        })
        setPacientesLista(res.items)

        // Se não tiver paciente selecionado pela URL, selecionar o primeiro
        if (!targetId && res.items.length > 0) {
          setPacienteSelecionadoId(res.items[0].id)
          navigate(`/prontuario/${res.items[0].id}`, { replace: true })
        }
      } catch (err: any) {
        console.warn('Erro ao listar pacientes para o prontuário:', err)
      }
    }
    carregarPacientes()
  }, [tenantId, selectedUnidadeId, targetId])

  // 2. Carregar prontuário completo do paciente ativo
  useEffect(() => {
    const idAtual = targetId || pacienteSelecionadoId
    if (!idAtual || !tenantId) {
      setLoading(false)
      return
    }

    const carregarDadosProntuario = async () => {
      setLoading(true)
      try {
        // A. Dados do Paciente
        const p = await pb.collection('pacientes').getOne<PacienteRecord>(idAtual)
        setPaciente(p)
        setPacienteSelecionadoId(idAtual)

        // B. Snapshots do Odontograma (Ordenados por versão/data descendente)
        const snaps = await pb
          .collection('odontogramas_snapshots')
          .getList<OdontogramaSnapshotRecord>(1, 50, {
            filter: `paciente_id = '${idAtual}'`,
            sort: '-created',
          })
        setSnapshots(snaps.items)

        if (snaps.items.length > 0) {
          // Último snapshot vira a base de visualização e edição
          setCurrentPayload(snaps.items[0].payload || {})
          setSelectedSnapshotId('novo') // Modo nova versão baseada no último estado
        } else {
          setCurrentPayload({})
          setSelectedSnapshotId('novo')
        }

        // C. Evoluções Clínicas (Append-Only)
        const evs = await pb
          .collection('evolucoes_clinicas')
          .getList<EvolucaoClinicaRecord>(1, 150, {
            filter: `paciente_id = '${idAtual}'`,
            sort: '-created',
          })
        setEvolucoes(evs.items)

        // D. Anamnese Digital
        try {
          const a = await pb
            .collection('anamneses')
            .getFirstListItem<AnamneseRecord>(`paciente_id = '${idAtual}'`)
          setAnamnese(a)
          if (a.respostas) setRespostasAnamnese(a.respostas)
        } catch {
          setAnamnese(null)
          setRespostasAnamnese({})
        }

        // E. Histórico de Agendamentos / Procedimentos
        try {
          const ags = await pb.collection('agendamentos').getList<AgendamentoRecord>(1, 50, {
            filter: `paciente_id = '${idAtual}' && (status = 'concluido' || status = 'em_atendimento' || status = 'presente')`,
            sort: '-data_inicio',
            expand: 'profissional_id',
          })
          setAgendamentosHistorico(ags.items)
        } catch {
          setAgendamentosHistorico([])
        }

        // F. Auditoria LGPD de Acesso Clínico (BL-006 item 5)
        await registrarAuditoria({
          tenantId,
          userEmail: user?.email,
          perfil,
          targetPatientId: idAtual,
          acao: 'visualizou_prontuario',
          detalhes: `Acesso clínico ao prontuário eletrônico e odontograma do paciente ${p.nome} (ID: ${idAtual})`,
        })
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar prontuário',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    carregarDadosProntuario()
  }, [targetId, tenantId])

  // Trocar de paciente no seletor
  const handleSelecionarPaciente = (novoId: string) => {
    setPacienteSelecionadoId(novoId)
    navigate(`/prontuario/${novoId}`)
  }

  // Idade do paciente para ativar suporte a dentes decíduos (<18)
  const idadePaciente = calcularIdade(paciente?.data_nascimento || '')
  const isMenor = idadePaciente !== null && idadePaciente < 18

  // Salvar Novo Snapshot do Odontograma (BL-007: Append-Only)
  const handleGravarSnapshot = async () => {
    if (!paciente) return
    setSalvandoSnapshot(true)
    try {
      const proximaVersao = (snapshots[0]?.versao || snapshots.length) + 1
      const agoraData = new Date().toISOString().slice(0, 10)

      const snap = await pb.collection('odontogramas_snapshots').create<OdontogramaSnapshotRecord>({
        tenant_id: tenantId,
        unidade_id: paciente.unidade_id || (selectedUnidadeId !== 'todas' ? selectedUnidadeId : ''),
        paciente_id: paciente.id,
        profissional_id: user?.id,
        data: agoraData,
        versao: proximaVersao,
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        cro: user?.cro || 'CRO-SP 89234',
        descricao_alteracao:
          descricaoSnapshot.trim() ||
          `Atualização clínica do odontograma (Versão ${proximaVersao})`,
        payload: currentPayload,
      })

      // Também gera um registro de auditoria append-only
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: paciente.id,
        acao: 'gravou_snapshot_odontograma',
        detalhes: `Odontograma imutável gravado - Versão ${proximaVersao} (ID: ${snap.id})`,
      })

      toast({
        title: 'Versão do Odontograma Registrada!',
        description: `Snapshot imutável v${proximaVersao} gravado com sucesso. Nunca sobrescrito (BL-007).`,
      })

      setDescricaoSnapshot('')
      // Recarregar snapshots
      const snaps = await pb
        .collection('odontogramas_snapshots')
        .getList<OdontogramaSnapshotRecord>(1, 50, {
          filter: `paciente_id = '${paciente.id}'`,
          sort: '-created',
        })
      setSnapshots(snaps.items)
      setSelectedSnapshotId(snap.id)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar odontograma',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoSnapshot(false)
    }
  }

  // Alternar snapshot histórico ou novo
  const handleTrocarSnapshot = (snapId: string) => {
    setSelectedSnapshotId(snapId)
    if (snapId === 'novo') {
      // Carrega estado mais recente para continuar marcando
      setCurrentPayload(snapshots[0]?.payload || {})
    } else {
      const snap = snapshots.find((s) => s.id === snapId)
      if (snap) {
        setCurrentPayload(snap.payload || {})
      }
    }
  }

  // Gravar Nova Evolução Clínica (BL-006: Append-Only)
  const handleGravarEvolucao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paciente || !novaEvolucaoTexto.trim()) return

    setSalvandoEvolucao(true)
    try {
      const agoraStr = new Date().toLocaleString('pt-BR')

      await pb.collection('evolucoes_clinicas').create<EvolucaoClinicaRecord>({
        tenant_id: tenantId,
        unidade_id: paciente.unidade_id || (selectedUnidadeId !== 'todas' ? selectedUnidadeId : ''),
        paciente_id: paciente.id,
        profissional_id: user?.id,
        data: agoraStr,
        tipo: novoTipo || 'evolucao',
        especialidade: novaEspecialidade,
        descricao: novaEvolucaoTexto.trim(),
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        cro: user?.cro || 'CRO-SP 89234',
        procedimento_relacionado: novoProcedimentoRelacionado.trim() || undefined,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: paciente.id,
        acao: 'adicionou_evolucao_clinica',
        detalhes: `Novo adendo clínico append-only tipo "${novoTipo}" (${novaEspecialidade})`,
      })

      toast({
        title: 'Evolução Clínica Registrada!',
        description: 'Registro adicionado de forma append-only sem sobrescrita (BL-006).',
      })

      setNovaEvolucaoTexto(TEMPLATES_EVOLUCAO[novaEspecialidade] || '')
      setNovoProcedimentoRelacionado('')

      // Recarregar evoluções
      const evs = await pb.collection('evolucoes_clinicas').getList<EvolucaoClinicaRecord>(1, 150, {
        filter: `paciente_id = '${paciente.id}'`,
        sort: '-created',
      })
      setEvolucoes(evs.items)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar evolução', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoEvolucao(false)
    }
  }

  // Abrir modal de Retificação / Adendo Encadeado
  const abrirRetificacao = (ev: EvolucaoClinicaRecord) => {
    setEvolucaoAlvoRetificacao(ev)
    setTextoRetificacao('')
    setMotivoRetificacao('')
    setModalRetificacaoAberto(true)
  }

  // Salvar Retificação (Gera nova entrada referenciando a anterior - BL-006 item 2)
  const handleGravarRetificacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !paciente ||
      !evolucaoAlvoRetificacao ||
      !textoRetificacao.trim() ||
      !motivoRetificacao.trim()
    ) {
      return
    }

    setSalvandoRetificacao(true)
    try {
      const agoraStr = new Date().toLocaleString('pt-BR')

      await pb.collection('evolucoes_clinicas').create<EvolucaoClinicaRecord>({
        tenant_id: tenantId,
        unidade_id: paciente.unidade_id || (selectedUnidadeId !== 'todas' ? selectedUnidadeId : ''),
        paciente_id: paciente.id,
        profissional_id: user?.id,
        data: agoraStr,
        tipo: 'retificacao',
        especialidade: evolucaoAlvoRetificacao.especialidade,
        descricao: textoRetificacao.trim(),
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        cro: user?.cro || 'CRO-SP 89234',
        retifica_evolucao_id: evolucaoAlvoRetificacao.id,
        motivo_retificacao: motivoRetificacao.trim(),
        procedimento_relacionado: evolucaoAlvoRetificacao.procedimento_relacionado,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: paciente.id,
        acao: 'retificou_evolucao_clinica',
        detalhes: `Retificação da evolução #${evolucaoAlvoRetificacao.id} registrada em modo append-only`,
      })

      toast({
        title: 'Retificação Encadeada Gravada!',
        description:
          'A retificação foi adicionada como novo registro preservando a evolução original.',
      })

      setModalRetificacaoAberto(false)
      // Recarregar evoluções
      const evs = await pb.collection('evolucoes_clinicas').getList<EvolucaoClinicaRecord>(1, 150, {
        filter: `paciente_id = '${paciente.id}'`,
        sort: '-created',
      })
      setEvolucoes(evs.items)
    } catch (err: any) {
      toast({
        title: 'Erro ao gravar retificação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoRetificacao(false)
    }
  }

  // Gravar Anamnese (BL-006 item 3)
  const handleGravarAnamnese = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paciente) return

    setSalvandoAnamnese(true)
    try {
      const agoraIso = new Date().toISOString()
      const perguntasPadrao = [
        {
          id: '1',
          pergunta: 'Possui alergia a medicamentos, anestésicos ou látex?',
          tipo: 'texto',
        },
        { id: '2', pergunta: 'Faz uso diário de alguma medicação contínua?', tipo: 'texto' },
        {
          id: '3',
          pergunta: 'Apresenta histórico de hipertensão, diabetes ou cardiopatias?',
          tipo: 'texto',
        },
        { id: '4', pergunta: 'Está grávida ou amamentando?', tipo: 'texto' },
        {
          id: '5',
          pergunta: 'Queixa principal ou motivo da consulta odontológica:',
          tipo: 'texto',
        },
        { id: '6', pergunta: 'Observações de risco e histórico adicional:', tipo: 'texto' },
      ]

      if (anamnese) {
        const atualizada = await pb.collection('anamneses').update<AnamneseRecord>(anamnese.id, {
          respostas: respostasAnamnese,
          status: 'assinada',
          data_resposta: agoraIso,
          dentista_nome: user?.name || 'Cirurgião-Dentista',
          cro: user?.cro || 'CRO-SP 89234',
        })
        setAnamnese(atualizada)
      } else {
        const nova = await pb.collection('anamneses').create<AnamneseRecord>({
          tenant_id: tenantId,
          unidade_id:
            paciente.unidade_id || (selectedUnidadeId !== 'todas' ? selectedUnidadeId : ''),
          paciente_id: paciente.id,
          profissional_id: user?.id,
          dentista_nome: user?.name || 'Cirurgião-Dentista',
          cro: user?.cro || 'CRO-SP 89234',
          status: 'assinada',
          data_resposta: agoraIso,
          perguntas: perguntasPadrao,
          respostas: respostasAnamnese,
        })
        setAnamnese(nova)
      }

      // Também registra como entrada na evolução clínica do paciente
      await pb.collection('evolucoes_clinicas').create<EvolucaoClinicaRecord>({
        tenant_id: tenantId,
        unidade_id: paciente.unidade_id || '',
        paciente_id: paciente.id,
        profissional_id: user?.id,
        data: new Date().toLocaleString('pt-BR'),
        tipo: 'anamnese',
        especialidade: 'geral',
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        cro: user?.cro || 'CRO-SP 89234',
        descricao: `Questionário de Anamnese preenchido e assinado eletronicamente. Alergias: ${
          respostasAnamnese['alergias'] || 'Nenhuma'
        } | Medicamentos: ${respostasAnamnese['medicamentos'] || 'Nenhum'} | Condições: ${
          respostasAnamnese['doencas'] || 'Sem relatos'
        }. Queixa: ${respostasAnamnese['queixa'] || 'Avaliação de rotina'}.`,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: paciente.id,
        acao: 'congelou_anamnese_digital',
        detalhes: 'Questionário de saúde odontológico respondido e congelado no prontuário',
      })

      toast({
        title: 'Anamnese Registrada!',
        description: 'Questionário de saúde salvo e sincronizado na linha do tempo do prontuário.',
      })

      // Recarregar evoluções
      const evs = await pb.collection('evolucoes_clinicas').getList<EvolucaoClinicaRecord>(1, 150, {
        filter: `paciente_id = '${paciente.id}'`,
        sort: '-created',
      })
      setEvolucoes(evs.items)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar anamnese', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoAnamnese(false)
    }
  }

  // Filtrar pacientes da busca
  const pacientesFiltrados = useMemo(() => {
    if (!buscaPaciente.trim()) return pacientesLista
    const termo = buscaPaciente.toLowerCase()
    return pacientesLista.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.cpf && p.cpf.includes(termo)) ||
        (p.telefone && p.telefone.includes(termo)),
    )
  }, [pacientesLista, buscaPaciente])

  // Linha do tempo unificada (Evoluções + Agendamentos concluídos)
  const linhaDoTempo = useMemo(() => {
    const itens: {
      id: string
      tipoOriginal: 'evolucao' | 'agendamento'
      data: string
      dataOrder: string
      titulo: string
      descricao: string
      autor: string
      tag: string
      corTag: string
      especialidade?: string
      retificacaoDe?: string
      motivoRetificacao?: string
      objetoEvolucao?: EvolucaoClinicaRecord
    }[] = []

    // Adicionar evoluções
    for (const ev of evolucoes) {
      itens.push({
        id: ev.id,
        tipoOriginal: 'evolucao',
        data: ev.data,
        dataOrder: ev.created || ev.data,
        titulo:
          ev.tipo === 'retificacao'
            ? 'Retificação / Adendo Clínico'
            : ev.tipo === 'anamnese'
              ? 'Anamnese / Questionário de Saúde'
              : ev.tipo === 'prescricao'
                ? 'Prescrição de Medicamentos'
                : ev.tipo === 'observacao'
                  ? 'Observação Clínica'
                  : 'Evolução Clínica',
        descricao: ev.descricao,
        autor: `${ev.dentista_nome || 'Dr(a).'} ${ev.cro ? `(${ev.cro})` : ''}`,
        tag: ev.tipo || 'evolucao',
        corTag:
          ev.tipo === 'retificacao'
            ? 'bg-amber-100 text-amber-900 border-amber-300'
            : ev.tipo === 'anamnese'
              ? 'bg-purple-100 text-purple-900 border-purple-300'
              : 'bg-cyan-100 text-[#0E7490] border-cyan-300',
        especialidade: ev.especialidade,
        retificacaoDe: ev.retifica_evolucao_id,
        motivoRetificacao: ev.motivo_retificacao,
        objetoEvolucao: ev,
      })
    }

    // Adicionar agendamentos concluídos
    for (const ag of agendamentosHistorico) {
      const dataFormatada = new Date(ag.data_inicio).toLocaleString('pt-BR')
      itens.push({
        id: `ag_${ag.id}`,
        tipoOriginal: 'agendamento',
        data: dataFormatada,
        dataOrder: ag.data_inicio,
        titulo: `Procedimento Realizado: ${ag.procedimento}`,
        descricao:
          ag.observacoes ||
          `Consulta com status ${ag.status}. Duração: ${ag.duracao_minutos || 30} min. Sala: ${ag.sala || 'Consultório'}.`,
        autor: (ag.expand?.profissional_id as any)?.nome || 'Profissional da Clínica',
        tag: 'procedimento',
        corTag: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      })
    }

    // Ordenar descendente por data
    itens.sort((a, b) => b.dataOrder.localeCompare(a.dataOrder))

    // Aplicar filtros de tipo
    return itens.filter((item) => {
      if (filtroTipo !== 'todos') {
        if (
          filtroTipo === 'procedimentos' &&
          item.tipoOriginal !== 'agendamento' &&
          item.tag !== 'procedimento'
        ) {
          return false
        }
        if (filtroTipo === 'evolucoes' && item.tag !== 'evolucao') return false
        if (filtroTipo === 'retificacoes' && item.tag !== 'retificacao') return false
        if (filtroTipo === 'anamneses' && item.tag !== 'anamnese') return false
      }
      return true
    })
  }, [evolucoes, agendamentosHistorico, filtroTipo])

  // Se o perfil não for clínico (ex: Recepção ou Financeiro), bloqueia acesso estrito com mensagem legal LGPD
  if (!canAccessClinical()) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          Acesso Restrito — Prontuário Odontológico
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          Conforme as resoluções do CFO (Conselho Federal de Odontologia) e as diretrizes de
          privacidade da LGPD, o prontuário clínico e o odontograma são de acesso restrito e
          privativo a profissionais de saúde bucal habilitados (Cirurgiões-Dentistas e ASB sob
          supervisão).
        </p>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left space-y-1">
          <span className="font-semibold block">Seu perfil atual: {perfil.toUpperCase()}</span>
          <span>
            Para testar e avaliar as funcionalidades do Prontuário e Odontograma, utilize o seletor
            rápido no topo da barra lateral e alterne para o perfil "Dentista (Dr. Marcelo)" ou
            "Owner (Dra. Renata)".
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link to="/pacientes">Voltar para a Lista de Pacientes</Link>
        </Button>
      </div>
    )
  }

  return (
    <ModuloGate modulo="prontuario">
      <div className="space-y-6">
        {/* Barra Superior de Navegação e Auditoria LGPD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-slate-500">
              <Link to={paciente ? `/pacientes/${paciente.id}` : '/pacientes'}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Ficha do Paciente
              </Link>
            </Button>

            <span className="text-slate-300">|</span>

            <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-slate-500">
              <Link to="/agenda">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Agenda
              </Link>
            </Button>
          </div>

          {/* Banner de Auditoria Indelével e Conformidade CFO */}
          <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Auditoria LGPD/CFO Ativa:</strong> Prontuário imutável (append-only). Acessos
              e novas versões são registrados sem sobrescrita.
            </span>
          </div>
        </div>

        {/* Seletor Rápido de Paciente e Cabeçalho do Prontuário */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Dados do Paciente Selecionado */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-lg flex items-center justify-center shrink-0">
                {paciente?.nome ? paciente.nome[0].toUpperCase() : 'P'}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">
                    {paciente ? paciente.nome : 'Selecione um Paciente'}
                  </h1>

                  <Badge
                    variant="outline"
                    className="text-[10px] bg-cyan-50 text-cyan-800 border-cyan-200 font-mono"
                  >
                    Prontuário Imutável
                  </Badge>

                  {isMenor && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-800 border-amber-300"
                    >
                      Menor de Idade ({idadePaciente} anos)
                    </Badge>
                  )}
                </div>

                {paciente && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>
                      CPF: <span className="font-mono text-slate-700">{paciente.cpf || '—'}</span>
                    </span>
                    <span>Nasc: {paciente.data_nascimento || '—'}</span>
                    <span>Plano: {paciente.convenio || 'Particular'}</span>
                    {paciente.responsavel_legal && (
                      <span className="text-amber-800">
                        Resp: <strong>{paciente.responsavel_legal}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Seletor Dropdown / Busca Rápida de Pacientes */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="w-64">
                <Select value={pacienteSelecionadoId} onValueChange={handleSelecionarPaciente}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Trocar de paciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientesLista.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                <Link to="/orcamentos">Novo Orçamento</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Abas Principais do Prontuário: Odontograma, Evoluções, Anamnese e Histórico Cronológico */}
        <Tabs defaultValue="odontograma" className="space-y-4">
          <TabsList className="bg-slate-100 p-1 border border-slate-200 flex-wrap">
            <TabsTrigger value="odontograma" className="text-xs flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-[#0E7490]" />
              Odontograma Interativo (BL-007)
            </TabsTrigger>

            <TabsTrigger value="evolucao" className="text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#0E7490]" />
              Nova Evolução Append-Only (BL-006)
            </TabsTrigger>

            <TabsTrigger value="historico" className="text-xs flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#0E7490]" />
              Linha do Tempo Cronológica ({linhaDoTempo.length})
            </TabsTrigger>

            <TabsTrigger value="anamnese" className="text-xs flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-[#0E7490]" />
              Questionário de Anamnese
            </TabsTrigger>
          </TabsList>

          {/* ============================================================== */}
          {/* 1. ABA ODONTOGRAMA (BL-007) */}
          {/* ============================================================== */}
          <TabsContent value="odontograma" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <span>Mapeamento Odontológico Anatômico Interativo</span>
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                      Versões Imutáveis
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    32 dentes permanentes adultos e dentes decíduos para pacientes menores. Cada
                    alteração gera uma nova versão congelada.
                  </CardDescription>
                </div>

                {/* Seletor de Snapshots / Versões Históricas */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Versão:</span>
                    <Select value={selectedSnapshotId} onValueChange={handleTrocarSnapshot}>
                      <SelectTrigger className="h-8 text-xs w-56 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo" className="font-semibold text-[#0E7490]">
                          ✦ Versão em Edição Atual (Nova)
                        </SelectItem>
                        {snapshots.map((s, idx) => (
                          <SelectItem key={s.id} value={s.id}>
                            v{s.versao || snapshots.length - idx} • {s.data} (
                            {s.dentista_nome || 'Dentista'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSnapshotId === 'novo' ? (
                    <Button
                      onClick={handleGravarSnapshot}
                      disabled={salvandoSnapshot}
                      size="sm"
                      className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{salvandoSnapshot ? 'Gravando Versão...' : 'Gravar Nova Versão'}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTrocarSnapshot('novo')}
                      className="h-8 text-xs flex items-center gap-1 text-[#0E7490] border-cyan-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Voltar para Edição Atual</span>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Campo opcional de descrição da versão antes de salvar */}
                {selectedSnapshotId === 'novo' && (
                  <div className="p-3 bg-cyan-50/50 border border-cyan-200/80 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Label className="text-xs font-medium text-[#0E7490] whitespace-nowrap">
                      Nota da Nova Versão:
                    </Label>
                    <Input
                      placeholder="Ex: Restauração O/M dente 16 concluída, planejamento de faceta no 21..."
                      className="h-8 text-xs bg-white flex-1"
                      value={descricaoSnapshot}
                      onChange={(e) => setDescricaoSnapshot(e.target.value)}
                    />
                  </div>
                )}

                {selectedSnapshotId !== 'novo' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Você está visualizando uma <strong>versão histórica congelada</strong> do
                      odontograma. Para realizar novos apontamentos ou registrar procedimentos,
                      selecione a "Versão em Edição Atual".
                    </span>
                  </div>
                )}

                {/* Componente Interativo Anatômico */}
                <OdontogramaInterativo
                  payload={currentPayload}
                  onChange={setCurrentPayload}
                  readonly={selectedSnapshotId !== 'novo'}
                  isMenorDeIdade={isMenor}
                  historicoSnapshots={snapshots}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* 2. ABA NOVA EVOLUÇÃO (BL-006: Append-Only) */}
          {/* ============================================================== */}
          <TabsContent value="evolucao" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#0E7490]" />
                  Adicionar Nova Evolução Clínica (Modo Append-Only)
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro imediato e indelével. Não oferece edição de registros anteriores;
                  eventuais correções são feitas através de retificações encadeadas.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleGravarEvolucao} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Entrada</Label>
                      <Select value={novoTipo} onValueChange={(val: any) => setNovoTipo(val)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="evolucao">Evolução de Atendimento</SelectItem>
                          <SelectItem value="anamnese">Anamnese / Questionário</SelectItem>
                          <SelectItem value="prescricao">Prescrição Medicamentosa</SelectItem>
                          <SelectItem value="observacao">Observação Geral</SelectItem>
                          <SelectItem value="procedimento">Procedimento Realizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Especialidade Clínica</Label>
                      <Select
                        value={novaEspecialidade}
                        onValueChange={(val: any) => {
                          setNovaEspecialidade(val)
                          setNovaEvolucaoTexto(TEMPLATES_EVOLUCAO[val] || '')
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="geral">Clínica Geral & Preventiva</SelectItem>
                          <SelectItem value="exodontia">Cirurgia / Exodontia</SelectItem>
                          <SelectItem value="endodontia">Endodontia</SelectItem>
                          <SelectItem value="ortodontia">Ortodontia</SelectItem>
                          <SelectItem value="periodontia">Periodontia</SelectItem>
                          <SelectItem value="protese">Prótese Dentária</SelectItem>
                          <SelectItem value="implantodontia">Implantodontia</SelectItem>
                          <SelectItem value="odontopediatria">Odontopediatria</SelectItem>
                          <SelectItem value="estetica">Estética & Clareamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Cirurgião-Dentista Responsável</Label>
                      <Input
                        disabled
                        value={`${user?.name || 'Dr(a).'} (${user?.cro || 'CRO-SP 89234'})`}
                        className="h-8 text-xs bg-slate-50 text-slate-700 font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Procedimento Vinculado (Opcional)</Label>
                    <Input
                      placeholder="Ex: Restauração em Resina 2 Faces, Clareamento de Consultório..."
                      className="h-8 text-xs"
                      value={novoProcedimentoRelacionado}
                      onChange={(e) => setNovoProcedimentoRelacionado(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Descrição Clínica Detalhada *</Label>
                      <span className="text-[11px] text-slate-400">
                        Pressione um modelo acima para carregar texto sugerido
                      </span>
                    </div>
                    <Textarea
                      required
                      rows={5}
                      className="text-xs font-sans leading-relaxed"
                      value={novaEvolucaoTexto}
                      onChange={(e) => setNovaEvolucaoTexto(e.target.value)}
                      placeholder="Descreva o procedimento realizado, faces, anestésicos, materiais e recomendações..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Regra Inegociável: Prontuário Append-Only. Uma vez salvo, este registro não
                        pode ser alterado ou apagado.
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={salvandoEvolucao}
                      className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 px-4 self-end sm:self-auto"
                    >
                      {salvandoEvolucao ? 'Assinando e Gravando...' : 'Assinar e Gravar Evolução'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* 3. ABA HISTÓRICO CRONOLÓGICO UNIFICADO (BL-006 item 4) */}
          {/* ============================================================== */}
          <TabsContent value="historico" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0E7490]" />
                    Linha do Tempo Cronológica do Paciente
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Trilha legal probatória unindo evoluções, retificações, questionários e
                    procedimentos
                  </CardDescription>
                </div>

                {/* Filtros da Linha do Tempo */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">Filtrar por:</span>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-8 text-xs w-44 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Registros</SelectItem>
                      <SelectItem value="evolucoes">Evoluções Clínicas</SelectItem>
                      <SelectItem value="procedimentos">Procedimentos Concluídos</SelectItem>
                      <SelectItem value="retificacoes">Retificações / Adendos</SelectItem>
                      <SelectItem value="anamneses">Anamneses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {linhaDoTempo.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
                    <p>Nenhum registro clínico encontrado para os filtros selecionados.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-cyan-200 space-y-6">
                    {linhaDoTempo.map((item) => (
                      <div key={item.id} className="relative group">
                        {/* Ponto / Marcador na Linha do Tempo */}
                        <div
                          className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-2 ${
                            item.tag === 'retificacao'
                              ? 'bg-amber-500 ring-amber-200'
                              : item.tag === 'procedimento'
                                ? 'bg-emerald-600 ring-emerald-200'
                                : 'bg-[#0E7490] ring-cyan-200'
                          }`}
                        />

                        <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-2 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold uppercase ${item.corTag}`}
                              >
                                {item.tag}
                              </Badge>

                              {item.especialidade && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-slate-200 text-slate-700 capitalize"
                                >
                                  {item.especialidade}
                                </Badge>
                              )}

                              <span className="text-xs font-semibold text-slate-800">
                                {item.titulo}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.data}
                              </span>

                              {/* Ação de Retificar (apenas para evoluções) */}
                              {item.tipoOriginal === 'evolucao' && item.objetoEvolucao && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => abrirRetificacao(item.objetoEvolucao!)}
                                  className="h-6 text-[11px] text-slate-500 hover:text-[#0E7490] px-2"
                                  title="Adicionar adendo retificador a este registro"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Retificar
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Se for retificação, mostrar vínculo com a evolução anterior */}
                          {item.retificacaoDe && (
                            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 space-y-1">
                              <span className="font-semibold flex items-center gap-1">
                                <RotateCcw className="w-3 h-3 text-amber-600" />
                                Adendo Retificador referente à evolução anterior (#
                                {item.retificacaoDe})
                              </span>
                              {item.motivoRetificacao && (
                                <p className="italic text-[11px]">
                                  Motivo da retificação: "{item.motivoRetificacao}"
                                </p>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {item.descricao}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-slate-400" />
                              Profissional: <strong className="text-slate-600">{item.autor}</strong>
                            </span>

                            <span className="flex items-center gap-1 text-[10px] text-emerald-700">
                              <FileCheck className="w-3 h-3 text-emerald-600" />
                              Assinatura Eletrônica Imutável
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================== */}
          {/* 4. ABA ANAMNESE DIGITAL (BL-006 item 3) */}
          {/* ============================================================== */}
          <TabsContent value="anamnese" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#0E7490]" />
                    Questionário de Saúde e Anamnese Odontológica
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Perguntas padrão respondidas pelo cirurgião-dentista e armazenadas como entrada
                    do prontuário
                  </CardDescription>
                </div>

                {anamnese?.status === 'assinada' && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Assinada por {anamnese.dentista_nome || 'Dentista'} em{' '}
                    {anamnese.data_resposta?.slice(0, 10)}
                  </Badge>
                )}
              </CardHeader>

              <CardContent>
                <form onSubmit={handleGravarAnamnese} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                      <Label className="font-semibold text-slate-800">
                        1. Alergias a Medicamentos, Anestésicos ou Látex:
                      </Label>
                      <Input
                        placeholder="Ex: Penicilina, Dipirona, Látex (ou 'Nenhuma conhecida')..."
                        className="h-8 text-xs bg-white"
                        value={respostasAnamnese['alergias'] || ''}
                        onChange={(e) =>
                          setRespostasAnamnese({ ...respostasAnamnese, alergias: e.target.value })
                        }
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                      <Label className="font-semibold text-slate-800">
                        2. Medicamentos de Uso Contínuo:
                      </Label>
                      <Input
                        placeholder="Ex: Losartana 50mg, Anticoagulante, Insulina..."
                        className="h-8 text-xs bg-white"
                        value={respostasAnamnese['medicamentos'] || ''}
                        onChange={(e) =>
                          setRespostasAnamnese({
                            ...respostasAnamnese,
                            medicamentos: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                      <Label className="font-semibold text-slate-800">
                        3. Condições Sistêmicas (Hipertensão, Diabetes, Cardiopatias):
                      </Label>
                      <Input
                        placeholder="Ex: Hipertensão arterial sistêmica controlada, Diabetes tipo 2..."
                        className="h-8 text-xs bg-white"
                        value={respostasAnamnese['doencas'] || ''}
                        onChange={(e) =>
                          setRespostasAnamnese({ ...respostasAnamnese, doencas: e.target.value })
                        }
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                      <Label className="font-semibold text-slate-800">
                        4. Gravidez, Amamentação ou Observação Ginecológica:
                      </Label>
                      <Input
                        placeholder="Ex: Gestante 2º trimestre, Não grávida, Não aplicável..."
                        className="h-8 text-xs bg-white"
                        value={respostasAnamnese['gravidez'] || ''}
                        onChange={(e) =>
                          setRespostasAnamnese({ ...respostasAnamnese, gravidez: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                    <Label className="font-semibold text-slate-800">
                      5. Queixa Principal Relatada pelo Paciente:
                    </Label>
                    <Input
                      placeholder="Ex: Dor aguda no elemento 36 ao mastigar, sensibilidade térmica..."
                      className="h-8 text-xs bg-white"
                      value={respostasAnamnese['queixa'] || ''}
                      onChange={(e) =>
                        setRespostasAnamnese({ ...respostasAnamnese, queixa: e.target.value })
                      }
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                    <Label className="font-semibold text-slate-800">
                      6. Hábitos e Riscos Específicos (Tabagismo, Bruxismo, Hemorragias):
                    </Label>
                    <Textarea
                      rows={3}
                      placeholder="Ex: Paciente relata apertamento noturno (bruxismo). Sem histórico de hemorragias em extrações prévias..."
                      className="text-xs bg-white"
                      value={respostasAnamnese['historico_adicional'] || ''}
                      onChange={(e) =>
                        setRespostasAnamnese({
                          ...respostasAnamnese,
                          historico_adicional: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        O questionário é congelado e salvo como entrada oficial de anamnese no
                        prontuário.
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={salvandoAnamnese}
                      className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 px-4"
                    >
                      {salvandoAnamnese ? 'Gravando Anamnese...' : 'Salvar e Congelar Anamnese'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Retificação / Adendo Encadeado (BL-006 item 2) */}
        <Dialog open={modalRetificacaoAberto} onOpenChange={setModalRetificacaoAberto}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Retificar Evolução Clínica (Modo Append-Only)
              </DialogTitle>
              <DialogDescription className="text-xs">
                O prontuário nunca sobrescreve o registro original. A retificação cria uma nova
                entrada encadeada com data/hora e justificativa legal.
              </DialogDescription>
            </DialogHeader>

            {evolucaoAlvoRetificacao && (
              <form onSubmit={handleGravarRetificacao} className="space-y-3 py-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-800">
                      Registro Original #{evolucaoAlvoRetificacao.id}
                    </span>
                    <span>{evolucaoAlvoRetificacao.data}</span>
                  </div>
                  <p className="text-xs italic bg-white p-2 rounded border border-slate-100 max-h-24 overflow-y-auto">
                    "{evolucaoAlvoRetificacao.descricao}"
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Motivo da Retificação / Adendo *
                  </Label>
                  <Input
                    required
                    placeholder="Ex: Correção na numeração do elemento anestesiado (era 16 e não 15)..."
                    className="h-8 text-xs"
                    value={motivoRetificacao}
                    onChange={(e) => setMotivoRetificacao(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Novo Texto do Adendo Clínico *
                  </Label>
                  <Textarea
                    required
                    rows={4}
                    placeholder="Descreva o adendo clínico completo com as correções pertinentes..."
                    className="text-xs"
                    value={textoRetificacao}
                    onChange={(e) => setTextoRetificacao(e.target.value)}
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalRetificacaoAberto(false)}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={salvandoRetificacao}
                    className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs"
                  >
                    {salvandoRetificacao ? 'Gravando Adendo...' : 'Gravar Retificação Encadeada'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
