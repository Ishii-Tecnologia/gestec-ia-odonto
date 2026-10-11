import React, { useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  LancamentoFinanceiroRecord,
  ModalidadePagamento,
  PacienteRecord,
  ProfissionalRecord,
  UnidadeRecord,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { ModuloGate } from '@/components/ModuloGate'
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
  DollarSign,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Building2,
  User,
  ShieldAlert,
  ArrowDownRight,
  PieChart,
  Wallet,
  Receipt,
  FileCheck2,
  Download,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function FinanceiroPage() {
  const {
    tenantId,
    user,
    perfil,
    selectedUnidadeId,
    unidades,
    canAccessFinancialReports,
    isOwner,
    isSuperAdmin,
  } = useAuth()
  const { toast } = useToast()

  const [titulos, setTitulos] = useState<LancamentoFinanceiroRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros Avançados (BL-009: por período, unidade, profissional, status)
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroUnidade, setFiltroUnidade] = useState<string>(selectedUnidadeId || 'todas')
  const [filtroProfissional, setFiltroProfissional] = useState<string>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<
    'mes_atual' | 'proximos_30' | 'ano_atual' | 'todos'
  >('mes_atual')
  const [tabAtiva, setTabAtiva] = useState<'receber' | 'fluxo' | 'faturamento'>('receber')

  // Modal Baixa com Split de Pagamento (RF-031 / RF-032 / BL-009)
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false)
  const [tituloSelecionado, setTituloSelecionado] = useState<LancamentoFinanceiroRecord | null>(
    null,
  )
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)
  const [comprovanteTransacao, setComprovanteTransacao] = useState('')

  // Configuração do Split de Pagamento
  const [splitModalidades, setSplitModalidades] = useState<ModalidadePagamento[]>([
    { modalidade: 'pix', valor: 0 },
  ])

  // Modal Simulação Pix Dinâmico com QR Code (RF-032)
  const [modalPixAberto, setModalPixAberto] = useState(false)
  const [pixPayload, setPixPayload] = useState('')

  // Modal Novo Lançamento Avulso (ex: Consulta avulsa a receber)
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoPacienteId, setNovoPacienteId] = useState('')
  const [novoDescricao, setNovoDescricao] = useState('')
  const [novoValor, setNovoValor] = useState(150)
  const [novoVencimento, setNovoVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [novoProfissionalId, setNovoProfissionalId] = useState('')

  // RBAC CA-Privacidade: Apenas Gestor / Owner / Financeiro / SuperAdmin têm visão plena.
  // Recepção: opera fluxo e vê títulos sem poder editar regras silenciosamente.
  // Dentista: bloqueado da visualização consolidada global.
  const temPermissaoPlena = canAccessFinancialReports()
  const podeDarBaixa = perfil === 'owner' || perfil === 'financeiro' || perfil === 'superadmin'

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [titRes, pacRes, profRes] = await Promise.all([
        pb.collection('lancamentos_financeiros').getList<LancamentoFinanceiroRecord>(1, 200, {
          sort: 'vencimento',
          expand: 'paciente_id,orcamento_id,profissional_id',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 100, { sort: 'nome' }),
        pb.collection('profissionais').getList<ProfissionalRecord>(1, 50, { sort: 'nome' }),
      ])
      setTitulos(titRes.items)
      setPacientes(pacRes.items)
      setProfissionais(profRes.items)

      if (pacRes.items.length > 0 && !novoPacienteId) {
        setNovoPacienteId(pacRes.items[0].id)
      }
      if (profRes.items.length > 0 && !novoProfissionalId) {
        setNovoProfissionalId(profRes.items[0].id)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados financeiros:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId])

  // Abrir modal de baixa com divisão de modalidades (Split - RF-031 / BL-009)
  const abrirModalBaixa = (titulo: LancamentoFinanceiroRecord) => {
    if (!podeDarBaixa) {
      toast({
        title: 'Acesso Restrito pelo RBAC',
        description: 'A baixa de pagamentos é restrita a usuários com perfil Financeiro ou Owner.',
        variant: 'destructive',
      })
      return
    }
    setTituloSelecionado(titulo)
    setSplitModalidades([{ modalidade: 'pix', valor: titulo.valor }])
    setComprovanteTransacao('')
    setModalBaixaAberto(true)
  }

  const handleAddSplit = () => {
    setSplitModalidades([...splitModalidades, { modalidade: 'cartao_credito', valor: 0 }])
  }

  const handleRemoveSplit = (idx: number) => {
    setSplitModalidades(splitModalidades.filter((_, i) => i !== idx))
  }

  const totalSplit = splitModalidades.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

  // Efetivar Baixa de Pagamento
  const handleConfirmarBaixa = async () => {
    if (!tituloSelecionado) return
    if (!podeDarBaixa) {
      toast({
        title: 'Operação Não Autorizada',
        description: 'Seu perfil não possui permissão para efetivar baixa financeira.',
        variant: 'destructive',
      })
      return
    }

    if (Math.abs(totalSplit - tituloSelecionado.valor) > 0.05) {
      toast({
        title: 'Valor do Split Incompatível',
        description: `A soma das modalidades (R$ ${totalSplit.toFixed(2)}) deve totalizar o valor do título (R$ ${tituloSelecionado.valor.toFixed(2)}).`,
        variant: 'destructive',
      })
      return
    }

    setSalvandoBaixa(true)
    try {
      const agoraStr = new Date().toISOString()
      const formaPrincipal =
        splitModalidades.length > 1 ? 'split' : splitModalidades[0]?.modalidade || 'pix'

      await pb.collection('lancamentos_financeiros').update(tituloSelecionado.id, {
        status: 'pago',
        data_pagamento: agoraStr,
        valor_pago: totalSplit,
        forma_pagamento_principal: formaPrincipal,
        comprovante_transacao: comprovanteTransacao || `BAIXA-${Date.now().toString().slice(-6)}`,
        responsavel_baixa_email: user?.email || 'operador@gestec',
        modalidades: splitModalidades.map((m) => ({
          ...m,
          data: agoraStr,
        })),
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: tituloSelecionado.paciente_id,
        acao: 'liquidou_titulo_financeiro',
        detalhes: `Baixa realizada no lançamento "${tituloSelecionado.descricao}" (R$ ${totalSplit.toFixed(2)}) com modalidades: ${splitModalidades.map((m) => `${m.modalidade} R$${m.valor}`).join(', ')}`,
      })

      toast({
        title: 'Título Liquidado com Sucesso! (RF-031 / BL-009)',
        description: 'Baixa computada no fluxo de caixa e histórico do paciente.',
      })

      setModalBaixaAberto(false)
      setTituloSelecionado(null)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao liquidar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoBaixa(false)
    }
  }

  // Gerar Pix Dinâmico Simulado (RF-032)
  const handleGerarPix = (titulo: LancamentoFinanceiroRecord) => {
    const payload = `00020126580014br.gov.bcb.pix0136gestec-${titulo.id}-pix520400005303986540${titulo.valor.toFixed(2)}5802BR5925GESTECODONTO6009SAOPAULO62070503***6304ABCD`
    setPixPayload(payload)
    setTituloSelecionado(titulo)
    setModalPixAberto(true)
  }

  // Criar Lançamento Financeiro Avulso
  const handleCriarLancamentoAvulso = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const unidadeEfetiva =
        selectedUnidadeId && selectedUnidadeId !== 'todas'
          ? selectedUnidadeId
          : unidades[0]?.id || ''

      await pb.collection('lancamentos_financeiros').create({
        tenant_id: tenantId,
        unidade_id: unidadeEfetiva,
        paciente_id: novoPacienteId,
        profissional_id: novoProfissionalId || null,
        descricao: novoDescricao || 'Consulta / Procedimento Avulso',
        tipo: 'receber',
        categoria: 'consulta',
        numero_parcela: 1,
        total_parcelas: 1,
        valor: Number(novoValor),
        valor_liquido: Number(novoValor),
        vencimento: novoVencimento,
        status: 'aberto',
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: novoPacienteId,
        acao: 'criou_titulo_financeiro_avulso',
        detalhes: `Lançamento avulso de R$ ${Number(novoValor).toFixed(2)} criado para ${novoDescricao}`,
      })

      toast({
        title: 'Recebível Criado com Sucesso',
        description: 'Título adicionado às contas a receber.',
      })

      setModalNovoAberto(false)
      setNovoDescricao('')
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao criar', description: err.message, variant: 'destructive' })
    }
  }

  // Filtragem dos Títulos
  const titulosFiltrados = useMemo(() => {
    return titulos.filter((t) => {
      // Filtro texto
      if (filtroTexto) {
        const txt = filtroTexto.toLowerCase()
        const pac = t.expand?.paciente_id?.nome?.toLowerCase() || ''
        const desc = t.descricao?.toLowerCase() || ''
        if (!pac.includes(txt) && !desc.includes(txt)) return false
      }

      // Filtro Status
      if (filtroStatus !== 'todos' && t.status !== filtroStatus) {
        return false
      }

      // Filtro Unidade
      if (filtroUnidade !== 'todas' && t.unidade_id && t.unidade_id !== filtroUnidade) {
        return false
      }

      // Filtro Profissional
      if (filtroProfissional !== 'todos' && t.profissional_id !== filtroProfissional) {
        return false
      }

      // Filtro Período
      if (filtroPeriodo === 'mes_atual') {
        const mesAtualStr = new Date().toISOString().slice(0, 7)
        if (t.vencimento && !t.vencimento.startsWith(mesAtualStr)) return false
      } else if (filtroPeriodo === 'proximos_30') {
        const hojeIso = new Date().toISOString().slice(0, 10)
        const daqui30Iso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
        if (t.vencimento < hojeIso || t.vencimento > daqui30Iso) return false
      }

      return true
    })
  }, [titulos, filtroTexto, filtroStatus, filtroUnidade, filtroProfissional, filtroPeriodo])

  // Totalizadores Dinâmicos
  const totalRecebido = useMemo(() => {
    return titulosFiltrados
      .filter((t) => t.status === 'pago')
      .reduce((acc, curr) => acc + (curr.valor_pago || curr.valor || 0), 0)
  }, [titulosFiltrados])

  const totalAberto = useMemo(() => {
    return titulosFiltrados
      .filter((t) => t.status === 'aberto')
      .reduce((acc, curr) => acc + curr.valor, 0)
  }, [titulosFiltrados])

  const totalGeralPrevisto = totalRecebido + totalAberto

  // BL-023: Exportação Contábil e Extratos CSV
  const handleExportarExtratoCSV = () => {
    if (!temPermissaoPlena) {
      toast({
        title: 'Acesso Restrito',
        description: 'Seu perfil não possui permissão para exportar dados contábeis.',
        variant: 'destructive',
      })
      return
    }

    if (titulosFiltrados.length === 0) {
      toast({ title: 'Nenhum lançamento para exportar', variant: 'destructive' })
      return
    }

    // Layout de colunas: data, descrição, valor, status, forma de pagamento
    const headers = [
      'Data Vencimento',
      'Descrição',
      'Paciente',
      'Valor Original',
      'Valor Pago',
      'Status',
      'Forma de Pagamento',
      'Data Pagamento',
      'Comprovante / Ref',
      'Unidade',
    ]

    const rows = titulosFiltrados.map((t) => {
      const pacNome = t.expand?.paciente_id?.nome || 'Avulso'
      const unidadeNome = unidades.find((u) => u.id === t.unidade_id)?.nome || 'Principal'
      return [
        t.vencimento || '',
        `"${(t.descricao || '').replace(/"/g, '""')}"`,
        `"${pacNome.replace(/"/g, '""')}"`,
        t.valor.toFixed(2),
        (t.valor_pago || 0).toFixed(2),
        t.status,
        t.forma_pagamento_principal || '',
        t.data_pagamento ? t.data_pagamento.slice(0, 10) : '',
        `"${(t.comprovante_transacao || '').replace(/"/g, '""')}"`,
        `"${unidadeNome.replace(/"/g, '""')}"`,
      ]
    })

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const hojeStr = new Date().toISOString().slice(0, 10)
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `gestec_extrato_contabil_${hojeStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    registrarAuditoria({
      tenantId,
      userEmail: user?.email,
      perfil,
      acao: 'exportou_extrato_contabil_csv',
      detalhes: `Exportação de extrato financeiro contábil em CSV (${titulosFiltrados.length} lançamentos)`,
    })

    toast({
      title: 'Extrato Contábil Exportado!',
      description: `Arquivo CSV gerado com ${titulosFiltrados.length} lançamentos.`,
    })
  }

  // Faturamento por profissional
  const faturamentoPorProfissional = useMemo(() => {
    const mapa: Record<string, { nome: string; pago: number; aberto: number }> = {}
    for (const t of titulosFiltrados) {
      const profNome = t.expand?.profissional_id?.nome || 'Profissional Geral'
      if (!mapa[profNome]) {
        mapa[profNome] = { nome: profNome, pago: 0, aberto: 0 }
      }
      if (t.status === 'pago') {
        mapa[profNome].pago += t.valor_pago || t.valor || 0
      } else if (t.status === 'aberto') {
        mapa[profNome].aberto += t.valor || 0
      }
    }
    return Object.values(mapa)
  }, [titulosFiltrados])

  // Faturamento por Unidade
  const faturamentoPorUnidade = useMemo(() => {
    const mapa: Record<string, { nome: string; pago: number; aberto: number }> = {}
    for (const t of titulosFiltrados) {
      const uNome = unidades.find((u) => u.id === t.unidade_id)?.nome || 'Unidade Principal'
      if (!mapa[uNome]) {
        mapa[uNome] = { nome: uNome, pago: 0, aberto: 0 }
      }
      if (t.status === 'pago') {
        mapa[uNome].pago += t.valor_pago || t.valor || 0
      } else if (t.status === 'aberto') {
        mapa[uNome].aberto += t.valor || 0
      }
    }
    return Object.values(mapa)
  }, [titulosFiltrados, unidades])

  // Bloqueio de dentistas para dados consolidados gerais
  if (!temPermissaoPlena && perfil === 'dentista') {
    return (
      <ModuloGate modulo="financeiro">
        <div className="p-8 max-w-xl mx-auto text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Acesso Restrito ao Módulo Financeiro</h2>
          <p className="text-xs text-slate-600">
            Conforme política de conformidade e privacidade (CA-Privacidade), dentistas não possuem
            acesso ao fluxo financeiro e contas a receber globais da clínica. Para consultar seus
            atendimentos e comissões individuais, acesse a agenda ou seu prontuário clínico.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/agenda">Voltar para a Agenda</Link>
          </Button>
        </div>
      </ModuloGate>
    )
  }

  return (
    <ModuloGate modulo="financeiro">
      <div className="space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                Gestão Financeira & Contas a Receber (BL-009)
              </h1>
              <Badge
                variant="outline"
                className="text-xs font-semibold text-emerald-700 bg-emerald-50"
              >
                Fase 1
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Controle de contas a receber, baixa com split de pagamento, faturamento por
              profissional/unidade e fluxo de caixa previsto vs. realizado
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportarExtratoCSV}
              className="text-xs h-9 flex items-center gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              title="Exportar extrato contábil em CSV das contas a receber filtradas"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Extrato</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={carregarDados}
              className="text-xs h-9 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </Button>

            {podeDarBaixa && (
              <Button
                onClick={() => setModalNovoAberto(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Recebível Avulso</span>
              </Button>
            )}
          </div>
        </div>

        {/* Cards de Fluxo Previsto vs. Realizado (BL-009) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Faturamento Realizado (Caixa)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalRecebido,
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Liquidações confirmadas via Pix/Cartão
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                A Receber em Aberto (Previsto)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalAberto,
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Parcelas a vencer de tratamentos</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Fluxo Total Projetado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalGeralPrevisto,
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Soma realizado + carteira prevista</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-cyan-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500">
                Taxa de Liquidação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#0E7490]">
                {totalGeralPrevisto > 0
                  ? Math.round((totalRecebido / totalGeralPrevisto) * 100)
                  : 0}
                %
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Proporção realizada no período</p>
            </CardContent>
          </Card>
        </div>

        {/* Abas de Navegação Financeira */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
          <button
            onClick={() => setTabAtiva('receber')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              tabAtiva === 'receber'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Contas a Receber ({titulosFiltrados.length})</span>
          </button>

          <button
            onClick={() => setTabAtiva('fluxo')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              tabAtiva === 'fluxo'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Fluxo Previsto vs. Realizado</span>
          </button>

          <button
            onClick={() => setTabAtiva('faturamento')}
            className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
              tabAtiva === 'faturamento'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Faturamento por Unidade / Profissional</span>
          </button>
        </div>

        {/* Filtros em Linha */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Buscar título por paciente ou descrição do lançamento..."
              className="pl-9 h-9 text-xs border-slate-200"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 text-xs w-36 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="aberto">Em Aberto</SelectItem>
                <SelectItem value="pago">Liquidado / Pago</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroPeriodo} onValueChange={(v: any) => setFiltroPeriodo(v)}>
              <SelectTrigger className="h-9 text-xs w-36 border-slate-200">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="proximos_30">Próximos 30 dias</SelectItem>
                <SelectItem value="todos">Todo o Período</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
              <SelectTrigger className="h-9 text-xs w-44 border-slate-200">
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
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        {tabAtiva === 'receber' && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Títulos a Receber da Clínica
                </CardTitle>
                <CardDescription className="text-xs">
                  Controle individual de parcelas, emissão Pix com QR Code e quitação com split de
                  pagamento
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">
                {titulosFiltrados.length} registro(s)
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Carregando financeiro...
                </div>
              ) : titulosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                  <div>Nenhum título financeiro encontrado para estes filtros.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Paciente</th>
                        <th className="py-3 px-4">Descrição do Título</th>
                        <th className="py-3 px-4">Profissional</th>
                        <th className="py-3 px-4">Vencimento</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações de Baixa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {titulosFiltrados.map((t) => {
                        const pacNome = t.expand?.paciente_id?.nome || 'Paciente Avulso'
                        const profNome = t.expand?.profissional_id?.nome || 'Corpo Clínico'

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              <Link
                                to={t.paciente_id ? `/pacientes/${t.paciente_id}` : '#'}
                                className="hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                              >
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span>{pacNome}</span>
                              </Link>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{t.descricao}</div>
                              {t.modalidades && t.modalidades.length > 0 && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Liquidado via:{' '}
                                  {t.modalidades
                                    .map((m) => `${m.modalidade.toUpperCase()} R$${m.valor}`)
                                    .join(' + ')}
                                </div>
                              )}
                              {t.comprovante_transacao && (
                                <div className="text-[9px] text-slate-400 font-mono">
                                  Ref: {t.comprovante_transacao}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-slate-600">{profNome}</td>

                            <td className="py-3 px-4 font-mono">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{t.vencimento}</span>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-bold text-slate-900 text-xs">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(t.valor)}
                            </td>

                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize font-semibold ${
                                  t.status === 'pago'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : t.status === 'aberto'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {t.status === 'pago' ? 'Liquidado' : t.status}
                              </Badge>
                              {t.data_pagamento && (
                                <div className="text-[9px] text-emerald-700 mt-0.5 font-medium">
                                  Pago em {t.data_pagamento.slice(0, 10)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {t.status !== 'pago' ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs flex items-center gap-1 text-[#0E7490] border-cyan-200 hover:bg-cyan-50"
                                      onClick={() => handleGerarPix(t)}
                                      title="Gerar Pix Copia e Cola / QR Code"
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                      <span>Pix</span>
                                    </Button>

                                    {podeDarBaixa ? (
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                                        onClick={() => abrirModalBaixa(t)}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Baixa (Split)</span>
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">
                                        Recepção (somente leitura)
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                                    <FileCheck2 className="w-3.5 h-3.5" />
                                    <span>Quitado</span>
                                  </div>
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
        )}

        {/* Aba: Fluxo Previsto vs Realizado */}
        {tabAtiva === 'fluxo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Comparativo de Fluxo de Caixa
                </CardTitle>
                <CardDescription className="text-xs">
                  Entradas confirmadas em caixa versus previsões de vencimento
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">Realizado (Recebido):</span>
                    <span className="font-bold text-emerald-700">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalRecebido)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalGeralPrevisto > 0
                            ? Math.min((totalRecebido / totalGeralPrevisto) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">A Receber (Projetado):</span>
                    <span className="font-bold text-amber-600">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(totalAberto)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          totalGeralPrevisto > 0
                            ? Math.min((totalAberto / totalGeralPrevisto) * 100, 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div>
                    <strong>Total Geral Carteira:</strong>{' '}
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      totalGeralPrevisto,
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Calculado sobre {titulosFiltrados.length} parcelas sob gestão neste filtro.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0E7490]" />
                  Modalidades de Pagamento Utilizadas
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição de liquidações por meio de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#0E7490]" />
                    <span className="font-semibold text-slate-800">Pix Instantâneo (RF-032)</span>
                  </div>
                  <span className="font-bold text-emerald-700 font-mono">Alta preferência</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    <span className="font-semibold text-slate-800">Cartão de Crédito / Débito</span>
                  </div>
                  <span className="font-bold text-slate-700 font-mono">
                    Com split e parcelamento
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-slate-800">Dinheiro / Espécie</span>
                  </div>
                  <span className="font-bold text-slate-700 font-mono">
                    Baixa imediata em balcão
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aba: Faturamento por Unidade / Profissional */}
        {tabAtiva === 'faturamento' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0E7490]" />
                  Faturamento por Profissional Clínico
                </CardTitle>
                <CardDescription className="text-xs">
                  Valores liquidados e a receber vinculados a cada dentista
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Profissional</th>
                      <th className="py-2.5 px-4 text-right">Liquidado</th>
                      <th className="py-2.5 px-4 text-right">A Receber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faturamentoPorProfissional.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.nome}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(item.pago)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(item.aberto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0E7490]" />
                  Faturamento por Unidade Operacional
                </CardTitle>
                <CardDescription className="text-xs">
                  Desempenho financeiro segregado pelas sedes da clínica
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Unidade</th>
                      <th className="py-2.5 px-4 text-right">Liquidado</th>
                      <th className="py-2.5 px-4 text-right">A Receber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {faturamentoPorUnidade.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.nome}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(item.pago)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(item.aberto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal Split de Pagamento (RF-031 / BL-009) */}
        <Dialog open={modalBaixaAberto} onOpenChange={setModalBaixaAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Baixa com Split de Pagamento (RF-031)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Divida a liquidação em diferentes modalidades simultâneas (Pix, Cartão, Dinheiro)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg text-slate-800 space-y-1 border border-slate-200">
                <div>
                  <strong>Título:</strong> {tituloSelecionado?.descricao}
                </div>
                <div>
                  <strong>Valor Total a Liquidar:</strong>{' '}
                  <span className="font-bold text-emerald-700">
                    R$ {tituloSelecionado?.valor?.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Formas de Pagamento (Split):</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddSplit}
                    className="h-6 text-[10px] text-[#0E7490] hover:text-[#155E75]"
                  >
                    + Adicionar Outra Forma
                  </Button>
                </div>

                {splitModalidades.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={item.modalidade}
                      onValueChange={(val: any) => {
                        const updated = [...splitModalidades]
                        updated[idx].modalidade = val
                        setSplitModalidades(updated)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix (Instantâneo)</SelectItem>
                        <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro (Espécie)</SelectItem>
                        <SelectItem value="boleto">Boleto Bancário</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      step="0.01"
                      value={item.valor}
                      onChange={(e) => {
                        const updated = [...splitModalidades]
                        updated[idx].valor = Number(e.target.value)
                        setSplitModalidades(updated)
                      }}
                      className="h-8 text-xs w-28 text-right font-mono"
                    />

                    {splitModalidades.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSplit(idx)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Comprovante / NSU / Código da Transação</Label>
                <Input
                  value={comprovanteTransacao}
                  onChange={(e) => setComprovanteTransacao(e.target.value)}
                  placeholder="ex: PIX-981240182 ou NSU Cartão"
                  className="h-8 text-xs"
                />
              </div>

              <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Soma das Formas:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    Math.abs(totalSplit - (tituloSelecionado?.valor || 0)) < 0.05
                      ? 'text-emerald-700'
                      : 'text-rose-600'
                  }`}
                >
                  R$ {totalSplit.toFixed(2)} / R$ {tituloSelecionado?.valor?.toFixed(2)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalBaixaAberto(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarBaixa}
                disabled={salvandoBaixa}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {salvandoBaixa ? 'Processando baixa...' : 'Confirmar Baixa Imediata'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Pix Dinâmico Simulado (RF-032 / BL-009) */}
        <Dialog open={modalPixAberto} onOpenChange={setModalPixAberto}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Pix com QR Code Dinâmico
              </DialogTitle>
              <DialogDescription className="text-xs">
                Apresente o QR Code ao paciente para pagamento imediato via app bancário
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="w-44 h-44 bg-white border-2 border-slate-900 rounded-xl mx-auto p-3 flex flex-col items-center justify-center shadow-xs">
                <QrCode className="w-36 h-36 text-slate-900" />
              </div>

              <div className="text-slate-800 font-bold text-sm">
                Valor:{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  tituloSelecionado?.valor || 0,
                )}
              </div>

              <div className="space-y-1 text-left">
                <Label className="text-[10px] text-slate-500 uppercase">Código Copia e Cola:</Label>
                <div className="p-2 bg-slate-100 rounded text-[10px] font-mono break-all select-all text-slate-600">
                  {pixPayload}
                </div>
              </div>

              <div className="p-2 bg-cyan-50 rounded border border-cyan-100 text-[11px] text-cyan-800">
                ⚡ Após a confirmação pelo banco (simulação de webhook), a baixa será computada em
                menos de 1 minuto (CA-Financeiro).
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  setModalPixAberto(false)
                  if (tituloSelecionado) abrirModalBaixa(tituloSelecionado)
                }}
                className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Simular Confirmação Bancária & Baixa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Novo Recebível Avulso */}
        <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Lançamento Financeiro Avulso
              </DialogTitle>
              <DialogDescription className="text-xs">
                Crie um título a receber direto no financeiro (consulta ou procedimento avulso)
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarLancamentoAvulso} className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Paciente *</Label>
                <Select value={novoPacienteId} onValueChange={setNovoPacienteId}>
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
                <Label className="text-xs">Profissional Clínico</Label>
                <Select value={novoProfissionalId} onValueChange={setNovoProfissionalId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Dentista responsável" />
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
                <Label className="text-xs">Descrição do Título *</Label>
                <Input
                  value={novoDescricao}
                  onChange={(e) => setNovoDescricao(e.target.value)}
                  placeholder="ex: Avaliação de Emergência ou Raio-X Avulso"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={novoValor}
                    onChange={(e) => setNovoValor(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Vencimento *</Label>
                  <Input
                    type="date"
                    value={novoVencimento}
                    onChange={(e) => setNovoVencimento(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNovoAberto(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  Criar Recebível
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}
