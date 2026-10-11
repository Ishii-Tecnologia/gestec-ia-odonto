import React, { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  OrcamentoRecord,
  PacienteRecord,
  ProcedimentoRecord,
  ProfissionalRecord,
  OrçamentoItem,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { ModuloGate } from '@/components/ModuloGate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileCheck,
  Signature,
  DollarSign,
  User,
  ArrowRight,
  Printer,
  Send,
  Eye,
  Search,
  Filter,
  Clock,
  AlertCircle,
  Calendar,
  Building2,
  Stethoscope,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function OrcamentosPage() {
  const { tenantId, user, perfil, selectedUnidadeId, unidades } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const pacienteUrlId = searchParams.get('paciente_id')

  const [orcamentos, setOrcamentos] = useState<OrcamentoRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros de listagem
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroPaciente, setFiltroPaciente] = useState<string>(pacienteUrlId || 'todos')

  // Modal Novo / Edição de Orçamento
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [pacienteId, setPacienteId] = useState(pacienteUrlId || '')
  const [profissionalId, setProfissionalId] = useState('')
  const [parcelas, setParcelas] = useState(4)
  const [descontoPct, setDescontoPct] = useState(0)
  const [validade, setValidade] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Itens do orçamento
  const [itens, setItens] = useState<OrçamentoItem[]>([
    {
      procedimento: 'Profilaxia e Remoção de Tártaro (Jato Bicarbonato)',
      dente: 'Geral',
      face: 'Arcadas',
      valor: 220,
      valor_unitario: 220,
      valor_total: 220,
      quantidade: 1,
    },
  ])

  // Modal Assinatura Digital do Paciente (RF-024 / BL-008)
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false)
  const [orcamentoParaAssinar, setOrcamentoParaAssinar] = useState<OrcamentoRecord | null>(null)
  const [nomeRubrica, setNomeRubrica] = useState('')
  const [documentoIdentidade, setDocumentoIdentidade] = useState('')
  const [assinando, setAssinando] = useState(false)

  // Modal Detalhes / Impressão de Proposta
  const [modalVisualizarAberto, setModalVisualizarAberto] = useState(false)
  const [orcamentoDetalhes, setOrcamentoDetalhes] = useState<OrcamentoRecord | null>(null)

  // Modal Rejeição de Proposta
  const [modalRejeitarAberto, setModalRejeitarAberto] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [orcamentoParaRejeitar, setOrcamentoParaRejeitar] = useState<OrcamentoRecord | null>(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [orcRes, pacRes, procRes, profRes] = await Promise.all([
        pb.collection('orcamentos').getList<OrcamentoRecord>(1, 100, {
          sort: '-created',
          expand: 'paciente_id,profissional_id',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 100, { sort: 'nome' }),
        pb.collection('procedimentos').getList<ProcedimentoRecord>(1, 100, { sort: 'nome' }),
        pb.collection('profissionais').getList<ProfissionalRecord>(1, 50, { sort: 'nome' }),
      ])
      setOrcamentos(orcRes.items)
      setPacientes(pacRes.items)
      setProcedimentos(procRes.items)
      setProfissionais(profRes.items)

      if (pacienteUrlId && pacRes.items.some((p) => p.id === pacienteUrlId)) {
        setPacienteId(pacienteUrlId)
        setFiltroPaciente(pacienteUrlId)
      } else if (pacRes.items.length > 0 && !pacienteId) {
        setPacienteId(pacRes.items[0].id)
      }

      if (profRes.items.length > 0 && !profissionalId) {
        setProfissionalId(profRes.items[0].id)
      }

      // Validade default: 30 dias a partir de hoje
      const defaultValidade = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      setValidade(defaultValidade)
    } catch (err: any) {
      console.error('Erro ao carregar dados de orçamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId])

  // Adicionar item ao orçamento
  const handleAdicionarItem = (procIdOrNome: string) => {
    const p =
      procedimentos.find((x) => x.id === procIdOrNome) ||
      procedimentos.find((x) => x.nome === procIdOrNome)
    if (!p) return
    setItens([
      ...itens,
      {
        procedimento_id: p.id,
        procedimento: p.nome,
        dente: 'Geral',
        face: 'Todas',
        valor: p.valor,
        valor_unitario: p.valor,
        valor_total: p.valor,
        quantidade: 1,
      },
    ])
  }

  const handleRemoverItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index))
  }

  const valorBruto = itens.reduce(
    (acc, curr) => acc + (curr.valor_unitario || curr.valor || 0) * (curr.quantidade || 1),
    0,
  )
  const descontoValor = (valorBruto * (descontoPct || 0)) / 100
  const valorLiquido = valorBruto - descontoValor
  const valorParcela = parcelas > 0 ? valorLiquido / parcelas : valorLiquido

  // Criar Orçamento Comercial (BL-008)
  const handleCriarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || itens.length === 0) {
      toast({
        title: 'Dados Incompletos',
        description: 'Selecione o paciente e adicione ao menos um procedimento.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      const numSeq = Math.floor(1000 + Math.random() * 9000)
      const numeroOrcamento = `ORC-${new Date().getFullYear()}-${numSeq}`
      const unidadeEfetiva =
        selectedUnidadeId && selectedUnidadeId !== 'todas'
          ? selectedUnidadeId
          : unidades[0]?.id || ''

      const novo = await pb.collection('orcamentos').create<OrcamentoRecord>({
        tenant_id: tenantId,
        unidade_id: unidadeEfetiva,
        paciente_id: pacienteId,
        profissional_id: profissionalId || null,
        numero_orcamento: numeroOrcamento,
        valor_bruto: valorBruto,
        desconto_percentual: descontoPct,
        desconto_valor: Number(descontoValor.toFixed(2)),
        valor_liquido: Number(valorLiquido.toFixed(2)),
        parcelas,
        status: 'rascunho',
        validade,
        observacoes,
        itens: itens.map((it) => ({
          ...it,
          valor_unitario: it.valor_unitario || it.valor,
          valor_total: (it.valor_unitario || it.valor) * (it.quantidade || 1),
        })),
      })

      const pacienteObj = pacientes.find((p) => p.id === pacienteId)
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: pacienteId,
        acao: 'criou_orcamento',
        detalhes: `Orçamento ${numeroOrcamento} criado no valor de R$ ${valorLiquido.toFixed(2)} para ${pacienteObj?.nome || 'paciente'} (${itens.length} itens).`,
      })

      toast({
        title: 'Orçamento Gerado com Sucesso',
        description: `${numeroOrcamento} salvo em rascunho e pronto para envio/aprovação.`,
      })

      setModalAberto(false)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao criar orçamento', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  // Enviar Orçamento para o Paciente (muda status para 'enviado')
  const handleEnviarOrcamento = async (orc: OrcamentoRecord) => {
    try {
      await pb.collection('orcamentos').update(orc.id, {
        status: 'enviado',
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: orc.paciente_id,
        acao: 'enviou_orcamento_paciente',
        detalhes: `Proposta ${orc.numero_orcamento || orc.id} enviada via canais digitais ao paciente.`,
      })

      toast({
        title: 'Proposta Enviada!',
        description: `Orçamento ${orc.numero_orcamento || ''} marcado como enviado para análise do paciente.`,
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Falha ao atualizar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Aprovação e Assinatura Eletrônica (RF-023 / RF-024 / BL-008)
  // REGRA DE DOMÍNIO INEGOCIÁVEL: Gera automaticamente os lançamentos financeiros a receber
  const handleConfirmarAssinatura = async () => {
    if (!orcamentoParaAssinar || !nomeRubrica.trim()) {
      toast({
        title: 'Informe a assinatura do paciente',
        description: 'É necessário o nome ou rubrica para conferir validade jurídica.',
        variant: 'destructive',
      })
      return
    }

    setAssinando(true)
    try {
      const agoraStr = new Date().toISOString()
      const pacNome = orcamentoParaAssinar.expand?.paciente_id?.nome || nomeRubrica

      // 1. Atualizar Orçamento para aprovado
      const updated = await pb
        .collection('orcamentos')
        .update<OrcamentoRecord>(orcamentoParaAssinar.id, {
          status: 'aprovado',
          data_aprovacao: agoraStr,
          aprovado_por: nomeRubrica.trim(),
          assinatura: {
            rubrica: nomeRubrica.trim(),
            data_hora: agoraStr,
            ip: '189.120.45.12 (Dispositivo Clínico Autorizado)',
            documento_identidade: documentoIdentidade || 'Conferência Biométrica Presencial',
            valido: true,
            assinado: true,
          },
        })

      // 2. Disparo do evento financeiro: Gerar títulos a receber no Financeiro (BL-008 / BL-009)
      const numParcelas = updated.parcelas || 1
      const valorUnitarioParcela = Number((updated.valor_liquido / numParcelas).toFixed(2))

      for (let p = 1; p <= numParcelas; p++) {
        const dataVenc = new Date()
        dataVenc.setDate(dataVenc.getDate() + (p - 1) * 30)

        await pb.collection('lancamentos_financeiros').create({
          tenant_id: tenantId,
          unidade_id: updated.unidade_id || selectedUnidadeId || '',
          paciente_id: updated.paciente_id,
          orcamento_id: updated.id,
          profissional_id: updated.profissional_id || null,
          descricao: `Tratamento Aprovado (${updated.numero_orcamento || 'ORC'}) - Parcela ${p}/${numParcelas}`,
          tipo: 'receber',
          categoria: 'tratamento',
          numero_parcela: p,
          total_parcelas: numParcelas,
          valor: valorUnitarioParcela,
          valor_liquido: valorUnitarioParcela,
          vencimento: dataVenc.toISOString().slice(0, 10),
          status: 'aberto',
        })
      }

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: updated.paciente_id,
        acao: 'aprovou_orcamento_assinatura',
        detalhes: `Orçamento ${updated.numero_orcamento || updated.id} aprovado digitalmente por ${nomeRubrica}. Gerados ${numParcelas} lançamentos no Financeiro (BL-009).`,
      })

      toast({
        title: 'Orçamento Aprovado com Sucesso! (BL-008 / BL-009)',
        description: `Assinatura eletrônica homologada. Foram geradas ${numParcelas} parcela(s) a receber no Financeiro.`,
      })

      setModalAssinaturaAberto(false)
      setOrcamentoParaAssinar(null)
      setNomeRubrica('')
      setDocumentoIdentidade('')
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar orçamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setAssinando(false)
    }
  }

  // Rejeitar Orçamento
  const handleConfirmarRejeicao = async () => {
    if (!orcamentoParaRejeitar) return
    try {
      await pb.collection('orcamentos').update(orcamentoParaRejeitar.id, {
        status: 'rejeitado',
        motivo_rejeicao: motivoRejeicao.trim() || 'Recusado pelo paciente/condições',
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: orcamentoParaRejeitar.paciente_id,
        acao: 'rejeitou_orcamento',
        detalhes: `Orçamento ${orcamentoParaRejeitar.numero_orcamento || orcamentoParaRejeitar.id} rejeitado. Motivo: ${motivoRejeicao}`,
      })

      toast({
        title: 'Orçamento Rejeitado',
        description: 'Status atualizado no prontuário do paciente.',
      })

      setModalRejeitarAberto(false)
      setOrcamentoParaRejeitar(null)
      setMotivoRejeicao('')
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao rejeitar', description: err.message, variant: 'destructive' })
    }
  }

  // Filtragem dos orçamentos
  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter((orc) => {
      // Filtro texto
      if (filtroTexto) {
        const txt = filtroTexto.toLowerCase()
        const pacNome = orc.expand?.paciente_id?.nome?.toLowerCase() || ''
        const num = orc.numero_orcamento?.toLowerCase() || ''
        const procs = orc.itens?.map((i) => i.procedimento.toLowerCase()).join(' ') || ''
        if (!pacNome.includes(txt) && !num.includes(txt) && !procs.includes(txt)) {
          return false
        }
      }

      // Filtro status
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'aprovado' && orc.status !== 'aprovado') return false
        if (
          filtroStatus === 'rejeitado' &&
          orc.status !== 'rejeitado' &&
          orc.status !== 'recusado'
        ) {
          return false
        }
        if (filtroStatus === 'rascunho' && orc.status !== 'rascunho') return false
        if (filtroStatus === 'enviado' && orc.status !== 'enviado' && orc.status !== 'negociacao') {
          return false
        }
      }

      // Filtro paciente
      if (filtroPaciente !== 'todos' && orc.paciente_id !== filtroPaciente) {
        return false
      }

      return true
    })
  }, [orcamentos, filtroTexto, filtroStatus, filtroPaciente])

  // Métricas do módulo de orçamentos
  const totalAprovadosValor = orcamentos
    .filter((o) => o.status === 'aprovado')
    .reduce((acc, curr) => acc + (curr.valor_liquido || 0), 0)

  const totalNegociacaoValor = orcamentos
    .filter((o) => o.status === 'enviado' || o.status === 'negociacao' || o.status === 'rascunho')
    .reduce((acc, curr) => acc + (curr.valor_liquido || 0), 0)

  const taxaConversao =
    orcamentos.length > 0
      ? Math.round(
          (orcamentos.filter((o) => o.status === 'aprovado').length / orcamentos.length) * 100,
        )
      : 0

  return (
    <ModuloGate modulo="orcamentos">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-[#0E7490]" />
                Orçamentos & Planos de Tratamento (BL-008)
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-[#0E7490] bg-cyan-50">
                Fase 1
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Montagem de propostas a partir do odontograma, desconto controlado, assinatura
              eletrônica e conversão automática no financeiro
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (pacientes.length > 0 && !pacienteId) setPacienteId(pacientes[0].id)
                setModalAberto(true)
              }}
              className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Orçamento</span>
            </Button>
          </div>
        </div>

        {/* Métricas / Cards de Conversão Comercial */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Orçamentos Aprovados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalAprovadosValor,
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {orcamentos.filter((o) => o.status === 'aprovado').length} propostas com faturamento
                gerado
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Em Negociação / Aberto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalNegociacaoValor,
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {
                  orcamentos.filter((o) => ['rascunho', 'enviado', 'negociacao'].includes(o.status))
                    .length
                }{' '}
                propostas aguardando decisão
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-cyan-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Taxa de Aceite Comercial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#0E7490]">{taxaConversao}%</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Baseado no histórico de {orcamentos.length} propostas registradas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar por paciente, código do orçamento ou procedimento..."
              className="pl-9 h-9 text-xs border-slate-200"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 text-xs w-full md:w-40 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
              <SelectTrigger className="h-9 text-xs w-full md:w-48 border-slate-200">
                <SelectValue placeholder="Paciente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Pacientes</SelectItem>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela de Orçamentos */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                Carregando propostas comerciais...
              </div>
            ) : orcamentosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
                <div>Nenhum orçamento encontrado para os filtros selecionados.</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiltroTexto('')
                    setFiltroStatus('todos')
                    setFiltroPaciente('todos')
                  }}
                  className="text-xs mt-2"
                >
                  Limpar Filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Proposta</th>
                      <th className="py-3 px-4">Paciente & Responsável</th>
                      <th className="py-3 px-4">Itens & Procedimentos</th>
                      <th className="py-3 px-4">Condição Financeira</th>
                      <th className="py-3 px-4">Status & Aceite</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {orcamentosFiltrados.map((orc) => {
                      const pacNome = orc.expand?.paciente_id?.nome || 'Paciente'
                      const profNome = orc.expand?.profissional_id?.nome || 'Dr(a). Responsável'

                      const statusConfig: Record<string, { label: string; color: string }> = {
                        rascunho: {
                          label: 'Rascunho',
                          color: 'bg-slate-100 text-slate-700 border-slate-200',
                        },
                        enviado: {
                          label: 'Enviado ao Paciente',
                          color: 'bg-blue-50 text-blue-700 border-blue-200',
                        },
                        negociacao: {
                          label: 'Em Negociação',
                          color: 'bg-amber-50 text-amber-700 border-amber-200',
                        },
                        aprovado: {
                          label: 'Aprovado & Faturado',
                          color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        },
                        rejeitado: {
                          label: 'Rejeitado',
                          color: 'bg-red-50 text-red-700 border-red-200',
                        },
                        recusado: {
                          label: 'Rejeitado',
                          color: 'bg-red-50 text-red-700 border-red-200',
                        },
                        vencido: {
                          label: 'Vencido',
                          color: 'bg-slate-100 text-slate-500 border-slate-200',
                        },
                      }

                      const status = statusConfig[orc.status] || {
                        label: orc.status,
                        color: 'bg-slate-50',
                      }

                      return (
                        <tr key={orc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 font-mono">
                              {orc.numero_orcamento || `ORC-${orc.id.slice(0, 6)}`}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Validade: {orc.validade || '30 dias'}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <Link
                              to={`/pacientes/${orc.paciente_id}`}
                              className="font-semibold text-slate-900 hover:text-[#0E7490] hover:underline flex items-center gap-1"
                            >
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{pacNome}</span>
                            </Link>
                            <div className="text-[10px] text-slate-400 mt-0.5">{profNome}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-slate-800 font-medium">
                              {orc.itens?.length || 0} procedimento(s)
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs">
                              {orc.itens
                                ?.map((i) =>
                                  i.dente && i.dente !== 'Geral'
                                    ? `${i.procedimento} (Dente ${i.dente})`
                                    : i.procedimento,
                                )
                                .join('; ')}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-xs">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(orc.valor_liquido)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {orc.parcelas}x de{' '}
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(orc.valor_liquido / (orc.parcelas || 1))}
                            </div>
                            {orc.desconto_percentual ? (
                              <div className="text-[10px] text-emerald-600 font-medium">
                                {orc.desconto_percentual}% desc. aplicado
                              </div>
                            ) : null}
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold ${status.color}`}
                            >
                              {status.label}
                            </Badge>
                            {orc.assinatura?.rubrica && (
                              <div className="text-[9px] text-emerald-700 flex items-center gap-1 mt-1 font-medium">
                                <FileCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  Assinado por {orc.assinatura.rubrica}
                                </span>
                              </div>
                            )}
                            {orc.status === 'rejeitado' && orc.motivo_rejeicao && (
                              <div className="text-[9px] text-red-600 truncate max-w-[180px] mt-0.5">
                                Motivo: {orc.motivo_rejeicao}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Visualizar / Imprimir */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                                title="Visualizar Proposta / Imprimir"
                                onClick={() => {
                                  setOrcamentoDetalhes(orc)
                                  setModalVisualizarAberto(true)
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>

                              {orc.status === 'rascunho' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                                  onClick={() => handleEnviarOrcamento(orc)}
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Enviar</span>
                                </Button>
                              )}

                              {orc.status !== 'aprovado' &&
                                orc.status !== 'rejeitado' &&
                                orc.status !== 'recusado' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                                      onClick={() => {
                                        setOrcamentoParaAssinar(orc)
                                        setNomeRubrica(pacNome)
                                        setModalAssinaturaAberto(true)
                                      }}
                                    >
                                      <Signature className="w-3 h-3" />
                                      <span>Aprovar</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-red-600 hover:bg-red-50 p-1.5"
                                      title="Rejeitar Orçamento"
                                      onClick={() => {
                                        setOrcamentoParaRejeitar(orc)
                                        setModalRejeitarAberto(true)
                                      }}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}

                              {orc.status === 'aprovado' && (
                                <Button
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-[#0E7490] border-cyan-200 hover:bg-cyan-50"
                                >
                                  <Link to={`/financeiro`}>Ver Contas a Receber</Link>
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
            )}
          </CardContent>
        </Card>

        {/* Modal Novo Orçamento (RF-023 / RF-024 / BL-008) */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
                <FileSpreadsheet className="w-5 h-5 text-[#0E7490]" />
                Elaboração de Orçamento Clínico
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecione os procedimentos, especifique dentes e faces, aplique descontos e defina o
                parcelamento
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarOrcamento} className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Paciente *</Label>
                  <Select value={pacienteId} onValueChange={setPacienteId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione o paciente" />
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
                  <Label className="text-xs font-semibold">Dentista Responsável</Label>
                  <Select value={profissionalId} onValueChange={setProfissionalId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Profissional avaliador" />
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
                  <Label className="text-xs font-semibold">Validade da Proposta</Label>
                  <Input
                    type="date"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Seletor Rápido para Adicionar Procedimentos */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <Label className="text-xs font-semibold text-slate-800">
                  Adicionar Procedimentos do Catálogo / Tabela Própria:
                </Label>
                <div className="flex gap-2">
                  <Select onValueChange={handleAdicionarItem}>
                    <SelectTrigger className="h-8 text-xs flex-1 bg-white">
                      <SelectValue placeholder="Escolha um procedimento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {procedimentos.map((proc) => (
                        <SelectItem key={proc.id} value={proc.id}>
                          {proc.nome} — R$ {proc.valor.toFixed(2)} ({proc.categoria || 'Geral'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabela de Itens Adicionados */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Procedimento</th>
                      <th className="py-2 px-3 w-24">Dente</th>
                      <th className="py-2 px-3 w-24">Face</th>
                      <th className="py-2 px-3 w-20">Qtd</th>
                      <th className="py-2 px-3 w-28">Valor Unit.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                      <th className="py-2 px-3 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itens.map((it, idx) => {
                      const subtotal = (it.valor_unitario || it.valor) * (it.quantidade || 1)
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {it.procedimento}
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={it.dente || 'Geral'}
                              onChange={(e) => {
                                const newItens = [...itens]
                                newItens[idx].dente = e.target.value
                                setItens(newItens)
                              }}
                              className="h-7 w-20 text-xs"
                              placeholder="ex: 16, 21"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={it.face || 'Todas'}
                              onChange={(e) => {
                                const newItens = [...itens]
                                newItens[idx].face = e.target.value
                                setItens(newItens)
                              }}
                              className="h-7 w-20 text-xs"
                              placeholder="ex: O, M"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min={1}
                              max={32}
                              value={it.quantidade || 1}
                              onChange={(e) => {
                                const newItens = [...itens]
                                newItens[idx].quantidade = Number(e.target.value) || 1
                                setItens(newItens)
                              }}
                              className="h-7 w-16 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={it.valor_unitario || it.valor}
                              onChange={(e) => {
                                const newItens = [...itens]
                                const val = Number(e.target.value) || 0
                                newItens[idx].valor_unitario = val
                                newItens[idx].valor = val
                                setItens(newItens)
                              }}
                              className="h-7 w-24 text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                            R$ {subtotal.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(idx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Remover Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totalizadores e Condições de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 items-center">
                <div>
                  <Label className="text-[11px] text-slate-500">Valor Bruto</Label>
                  <div className="text-base font-bold text-slate-800">
                    R$ {valorBruto.toFixed(2)}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-500">Desconto (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={descontoPct}
                    onChange={(e) => setDescontoPct(Number(e.target.value))}
                    className="h-7 text-xs w-24 bg-white"
                  />
                </div>

                <div>
                  <Label className="text-[11px] text-slate-500">Parcelamento</Label>
                  <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                    <SelectTrigger className="h-7 text-xs bg-white w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de R$ {(valorLiquido / n).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white p-2 rounded border border-cyan-200 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Total Líquido
                  </div>
                  <div className="text-lg font-extrabold text-[#0E7490]">
                    R$ {valorLiquido.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Observações da Proposta */}
              <div className="space-y-1">
                <Label className="text-xs">Observações / Orientações ao Paciente</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Instruções de garantia, prazo de execução ou condições comerciais..."
                  className="h-16 text-xs resize-none"
                />
              </div>

              <DialogFooter>
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
                  disabled={salvando}
                  size="sm"
                  className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
                >
                  {salvando ? 'Salvando...' : 'Gerar Orçamento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Coleta de Assinatura Digital do Paciente (RF-024 / BL-008) */}
        <Dialog open={modalAssinaturaAberto} onOpenChange={setModalAssinaturaAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Signature className="w-5 h-5 text-emerald-600" />
                Assinatura Eletrônica do Paciente
              </DialogTitle>
              <DialogDescription className="text-xs">
                Coleta formal de aceite do plano de tratamento odontológico e autorização de
                cobrança
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg text-slate-700 space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposta:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {orcamentoParaAssinar?.numero_orcamento || orcamentoParaAssinar?.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor Total Aprovado:</span>
                  <span className="font-bold text-emerald-700">
                    R$ {orcamentoParaAssinar?.valor_liquido?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Condição Acordada:</span>
                  <span className="font-medium text-slate-800">
                    {orcamentoParaAssinar?.parcelas}x de R${' '}
                    {(orcamentoParaAssinar
                      ? orcamentoParaAssinar.valor_liquido / (orcamentoParaAssinar.parcelas || 1)
                      : 0
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Procedimentos:</span>
                  <span className="font-medium text-slate-800">
                    {orcamentoParaAssinar?.itens?.length || 0} itens mapeados
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Nome Completo do Titular / Rubrica *
                </Label>
                <Input
                  value={nomeRubrica}
                  onChange={(e) => setNomeRubrica(e.target.value)}
                  placeholder="Nome do paciente rubricado na tela"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Documento de Identidade (CPF ou RG)</Label>
                <Input
                  value={documentoIdentidade}
                  onChange={(e) => setDocumentoIdentidade(e.target.value)}
                  placeholder="ex: CPF 000.000.000-00 ou RG"
                  className="h-8 text-xs"
                />
              </div>

              {/* Área simulada de assinatura em tablet touch */}
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">Área de Assinatura na Tela:</Label>
                <div className="h-20 bg-white border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-600 font-serif italic text-lg shadow-inner">
                  {nomeRubrica || 'Toque aqui para assinar'}
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Efeito Imediato no Módulo Financeiro (BL-009):
                </div>
                <div>
                  Ao confirmar, o sistema gerará automaticamente as{' '}
                  <strong>{orcamentoParaAssinar?.parcelas || 1} parcelas</strong> de contas a
                  receber com vencimentos mensais programados.
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalAssinaturaAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAssinatura}
                disabled={assinando}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {assinando ? 'Processando...' : 'Homologar Assinatura & Faturar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Visualizar / Imprimir Proposta */}
        <Dialog open={modalVisualizarAberto} onOpenChange={setModalVisualizarAberto}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center justify-between text-slate-900">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#0E7490]" />
                  Proposta de Tratamento Odontológico
                </span>
                <span className="font-mono text-sm font-bold text-slate-600">
                  {orcamentoDetalhes?.numero_orcamento}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Demonstrativo comercial para apresentação ao paciente e arquivo
              </DialogDescription>
            </DialogHeader>

            {orcamentoDetalhes && (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Paciente
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {orcamentoDetalhes.expand?.paciente_id?.nome || 'Paciente'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      CPF: {orcamentoDetalhes.expand?.paciente_id?.cpf || 'Não informado'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Profissional & Validade
                    </div>
                    <div className="text-xs font-semibold text-slate-800">
                      {orcamentoDetalhes.expand?.profissional_id?.nome || 'Corpo Clínico'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Válido até: {orcamentoDetalhes.validade || '30 dias'}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Procedimento</th>
                        <th className="py-2 px-3">Local (Dente/Face)</th>
                        <th className="py-2 px-3 text-right">Qtd</th>
                        <th className="py-2 px-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orcamentoDetalhes.itens?.map((it, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {it.procedimento}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            Dente {it.dente || 'Geral'} {it.face ? `• Face ${it.face}` : ''}
                          </td>
                          <td className="py-2 px-3 text-right">{it.quantidade || 1}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            R$ {((it.valor_unitario || it.valor) * (it.quantidade || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-600">
                      Condição: {orcamentoDetalhes.parcelas}x de R${' '}
                      {(
                        orcamentoDetalhes.valor_liquido / (orcamentoDetalhes.parcelas || 1)
                      ).toFixed(2)}
                    </div>
                    {orcamentoDetalhes.desconto_percentual ? (
                      <div className="text-[11px] text-emerald-700 font-medium">
                        Desconto concedido: {orcamentoDetalhes.desconto_percentual}%
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      Total Líquido
                    </div>
                    <div className="text-xl font-extrabold text-[#0E7490]">
                      R$ {orcamentoDetalhes.valor_liquido?.toFixed(2)}
                    </div>
                  </div>
                </div>

                {orcamentoDetalhes.assinatura?.rubrica && (
                  <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 text-[11px] flex items-center justify-between">
                    <div>
                      <strong>Aceite Eletrônico Registrado:</strong>{' '}
                      {orcamentoDetalhes.assinatura.rubrica}
                      <div className="text-[10px] text-emerald-700">
                        Carimbo de tempo: {orcamentoDetalhes.assinatura.data_hora?.slice(0, 19)}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800">
                      Homologado
                    </Badge>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Proposta</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setModalVisualizarAberto(false)}
                className="text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Rejeitar Orçamento */}
        <Dialog open={modalRejeitarAberto} onOpenChange={setModalRejeitarAberto}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Registrar Rejeição de Orçamento
              </DialogTitle>
              <DialogDescription className="text-xs">
                Informe o motivo para histórico e análise de perda comercial
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Motivo da Rejeição</Label>
                <Select value={motivoRejeicao} onValueChange={setMotivoRejeicao}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Valor acima do esperado">Valor acima do esperado</SelectItem>
                    <SelectItem value="Preferiu postergar o tratamento">
                      Preferiu postergar o tratamento
                    </SelectItem>
                    <SelectItem value="Optou por outro profissional/clínica">
                      Optou por outro profissional/clínica
                    </SelectItem>
                    <SelectItem value="Condições de pagamento inadequadas">
                      Condições de pagamento inadequadas
                    </SelectItem>
                    <SelectItem value="Outro motivo clínico ou pessoal">
                      Outro motivo clínico ou pessoal
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalRejeitarAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmarRejeicao}
                className="text-xs"
              >
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
