import React, { useCallback, useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { ModuloGate } from '@/components/ModuloGate'
import {
  CATEGORIAS_INSUMO,
  LABEL_CATEGORIA,
  LABEL_TIPO_MOV,
  carregarEstoque,
  podeGerenciarEstoque,
  situacaoValidade,
  type InsumoComSaldo,
} from '@/services/estoque'
import type {
  CategoriaInsumo,
  InsumoRecord,
  LoteEstoqueRecord,
  MovimentacaoEstoqueRecord,
  TipoMovimentacaoEstoque,
} from '@/types/gestec'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  Warehouse,
  History,
  ShieldAlert,
} from 'lucide-react'

type AbaId = 'insumos' | 'movimentacoes' | 'entradas' | 'consumo'

interface AgendamentoOption {
  id: string
  label: string
  pacienteId: string
  pacienteNome: string
}

const hojeIso = () => new Date().toISOString().slice(0, 10)

function fmtData(iso?: string): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR')
}

function fmtDataHora(iso?: string): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function EstoquePage() {
  const { user, tenant, perfil, selectedUnidade, selectedUnidadeId, unidades } = useAuth()

  // Se o seletor global estiver em "todas", pegamos a primeira unidade disponível ou vazia
  const unidadeAtivaId =
    selectedUnidadeId && selectedUnidadeId !== 'todas'
      ? selectedUnidadeId
      : unidades.length > 0
        ? unidades[0].id
        : ''

  const unidadeAtivaNome =
    selectedUnidade?.nome || unidades.find((u) => u.id === unidadeAtivaId)?.nome || 'Unidade Matriz'

  const podeGerenciar = podeGerenciarEstoque(perfil)
  const isRecepcao = perfil === 'recepcao'
  const podeConsumir = !isRecepcao

  const [aba, setAba] = useState<AbaId>('insumos')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [itens, setItens] = useState<InsumoComSaldo[]>([])
  const [movs, setMovs] = useState<MovimentacaoEstoqueRecord[]>([])
  const [agendamentos, setAgendamentos] = useState<AgendamentoOption[]>([])

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [filtroAlerta, setFiltroAlerta] = useState<'todos' | 'baixo' | 'validade'>('todos')
  const [filtroTipoMov, setFiltroTipoMov] = useState<string>('todos')

  // Modais
  const [modalInsumoOpen, setModalInsumoOpen] = useState(false)
  const [insumoEdicao, setInsumoEdicao] = useState<InsumoRecord | null>(null)
  const [formInsumo, setFormInsumo] = useState<{
    nome: string
    categoria: CategoriaInsumo
    unidade_medida: string
    estoque_minimo: number
    custo_referencia: number
    fornecedor: string
    ativo: boolean
  }>({
    nome: '',
    categoria: 'outros',
    unidade_medida: 'unidade',
    estoque_minimo: 5,
    custo_referencia: 0,
    fornecedor: '',
    ativo: true,
  })

  // Formulário de Entrada de Lote
  const [formEntrada, setFormEntrada] = useState<{
    insumo_id: string
    quantidade: number | ''
    custo_unitario: number | ''
    validade: string
    lote: string
    fabricante: string
    data_entrada: string
  }>({
    insumo_id: '',
    quantidade: '',
    custo_unitario: '',
    validade: '',
    lote: '',
    fabricante: '',
    data_entrada: hojeIso(),
  })

  // Formulário de Consumo Clínico / Perda / Ajuste
  const [formConsumo, setFormConsumo] = useState<{
    insumo_id: string
    tipo: TipoMovimentacaoEstoque
    quantidade: number | ''
    motivo: string
    atendimento_id: string
    profissional: string
  }>({
    insumo_id: '',
    tipo: 'consumo',
    quantidade: '',
    motivo: '',
    atendimento_id: '',
    profissional: user?.name || '',
  })

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!tenant?.id || !unidadeAtivaId) {
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      // 1. Insumos com saldo consolidado
      const listaComSaldo = await carregarEstoque(unidadeAtivaId)
      setItens(listaComSaldo)

      // 2. Movimentações recentes
      const movsRes = await pb
        .collection('movimentacoes_estoque')
        .getList<MovimentacaoEstoqueRecord>(1, 100, {
          filter: `unidade_id = '${unidadeAtivaId}'`,
          sort: '-created',
        })
      setMovs(movsRes.items)

      // 3. Agendamentos recentes da unidade para facilitar vinculação de consumo
      try {
        const agRes = await pb.collection('agendamentos').getList(1, 40, {
          filter: `unidade_id = '${unidadeAtivaId}'`,
          sort: '-data_inicio',
          expand: 'paciente_id',
        })
        const opts: AgendamentoOption[] = agRes.items.map((ag: any) => ({
          id: ag.id,
          label: `${fmtDataHora(ag.data_inicio)} — ${ag.expand?.paciente_id?.nome || 'Paciente'} (${ag.procedimento || 'Atendimento'})`,
          pacienteId: ag.paciente_id || '',
          pacienteNome: ag.expand?.paciente_id?.nome || '',
        }))
        setAgendamentos(opts)
      } catch (_) {
        setAgendamentos([])
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar estoque',
        description:
          getErrorMessage(err) || 'Não foi possível carregar os dados de estoque da unidade.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, unidadeAtivaId])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Métricas
  const metricas = useMemo(() => {
    let totalInsumos = itens.length
    let totalBaixo = 0
    let totalVencidosOuProximos = 0
    let valorTotalEstoque = 0

    for (const item of itens) {
      if (item.situacaoEstoque === 'baixo' || item.situacaoEstoque === 'sem_estoque') {
        totalBaixo++
      }
      if (item.piorValidade.status === 'vencido' || item.piorValidade.status === 'proximo') {
        totalVencidosOuProximos++
      }
      valorTotalEstoque += item.valorTotal || 0
    }

    return {
      totalInsumos,
      totalBaixo,
      totalVencidosOuProximos,
      valorTotalEstoque,
    }
  }, [itens])

  // Insumos filtrados
  const insumosFiltrados = useMemo(() => {
    return itens.filter((i) => {
      if (busca) {
        const termo = busca.toLowerCase()
        const nomeMatch = i.insumo.nome.toLowerCase().includes(termo)
        const fornMatch = (i.insumo.fornecedor || '').toLowerCase().includes(termo)
        if (!nomeMatch && !fornMatch) return false
      }
      if (filtroCategoria !== 'todas' && i.insumo.categoria !== filtroCategoria) {
        return false
      }
      if (filtroAlerta === 'baixo' && i.situacaoEstoque === 'ok') {
        return false
      }
      if (
        filtroAlerta === 'validade' &&
        i.piorValidade.status !== 'vencido' &&
        i.piorValidade.status !== 'proximo'
      ) {
        return false
      }
      return true
    })
  }, [itens, busca, filtroCategoria, filtroAlerta])

  // Movimentações filtradas
  const movimentacoesFiltradas = useMemo(() => {
    const mapaInsumo = new Map(itens.map((i) => [i.insumo.id, i.insumo]))
    return movs.filter((m) => {
      if (filtroTipoMov !== 'todos' && m.tipo !== filtroTipoMov) {
        return false
      }
      if (busca) {
        const termo = busca.toLowerCase()
        const ins = mapaInsumo.get(m.insumo_id)
        const nomeInsumo = ins ? ins.nome.toLowerCase() : ''
        const motivo = (m.motivo || '').toLowerCase()
        const prof = (m.profissional || '').toLowerCase()
        if (!nomeInsumo.includes(termo) && !motivo.includes(termo) && !prof.includes(termo)) {
          return false
        }
      }
      return true
    })
  }, [movs, filtroTipoMov, busca, itens])

  // Abrir modal de cadastro/edição de insumo
  const abrirModalInsumo = (insumo?: InsumoRecord) => {
    if (insumo) {
      setInsumoEdicao(insumo)
      setFormInsumo({
        nome: insumo.nome,
        categoria: insumo.categoria,
        unidade_medida: insumo.unidade_medida,
        estoque_minimo: Number(insumo.estoque_minimo) || 0,
        custo_referencia: Number(insumo.custo_referencia) || 0,
        fornecedor: insumo.fornecedor || '',
        ativo: insumo.ativo ?? true,
      })
    } else {
      setInsumoEdicao(null)
      setFormInsumo({
        nome: '',
        categoria: 'outros',
        unidade_medida: 'unidade',
        estoque_minimo: 5,
        custo_referencia: 0,
        fornecedor: '',
        ativo: true,
      })
    }
    setModalInsumoOpen(true)
  }

  // Salvar cadastro de insumo
  const salvarInsumo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formInsumo.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do insumo odontológico.',
        variant: 'destructive',
      })
      return
    }
    if (!tenant?.id || !unidadeAtivaId) return

    setSalvando(true)
    try {
      if (insumoEdicao) {
        await pb.collection('insumos').update(insumoEdicao.id, {
          nome: formInsumo.nome.trim(),
          categoria: formInsumo.categoria,
          unidade_medida: formInsumo.unidade_medida.trim(),
          estoque_minimo: Number(formInsumo.estoque_minimo) || 0,
          custo_referencia: Number(formInsumo.custo_referencia) || 0,
          fornecedor: formInsumo.fornecedor.trim(),
          ativo: formInsumo.ativo,
        })
        await registrarAuditoria({
          tenantId: tenant.id,
          userEmail: user?.email,
          perfil,
          acao: 'insumo_atualizado',
          detalhes: `Insumo atualizado: ${formInsumo.nome}`,
        })
        toast({
          title: 'Insumo atualizado!',
          description: `Os dados de "${formInsumo.nome}" foram atualizados com sucesso.`,
        })
      } else {
        await pb.collection('insumos').create({
          tenant_id: tenant.id,
          unidade_id: unidadeAtivaId,
          nome: formInsumo.nome.trim(),
          categoria: formInsumo.categoria,
          unidade_medida: formInsumo.unidade_medida.trim() || 'unidade',
          estoque_minimo: Number(formInsumo.estoque_minimo) || 0,
          custo_referencia: Number(formInsumo.custo_referencia) || 0,
          fornecedor: formInsumo.fornecedor.trim(),
          ativo: formInsumo.ativo,
        })
        await registrarAuditoria({
          tenantId: tenant.id,
          userEmail: user?.email,
          perfil,
          acao: 'insumo_cadastrado',
          detalhes: `Novo insumo cadastrado: ${formInsumo.nome}`,
        })
        toast({
          title: 'Insumo cadastrado!',
          description: `"${formInsumo.nome}" foi cadastrado no estoque da unidade.`,
        })
      }
      setModalInsumoOpen(false)
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar estoque',
        description:
          getErrorMessage(err) || 'Não foi possível carregar os dados de estoque da unidade.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Registrar Entrada de Lote
  const registrarEntrada = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEntrada.insumo_id) {
      toast({
        title: 'Insumo não selecionado',
        description: 'Selecione o insumo para dar entrada no lote.',
        variant: 'destructive',
      })
      return
    }
    const qtd = Number(formEntrada.quantidade)
    if (!qtd || qtd <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade de entrada deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }
    if (!tenant?.id || !unidadeAtivaId) return

    setSalvando(true)
    try {
      const insumo = itens.find((i) => i.insumo.id === formEntrada.insumo_id)?.insumo
      const custo =
        formEntrada.custo_unitario !== ''
          ? Number(formEntrada.custo_unitario)
          : Number(insumo?.custo_referencia) || 0

      // 1. Cria o lote
      const loteCriado = await pb.collection('lotes_estoque').create<LoteEstoqueRecord>({
        tenant_id: tenant.id,
        unidade_id: unidadeAtivaId,
        insumo_id: formEntrada.insumo_id,
        quantidade: qtd,
        custo_unitario: custo,
        validade: formEntrada.validade ? new Date(formEntrada.validade).toISOString() : '',
        lote: formEntrada.lote.trim(),
        fabricante: formEntrada.fabricante.trim() || insumo?.fornecedor || '',
        data_entrada: formEntrada.data_entrada
          ? new Date(formEntrada.data_entrada).toISOString()
          : new Date().toISOString(),
      })

      // 2. Cria a movimentação append-only de entrada
      await pb.collection('movimentacoes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeAtivaId,
        insumo_id: formEntrada.insumo_id,
        tipo: 'entrada',
        quantidade: qtd,
        motivo: `Entrada de lote ${formEntrada.lote ? `(${formEntrada.lote})` : ''}`,
        lote_id: loteCriado.id,
        profissional: user?.name || 'Gestor de Estoque',
      })

      await registrarAuditoria({
        tenantId: tenant.id,
        userEmail: user?.email,
        perfil,
        acao: 'estoque_entrada_lote',
        detalhes: `Entrada de ${qtd} un. de ${insumo?.nome || 'insumo'} (Lote ${formEntrada.lote || 'S/N'})`,
      })

      toast({
        title: 'Entrada registrada com sucesso!',
        description: `${qtd} ${insumo?.unidade_medida || 'un.'} de "${insumo?.nome}" adicionados ao estoque.`,
      })

      // Limpar form e mudar para a aba de insumos ou movimentações
      setFormEntrada({
        insumo_id: '',
        quantidade: '',
        custo_unitario: '',
        validade: '',
        lote: '',
        fabricante: '',
        data_entrada: hojeIso(),
      })
      await carregarDados()
      setAba('insumos')
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar insumo',
        description: getErrorMessage(err) || 'Não foi possível gravar o insumo.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Registrar Consumo / Perda / Ajuste
  const registrarConsumoAjuste = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formConsumo.insumo_id) {
      toast({
        title: 'Insumo não selecionado',
        description: 'Selecione o insumo para registrar a movimentação.',
        variant: 'destructive',
      })
      return
    }
    const qtd = Number(formConsumo.quantidade)
    if (
      isNaN(qtd) ||
      (formConsumo.tipo !== 'ajuste' && qtd <= 0) ||
      (formConsumo.tipo === 'ajuste' && qtd < 0)
    ) {
      toast({
        title: 'Quantidade inválida',
        description:
          formConsumo.tipo === 'ajuste'
            ? 'Informe o saldo final apurado (zero ou positivo).'
            : 'A quantidade deve ser maior que zero.',
        variant: 'destructive',
      })
      return
    }

    const insumoComSaldo = itens.find((i) => i.insumo.id === formConsumo.insumo_id)
    const saldoAtual = insumoComSaldo?.saldo || 0

    // Validação preventiva no frontend: consumo ou perda acima do saldo é bloqueado com mensagem clara
    if ((formConsumo.tipo === 'consumo' || formConsumo.tipo === 'perda') && qtd > saldoAtual) {
      toast({
        title: 'Saldo insuficiente',
        description: `Não é possível registrar saída de ${qtd} ${insumoComSaldo?.insumo.unidade_medida || 'un.'}. Saldo atual disponível: ${saldoAtual}.`,
        variant: 'destructive',
      })
      return
    }

    // Motivo obrigatório em consumo manual, perda e ajuste
    if (!formConsumo.motivo.trim() && !formConsumo.atendimento_id) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo ou vincule a um atendimento clínico.',
        variant: 'destructive',
      })
      return
    }

    if (!tenant?.id || !unidadeAtivaId) return

    setSalvando(true)
    try {
      const agSel = agendamentos.find((a) => a.id === formConsumo.atendimento_id)

      await pb.collection('movimentacoes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeAtivaId,
        insumo_id: formConsumo.insumo_id,
        tipo: formConsumo.tipo,
        quantidade: qtd,
        motivo:
          formConsumo.motivo.trim() || `Consumo em atendimento (${agSel?.label || 'Clínico'})`,
        atendimento_id: formConsumo.atendimento_id || '',
        paciente_id: agSel?.pacienteId || '',
        profissional: formConsumo.profissional.trim() || user?.name || 'Profissional',
      })

      await registrarAuditoria({
        tenantId: tenant.id,
        userEmail: user?.email,
        perfil,
        acao: `estoque_${formConsumo.tipo}`,
        detalhes: `${formConsumo.tipo.toUpperCase()} de ${qtd} un. do insumo ${insumoComSaldo?.insumo.nome || ''}`,
      })

      toast({
        title:
          formConsumo.tipo === 'consumo'
            ? 'Consumo registrado!'
            : formConsumo.tipo === 'perda'
              ? 'Perda registrada!'
              : 'Saldo ajustado!',
        description: `Movimentação registrada com sucesso no estoque da unidade.`,
      })

      setFormConsumo({
        insumo_id: '',
        tipo: 'consumo',
        quantidade: '',
        motivo: '',
        atendimento_id: '',
        profissional: user?.name || '',
      })
      await carregarDados()
      setAba('insumos')
    } catch (err: any) {
      toast({
        title: 'Erro ao registrar entrada',
        description: getErrorMessage(err) || 'Falha ao registrar lote e movimentação de entrada.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Helper para pré-selecionar insumo ao clicar em "Registrar Entrada" ou "Consumir" na tabela
  const prepararEntradaInsumo = (insumoId: string) => {
    setFormEntrada((prev) => ({ ...prev, insumo_id: insumoId }))
    setAba('entradas')
  }

  const prepararConsumoInsumo = (insumoId: string) => {
    setFormConsumo((prev) => ({ ...prev, insumo_id: insumoId, tipo: 'consumo' }))
    setAba('consumo')
  }

  return (
    <ModuloGate
      modulo="estoque"
      fallbackTitle="Controle de Estoque & Insumos — Plano Pro"
      fallbackDescription="Gerencie entradas de lotes com validade, consumo clínico por atendimento, alertas de estoque baixo e apuração de custos em conformidade com o BL-025."
    >
      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Cabeçalho da página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Warehouse className="w-7 h-7 text-[#0E7490]" />
                Controle de Estoque & Insumos
              </h1>
              <Badge
                variant="outline"
                className="text-xs border-cyan-300 bg-cyan-50 text-[#0E7490]"
              >
                {unidadeAtivaNome}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Rastreamento de insumos, entradas de lotes com validade e consumo clínico append-only
              (BL-025).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={carregarDados}
              disabled={carregando}
              className="text-slate-600 gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {podeGerenciar && (
              <Button
                onClick={() => abrirModalInsumo()}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Novo Insumo
              </Button>
            )}
          </div>
        </div>

        {/* Banner de permissão quando recepção visualiza */}
        {isRecepcao && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Perfil <strong>Recepção</strong>: modo somente-leitura. Entradas de lotes, ajustes e
              registros de consumo são restritos a gestores e profissionais clínicos.
            </span>
          </div>
        )}

        {/* Cards de Métricas / Alertas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Insumos Ativos
              </CardTitle>
              <Package className="w-4 h-4 text-cyan-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">{metricas.totalInsumos}</div>
              <p className="text-xs text-slate-500 mt-1">Cadastrados nesta unidade</p>
            </CardContent>
          </Card>

          <Card
            className={`shadow-sm cursor-pointer transition-all ${
              filtroAlerta === 'baixo' ? 'ring-2 ring-amber-500 bg-amber-50/30' : 'border-slate-200'
            }`}
            onClick={() => setFiltroAlerta(filtroAlerta === 'baixo' ? 'todos' : 'baixo')}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                Estoque Baixo
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-amber-700">{metricas.totalBaixo}</div>
              <p className="text-xs text-slate-500 mt-1">
                {metricas.totalBaixo > 0
                  ? 'Insumos abaixo do estoque mínimo'
                  : 'Nenhum insumo em nível crítico'}
              </p>
            </CardContent>
          </Card>

          <Card
            className={`shadow-sm cursor-pointer transition-all ${
              filtroAlerta === 'validade' ? 'ring-2 ring-red-500 bg-red-50/30' : 'border-slate-200'
            }`}
            onClick={() => setFiltroAlerta(filtroAlerta === 'validade' ? 'todos' : 'validade')}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-red-700 uppercase tracking-wider">
                Alerta de Validade
              </CardTitle>
              <CalendarClock className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-red-700">
                {metricas.totalVencidosOuProximos}
              </div>
              <p className="text-xs text-slate-500 mt-1">Lotes vencidos ou em até 30 dias</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Valor em Estoque
              </CardTitle>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">
                {podeGerenciar ? fmtMoney(metricas.valorTotalEstoque) : '••••••'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {podeGerenciar ? 'Custo total acumulado dos lotes' : 'Visível apenas para gestores'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Abas Principais */}
        <Tabs value={aba} onValueChange={(v) => setAba(v as AbaId)} className="space-y-4">
          <TabsList className="bg-slate-100 p-1 border border-slate-200">
            <TabsTrigger value="insumos" className="gap-2">
              <Package className="w-4 h-4" />
              <span>Insumos</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {itens.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="movimentacoes" className="gap-2">
              <History className="w-4 h-4" />
              <span>Movimentações</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {movs.length}
              </Badge>
            </TabsTrigger>

            {podeGerenciar && (
              <TabsTrigger value="entradas" className="gap-2">
                <PackagePlus className="w-4 h-4" />
                <span>Entrada de Lote</span>
              </TabsTrigger>
            )}

            {podeConsumir && (
              <TabsTrigger value="consumo" className="gap-2">
                <TrendingDown className="w-4 h-4" />
                <span>Consumo / Ajuste</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ================================================================ */}
          {/* ABA 1: INSUMOS                                                   */}
          {/* ================================================================ */}
          <TabsContent value="insumos" className="space-y-4">
            {/* Filtros da tabela */}
            <Card className="border-slate-200">
              <CardContent className="p-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <Input
                      placeholder="Buscar por insumo ou fornecedor..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas Categorias</SelectItem>
                        {CATEGORIAS_INSUMO.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {LABEL_CATEGORIA[cat] || cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filtroAlerta}
                      onValueChange={(v) => setFiltroAlerta(v as 'todos' | 'baixo' | 'validade')}
                    >
                      <SelectTrigger className="w-full md:w-[170px]">
                        <SelectValue placeholder="Alertas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos Status</SelectItem>
                        <SelectItem value="baixo">Apenas Estoque Baixo</SelectItem>
                        <SelectItem value="validade">Validade Próxima/Vencida</SelectItem>
                      </SelectContent>
                    </Select>

                    {(busca || filtroCategoria !== 'todas' || filtroAlerta !== 'todos') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBusca('')
                          setFiltroCategoria('todas')
                          setFiltroAlerta('todos')
                        }}
                        className="text-xs text-slate-500"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Listagem em Tabela */}
            <Card className="border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Insumo</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3 text-right">Saldo Atual</th>
                      <th className="px-4 py-3 text-right">Mínimo</th>
                      <th className="px-4 py-3">Validade</th>
                      {podeGerenciar && <th className="px-4 py-3 text-right">Custo Total</th>}
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {carregando ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-cyan-600" />
                          Carregando estoque da unidade...
                        </td>
                      </tr>
                    ) : insumosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Nenhum insumo encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      insumosFiltrados.map((item) => {
                        const { insumo, saldo, valorTotal, situacaoEstoque, piorValidade } = item
                        const minimo = Number(insumo.estoque_minimo) || 0

                        return (
                          <tr key={insumo.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{insumo.nome}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{insumo.fornecedor || 'Sem fornecedor'}</span>
                                {!insumo.ativo && (
                                  <Badge variant="outline" className="text-[10px] text-slate-400">
                                    Inativo
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="text-xs capitalize border-slate-300"
                              >
                                {LABEL_CATEGORIA[insumo.categoria] || insumo.categoria}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-bold text-slate-900">
                                {saldo}{' '}
                                <span className="text-xs font-normal text-slate-500">
                                  {insumo.unidade_medida}
                                </span>
                              </div>
                              {situacaoEstoque === 'sem_estoque' && (
                                <Badge variant="destructive" className="text-[10px] mt-0.5">
                                  Sem Estoque
                                </Badge>
                              )}
                              {situacaoEstoque === 'baixo' && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] mt-0.5">
                                  Estoque Baixo
                                </Badge>
                              )}
                              {situacaoEstoque === 'ok' && (
                                <span className="text-[10px] text-emerald-600 flex items-center justify-end gap-1 mt-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> Normal
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {minimo}{' '}
                              <span className="text-xs text-slate-400">
                                {insumo.unidade_medida}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {piorValidade.status === 'vencido' && (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Vencido ({Math.abs(piorValidade.diasRestantes || 0)}d atrás)
                                </Badge>
                              )}
                              {piorValidade.status === 'proximo' && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 text-xs gap-1">
                                  <CalendarClock className="w-3 h-3" />
                                  Vence em {piorValidade.diasRestantes}d
                                </Badge>
                              )}
                              {piorValidade.status === 'ok' && (
                                <span className="text-xs text-slate-600">
                                  Validade OK ({piorValidade.diasRestantes}d)
                                </span>
                              )}
                              {piorValidade.status === 'sem_validade' && (
                                <span className="text-xs text-slate-400">
                                  Sem lotes cadastrados
                                </span>
                              )}
                            </td>
                            {podeGerenciar && (
                              <td className="px-4 py-3 text-right font-medium text-slate-800">
                                {fmtMoney(valorTotal)}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {podeConsumir && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => prepararConsumoInsumo(insumo.id)}
                                    className="h-8 text-xs text-slate-700"
                                    title="Registrar consumo ou ajuste"
                                  >
                                    Consumo
                                  </Button>
                                )}
                                {podeGerenciar && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => prepararEntradaInsumo(insumo.id)}
                                      className="h-8 text-xs text-[#0E7490] border-cyan-300 hover:bg-cyan-50"
                                      title="Dar entrada de lote"
                                    >
                                      + Lote
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => abrirModalInsumo(insumo)}
                                      className="h-8 text-xs text-slate-500 hover:text-slate-800"
                                    >
                                      Editar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* ABA 2: MOVIMENTAÇÕES (APPEND-ONLY)                               */}
          {/* ================================================================ */}
          <TabsContent value="movimentacoes" className="space-y-4">
            <Card className="border-slate-200">
              <CardContent className="p-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <Input
                      placeholder="Buscar por motivo, profissional ou insumo..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={filtroTipoMov} onValueChange={setFiltroTipoMov}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Tipo de Movimentação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Tipos</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="consumo">Consumos</SelectItem>
                      <SelectItem value="ajuste">Ajustes</SelectItem>
                      <SelectItem value="perda">Perdas/Vencimentos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Data/Hora</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Insumo</th>
                      <th className="px-4 py-3 text-right">Quantidade</th>
                      <th className="px-4 py-3">Motivo / Detalhes</th>
                      <th className="px-4 py-3">Profissional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {carregando ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          <RefreshCw className="w-5 h-5 animate-spin inline mr-2 text-cyan-600" />
                          Carregando histórico...
                        </td>
                      </tr>
                    ) : movimentacoesFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma movimentação registrada nesta unidade.
                        </td>
                      </tr>
                    ) : (
                      movimentacoesFiltradas.map((m) => {
                        const insumo = itens.find((i) => i.insumo.id === m.insumo_id)?.insumo
                        const tipoBadge =
                          m.tipo === 'entrada'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : m.tipo === 'consumo'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : m.tipo === 'perda'
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-purple-50 text-purple-700 border-purple-300'

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {fmtDataHora(m.created)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant="outline" className={tipoBadge}>
                                {LABEL_TIPO_MOV[m.tipo] || m.tipo}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {insumo?.nome || 'Insumo (' + m.insumo_id + ')'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                              {m.tipo === 'entrada'
                                ? '+'
                                : m.tipo === 'consumo' || m.tipo === 'perda'
                                  ? '-'
                                  : '='}{' '}
                              {m.quantidade} {insumo?.unidade_medida || 'un.'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>{m.motivo || '—'}</div>
                              {m.atendimento_id && (
                                <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                                  Atendimento: {m.atendimento_id}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {m.profissional || 'Sistema'}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ================================================================ */}
          {/* ABA 3: ENTRADA DE LOTE                                           */}
          {/* ================================================================ */}
          {podeGerenciar && (
            <TabsContent value="entradas">
              <Card className="max-w-2xl border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-[#0E7490]" />
                    Registrar Entrada de Lote
                  </CardTitle>
                  <CardDescription>
                    Adicione um lote recebido de fornecedor com rastreio de validade e custo
                    unitário. O saldo do insumo na unidade é atualizado automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={registrarEntrada} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ent-insumo">Insumo Odontológico *</Label>
                      <Select
                        value={formEntrada.insumo_id}
                        onValueChange={(val) => {
                          const ins = itens.find((i) => i.insumo.id === val)?.insumo
                          setFormEntrada((prev) => ({
                            ...prev,
                            insumo_id: val,
                            custo_unitario: ins?.custo_referencia || prev.custo_unitario,
                            fabricante: ins?.fornecedor || prev.fabricante,
                          }))
                        }}
                      >
                        <SelectTrigger id="ent-insumo">
                          <SelectValue placeholder="Selecione o insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {itens.map((item) => (
                            <SelectItem key={item.insumo.id} value={item.insumo.id}>
                              {item.insumo.nome} (Saldo atual: {item.saldo}{' '}
                              {item.insumo.unidade_medida})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ent-qtd">Quantidade Recebida *</Label>
                        <Input
                          id="ent-qtd"
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="Ex.: 10"
                          value={formEntrada.quantidade}
                          onChange={(e) =>
                            setFormEntrada({
                              ...formEntrada,
                              quantidade: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="ent-custo">Custo Unitário (R$)</Label>
                        <Input
                          id="ent-custo"
                          type="number"
                          step="0.01"
                          placeholder="Ex.: 89.90"
                          value={formEntrada.custo_unitario}
                          onChange={(e) =>
                            setFormEntrada({
                              ...formEntrada,
                              custo_unitario: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ent-lote">Número do Lote</Label>
                        <Input
                          id="ent-lote"
                          placeholder="Ex.: L84920"
                          value={formEntrada.lote}
                          onChange={(e) => setFormEntrada({ ...formEntrada, lote: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="ent-validade">Data de Validade</Label>
                        <Input
                          id="ent-validade"
                          type="date"
                          value={formEntrada.validade}
                          onChange={(e) =>
                            setFormEntrada({ ...formEntrada, validade: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ent-fab">Fabricante / Fornecedor</Label>
                        <Input
                          id="ent-fab"
                          placeholder="Ex.: Dentsply, 3M, Dental Cremer"
                          value={formEntrada.fabricante}
                          onChange={(e) =>
                            setFormEntrada({ ...formEntrada, fabricante: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="ent-data">Data de Entrada</Label>
                        <Input
                          id="ent-data"
                          type="date"
                          value={formEntrada.data_entrada}
                          onChange={(e) =>
                            setFormEntrada({ ...formEntrada, data_entrada: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAba('insumos')}
                        disabled={salvando}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={salvando}
                        className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                      >
                        {salvando ? 'Registrando...' : 'Confirmar Entrada'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ================================================================ */}
          {/* ABA 4: CONSUMO / PERDA / AJUSTE                                  */}
          {/* ================================================================ */}
          {podeConsumir && (
            <TabsContent value="consumo">
              <Card className="max-w-2xl border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-blue-600" />
                    Registrar Consumo ou Ajuste
                  </CardTitle>
                  <CardDescription>
                    Dentistas e ASBs podem registrar consumo clínico vinculado a atendimento.
                    Gestores também podem registrar perdas por vencimento e ajustes de inventário.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={registrarConsumoAjuste} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cons-tipo">Tipo de Operação *</Label>
                        <Select
                          value={formConsumo.tipo}
                          onValueChange={(val) =>
                            setFormConsumo((prev) => ({
                              ...prev,
                              tipo: val as TipoMovimentacaoEstoque,
                            }))
                          }
                        >
                          <SelectTrigger id="cons-tipo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consumo">Consumo Clínico / Uso</SelectItem>
                            {podeGerenciar && (
                              <SelectItem value="perda">Perda / Descarte / Vencido</SelectItem>
                            )}
                            {podeGerenciar && (
                              <SelectItem value="ajuste">Ajuste de Inventário (Balanço)</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cons-insumo">Insumo *</Label>
                        <Select
                          value={formConsumo.insumo_id}
                          onValueChange={(val) =>
                            setFormConsumo((prev) => ({ ...prev, insumo_id: val }))
                          }
                        >
                          <SelectTrigger id="cons-insumo">
                            <SelectValue placeholder="Selecione o insumo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {itens.map((item) => (
                              <SelectItem key={item.insumo.id} value={item.insumo.id}>
                                {item.insumo.nome} (Saldo atual: {item.saldo}{' '}
                                {item.insumo.unidade_medida})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formConsumo.insumo_id && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                        <span className="text-slate-600">Saldo atual disponível:</span>
                        <span className="font-bold text-slate-900">
                          {itens.find((i) => i.insumo.id === formConsumo.insumo_id)?.saldo || 0}{' '}
                          {
                            itens.find((i) => i.insumo.id === formConsumo.insumo_id)?.insumo
                              .unidade_medida
                          }
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="cons-qtd">
                          {formConsumo.tipo === 'ajuste' ? 'Saldo Final Apurado *' : 'Quantidade *'}
                        </Label>
                        <Input
                          id="cons-qtd"
                          type="number"
                          step="any"
                          min={formConsumo.tipo === 'ajuste' ? '0' : '0.01'}
                          placeholder={
                            formConsumo.tipo === 'ajuste' ? 'Novo saldo total' : 'Ex.: 2'
                          }
                          value={formConsumo.quantidade}
                          onChange={(e) =>
                            setFormConsumo({
                              ...formConsumo,
                              quantidade: e.target.value === '' ? '' : Number(e.target.value),
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="cons-prof">Profissional Responsável</Label>
                        <Input
                          id="cons-prof"
                          placeholder="Nome do profissional"
                          value={formConsumo.profissional}
                          onChange={(e) =>
                            setFormConsumo({ ...formConsumo, profissional: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {formConsumo.tipo === 'consumo' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="cons-atend">
                          Vincular a Atendimento Clínico (Opcional)
                        </Label>
                        <Select
                          value={formConsumo.atendimento_id}
                          onValueChange={(val) =>
                            setFormConsumo((prev) => ({ ...prev, atendimento_id: val }))
                          }
                        >
                          <SelectTrigger id="cons-atend">
                            <SelectValue placeholder="Selecione um atendimento recente..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Nenhum vínculo (Consumo Geral)</SelectItem>
                            {agendamentos.map((ag) => (
                              <SelectItem key={ag.id} value={ag.id}>
                                {ag.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="cons-motivo">
                        Motivo / Justificativa{' '}
                        {formConsumo.tipo !== 'consumo' || !formConsumo.atendimento_id ? '*' : ''}
                      </Label>
                      <Textarea
                        id="cons-motivo"
                        rows={3}
                        placeholder={
                          formConsumo.tipo === 'consumo'
                            ? 'Ex.: Utilizado em restauração classe II (dente 36)'
                            : formConsumo.tipo === 'perda'
                              ? 'Ex.: Caixa caiu no chão / Material venceu sem uso'
                              : 'Ex.: Contagem física de balanço trimestral'
                        }
                        value={formConsumo.motivo}
                        onChange={(e) => setFormConsumo({ ...formConsumo, motivo: e.target.value })}
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setAba('insumos')}
                        disabled={salvando}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={salvando}
                        className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                      >
                        {salvando ? 'Processando...' : 'Confirmar Registro'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Modal de Cadastro / Edição de Insumo */}
        <Dialog open={modalInsumoOpen} onOpenChange={setModalInsumoOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {insumoEdicao ? `Editar: ${insumoEdicao.nome}` : 'Novo Insumo Odontológico'}
              </DialogTitle>
              <DialogDescription>
                Cadastre o insumo com estoque mínimo para alertas automáticos no painel.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={salvarInsumo} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ins-nome">Nome do Insumo *</Label>
                <Input
                  id="ins-nome"
                  placeholder="Ex.: Resina Composta Z350 XT A2"
                  value={formInsumo.nome}
                  onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ins-cat">Categoria *</Label>
                  <Select
                    value={formInsumo.categoria}
                    onValueChange={(val) =>
                      setFormInsumo({ ...formInsumo, categoria: val as CategoriaInsumo })
                    }
                  >
                    <SelectTrigger id="ins-cat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_INSUMO.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {LABEL_CATEGORIA[cat] || cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ins-un">Unidade de Medida *</Label>
                  <Input
                    id="ins-un"
                    placeholder="Ex.: caixa, seringa, frasco, pacote"
                    value={formInsumo.unidade_medida}
                    onChange={(e) =>
                      setFormInsumo({ ...formInsumo, unidade_medida: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ins-min">Estoque Mínimo (Alerta)</Label>
                  <Input
                    id="ins-min"
                    type="number"
                    min="0"
                    value={formInsumo.estoque_minimo}
                    onChange={(e) =>
                      setFormInsumo({ ...formInsumo, estoque_minimo: Number(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ins-custo">Custo de Referência (R$)</Label>
                  <Input
                    id="ins-custo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formInsumo.custo_referencia}
                    onChange={(e) =>
                      setFormInsumo({
                        ...formInsumo,
                        custo_referencia: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ins-forn">Fornecedor Preferencial</Label>
                <Input
                  id="ins-forn"
                  placeholder="Ex.: Dental Vip, MedSupply"
                  value={formInsumo.fornecedor}
                  onChange={(e) => setFormInsumo({ ...formInsumo, fornecedor: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label htmlFor="ins-ativo" className="text-sm font-medium">
                    Insumo Ativo
                  </Label>
                  <p className="text-xs text-slate-500">
                    Insumos inativos não aparecem para novos consumos
                  </p>
                </div>
                <Switch
                  id="ins-ativo"
                  checked={formInsumo.ativo}
                  onCheckedChange={(checked) => setFormInsumo({ ...formInsumo, ativo: checked })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalInsumoOpen(false)}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvando}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white"
                >
                  {salvando
                    ? 'Salvando...'
                    : insumoEdicao
                      ? 'Salvar Alterações'
                      : 'Cadastrar Insumo'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}

export default EstoquePage
