import React, { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  AgendamentoRecord,
  LancamentoFinanceiroRecord,
  MessageLembreteRecord,
  PacienteRecord,
  ProfissionalRecord,
  EvolucaoClinicaRecord,
  OrcamentoRecord,
} from '@/types/gestec'
import { ModuloGate } from '@/components/ModuloGate'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  BarChart3,
  Download,
  Calendar,
  MessageSquare,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  Users,
  Stethoscope,
  Filter,
  CheckCheck,
  Building2,
  CalendarDays,
  FileText,
  Percent,
} from 'lucide-react'

export default function RelatoriosPage() {
  const {
    tenantId,
    tenant,
    user,
    perfil,
    hasModule,
    canAccessFinancialReports,
    canAccessClinical,
    selectedUnidadeId,
    unidades,
  } = useAuth()
  const { toast } = useToast()

  // Dados brutos carregados do backend
  const [agendamentos, setAgendamentos] = useState<AgendamentoRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiroRecord[]>([])
  const [lembretes, setLembretes] = useState<MessageLembreteRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [evolucoes, setEvolucoes] = useState<EvolucaoClinicaRecord[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros Globais
  const [periodoFiltro, setPeriodoFiltro] = useState<
    '30dias' | 'mes_atual' | 'ano_atual' | 'custom'
  >('30dias')
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dataFim, setDataFim] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [filtroUnidadeId, setFiltroUnidadeId] = useState<string>(selectedUnidadeId || 'todas')
  const [filtroProfissionalId, setFiltroProfissionalId] = useState<string>('todos')

  // Se o usuário logado for dentista, fixa seu próprio escopo clínico
  const dentistaId = useMemo(() => {
    if (perfil === 'dentista') {
      const match = profissionais.find((p) => p.user_id === user?.id || p.email === user?.email)
      return match ? match.id : null
    }
    return null
  }, [perfil, profissionais, user])

  // Efeito para sincronizar unidade selecionada do header
  useEffect(() => {
    if (selectedUnidadeId) {
      setFiltroUnidadeId(selectedUnidadeId)
    }
  }, [selectedUnidadeId])

  // Carregar dados das coleções
  useEffect(() => {
    async function carregarDadosRelatorios() {
      if (!tenantId) return
      setLoading(true)
      try {
        const filterTenant = `tenant_id = '${tenantId}'`

        const pAg = pb.collection('agendamentos').getList<AgendamentoRecord>(1, 300, {
          filter: filterTenant,
          expand: 'paciente_id,profissional_id',
          sort: '-data_inicio',
        })

        const pLanc =
          canAccessFinancialReports() && hasModule('financeiro')
            ? pb.collection('lancamentos_financeiros').getList<LancamentoFinanceiroRecord>(1, 300, {
                filter: filterTenant,
                expand: 'paciente_id,orcamento_id',
                sort: '-vencimento',
              })
            : Promise.resolve({ items: [] })

        const pLemb = pb.collection('messages_lembretes').getList<MessageLembreteRecord>(1, 150, {
          filter: filterTenant,
          sort: '-created',
        })

        const pPac = pb.collection('pacientes').getList<PacienteRecord>(1, 300, {
          filter: filterTenant,
          sort: 'nome',
        })

        const pProf = pb.collection('profissionais').getList<ProfissionalRecord>(1, 100, {
          filter: filterTenant,
        })

        const pEv =
          canAccessClinical() && hasModule('prontuario')
            ? pb.collection('evolucoes_clinicas').getList<EvolucaoClinicaRecord>(1, 300, {
                filter: filterTenant,
                sort: '-data',
              })
            : Promise.resolve({ items: [] })

        const pOrc = hasModule('orcamentos')
          ? pb.collection('orcamentos').getList<OrcamentoRecord>(1, 200, {
              filter: filterTenant,
              sort: '-created',
            })
          : Promise.resolve({ items: [] })

        const [agRes, lancRes, lembRes, pacRes, profRes, evRes, orcRes] = await Promise.all([
          pAg,
          pLanc,
          pLemb,
          pPac,
          pProf,
          pEv,
          pOrc,
        ])

        setAgendamentos(agRes.items)
        setLancamentos(lancRes.items)
        setLembretes(lembRes.items)
        setPacientes(pacRes.items)
        setProfissionais(profRes.items)
        setEvolucoes(evRes.items)
        setOrcamentos(orcRes.items)

        // Registrar auditoria de visualização de relatórios
        await registrarAuditoria({
          tenantId,
          acao: 'visualizou_relatorios_bi',
          detalhes: `Acesso ao painel analítico com filtros período: ${dataInicio} a ${dataFim}, unidade: ${filtroUnidadeId}, perfil: ${perfil}.`,
        })
      } catch (err: any) {
        console.error('Erro ao carregar relatórios:', err)
        toast({
          title: 'Erro ao carregar relatórios',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    carregarDadosRelatorios()
  }, [tenantId, hasModule, perfil])

  // Ajuste do período pré-definido
  const handleMudarPeriodo = (tipo: '30dias' | 'mes_atual' | 'ano_atual' | 'custom') => {
    setPeriodoFiltro(tipo)
    const hoje = new Date()
    if (tipo === '30dias') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setDataInicio(d.toISOString().slice(0, 10))
      setDataFim(hoje.toISOString().slice(0, 10))
    } else if (tipo === 'mes_atual') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      setDataInicio(primeiroDia.toISOString().slice(0, 10))
      setDataFim(hoje.toISOString().slice(0, 10))
    } else if (tipo === 'ano_atual') {
      const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1)
      setDataInicio(primeiroDiaAno.toISOString().slice(0, 10))
      setDataFim(hoje.toISOString().slice(0, 10))
    }
  }

  // Filtragem dos Agendamentos pelas datas, unidade e profissional
  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter((ag) => {
      const dataIso = ag.data_inicio ? ag.data_inicio.slice(0, 10) : ''
      const matchPeriodo =
        (!dataInicio || dataIso >= dataInicio) && (!dataFim || dataIso <= dataFim)
      const matchUnidade =
        filtroUnidadeId === 'todas' || ag.unidade_id === filtroUnidadeId || !ag.unidade_id
      const profEfetivo =
        dentistaId || (filtroProfissionalId !== 'todos' ? filtroProfissionalId : null)
      const matchProf = !profEfetivo || ag.profissional_id === profEfetivo
      return matchPeriodo && matchUnidade && matchProf
    })
  }, [agendamentos, dataInicio, dataFim, filtroUnidadeId, filtroProfissionalId, dentistaId])

  // Filtragem dos Lançamentos Financeiros (Apenas se tiver acesso financeiro)
  const lancamentosFiltrados = useMemo(() => {
    if (!canAccessFinancialReports()) return []
    return lancamentos.filter((l) => {
      const dataIso = l.data_pagamento
        ? l.data_pagamento.slice(0, 10)
        : l.vencimento
          ? l.vencimento.slice(0, 10)
          : ''
      const matchPeriodo =
        (!dataInicio || dataIso >= dataInicio) && (!dataFim || dataIso <= dataFim)
      const matchUnidade =
        filtroUnidadeId === 'todas' || l.unidade_id === filtroUnidadeId || !l.unidade_id
      return matchPeriodo && matchUnidade
    })
  }, [lancamentos, dataInicio, dataFim, filtroUnidadeId, canAccessFinancialReports])

  // Filtragem dos Orçamentos
  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter((o) => {
      const dataIso = o.created ? o.created.slice(0, 10) : ''
      const matchPeriodo =
        (!dataInicio || dataIso >= dataInicio) && (!dataFim || dataIso <= dataFim)
      const matchUnidade =
        filtroUnidadeId === 'todas' || o.unidade_id === filtroUnidadeId || !o.unidade_id
      return matchPeriodo && matchUnidade
    })
  }, [orcamentos, dataInicio, dataFim, filtroUnidadeId])

  // 1. Métricas de Agenda e Ocupação
  const totalConsultas = agendamentosFiltrados.length
  const consultasConcluidas = agendamentosFiltrados.filter((a) => a.status === 'concluido').length
  const consultasConfirmadas = agendamentosFiltrados.filter(
    (a) => a.status === 'confirmado' || a.status === 'presente',
  ).length
  const consultasCanceladas = agendamentosFiltrados.filter((a) => a.status === 'cancelado').length
  const consultasFaltas = agendamentosFiltrados.filter((a) => a.status === 'falta').length
  const consultasNoShowTotal = consultasFaltas + consultasCanceladas
  const taxaNoShow =
    totalConsultas > 0 ? Math.round((consultasNoShowTotal / totalConsultas) * 100) : 0
  const taxaOcupacaoConcluida =
    totalConsultas > 0 ? Math.round((consultasConcluidas / totalConsultas) * 100) : 0

  // 2. Produção Clínica por Profissional
  const producaoPorProfissional = useMemo(() => {
    const mapa: Record<
      string,
      { nome: string; cro: string; total: number; concluidos: number; faltas: number }
    > = {}

    profissionais.forEach((p) => {
      mapa[p.id] = { nome: p.nome, cro: p.cro, total: 0, concluidos: 0, faltas: 0 }
    })

    agendamentosFiltrados.forEach((a) => {
      if (a.profissional_id && mapa[a.profissional_id]) {
        mapa[a.profissional_id].total += 1
        if (a.status === 'concluido') mapa[a.profissional_id].concluidos += 1
        if (a.status === 'falta' || a.status === 'cancelado') mapa[a.profissional_id].faltas += 1
      }
    })

    return Object.values(mapa).filter((p) => p.total > 0 || dentistaId)
  }, [profissionais, agendamentosFiltrados, dentistaId])

  // 3. Procedimentos mais frequentes
  const procedimentosFrequencia = useMemo(() => {
    const mapa: Record<string, number> = {}
    agendamentosFiltrados.forEach((a) => {
      const nome = a.procedimento || 'Consulta Geral'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    const ordenados = Object.entries(mapa).map(([nome, qtd]) => ({
      nome,
      qtd,
      pct: totalConsultas > 0 ? Math.round((qtd / totalConsultas) * 100) : 0,
    }))
    ordenados.sort((a, b) => b.qtd - a.qtd)
    return ordenados.slice(0, 6)
  }, [agendamentosFiltrados, totalConsultas])

  // 4. Métricas Financeiras Consolidadas (Apenas se tiver permissão financeira)
  const totalReceitaPaga = useMemo(() => {
    return lancamentosFiltrados
      .filter((l) => l.tipo === 'receber' && l.status === 'pago')
      .reduce((acc, curr) => acc + (curr.valor_pago || curr.valor || 0), 0)
  }, [lancamentosFiltrados])

  const totalReceitaAberta = useMemo(() => {
    return lancamentosFiltrados
      .filter((l) => l.tipo === 'receber' && (l.status === 'aberto' || l.status === 'vencido'))
      .reduce((acc, curr) => acc + (curr.valor_liquido || curr.valor || 0), 0)
  }, [lancamentosFiltrados])

  // 5. Eficácia de Lembretes e Confirmação (BL-010 + BL-012)
  const lembretesFiltrados = useMemo(() => {
    return lembretes.filter((l) => {
      const dataIso = l.data_envio
        ? l.data_envio.slice(0, 10)
        : l.created
          ? l.created.slice(0, 10)
          : ''
      const matchPeriodo =
        (!dataInicio || dataIso >= dataInicio) && (!dataFim || dataIso <= dataFim)
      const matchUnidade =
        filtroUnidadeId === 'todas' || l.unidade_id === filtroUnidadeId || !l.unidade_id
      return matchPeriodo && matchUnidade
    })
  }, [lembretes, dataInicio, dataFim, filtroUnidadeId])

  const totalDisparosLembretes = lembretesFiltrados.length
  const totalConfirmacoesLembretes = lembretesFiltrados.filter(
    (l) => l.status === 'respondido_confirmado',
  ).length
  const taxaConversaoLembrete =
    totalDisparosLembretes > 0
      ? Math.round((totalConfirmacoesLembretes / totalDisparosLembretes) * 100)
      : 0

  // Exportação Contábil / Extrato CSV (BL-012 / BL-023)
  const handleExportarContabilCSV = () => {
    if (!canAccessFinancialReports()) {
      toast({
        title: 'Acesso Restrito pelo RBAC',
        description: 'Seu perfil não possui permissão para exportar relatórios financeiros.',
        variant: 'destructive',
      })
      return
    }

    if (lancamentosFiltrados.length === 0) {
      toast({ title: 'Sem lançamentos no período filtrado', variant: 'destructive' })
      return
    }

    const headers = [
      'ID',
      'Vencimento',
      'Paciente',
      'Descricao',
      'Tipo',
      'Valor Original',
      'Valor Pago',
      'Status',
      'Forma Pagamento',
      'Data Pagamento',
      'Unidade',
    ]

    const rows = lancamentosFiltrados.map((l) => [
      l.id,
      l.vencimento,
      `"${(l.expand?.paciente_id?.nome || 'Avulso').replace(/"/g, '""')}"`,
      `"${l.descricao.replace(/"/g, '""')}"`,
      l.tipo,
      l.valor.toFixed(2),
      (l.valor_pago || 0).toFixed(2),
      l.status,
      l.forma_pagamento_principal || '',
      l.data_pagamento || '',
      l.unidade_id || '',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `gestec_relatorio_financeiro_${dataInicio}_a_${dataFim}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    registrarAuditoria({
      tenantId,
      acao: 'exportou_relatorio_csv',
      detalhes: `Exportado extrato CSV com ${lancamentosFiltrados.length} lançamentos entre ${dataInicio} e ${dataFim}.`,
    })

    toast({
      title: 'Arquivo CSV Gerado com Sucesso',
      description: 'Extrato operacional e contábil baixado para conciliação bancária.',
    })
  }

  // Exportação Visual / Modo Impressão PDF
  const handleImprimirRelatorio = () => {
    window.print()
    registrarAuditoria({
      tenantId,
      acao: 'imprimiu_relatorio_pdf',
      detalhes: `Disparada janela de impressão visual de relatório gerencial para o período ${dataInicio} a ${dataFim}.`,
    })
  }

  return (
    <ModuloGate modulo="bi">
      <div className="space-y-6 print:space-y-4">
        {/* Top Header / Barra de Controle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#0E7490]" />
              Relatórios Gerenciais & Indicadores (BL-012)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Taxa de no-show, ocupação de cadeiras, produção por profissional, eficácia de
              lembretes e fluxo de caixa
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Button
              onClick={handleImprimirRelatorio}
              variant="outline"
              size="sm"
              className="h-9 text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Imprimir / Salvar PDF</span>
            </Button>

            {canAccessFinancialReports() && (
              <Button
                onClick={handleExportarContabilCSV}
                variant="outline"
                size="sm"
                className="h-9 text-xs flex items-center gap-1.5 text-[#0E7490] border-cyan-200 hover:bg-cyan-50"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Filtros Operacionais */}
        <Card className="border-slate-200 shadow-sm print:hidden">
          <CardContent className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {/* Período Rápido */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Período de Análise</Label>
                <Select value={periodoFiltro} onValueChange={(val: any) => handleMudarPeriodo(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30dias">Últimos 30 Dias</SelectItem>
                    <SelectItem value="mes_atual">Mês Vigente</SelectItem>
                    <SelectItem value="ano_atual">Ano Vigente</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data Início */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Data Inicial</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value)
                    setPeriodoFiltro('custom')
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {/* Data Fim */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Data Final</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value)
                    setPeriodoFiltro('custom')
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {/* Filtro Unidade */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Unidade Operacional</Label>
                <Select value={filtroUnidadeId} onValueChange={setFiltroUnidadeId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Todas as unidades" />
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

              {/* Filtro Profissional (Restrito pelo RBAC se dentista) */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Cirurgião-Dentista</Label>
                {dentistaId ? (
                  <div className="h-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 font-medium truncate flex items-center">
                    {profissionais.find((p) => p.id === dentistaId)?.nome ||
                      user?.name ||
                      'Seu Perfil'}
                  </div>
                ) : (
                  <Select value={filtroProfissionalId} onValueChange={setFiltroProfissionalId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Todos os profissionais" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Profissionais</SelectItem>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({p.cro})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerta de Escopo de Perfil RBAC */}
        {dentistaId && (
          <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-900 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#0E7490] shrink-0" />
            <span>
              <strong>Visão RBAC Dentista:</strong> Os relatórios clínicos exibem exclusivamente
              seus atendimentos e pacientes atribuídos. Relatórios financeiros consolidados globais
              são restritos à administração.
            </span>
          </div>
        )}

        {!canAccessFinancialReports() && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Regra de Conformidade CFO/LGPD:</strong> Indicadores consolidados de
              faturamento estão ocultos para perfis assistenciais e recepção.
            </span>
          </div>
        )}

        {/* CARDS DE INDICADORES CHAVE (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Consultas Agendadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{totalConsultas}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                {consultasConcluidas} finalizadas ({taxaOcupacaoConcluida}% taxa de conclusão)
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Taxa de No-Show / Faltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold flex items-center gap-1.5 ${
                  taxaNoShow > 15 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                <span>{taxaNoShow}%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {consultasFaltas} faltas e {consultasCanceladas} cancelamentos no período
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                Eficácia de Confirmações (BL-010)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-700 flex items-center gap-1.5">
                <CheckCheck className="w-6 h-6" />
                <span>{taxaConversaoLembrete}%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {totalConfirmacoesLembretes} confirmações em {totalDisparosLembretes} lembretes
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">
                {canAccessFinancialReports() ? 'Receita Liquidada (Caixa)' : 'Orçamentos Ativos'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {canAccessFinancialReports() ? (
                <>
                  <div className="text-2xl font-bold text-emerald-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      totalReceitaPaga,
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      totalReceitaAberta,
                    )}{' '}
                    em aberto no período
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-slate-900">
                    {orcamentosFiltrados.length}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Planos de tratamento em negociação
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ABAS DETALHADAS DE RELATÓRIO */}
        <Tabs defaultValue="agenda" className="space-y-4">
          <TabsList className="bg-slate-100 p-1 border border-slate-200 print:hidden">
            <TabsTrigger value="agenda" className="text-xs flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Agenda, Ocupação & No-Show
            </TabsTrigger>
            <TabsTrigger value="producao" className="text-xs flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              Produção por Profissional
            </TabsTrigger>
            <TabsTrigger value="procedimentos" className="text-xs flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Mix de Procedimentos
            </TabsTrigger>
            {canAccessFinancialReports() && (
              <TabsTrigger value="financeiro" className="text-xs flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Faturamento & Contas a Receber
              </TabsTrigger>
            )}
            <TabsTrigger value="comunicacao" className="text-xs flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Régua de Lembretes & Retorno
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: Relatório de Agenda & No-Show */}
          <TabsContent value="agenda" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Status e Desfechos das Consultas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Acompanhamento de pontualidade, presenças e absenteísmo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Atendimentos Concluídos',
                        qtd: consultasConcluidas,
                        cor: 'bg-emerald-500',
                        textColor: 'text-emerald-700',
                      },
                      {
                        label: 'Confirmados / Aguardando Atendimento',
                        qtd: consultasConfirmadas,
                        cor: 'bg-cyan-500',
                        textColor: 'text-cyan-700',
                      },
                      {
                        label: 'Faltas Injustificadas (No-Show)',
                        qtd: consultasFaltas,
                        cor: 'bg-rose-500',
                        textColor: 'text-rose-700',
                      },
                      {
                        label: 'Cancelamentos Prévios',
                        qtd: consultasCanceladas,
                        cor: 'bg-amber-500',
                        textColor: 'text-amber-700',
                      },
                    ].map((item, idx) => {
                      const pct =
                        totalConsultas > 0 ? Math.round((item.qtd / totalConsultas) * 100) : 0
                      return (
                        <div key={idx} className="space-y-1 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-700">{item.label}</span>
                            <span className={item.textColor}>
                              {item.qtd} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.cor} rounded-full`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Resumo Operacional</CardTitle>
                  <CardDescription className="text-xs">
                    Período: {dataInicio} até {dataFim}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unidade Analisada:</span>
                      <span className="font-semibold text-slate-900">
                        {filtroUnidadeId === 'todas'
                          ? 'Todas as Unidades'
                          : unidades.find((u) => u.id === filtroUnidadeId)?.nome ||
                            'Unidade Principal'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Pacientes na Base:</span>
                      <span className="font-semibold text-slate-900">{pacientes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Média Diária Atendimentos:</span>
                      <span className="font-semibold text-slate-900">
                        {(totalConsultas / 30).toFixed(1)} consultas/dia
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Índice Geral de Assiduidade:</span>
                      <span className="font-semibold text-emerald-600">{100 - taxaNoShow}%</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 text-[11px] text-amber-900">
                    <strong>Gestão de No-Show:</strong> Pacientes que faltam são automaticamente
                    sugeridos para reativação na Fila de Comunicação ou liberação de horário para a
                    Fila de Espera.
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 2: Produção por Profissional */}
          <TabsContent value="producao" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Desempenho e Produtividade por Cirurgião-Dentista
                </CardTitle>
                <CardDescription className="text-xs">
                  Consultas totais, atendimentos concluídos e índice individual de faltas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Cirurgião-Dentista</th>
                        <th className="py-3 px-4">Registro CRO</th>
                        <th className="py-3 px-4 text-center">Consultas Atribuídas</th>
                        <th className="py-3 px-4 text-center">Concluídas</th>
                        <th className="py-3 px-4 text-center">Faltas / Canceladas</th>
                        <th className="py-3 px-4 text-right">Aproveitamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {producaoPorProfissional.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Nenhuma consulta atribuída a profissionais neste período.
                          </td>
                        </tr>
                      ) : (
                        producaoPorProfissional.map((p, idx) => {
                          const taxaAproveitamento =
                            p.total > 0 ? Math.round((p.concluidos / p.total) * 100) : 0
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-semibold text-slate-900">{p.nome}</td>
                              <td className="py-3 px-4 font-mono text-slate-500">{p.cro}</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-800">
                                {p.total}
                              </td>
                              <td className="py-3 px-4 text-center text-emerald-600 font-semibold">
                                {p.concluidos}
                              </td>
                              <td className="py-3 px-4 text-center text-rose-600">{p.faltas}</td>
                              <td className="py-3 px-4 text-right">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    taxaAproveitamento >= 70
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {taxaAproveitamento}% concluído
                                </Badge>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: Mix de Procedimentos */}
          <TabsContent value="procedimentos" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Procedimentos Mais Executados na Clínica
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição calculada diretamente dos agendamentos e atendimentos reais
                  registrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {procedimentosFrequencia.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Nenhum procedimento encontrado no período.
                    </div>
                  ) : (
                    procedimentosFrequencia.map((proc, idx) => (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-800">{proc.nome}</span>
                          <span className="text-[#0E7490]">
                            {proc.qtd} consultas ({proc.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0E7490] rounded-full transition-all"
                            style={{ width: `${proc.pct}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 4: Faturamento & Contas a Receber (Somente Gestores/Financeiro) */}
          {canAccessFinancialReports() && (
            <TabsContent value="financeiro" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">
                      Composição do Caixa e Títulos Financeiros (BL-009 / BL-012)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detalhamento dos valores recebidos e saldos previstos para o período
                      selecionado
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                          <tr>
                            <th className="py-3 px-4">Paciente</th>
                            <th className="py-3 px-4">Descrição</th>
                            <th className="py-3 px-4">Vencimento</th>
                            <th className="py-3 px-4">Forma</th>
                            <th className="py-3 px-4 text-right">Valor</th>
                            <th className="py-3 px-4 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lancamentosFiltrados.slice(0, 8).map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-semibold text-slate-900">
                                {l.expand?.paciente_id?.nome || 'Avulso'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-700 truncate max-w-[200px]">
                                {l.descricao}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-slate-500">
                                {l.vencimento}
                              </td>
                              <td className="py-2.5 px-4 uppercase text-[10px] font-semibold text-slate-600">
                                {l.forma_pagamento_principal || 'A Definir'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                }).format(l.valor)}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] capitalize ${
                                    l.status === 'pago'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : l.status === 'aberto'
                                        ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}
                                >
                                  {l.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Totalização de Fluxo</CardTitle>
                    <CardDescription className="text-xs">Conciliação do Período</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider">
                        Total Liquidado no Período
                      </div>
                      <div className="text-xl font-bold text-emerald-700 mt-1">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(totalReceitaPaga)}
                      </div>
                      <div className="text-[10px] text-emerald-600 mt-0.5">
                        Baixas registradas e conferidas no caixa
                      </div>
                    </div>

                    <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <div className="text-[11px] text-cyan-800 font-semibold uppercase tracking-wider">
                        Previsão a Receber
                      </div>
                      <div className="text-xl font-bold text-cyan-700 mt-1">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(totalReceitaAberta)}
                      </div>
                      <div className="text-[10px] text-cyan-600 mt-0.5">
                        Títulos em aberto com vencimento no intervalo
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ABA 5: Régua de Lembretes & Comunicação (BL-010 Integrado a BL-012) */}
          <TabsContent value="comunicacao" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Performance da Régua de Mensagens & Confirmações (BL-010)
                </CardTitle>
                <CardDescription className="text-xs">
                  Gatilhos de 48h, 24h, retorno preventivo e avisos operacionais
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Destinatário</th>
                        <th className="py-3 px-4">Canal</th>
                        <th className="py-3 px-4">Gatilho</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Data Envio</th>
                        <th className="py-3 px-4">Resposta Registrada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lembretesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Nenhum lembrete gerado neste período.
                          </td>
                        </tr>
                      ) : (
                        lembretesFiltrados.slice(0, 10).map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {l.destinatario_nome}
                              <div className="text-[11px] text-slate-400 font-mono font-normal">
                                {l.telefone}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase font-semibold"
                              >
                                {l.canal}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 capitalize text-slate-700">
                              {l.tipo_gatilho.replace(/_/g, ' ')}
                            </td>
                            <td className="py-3 px-4">
                              {l.status === 'respondido_confirmado' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 text-[10px]">
                                  Confirmado
                                </Badge>
                              ) : l.status === 'pendente_integracao_externa' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                >
                                  Pendente Integração
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {l.status.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {l.data_envio || l.created?.slice(0, 16) || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 italic text-[11px]">
                              {l.resposta_paciente ? `"${l.resposta_paciente}"` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ModuloGate>
  )
}
