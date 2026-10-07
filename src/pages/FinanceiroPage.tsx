import React, { useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { LancamentoFinanceiroRecord, ModalidadePagamento } from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { ModuloGate } from '@/components/ModuloGate'
import { RequireProfile } from '@/components/RequireProfile'
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
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function FinanceiroPage() {
  const { tenantId, user, perfil } = useAuth()
  const { toast } = useToast()

  const [titulos, setTitulos] = useState<LancamentoFinanceiroRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Baixa com Split de Pagamento (RF-031 / RF-032)
  const [modalBaixaAberto, setModalBaixaAberto] = useState(false)
  const [tituloSelecionado, setTituloSelecionado] = useState<LancamentoFinanceiroRecord | null>(
    null,
  )
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)

  // Configuração do Split de Pagamento
  const [splitModalidades, setSplitModalidades] = useState<ModalidadePagamento[]>([
    { modalidade: 'pix', valor: 0 },
  ])

  // Modal Simulação Pix Dinâmico com QR Code
  const [modalPixAberto, setModalPixAberto] = useState(false)
  const [pixPayload, setPixPayload] = useState('')

  const carregarTitulos = async () => {
    setLoading(true)
    try {
      const res = await pb
        .collection('lancamentos_financeiros')
        .getList<LancamentoFinanceiroRecord>(1, 100, {
          sort: '-vencimento',
          expand: 'paciente_id,orcamento_id',
        })
      setTitulos(res.items)
    } catch (err: any) {
      console.error('Erro ao carregar financeiro:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarTitulos()
  }, [tenantId])

  // Abrir modal de baixa com divisão de modalidades (Split - RF-031)
  const abrirModalBaixa = (titulo: LancamentoFinanceiroRecord) => {
    setTituloSelecionado(titulo)
    setSplitModalidades([{ modalidade: 'pix', valor: titulo.valor }])
    setModalBaixaAberto(true)
  }

  const handleAddSplit = () => {
    setSplitModalidades([...splitModalidades, { modalidade: 'cartao_credito', valor: 0 }])
  }

  const handleRemoveSplit = (idx: number) => {
    setSplitModalidades(splitModalidades.filter((_, i) => i !== idx))
  }

  const totalSplit = splitModalidades.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)

  // Efetivar Baixa com Webhook / Conciliação Instantânea (CA-Financeiro: < 1 min)
  const handleConfirmarBaixa = async () => {
    if (!tituloSelecionado) return
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
      await pb.collection('lancamentos_financeiros').update(tituloSelecionado.id, {
        status: 'pago',
        data_pagamento: agoraStr,
        valor_pago: totalSplit,
        modalidades: splitModalidades,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: tituloSelecionado.paciente_id,
        acao: 'liquidou_titulo_financeiro',
        detalhes: `Baixa realizada no título ${tituloSelecionado.descricao} (R$ ${totalSplit.toFixed(2)}) com split de modalidades`,
      })

      toast({
        title: 'Título Liquidado com Sucesso! (RF-031 / CA-Financeiro)',
        description: 'Baixa imediata confirmada no fluxo de caixa da clínica.',
      })

      setModalBaixaAberto(false)
      setTituloSelecionado(null)
      carregarTitulos()
    } catch (err: any) {
      toast({ title: 'Erro ao liquidar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoBaixa(false)
    }
  }

  // Gerar Pix Dinâmico Simulado
  const handleGerarPix = (titulo: LancamentoFinanceiroRecord) => {
    const payload = `00020126580014br.gov.bcb.pix0136gestec-${titulo.id}-pix520400005303986540${titulo.valor.toFixed(2)}5802BR5925GESTECODONTO6009SAOPAULO62070503***6304ABCD`
    setPixPayload(payload)
    setTituloSelecionado(titulo)
    setModalPixAberto(true)
  }

  // Totalizadores
  const totalRecebido = titulos
    .filter((t) => t.status === 'pago')
    .reduce((acc, curr) => acc + (curr.valor_pago || curr.valor || 0), 0)

  const totalAberto = titulos
    .filter((t) => t.status === 'aberto')
    .reduce((acc, curr) => acc + curr.valor, 0)

  return (
    <RequireProfile allowed={['owner', 'financeiro']}>
      <ModuloGate modulo="financeiro">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                Gestão Financeira & Títulos a Receber
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Contas a receber integradas, emissão Pix dinâmico e baixa com split de pagamento
                (RF-031 / RF-032)
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={carregarTitulos}
              className="text-xs h-9 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar Títulos</span>
            </Button>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Total Liquidado (Caixa)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalRecebido,
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Baixas confirmadas no período</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  A Receber em Aberto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalAberto,
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Parcelas de tratamentos em curso</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-cyan-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Integração Pix & Cartão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-700 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-cyan-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Split de Pagamento Ativo (RF-031)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Suporte a recebimento dividido em múltiplas formas simultâneas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Listagem de Títulos a Receber */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-sm font-semibold">Títulos a Receber da Clínica</CardTitle>
              <CardDescription className="text-xs">
                Controle de quitações, conciliação de parcelas e liquidação com split
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Carregando financeiro...
                </div>
              ) : titulos.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum título financeiro encontrado. Aprove orçamentos para gerar recebíveis
                  automáticos.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Paciente</th>
                        <th className="py-3 px-4">Descrição do Lançamento</th>
                        <th className="py-3 px-4">Vencimento</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações de Baixa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {titulos.map((t) => {
                        const pacNome = t.expand?.paciente_id?.nome || 'Paciente Avulso'

                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              <Link
                                to={t.paciente_id ? `/pacientes/${t.paciente_id}` : '#'}
                                className="hover:underline"
                              >
                                {pacNome}
                              </Link>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-slate-800">{t.descricao}</div>
                              {t.modalidades && t.modalidades.length > 0 && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Split:{' '}
                                  {t.modalidades
                                    .map((m) => `${m.modalidade.toUpperCase()} R$${m.valor}`)
                                    .join(' + ')}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono">{t.vencimento}</td>

                            <td className="py-3 px-4 font-bold text-slate-900">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(t.valor)}
                            </td>

                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize font-medium ${
                                  t.status === 'pago'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : t.status === 'aberto'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {t.status}
                              </Badge>
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
                                    >
                                      <QrCode className="w-3.5 h-3.5" />
                                      <span>Pix</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                                      onClick={() => abrirModalBaixa(t)}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Dar Baixa (Split)</span>
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 font-medium">
                                    ✓ Liquidado
                                  </span>
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

          {/* Modal Split de Pagamento (RF-031) */}
          <Dialog open={modalBaixaAberto} onOpenChange={setModalBaixaAberto}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  Baixa com Split de Pagamento
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Divida a liquidação em diferentes modalidades no mesmo título (RF-031)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg text-slate-800 space-y-1">
                  <div>
                    <strong>Título:</strong> {tituloSelecionado?.descricao}
                  </div>
                  <div>
                    <strong>Valor Total a Liquidar:</strong> R${' '}
                    {tituloSelecionado?.valor?.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Modalidades do Pagamento (Split):
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddSplit}
                      className="h-6 text-[10px] text-[#0E7490]"
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
                          className="h-8 w-8 p-0 text-red-500"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
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

          {/* Modal Pix Dinâmico Simulado (RF-032) */}
          <Dialog open={modalPixAberto} onOpenChange={setModalPixAberto}>
            <DialogContent className="max-w-sm text-center">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  Pix com QR Code Dinâmico
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Apresente o QR Code ao paciente para pagamento via aplicativo bancário
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* QR Code Simulado Visual */}
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
                  <Label className="text-[10px] text-slate-500 uppercase">
                    Código Copia e Cola:
                  </Label>
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
                  className="w-full text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  Simular Baixa Automática de Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ModuloGate>
    </RequireProfile>
  )
}
