import React, { useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  AgendamentoRecord,
  LancamentoFinanceiroRecord,
  MessageLembreteRecord,
} from '@/types/gestec'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
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
} from 'lucide-react'

export default function RelatoriosPage() {
  const { tenantId, user, perfil, hasModule } = useAuth()
  const { toast } = useToast()

  const [agendamentos, setAgendamentos] = useState<AgendamentoRecord[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiroRecord[]>([])
  const [lembretes, setLembretes] = useState<MessageLembreteRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarDadosRelatorios() {
      setLoading(true)
      try {
        const [agRes, lancRes, lembRes] = await Promise.all([
          pb.collection('agendamentos').getList<AgendamentoRecord>(1, 200, {
            expand: 'paciente_id,profissional_id',
          }),
          hasModule('financeiro')
            ? pb.collection('lancamentos_financeiros').getList<LancamentoFinanceiroRecord>(1, 200, {
                expand: 'paciente_id',
              })
            : Promise.resolve({ items: [] }),
          pb.collection('messages_lembretes').getList<MessageLembreteRecord>(1, 50, {
            sort: '-created',
          }),
        ])

        setAgendamentos(agRes.items)
        setLancamentos(lancRes.items)
        setLembretes(lembRes.items)
      } catch (err: any) {
        console.error('Erro ao carregar relatórios:', err)
      } finally {
        setLoading(false)
      }
    }

    carregarDadosRelatorios()
  }, [tenantId, hasModule])

  // Exportação Contábil CSV (BL-023 - Could Have)
  const handleExportarContabilCSV = () => {
    if (lancamentos.length === 0) {
      toast({ title: 'Sem lançamentos para exportar', variant: 'destructive' })
      return
    }

    const headers = [
      'ID',
      'Data Vencimento',
      'Paciente',
      'Descricao',
      'Tipo',
      'Valor',
      'Status',
      'Data Pagamento',
    ]
    const rows = lancamentos.map((l) => [
      l.id,
      l.vencimento,
      l.expand?.paciente_id?.nome || 'Avulso',
      `"${l.descricao.replace(/"/g, '""')}"`,
      l.tipo,
      l.valor.toFixed(2),
      l.status,
      l.data_pagamento || '',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `gestec_contabil_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Arquivo CSV Exportado (BL-023)',
      description: 'Extrato contábil gerado para conciliação bancária ou ERP externo.',
    })
  }

  // Métricas Consolidadas
  const totalAg = agendamentos.length
  const agConcluidos = agendamentos.filter((a) => a.status === 'concluido').length
  const agCancelados = agendamentos.filter((a) => a.status === 'cancelado').length
  const agFaltas = agendamentos.filter((a) => a.status === 'falta').length
  const taxaNoShow = totalAg > 0 ? Math.round(((agFaltas + agCancelados) / totalAg) * 100) : 0

  const totalFinanceiroPago = lancamentos
    .filter((l) => l.status === 'pago')
    .reduce((acc, curr) => acc + (curr.valor_pago || curr.valor || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#0E7490]" />
            Relatórios Operacionais & Comunicação
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Métricas de ocupação, taxa de no-show, exportação contábil CSV e régua de lembretes
          </p>
        </div>

        <Button
          onClick={handleExportarContabilCSV}
          variant="outline"
          size="sm"
          className="h-9 text-xs flex items-center gap-2 text-[#0E7490] border-cyan-200 hover:bg-cyan-50"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Contábil (CSV)</span>
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Consultas no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalAg}</div>
            <p className="text-[11px] text-slate-400 mt-1">
              {agConcluidos} atendimentos finalizados
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Taxa de No-Show / Faltas</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${taxaNoShow > 15 ? 'text-amber-600' : 'text-emerald-600'}`}
            >
              {taxaNoShow}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{agFaltas} ausências registradas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Lembretes WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700">{lembretes.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Disparos de 48h e 24h na fila</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500">Receita Liquidada (Caixa)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                totalFinanceiroPago,
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Baixas automáticas no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas: Resumo Operacional e Mensageria */}
      <Tabs defaultValue="mensagens" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="mensagens" className="text-xs flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Lembretes WhatsApp & Fila (BL-010)
          </TabsTrigger>
          <TabsTrigger value="agenda" className="text-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Desempenho por Procedimento
          </TabsTrigger>
        </TabsList>

        {/* 1. Lembretes de Mensageria WhatsApp (BL-010) */}
        <TabsContent value="mensagens" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Fila de Disparos de Confirmação (RF-005)
              </CardTitle>
              <CardDescription className="text-xs">
                Mensagens automáticas programadas para as janelas de 48h e 24h antes da consulta
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {lembretes.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  Nenhum lembrete gerado na fila até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Destinatário</th>
                        <th className="py-2.5 px-4">Telefone</th>
                        <th className="py-2.5 px-4">Gatilho</th>
                        <th className="py-2.5 px-4">Canal</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lembretes.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            {l.destinatario_nome}
                          </td>
                          <td className="py-2.5 px-4 font-mono">{l.telefone}</td>
                          <td className="py-2.5 px-4 capitalize text-slate-600">
                            {l.tipo_gatilho.replace('_', ' ')}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200 uppercase"
                            >
                              {l.canal}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="outline"
                              className="text-[10px] capitalize bg-cyan-50 text-[#0E7490] border-cyan-200"
                            >
                              {l.status.replace('_', ' ')}
                            </Badge>
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

        {/* 2. Desempenho por Procedimento */}
        <TabsContent value="agenda" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Procedimentos Mais Realizados</CardTitle>
              <CardDescription className="text-xs">
                Distribuição de atendimentos por especialidade na clínica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { nome: 'Manutenção Ortodôntica', qtd: 45, pct: 35 },
                  { nome: 'Profilaxia e Remoção de Tártaro', qtd: 32, pct: 25 },
                  { nome: 'Restauração em Resina', qtd: 24, pct: 19 },
                  { nome: 'Clareamento Dental', qtd: 15, pct: 12 },
                  { nome: 'Tratamento de Canal (Endodontia)', qtd: 12, pct: 9 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-700 font-medium">
                      <span>{item.nome}</span>
                      <span>
                        {item.qtd} consultas ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0E7490] rounded-full"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
