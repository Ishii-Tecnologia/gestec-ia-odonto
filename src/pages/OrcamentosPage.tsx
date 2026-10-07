import React, { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { OrcamentoRecord, PacienteRecord, ProcedimentoRecord, OrçamentoItem } from '@/types/gestec'
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
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function OrcamentosPage() {
  const { tenantId, user, perfil } = useAuth()
  const { toast } = useToast()

  const [orcamentos, setOrcamentos] = useState<OrcamentoRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo Orçamento
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [pacienteId, setPacienteId] = useState('')
  const [parcelas, setParcelas] = useState(6)
  const [descontoPct, setDescontoPct] = useState(0)
  const [validade, setValidade] = useState('2026-11-30')

  // Itens do orçamento
  const [itens, setItens] = useState<OrçamentoItem[]>([
    { procedimento: 'Profilaxia e Remoção de Tártaro', dente: 'Geral', valor: 220, quantidade: 1 },
  ])

  // Modal Assinatura Digital do Paciente (RF-024)
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false)
  const [orcamentoParaAssinar, setOrcamentoParaAssinar] = useState<OrcamentoRecord | null>(null)
  const [nomeRubrica, setNomeRubrica] = useState('')
  const [assinando, setAssinando] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [orcRes, pacRes, procRes] = await Promise.all([
        pb.collection('orcamentos').getList<OrcamentoRecord>(1, 100, {
          sort: '-created',
          expand: 'paciente_id',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 100, { sort: 'nome' }),
        pb.collection('procedimentos').getList<ProcedimentoRecord>(1, 50, { sort: 'nome' }),
      ])
      setOrcamentos(orcRes.items)
      setPacientes(pacRes.items)
      setProcedimentos(procRes.items)
    } catch (err: any) {
      console.error('Erro ao carregar orçamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId])

  // Adicionar item ao orçamento em construção
  const handleAdicionarItem = (procNome: string) => {
    const p = procedimentos.find((x) => x.nome === procNome)
    if (!p) return
    setItens([
      ...itens,
      {
        procedimento_id: p.id,
        procedimento: p.nome,
        dente: 'Geral',
        valor: p.valor,
        quantidade: 1,
      },
    ])
  }

  const handleRemoverItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index))
  }

  const valorBruto = itens.reduce((acc, curr) => acc + curr.valor * (curr.quantidade || 1), 0)
  const valorLiquido = valorBruto - (valorBruto * (descontoPct || 0)) / 100
  const valorParcela = parcelas > 0 ? valorLiquido / parcelas : valorLiquido

  // Criar Orçamento
  const handleCriarOrcamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId || itens.length === 0) {
      toast({ title: 'Selecione o paciente e adicione itens', variant: 'destructive' })
      return
    }

    setSalvando(true)
    try {
      const novo = await pb.collection('orcamentos').create<OrcamentoRecord>({
        tenant_id: tenantId,
        paciente_id: pacienteId,
        valor_bruto: valorBruto,
        desconto_percentual: descontoPct,
        valor_liquido: valorLiquido,
        parcelas,
        status: 'rascunho',
        validade,
        itens,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: pacienteId,
        acao: 'criou_orcamento',
        detalhes: `Orçamento comercial gerado no valor de R$ ${valorLiquido.toFixed(2)} (${itens.length} itens)`,
      })

      toast({
        title: 'Orçamento Criado com Sucesso',
        description: 'Proposta disponível para negociação e assinatura do paciente.',
      })

      setModalAberto(false)
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao criar orçamento', description: err.message, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  // Aprovação e Assinatura Eletrônica (RF-023 / RF-024 / BL-008)
  // REGRA DE DOMÍNIO: Aprovação gera automaticamente os títulos a receber no Financeiro (evento tratamento.aprovado)
  const handleConfirmarAssinatura = async () => {
    if (!orcamentoParaAssinar || !nomeRubrica.trim()) {
      toast({ title: 'Informe a assinatura do paciente', variant: 'destructive' })
      return
    }

    setAssinando(true)
    try {
      // 1. Atualizar Orçamento para aprovado com assinatura registrada
      const agoraStr = new Date().toISOString()
      const updated = await pb
        .collection('orcamentos')
        .update<OrcamentoRecord>(orcamentoParaAssinar.id, {
          status: 'aprovado',
          assinatura: {
            rubrica: nomeRubrica.trim(),
            data_hora: agoraStr,
            ip: '189.120.45.12 (Dispositivo Clínico)',
            valido: true,
          },
        })

      // 2. Disparo do evento de negócio: Gerar títulos a receber no Financeiro (RF-030)
      const numParcelas = updated.parcelas || 1
      const valorUnitarioParcela = updated.valor_liquido / numParcelas

      for (let p = 1; p <= numParcelas; p++) {
        const dataVenc = new Date()
        dataVenc.setDate(dataVenc.getDate() + (p - 1) * 30)

        await pb.collection('lancamentos_financeiros').create({
          tenant_id: tenantId,
          paciente_id: updated.paciente_id,
          orcamento_id: updated.id,
          descricao: `Tratamento Aprovado - Parcela ${p}/${numParcelas}`,
          tipo: 'receber',
          valor: Number(valorUnitarioParcela.toFixed(2)),
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
        detalhes: `Orçamento aprovado digitalmente por ${nomeRubrica}. Gerados ${numParcelas} títulos no Financeiro.`,
      })

      toast({
        title: 'Orçamento Aprovado com Sucesso!',
        description: `Assinatura digital coletada e ${numParcelas} parcela(s) lançadas automaticamente no Financeiro (RF-030).`,
      })

      setModalAssinaturaAberto(false)
      setOrcamentoParaAssinar(null)
      setNomeRubrica('')
      carregarDados()
    } catch (err: any) {
      toast({ title: 'Erro ao aprovar', description: err.message, variant: 'destructive' })
    } finally {
      setAssinando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#0E7490]" />
            Orçamentos & Planos de Tratamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Elaboração de planos, desconto controlado, assinatura eletrônica e faturamento
            automático
          </p>
        </div>

        <Button
          onClick={() => {
            if (pacientes.length > 0 && !pacienteId) setPacienteId(pacientes[0].id)
            setModalAberto(true)
          }}
          className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Orçamento</span>
        </Button>
      </div>

      {/* Tabela de Orçamentos */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Carregando propostas comerciais...
            </div>
          ) : orcamentos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Nenhum orçamento cadastrado ainda. Clique em "Novo Orçamento" para iniciar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Itens & Procedimentos</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Condição</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orcamentos.map((orc) => {
                    const statusConfig: Record<string, { label: string; color: string }> = {
                      rascunho: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
                      negociacao: {
                        label: 'Em Negociação',
                        color: 'bg-amber-50 text-amber-700 border-amber-200',
                      },
                      aprovado: {
                        label: 'Aprovado & Assinado',
                        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      },
                      recusado: {
                        label: 'Recusado',
                        color: 'bg-red-50 text-red-700 border-red-200',
                      },
                      vencido: { label: 'Vencido', color: 'bg-slate-100 text-slate-500' },
                    }

                    const status = statusConfig[orc.status] || { label: orc.status, color: '' }
                    const pacNome = orc.expand?.paciente_id?.nome || 'Paciente'

                    return (
                      <tr key={orc.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <Link to={`/pacientes/${orc.paciente_id}`} className="hover:underline">
                            {pacNome}
                          </Link>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Criado em {orc.created?.slice(0, 10)}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">
                            {orc.itens?.length || 0} procedimento(s) incluído(s)
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">
                            {orc.itens?.map((i) => i.procedimento).join(', ')}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(orc.valor_liquido)}
                          </div>
                          {orc.desconto_percentual ? (
                            <div className="text-[10px] text-emerald-600 font-medium">
                              {orc.desconto_percentual}% de desconto
                            </div>
                          ) : null}
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            {orc.parcelas}x de{' '}
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(orc.valor_liquido / (orc.parcelas || 1))}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Validade: {orc.validade || '—'}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${status.color}`}
                          >
                            {status.label}
                          </Badge>
                          {orc.assinatura?.rubrica && (
                            <div className="text-[9px] text-emerald-700 flex items-center gap-1 mt-0.5">
                              <FileCheck className="w-3 h-3" />
                              Assinado por {orc.assinatura.rubrica}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {orc.status !== 'aprovado' ? (
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
                                <span>Coletar Assinatura</span>
                              </Button>
                            ) : (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-[#0E7490]"
                              >
                                <Link to="/financeiro">Ver Títulos</Link>
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

      {/* Modal Novo Orçamento (RF-023 / RF-024) */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Novo Orçamento Clínico</DialogTitle>
            <DialogDescription className="text-xs">
              Adicione procedimentos da tabela própria, configure descontos e defina parcelas
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarOrcamento} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Paciente *</Label>
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
                <Label className="text-xs">Validade da Proposta</Label>
                <Input
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Seletor Rápido para Adicionar Procedimentos */}
            <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Label className="text-xs font-semibold">Adicionar Procedimento da Tabela:</Label>
              <div className="flex gap-2">
                <Select onValueChange={handleAdicionarItem}>
                  <SelectTrigger className="h-8 text-xs flex-1 bg-white">
                    <SelectValue placeholder="Escolha um procedimento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {procedimentos.map((proc) => (
                      <SelectItem key={proc.id} value={proc.nome}>
                        {proc.nome} — R$ {proc.valor.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela de Itens Adicionados */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Procedimento</th>
                    <th className="py-2 px-3">Elemento/Dente</th>
                    <th className="py-2 px-3">Valor</th>
                    <th className="py-2 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-medium">{it.procedimento}</td>
                      <td className="py-2 px-3">
                        <Input
                          value={it.dente || 'Geral'}
                          onChange={(e) => {
                            const newItens = [...itens]
                            newItens[idx].dente = e.target.value
                            setItens(newItens)
                          }}
                          className="h-6 w-24 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">R$ {it.valor.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoverItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totalizadores e Condições de Pagamento */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-cyan-50/40 rounded-lg border border-cyan-100">
              <div>
                <Label className="text-[11px] text-slate-500">Valor Bruto</Label>
                <div className="text-base font-bold text-slate-800">R$ {valorBruto.toFixed(2)}</div>
              </div>

              <div>
                <Label className="text-[11px] text-slate-500">Desconto (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={descontoPct}
                  onChange={(e) => setDescontoPct(Number(e.target.value))}
                  className="h-7 text-xs w-20"
                />
              </div>

              <div>
                <Label className="text-[11px] text-slate-500">Parcelas</Label>
                <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                  <SelectTrigger className="h-7 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de R$ {(valorLiquido / n).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75]"
              >
                {salvando ? 'Salvando...' : 'Gerar Orçamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Coleta de Assinatura Digital do Paciente (RF-024) */}
      <Dialog open={modalAssinaturaAberto} onOpenChange={setModalAssinaturaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Assinatura Eletrônica do Paciente
            </DialogTitle>
            <DialogDescription className="text-xs">
              Coleta de aceite do plano de tratamento e condições comerciais com valor jurídico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg text-slate-700 space-y-1">
              <div>
                <strong>Valor Total Aprovado:</strong> R${' '}
                {orcamentoParaAssinar?.valor_liquido?.toFixed(2)}
              </div>
              <div>
                <strong>Parcelamento:</strong> {orcamentoParaAssinar?.parcelas}x de R${' '}
                {(orcamentoParaAssinar
                  ? orcamentoParaAssinar.valor_liquido / orcamentoParaAssinar.parcelas
                  : 0
                ).toFixed(2)}
              </div>
              <div>
                <strong>Itens:</strong> {orcamentoParaAssinar?.itens?.length} procedimentos
                odontológicos
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome do Titular ou Rubrica Digital *</Label>
              <Input
                value={nomeRubrica}
                onChange={(e) => setNomeRubrica(e.target.value)}
                placeholder="Nome completo do paciente rubricado"
                className="h-9 text-xs"
              />
            </div>

            {/* Simulação de Canvas de Assinatura */}
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">
                Área de Toque para Assinatura em Tablet:
              </Label>
              <div className="h-24 bg-white border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 font-cursive text-lg">
                {nomeRubrica || 'Rubrica na tela do dispositivo'}
              </div>
            </div>

            <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-[11px] text-emerald-800">
              ✓ Ao confirmar, o sistema gerará automaticamente os títulos a receber no Financeiro
              (RF-030).
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
              {assinando ? 'Processando...' : 'Confirmar e Aprovar Orçamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
