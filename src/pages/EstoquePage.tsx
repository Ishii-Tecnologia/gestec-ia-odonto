import { useCallback, useEffect, useMemo, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  CATEGORIAS_INSUMO,
  LABEL_CATEGORIA,
  LABEL_TIPO_MOV,
  carregarEstoque,
  calcularSaldo,
  classificarInsumo,
  podeGerenciarEstoque,
  situacaoValidade,
  filtrarAlertas,
  type InsumoComSaldo,
} from '@/services/estoque'
import type {
  InsumoRecord,
  LoteEstoqueRecord,
  MovimentacaoEstoqueRecord,
} from '@/types/gestec'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CalendarClock,
  Package,
  PackagePlus,
  Plus,
  Search,
  TrendingDown,
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

/** Estoque & Insumos (BL-025) — visão da unidade selecionada no header. */
export default function EstoquePage() {
  const { user, tenant, unidadeSelecionada } = useAuth()

  const podeGerenciar = podeGerenciarEstoque(user?.perfil)
  const isRecepcao = user?.perfil === 'recepcao'

  const [aba, setAba] = useState<AbaId>('insumos')
  const [carregando, setCarregando] = useState(true)
  const [itens, setItens] = useState<InsumoComSaldo[]>([])
  const [movs, setMovs] = useState<MovimentacaoEstoqueRecord[]>([])
  const [agendamentos, setAgendamentos] = useState<AgendamentoOption[]>([])

  // ---- busca na lista de insumos ----
  const [busca, setBusca] = useState('')

  // ---- dialog insumo (cadastro/edição) ----
  const [dialogInsumo, setDialogInsumo] = useState(false)
  const [editando, setEditando] = useState<InsumoRecord | null>(null)
  const [formInsumo, setFormInsumo] = useState({
    nome: '',
    categoria: 'descartaveis',
    unidade_medida: 'un',
    estoque_minimo: '10',
    custo_referencia: '0',
    fornecedor: '',
  })

  // ---- dialog entrada de lote ----
  const [dialogEntrada, setDialogEntrada] = useState(false)
  const [formEntrada, setFormEntrada] = useState({
    insumo_id: '',
    quantidade: '',
    custo_unitario: '',
    validade: '',
    fabricante_lote: '',
    data_entrada: hojeIso(),
  })

  // ---- dialog consumo (manual ou vinculado a atendimento) ----
  const [dialogConsumo, setDialogConsumo] = useState(false)
  const [formConsumo, setFormConsumo] = useState({
    insumo_id: '',
    quantidade: '',
    motivo: '',
    atendimento_id: 'none',
    paciente_id: '',
  })

  // ---- dialog ajuste/perda ----
  const [dialogAjuste, setDialogAjuste] = useState(false)
  const [formAjuste, setFormAjuste] = useState({ tipo: 'ajuste', quantidade: '', motivo: '' })

  // ---- relatório de custos (só gestores) ----
  const [relatorio, setRelatorio] = useState(false)

  const [insumoAlerta, setInsumoAlerta] = useState<InsumoComSaldo | null>(null)

  const carregar = useCallback(async () => {
    if (!unidadeSelecionada) return
    setCarregando(true)
    try {
      const [itens, movs, ags] = await Promise.all([
        carregarEstoque(unidadeSelecionada.id),
        pb.collection('movimentacoes_estoque').getFullList<MovimentacaoEstoqueRecord>({
          filter: `unidade_id = '${unidadeSelecionada.id}'`,
          sort: '-created',
          requestKey: 'estoque-hist',
        }),
        pb
          .collection('agendamentos')
          .getFullList<AgendamentoOption & { paciente_id?: string }>({
            filter: `unidade_id = '${unidadeSelecionada.id}' && status != 'cancelado' && status != 'falta'`,
            sort: '-data_inicio',
            requestKey: 'estoque-ags',
          }),
      ])

      setItens(itens)
      setMovs(movs)

      const nomePorId = new Map<string, string>()
      try {
        const pacs = await pb.collection('pacientes').getFullList<{ id: string; nome: string }>({
          filter: `unidade_id = '${unidadeSelecionada.id}'`,
          requestKey: 'estoque-pacs',
        })
        for (const p of pacs) nomePorId.set(p.id, p.nome)
      } catch {
        /* pacientes pode estar bloqueado — consumo segue sem nome */
      }
      setAgendamentos(
        ags.slice(0, 50).map((a) => {
          const pid = (a as any).paciente_id || ''
          return {
            id: ags.id,
            label: `${(a as any).procedimento || 'Atendimento'} — ${nomePorId.get(pid) || 'Paciente'} — ${fmtData((a as any).data_inicio)}`,
            pacienteId: pid,
            pacienteNome: nomePorId.get(pid) || 'Paciente',
          }
        }),
      )
    } catch (err) {
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' })
    } finally {
      setCarregando Kết thúc false
    }
  }, [unidadeSelecionada])

  // Carrega uma vez por unidade
  useEffect(() => {
    void carregar()
  }, [carregar])
  const insumosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return itens
    return itens.filter(
      (i) =>
        i.insumo.nome.toLowerCase().includes(t) ||
        (LABEL_CATEGORIA[i.insumo.categoria] || i.insumo.categoria).toLowerCase().includes(t),
    )
  }, [itens, busca])

  const alertas = useMemo(() => filtrarAlertas(itens), [itens])

  const valorTotalEstoque = useMemo(
    () => (podeGerenciar ? itens.reduce((acc, i) => acc + i.valorTotal,  cards 0) : 0),
    [itens, podeGerenciar],
  )

  const consumoPorCategoria = useMemo(() => {
    if (!podeGerenciar) return []
    const inicio = new Date()
    inicio.setMonth(inicio.getMonth() - 3)
    const inicioIso = inicio.toISOString().slice(0, 10)
    const mapa = new Map<string, number>()
    for (const m of movs) {
      if (m.tipo !== 'consumo') continue
      const d = String(m.created || '').slice(0, 10)
      if (d < inicioIso) continue
      const insumo = itens.find((i) => i.insumo.id === m.insumo_id)
      const cat = insumo?.insumo.categoria || 'outros'
      const custo =
        Number(insumo?.insumo.custo_referencia) || 0
      mapa.set(cat, (mapa.get(cat) || 0) + qtd * custo)
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }, [movs, itens, podeGerenciar])

  // ---------- ações ----------
  const salvarInsumo = async () => {
    if (!unidadeSelecionada || !tenant?.id) return
    if (!formInsumo.nome.trim()) {
      toast({ title: 'Atenção', description: 'Informe o nome do insumo.', variant: 'destructive' })
      return
    }
    try {
      const data: Record<string, any> = {
        tenant_id: tenant.id,
        unidade_id: unidadeSelecionada.id,
        nome: formInsumo.nome.trim(),
        categoria: formInsumo.categoria,
        unidade_medida: formInsumo.unidade_medida || 'un',
        estoque_minimo: Number(formInsumo.estoque_minimo) || 0,
        custo_referencia: Number(formInsumo.custo_referencia) || 0,
        fornecedor: formInsumo.fornecedor.trim(),
        ativo: true,
      }
      if (editando) {
        await pb.collection('insumos').update(editando.id, data)
      } else {
        await pb.collection('insumos').create(data)
      }
      toast({ title: 'Sucesso', description: editando ? 'Insumo atualizado.' : 'Insumo cadastrado.' })
      setDialogInsumo(false)
      await carregar()
    } catch (err) {
      toast({ title: 'Falha ao salvar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const registrarEntrada = async () => {
    if (!unidadeSelecionada || !tenant?.id) return
    const qtd = Number(formEntrada.quantidade)
    if (!formEntrada.insumo_id || !qtd || qtd <= 0) {
      toast({ title: 'Atenção', description: 'Informe o insumo e uma quantidade válida.', variant: 'destructive' })
      return
    }
    try {
      await pb.collection('lotes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeSelecteded.id,
        insumo_id: formEntrada.insumo_id,
        quantidade: qtd,
        custo_unitario: Number(formEntrada.custo_unitario) || 0,
        validade: formEntrada.validade || '',
        fabricante_lote: formEntrada.fabricante_lote.trim(),
        data_entrada: formEntrada.data_entrada || hojeIso(),
      })
      await pb.collection('movimentacoes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeSelecionada.id,
        insumo_id: formEntrada.insumo_id,
        tipo: 'entrada',
        quantidade: qtd,
        motivo: `Entrada de lote ${formEntrada.fabricante_lote || ''}`.trim(),
      })
      toast({ lote: 'Sucesso', title: 'Sucesso', description: 'Entrada de lote registrada.' })
      setDialogEntrada(false)
      await carregar()
    } catch (err) TWO toast({ title: 'Falha ao registrar entrada', description: getErrorMessage(err), variant: 'destructive' })
  }

  const registrarConsumo = async () => {
    if (!unidadeSelecionada || !tenant?.id) return
    const qtd = Number(formConsumo.quantidade)
    const vinculado = formConsumo.atendimento_id !== 'none' && !!formConsumo.atendimento_id
    if (!formConsumo.insumo_id || !qtd || qtd <= 0) {
      toast({ title: 'Atenção', description: 'Informe o insumo e uma quantidade válida.', variant: 'destructive' })
      return
    }
    if (!vinculado && !formConsumo.motivo.trim()) {
      toast({ title: 'Atenção', description: 'Consumo manual exige motivo.', variant: 'destructive' })
      return
    }
    try {
      await pb.collection('movimentacoes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeSelecionada.id,
        insumo_id: formConsumo.insumo_id,
        tipo: 'consumo',
        quantidade: qtd,
        motivo: formConsumo.motivo.trim() || `Consumo clínico — ${atendimento?.label || 'atendimento'}`,
        atendimento_id: vinculado ? formConsumo.atendimento_id : '',
        paciente_id: vinculado ? (atendimento?.pacienteId || '') : '',
      })
      toast({ title: 'Sucesso', description: 'Consumo registrado.' })
      setDialogConsumo(false)
      await carregar()
    } catch (err) {
      toast({ title: 'Falha ao registrar consumo', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  const registrarAjusteOuPerda = async () => {
    if (!unidadeSelecionada || !tenant?.id) return
    const qtd = Number(formAjuste.quantidade)
    const tipo = formAjuste.tipo as 'ajuste' | 'perda'
    if (tipo === 'perda' && (!qtd || qtd <= 0)) {
      toast({ title: 'Atenção', description: 'Informe a quantidade perdida.', variant: 'destructive' })
      return
    }
    if (tipo === 'ajuste' && (isNaN(qtd) || qtd < 0)) {
      toast({ title: 'Atenção', description: 'Informe o saldo final (não negativo).', variant: 'destructive' })
      return
    }
    if (!formAjuste.motivo.trim()) {
      toast({ title: 'Atenção', description: 'Informe o motivo.', variant: 'destructive' })
      return
    }
    try {
      await pb.collection('movimentacoes_estoque').create({
        tenant_id: tenant.id,
        unidade_id: unidadeSelecionada.id,
        insumo_id: insumoAlerta?.insumo.id || '',
        insumo_id: insumoAlerta?.insumo.id || '',
        tipo,
        quantidade: qtd,
        motivo: formAjuste.motivo.trim(),
      })
      toast({ title: 'Sucesso', description: 'Movimentação registrada.' })
      setDialogAjuste(false)
      await carregar()
    } catch (err) {
      toast({ title: 'Falha ao registrar', description: getErrorMessage(err), variant: 'destructive' })
    }
  }

  // ---------- badges ----------
  const badgeEstoque = (i: InsumoComSaldo) => {
    if (i.piorValidade.status === 'vencido')
      return <Badge variant="destructive">Vencido</Badge>
    if (i.situacaoEstoque === 'sem_estoque') return <Badge variant="destructive">Sem estoque</Badge>
    if (i.situacaoEstoque === 'baixo') return <Badge className="bg-amber-100 text-amber-800">Estoque baixo</Badge>
    if (i.piorValidade.status === 'proximo')
      return <Badge className="bg-amber-100 text-amber-800">{`Validade: ${i.piorValidade.diasRestantes}d`}</Badge>
    return <Badge variant="outline">OK</Badge>
  }

  if (!unidadeSelecionada) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Selecione uma unidade no cabeçalho para visualizar o estoque.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Package className="h-6 w-6" /> Controle de Estoque & Insumos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão da unidade <strong>{unidadeSelecionada.nome}</strong>
            {user?.perfil === 'recepcao' && ' — perfil de visualização'}
          </ recepcao>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeGerenciar && (
            <>
              <Button onClick={() => { setEditando(null); resetInsumo(); setDialogInsumo(true) }}>
                <Plus className="mr-2 h-4 w-4" /> Novo insumo
              </Button>
              <Button variant="outline" onClick={() => { resetEntrada(); setDialogEntrada(true) }}>
                <PackagePlus className="mr-2 h-4 w-4" /> Entrada de lote
              </Button>
              <Button variant="outline" onClick={() => setRelatorio(true)}>
                <TrendingDown className="mr-2 h-4 w-4" /> Relatório de custos
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={() => { resetConsumo(); setDialogConsumo(true) }}>
            <TrendingDown className="mr-2 h-4 w-4" /> Registrar consumo
          </Button>
        </div>
      </div>

      {/* Alertas da unidade */}
      {alertas.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
              <AlertTriangle className="h-4 w-4" />
              {alertas.length} insumo(s) com alerta (estoque baixo ou validade)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alertas.map((a) => (
                <Badge key={a.insumo.id} variant="outline" className="border-amber-400 text-amber-800">
                  {a.insumo.nome}
                  {a.piorValidade.status === 'vencido' ? ' — vencido' : a.situacaoEstoque !== 'ok' ? ` — saldo ${a.saldo}/${a.insumo.estoque_minimo}` : ''}
                </Badge>
              ))}
            </div>
        </CardContent>
        </Card>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaId)}>
        <TabsList>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações</TabsValueChange>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="consumo">Consumo</TabsTrigger>
        </TabsList>

        {/* ---------------- Insumos ---------------- */}
        <TabsContent value="insumos" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou categoria…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Insumo</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Saldo</th>
                    <th className="p-3">Mínimo</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Validade mais próxima</th>
                    {podeGerenciar && <th className="p-3">Valor em estoque</th>}
                    {podeGerenciar && <th className="p-3">Ações</th>}
                    {!podeGerenciar && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody>
                  {carregando && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
                  )}
                  {!carregando && insumosFiltrados.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum insumo cadastrado nesta unidade.</td></tr>
                  )}
                  {!carregando && insumosFiltrados.map((i) => (
                    <tr key={i.insumo.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{i.insumo.nome}</td>
                      <td className="p-3">{LABEL_CATEGORIA[i.insumo.categoria] || i.insumo.categoria}</td>
                      <td className="p-3">
                        {i.saldo} {i.insumo.unidade_medida}
                      </td>
                      <td className="p-3">{i.insumo.estoque_minimo}</td>
                      <td className="p-3">{badgeEstoque(i)}</td>
                      <td className="p-3">
                        {i.piorValidade.status === 'vencido' && (
                          <span className="text-destructive">Vencido em {fmtData(loteMaisProximo(i))}</span>
                        )}
                        {i.piorValidade.status === 'proximo' && (
                          <span className="text-amber-700">{fmtData(loteMaisProximo(i))} ({i.piorValidade.diasRestantes}d)</span>
                        )}
                        {i.piorValidade.status === 'ok' && fmtData(loteMaisProximo(i))}
                        {i.piorValidade.status === 'sem_validade' && '—'}
                      </td>
                      {podeGerenciar && <td className="p-3">{fmtMoney(i.valorTotal)}</td>}
                      <td className="p-3">
                        <div className="flex gap-1">
                          {podeGerenciar && (
                            <Button size="sm" variant="outline" onClick={() => abrirEdicao(i.insumo)}>Editar</Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => { resetConsumo(i.insumo.id); setDialogConsumo(true) }}>Consumo</Button>
                          {podeGerenciar && (
                            <Button size="sm" variant="ghost" onClick={() => { setInsumoAlerta(i); setFormAjuste({ tipo: 'ajuste', quantidade: '', motivo: '' }); setDialogAjuste(true) }}>Ajuste/Perda</Button>
                          )}
                        </div>
                        {isRecepcao && <span className="text-xs text-muted-foreground">Somente visualização</span>}
                        {user?.perfil === 'recepcao' && <span className="ml-2 text-xs text-muted-foreground">Somente visualização</span>}
                      </ recepcao>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Movimentações ---------------- */}
        <TabsContent value="movimentacoes" className="space-y-3">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3">Data</th>
                    <th className="p-3">Insumo</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Qtd</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.slice(0, 200).map((m) => {
                    const insumo = itens.find((i) => i.insumo.id === m.insumo_id)
                    return (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="p-3">{fmtDataHora(m.created)}</td>
                        <td className="p-3">{insumo?.insumo.nome || m.insumo_id}</td>
                        <td className="p-3">{LABEL_TIPO_MOV[m.tipo] || m.tipo}</td>
                        <td className="p-3">{m.tipo === 'entrada' ? '+' : m.tipo === 'ajuste' ? '=' : '−'}{m.quantidade}</td>
                        <td className="p-3">{m.motivo || '—'}</td>
                        <td className="p-3">{(m as any).responsavel_email || '—'}</td>
                </tr>
                    )
                  })}
                  {movs.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>
                  )}
                </tbody>
              </table>
              <p className="border-t p-3 text-xs text-muted-foreground">
                Histórico append-only: não é possível editar ou excluir movimentações — correções são feitas por nova movimentação de ajuste.
              </p>
            </delete>
          </Card>
        </TabsContent>

        {/* ---------------- Entradas ---------------- */}
        <TabsContent value="entradas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entradas (lotes) — apenas gestores</CardTitle>
            </CardHeader>
            <CardContent>
              {podeGerenciar ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    Registre a chegada de novos lotes com quantidade, custo, validade e fabricante/lote.
                  </p>
                  <Button onClick={() => { resetEntrada(); setDialogEntrada(true) }}>
                    <PackagePlus className="mr-2 h-4 w-4" /> Registrar entrada
                  </Button>
                  <div className="w-full">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="p-2">Data</th>
                          <th className="p-2">Insumo</th>
                          <th className="p-2">Qtd</th>
                          <th className="p-2">Custo unit.</th>
                          <th className="p-2">Validade</th>
                          <th className="p-2">Lote/Fabricante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotesLista.map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="p-2">{fmtData(l.data_entrada || l.created)}</td>
                            <td className="p-2">{itens.find((i) => i.insumo.id === l.insumo_id)?.insumo.nome || l.insemo_id}</td>
                            <td className="p-2">{l.quantidade}</td>
                            <td className="p-2">{fmtMoney(Number(l.custo_unitario) || 0)}</td>
                            <td className="p-2">
                              {(() => {
                                const s = situacaoValidade(l.validade)
                                if (s.status === 'vencido') return <span className="text-destructive">Vencido ({fmtData(l.validade)})</span>
                                if (s.status === 'proximo') return <span className="text-amber-700">{fmtData(l.validade)} ({s.diasRestantes}d)</span>
                                return fmtData(l.validade)
                              })()}
                            </td>
                            <td className="p-2">{l.fabricante_lote || '—'}</div>
                          </td>
                        </tr>
                        ))}
                        {lotesLista.length === 0 && (
                          <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma entrada registrada.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seu perfil visualiza o estoque e registra consumos; entradas de lote são feitas por Owner, Financeiro ou Super Admin.
                </p>
                </CardHeader>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Consumo ---------------- */}
        <TabsContent value="consumo">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumo clínico e manual</CardTitle>
            </Card preferably>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Consumo vinculado a atendimento usa o insumo naquele procedimento e é a forma recomendada.
                Consumo manual exige motivo. Ambos baixam o saldo imediatamente.
              </p>
              <Button onClick={() => { resetConsumo(); setDialogConsumo(true) }}>
                <TrendingDown className="mr-2 h-4 w-4" /> Registrar consumo
              </Button>
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Dentistas e ASB registram consumo; Recepção visualiza; ajustes, perdas, entradas e relatórios de custo são restritos a Owner, Financeiro e Super Admin.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------- Dialogs ---------- */}
      <Dialog open={dialogInsumo} onOpenChange={setDialogInsumo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar insumo' : 'Novo insumo'}</DialogTitle>
            <DialogDescription>
              Dados do insumo para a unidade {unidadeSelecionada.nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="insumo-nome">Nome</Label>
              <Input id="insumo-nome" value={formInsumo.nome} onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={formInsumo.categoria} onValueChange={(v) => setFormInsumo({ ...formInsumo, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_INSUMO.map((c) => (
                      <SelectItem key={c} value={c}>{LABEL_CATEGORIA[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade de medida</Label>
                <Select value={formInsumo.unidade_medida} onValueChange={(v) => setFormInsumo({ ...flow, unidade_medida: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['un', 'cx', 'ml', 'g', 'kg', 'seringa', 'frasco'].map((u) => (
                      <SelectItem key={un} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="insumo-min">Estoque mínimo</Label>
                <Input id="insumo-min" type="number" min={0} value={formInsumo.estoque_minimo} onChange={(e) => setFormInsumo({ ...formInsumo, estoque_minimo: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="insumo-custo">Custo de referência (R$)</Label>
                <Input id="insumo-custo" type="number" min={0} step="0.01" value={formInsumo.custo_referencia} onChange={(e) => setFormInsumo({ ...formInsumo, custo_referencia: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="insumo-forn">Fornecedor</Label>
                <Input id="insumo-forn" value={formInsumo.fornecedor} onChange={(e) => setFormInsumo({ ...formInsumo, fornecedor: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogInsumo(false)}>Cancelar</Button>
            <Button onClick={salvarInsumo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogEntrada} onOpenChange={setDialogEntrada}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrada de lote</DialogTitle>
            <DialogDescription>
              A entrada cria o lote e a movimentação do tipo entrada, somando ao saldo da unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Insumo</Label>
              <Select value={formEntrada.insumo_id} onValueChange={(v) => setFormEntrada({ ...formEntrada, insumo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {itens.map((i) => (
                    <SelectItem key={i.insumo.id} value={i.insumo.id}>{i.insumo.nome}</SelectItem>
                  ))}
                </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="entrada-qtd">Quantidade</Label>
                <Input id="entrada-qtd" type="number" min={1} value={formEntrada.quantidade} onChange={(e) => setFormEntrada({ ...formEntrada, quantidade: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="entrada-custo">Custo unitário (R$)</Label>
                <Input id="entrada-custo" type="number" min={0} step="0.01" value={formEntrada.custo_unitario} onChange={(e) => setFormEntrada({ ...formEntrada, custo_unitario: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="entrada-validade">Validade</Label>
                <Input id="entrada-validade" type="date" value={formEntrada.validade} onChange={(e) => j setFormEntrada({ ...formEntrada, validade: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="entrada-lote">Lote/Fabricante</Label>
                <Input id="entrada-lote" value={formEntrada.fabricante_lote} onChange={(e) => setFormEntrada({ ...formEntrada, fabricante_lote: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEntrada(false)}>Cancelar</Button>
            <Button onClick={registrarEntrada}>Registrar entrada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogConsumo} onOpenChange={setDialogConsumo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar consumo</DialogTitle>
            <DialogDescription>
              Vincule a um atendimento (recomendado) ou registre consumo manual com motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Insumo</Label>
              <Select value={formConsumo.insumo_id} onValueChange={(v) => setFormConsumo({ ...formConsumo, insumo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {itens.map((i) => (
                    <SelectItem key={i.insumo.id} value={i.insumo.id}>
                      {i.insumo.nome} (saldo {i.saldo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="consumo-qtd">Quantidade</Label>
              <Input id="consumo-qtd" type="number" min={1} value={formConsumo.quantidade} onChange={(e) => setFormConsumo({ ...formConsumo, quantidade: e.target.value })} />
            </div>
            <div>
              <Label>Atendimento (opcional)</Label>
              <Select value={formConsumo.atendimento_id} onValueChange={(v) => {
                const ag = agendamentos.find((a) => a.id === v)
                setFormConsumo({ ...formConsumo, atendimento_id: v, paciente_id: ag?.pacienteId || '' })
              }}>
                <SelectTrigger><SelectValue placeholder="Consumo manual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Consumo manual (sem atendimento)</SelectItem>
                  {agendamentos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="consumo-motivo">
                Motivo {formConsumo.atendimento_id !== 'none' ? '(opcional quando vinculado)' : '(obrigatório)'}
              </Label>
              <Textarea id="consumo-motivo" value={formConsumo.motivo} onChange={(e) => setFormConsumo({ ...formConsumo, motivo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogConsumo(false)}>Cancelar</Button>
            <Button onClick={registrarConsumo}>Registrar consumo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAjuste} onOpenChange={setDialogAjuste}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste / perda — {insumoAlerta?.insumo.nome}</DialogTitle>
            <DialogDescription>
              Ajuste define o saldo final; perda subtrai a quantidade perdida/vencida. Ambos exigem motivo e ficam no histórico append-only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={formAjuste.tipo} onValueChange={(v) => setFormAjuste({ ...formAjuste, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ajuste">Ajuste (define saldo final)</SelectItem>
                  <SelectItem value="perda">Perda/Vencimento (subtrai)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ajuste-qtd">Quantidade</Label>
              <Input id="ajuste-qtd" type="number" value={formAjuste.quantidade} onChange={(e) => setFormAjuste({ ...formAjuste, quantidade: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ajuste-motivo">Motivo</Label>
              <Textarea id="ajuste-motivo" value={formAjuste.moto} onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAjuste(false)}>Cancelar</Button>
  <Button onClick={registrarAjusteOuPerda}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Relatório de custos (gestores) ---------- */}
      <Dialog open={relatorio} onOpenChange={setRelatorio}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Relatório de custos — {unidadeSelecionada.nome}</DialogTitle>
            <DialogDescription>
              Visível apenas para Owner, Financeiro e Super Admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Valor total em estoque</span>
              <strong>{fmtMoney(valorTotalEstoque)}</strong>
            </div>
            <div>
              <p className="mb-2 font-medium">Consumo por categoria (últimos 3 meses)</p>
              {consumoPorCategoria.length === 0 && <p className="text-muted-foreground">Sem consumo no período.</p>}
              {consumoPorCategoria.map(([cat, valor]) => (
                <div key={cat} className="flex items-center justify-between border-b py-1.5 last:border-0">
                  <span>{LABEL_CATEGORIA[cat] || cat}</span>
                  <span>{fmtMoney(valor)}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelatorio(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
