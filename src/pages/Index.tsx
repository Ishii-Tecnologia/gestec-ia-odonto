import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { AgendamentoRecord, PacienteRecord, LancamentoFinanceiroRecord } from '@/types/gestec'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2,
  Stethoscope,
  Settings,
  ShieldCheck,
  Server,
  Building2,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Index() {
  const {
    user,
    tenant,
    perfil,
    hasModule,
    isSuperAdmin,
    isOwner,
    selectedUnidadeId,
    selectedUnidade,
  } = useAuth()
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoRecord[]>([])
  const [pacientesTotal, setPacientesTotal] = useState<number>(0)
  const [pacientesRisco, setPacientesRisco] = useState<PacienteRecord[]>([])
  const [faturamentoTotal, setFaturamentoTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().slice(0, 10)
  const hasFinanceiro = hasModule('financeiro')
  const tenantId = tenant?.id

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true)
      try {
        // 1. Agendamentos de hoje filtrados por tenant e unidade (se selecionada)
        const conds: string[] = []
        if (tenantId) conds.push(`tenant_id = '${tenantId}'`)
        conds.push(`data_inicio >= '${todayStr}T00:00:00' && data_inicio <= '${todayStr}T23:59:59'`)
        if (selectedUnidadeId && selectedUnidadeId !== 'todas') {
          conds.push(`unidade_id = '${selectedUnidadeId}'`)
        }
        const filterAg = conds.join(' && ')

        const agRes = await pb.collection('agendamentos').getList<AgendamentoRecord>(1, 20, {
          filter: filterAg,
          sort: 'data_inicio',
          expand: 'paciente_id,profissional_id',
        })
        setAgendamentosHoje(agRes.items)

        // 2. Total de Pacientes e Risco de Evasão (BL-014) filtrados por tenant
        const filterPac = tenantId ? `tenant_id = '${tenantId}'` : ''
        const pacRes = await pb.collection('pacientes').getList<PacienteRecord>(1, 100, {
          filter: filterPac || undefined,
          sort: '-created',
        })
        setPacientesTotal(pacRes.totalItems)
        const emRisco = pacRes.items.filter((p) => (p.score_evasao || 0) > 50)
        setPacientesRisco(emRisco)

        // 3. Faturamento do Mês (se financeiro contratado)
        if (hasFinanceiro) {
          const filterFin = tenantId
            ? `tenant_id = '${tenantId}' && tipo = 'receber' && status = 'pago'`
            : "tipo = 'receber' && status = 'pago'"

          const finRes = await pb
            .collection('lancamentos_financeiros')
            .getList<LancamentoFinanceiroRecord>(1, 50, {
              filter: filterFin,
            })
          const total = finRes.items.reduce(
            (acc, curr) => acc + (curr.valor_pago || curr.valor || 0),
            0,
          )
          setFaturamentoTotal(total)
        }
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarDashboard()
  }, [hasFinanceiro, todayStr, tenantId, selectedUnidadeId])

  // Taxa de ocupação aproximada
  const ocupacaoPct = Math.min(Math.round((agendamentosHoje.length / 16) * 100), 100)

  return (
    <div className="space-y-6">
      {/* Top Banner de Boas-Vindas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Olá, {user?.name || 'Doutor(a)'}
            </h1>
            <Badge
              variant="outline"
              className="text-xs capitalize font-medium text-slate-600 bg-slate-50"
            >
              {perfil}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {' • '}
            <span className="font-semibold text-slate-700">
              {tenant?.nome || 'Unidade Principal'}
            </span>
            {selectedUnidade && (
              <>
                {' • '}
                <span className="text-[#0E7490] font-medium">{selectedUnidade.nome}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner() && (
            <Button
              asChild
              variant="outline"
              className="text-xs h-9 border-cyan-200 text-[#0E7490] hover:bg-cyan-50"
            >
              <Link to="/configuracoes">
                <Settings className="w-4 h-4 mr-1.5" />
                Gestão & Módulos
              </Link>
            </Button>
          )}

          {isSuperAdmin() && (
            <Button
              asChild
              variant="outline"
              className="text-xs h-9 border-red-200 text-red-700 hover:bg-red-50"
            >
              <Link to="/superadmin">
                <Server className="w-4 h-4 mr-1.5" />
                Painel Super Admin
              </Link>
            </Button>
          )}

          <Button asChild className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9">
            <Link to="/agenda">
              <Calendar className="w-4 h-4 mr-1.5" />
              Ver Grade do Dia
            </Link>
          </Button>
        </div>
      </div>

      {/* Grid de KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ocupação */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0E7490]" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Ocupação da Grade Hoje
            </CardTitle>
            <Clock className="w-4 h-4 text-[#0E7490]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{ocupacaoPct}%</div>
            <p className="text-[11px] text-slate-500 mt-1">
              {agendamentosHoje.length} consultas agendadas para hoje
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Faturamento (Com Entitlement Graceful Degradation) */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Faturamento Realizado
            </CardTitle>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {hasFinanceiro ? (
              <>
                <div className="text-2xl font-bold text-slate-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    faturamentoTotal,
                  )}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Recebimentos liquidados via Pix/Cartão
                </p>
              </>
            ) : (
              <div className="py-1">
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 font-normal">
                  <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                  Disponível no Plano Pro
                </Badge>
                <p className="text-[10px] text-slate-400 mt-1">
                  Módulo Financeiro desativado para esta clínica
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Pacientes Ativos */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Pacientes em Base</CardTitle>
            <Users className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{pacientesTotal}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cadastros clínicos isolados por tenant_id
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Taxa de No-Show / Risco de Evasão */}
        <Card className="border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Risco de Evasão (BL-014)
            </CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pacientesRisco.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Pacientes com score &gt; 50% sem retorno recente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade de Conteúdo: Próximos Atendimentos e Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de Próximos Agendamentos do Dia (2 cols) */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold text-slate-800">
                Próximos Atendimentos do Dia
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Grade cronológica com status operacional em tempo real
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-[#0E7490] hover:text-[#155E75]"
            >
              <Link to="/agenda" className="flex items-center gap-1">
                Agenda completa <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {agendamentosHoje.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400 text-xs">
                Nenhum agendamento para hoje neste consultório.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {agendamentosHoje.map((ag) => {
                  const hora = ag.data_inicio.slice(11, 16)
                  const pacNome = ag.expand?.paciente_id?.nome || 'Paciente'
                  const profNome = ag.expand?.profissional_id?.nome || 'Profissional'

                  const statusColors: Record<string, string> = {
                    confirmado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    presente: 'bg-blue-50 text-blue-700 border-blue-200',
                    pendente: 'bg-amber-50 text-amber-700 border-amber-200',
                    em_atendimento: 'bg-purple-50 text-purple-700 border-purple-200',
                    concluido: 'bg-slate-100 text-slate-600 border-slate-200',
                    cancelado: 'bg-red-50 text-red-700 border-red-200',
                    falta: 'bg-rose-50 text-rose-700 border-rose-200',
                  }

                  return (
                    <div
                      key={ag.id}
                      className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 text-center py-1 bg-slate-100 rounded text-xs font-mono font-semibold text-slate-700">
                          {hora}
                        </div>
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-900">
                            {pacNome}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{ag.procedimento}</span>
                            <span>•</span>
                            <span className="text-slate-400">{profNome}</span>
                            {ag.sala && (
                              <>
                                <span>•</span>
                                <span className="text-cyan-700 font-medium">{ag.sala}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize px-2 py-0.5 ${statusColors[ag.status] || ''}`}
                        >
                          {ag.status.replace('_', ' ')}
                        </Badge>
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                          <Link to={`/prontuario/${ag.paciente_id}`}>Prontuário</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna Direita: Alertas de Risco de Evasão e Resumo de Compliance LGPD */}
        <div className="space-y-6">
          {/* Card Alerta Score de Evasão */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Atenção ao Risco de Evasão
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pacientes que necessitam contato ativo para retenção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pacientesRisco.length === 0 ? (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Todos os pacientes estão com boa frequência e retenção!</span>
                </div>
              ) : (
                pacientesRisco.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{p.nome}</div>
                      <div className="text-[11px] text-slate-500">{p.telefone || p.email}</div>
                    </div>
                    <Badge
                      variant="destructive"
                      className="text-[10px] bg-amber-500 hover:bg-amber-600"
                    >
                      Score {p.score_evasao}%
                    </Badge>
                  </div>
                ))
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs text-[#0E7490] border-cyan-200 hover:bg-cyan-50"
              >
                <Link to="/pacientes">Ver Lista de Pacientes</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Compliance Card: LGPD e Imutabilidade */}
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-[#0E7490]" />
                Segurança & Conformidade CFO
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 space-y-2">
              <p>
                • <strong>Multi-tenancy RLS:</strong> Isolamento estrito por tenant_id em todas as
                coleções.
              </p>
              <p>
                • <strong>Auditoria LGPD Ativa:</strong> Coleção append-only sem permissão de
                alteração ou exclusão via API.
              </p>
              <p>
                • <strong>Entitlements v2.0:</strong> Feature flags dinâmicas com degradação
                graciosa em tempo real.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
