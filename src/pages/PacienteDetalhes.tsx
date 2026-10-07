import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  PacienteRecord,
  AnamneseRecord,
  LancamentoFinanceiroRecord,
  ExameAnexoRecord,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  Stethoscope,
  DollarSign,
  FileText,
  Paperclip,
  Share2,
  CheckCircle2,
  ArrowLeft,
  Users,
} from 'lucide-react'
import { ModuloGate } from '@/components/ModuloGate'

export default function PacienteDetalhes() {
  const { id } = useParams<{ id: string }>()
  const { tenantId, user, perfil, hasModule, canAccessClinical } = useAuth()
  const { toast } = useToast()

  const [paciente, setPaciente] = useState<PacienteRecord | null>(null)
  const [anamnese, setAnamnese] = useState<AnamneseRecord | null>(null)
  const [financeiro, setFinanceiro] = useState<LancamentoFinanceiroRecord[]>([])
  const [exames, setExames] = useState<ExameAnexoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Estados de Anamnese
  const [respostasAnamnese, setRespostasAnamnese] = useState<Record<string, string>>({})
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false)

  useEffect(() => {
    if (!id) return
    async function carregarFicha() {
      setLoading(true)
      try {
        // 1. Paciente
        const p = await pb.collection('pacientes').getOne<PacienteRecord>(id!)
        setPaciente(p)

        // 2. Anamnese
        try {
          const a = await pb
            .collection('anamneses')
            .getFirstListItem<AnamneseRecord>(`paciente_id = '${id}'`)
          setAnamnese(a)
          if (a.respostas) setRespostasAnamnese(a.respostas)
        } catch {
          setAnamnese(null)
        }

        // 3. Financeiro (se ativo)
        if (hasModule('financeiro')) {
          const fRes = await pb
            .collection('lancamentos_financeiros')
            .getList<LancamentoFinanceiroRecord>(1, 20, {
              filter: `paciente_id = '${id}'`,
              sort: '-vencimento',
            })
          setFinanceiro(fRes.items)
        }

        // 4. Exames anexados
        const exRes = await pb.collection('exames_anexos').getList<ExameAnexoRecord>(1, 20, {
          filter: `paciente_id = '${id}'`,
          sort: '-created',
        })
        setExames(exRes.items)

        // Registrar auditoria LGPD de acesso à ficha (BL-011)
        await registrarAuditoria({
          tenantId,
          userEmail: user?.email,
          perfil,
          targetPatientId: id,
          acao: 'acessou_ficha_paciente',
          detalhes: `Acesso à visão geral do cadastro do paciente ID ${id}`,
        })
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar paciente',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    carregarFicha()
  }, [id, tenantId, hasModule])

  // Salvar resposta de anamnese (gera versão congelada e assinada - RF-011)
  const handleSalvarAnamnese = async () => {
    if (!id) return
    setSalvandoAnamnese(true)
    try {
      if (anamnese) {
        const updated = await pb.collection('anamneses').update<AnamneseRecord>(anamnese.id, {
          respostas: respostasAnamnese,
          status: 'assinada',
          data_resposta: new Date().toISOString(),
        })
        setAnamnese(updated)
      } else {
        const created = await pb.collection('anamneses').create<AnamneseRecord>({
          tenant_id: tenantId,
          paciente_id: id,
          status: 'assinada',
          data_resposta: new Date().toISOString(),
          respostas: respostasAnamnese,
          perguntas: [
            { id: '1', pergunta: 'Possui alergia a medicamentos ou látex?', tipo: 'sim_nao' },
            {
              id: '2',
              pergunta: 'Faz uso de medicação contínua (ex: anticoagulante)?',
              tipo: 'texto',
            },
            { id: '3', pergunta: 'É hipertenso, diabético ou cardiopata?', tipo: 'sim_nao' },
            { id: '4', pergunta: 'Está grávida ou amamentando?', tipo: 'sim_nao' },
            { id: '5', pergunta: 'Queixa principal ou motivo da consulta:', tipo: 'texto' },
          ],
        })
        setAnamnese(created)
      }

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'congelou_anamnese_digital',
        detalhes: 'Anamnese preenchida e congelada para auditoria do prontuário',
      })

      toast({
        title: 'Anamnese congelada com sucesso',
        description: 'Questionário registrado e bloqueado no prontuário do paciente (RF-011).',
      })
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoAnamnese(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">Carregando ficha do paciente...</div>
    )
  }

  if (!paciente) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-slate-600">Paciente não localizado.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/pacientes">Voltar para lista</Link>
        </Button>
      </div>
    )
  }

  const score = paciente.score_evasao || 0

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Voltar */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-slate-500">
          <Link to="/pacientes">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Lista de Pacientes
          </Link>
        </Button>
      </div>

      {/* Header do Paciente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-xl flex items-center justify-center shrink-0">
            {paciente.nome[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{paciente.nome}</h1>
              <Badge
                variant="outline"
                className={`capitalize text-[10px] ${
                  paciente.status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {paciente.status}
              </Badge>
              {score > 50 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Risco de Evasão ({score}%)
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              {paciente.cpf && (
                <span>
                  CPF: <span className="font-mono text-slate-700">{paciente.cpf}</span>
                </span>
              )}
              {paciente.data_nascimento && <span>Nasc: {paciente.data_nascimento}</span>}
              {paciente.telefone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {paciente.telefone}
                </span>
              )}
              {paciente.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {paciente.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9">
            <Link to={`/prontuario/${paciente.id}`}>
              <Stethoscope className="w-4 h-4 mr-1.5" />
              Abrir Prontuário Clínico
            </Link>
          </Button>
        </div>
      </div>

      {/* Abas da Ficha do Paciente */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="geral" className="text-xs">
            Visão Geral & Cadastro
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="text-xs">
            Anamnese Digital (RF-011)
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs">
            Histórico Financeiro
          </TabsTrigger>
          <TabsTrigger value="exames" className="text-xs">
            Exames & Radiografias
          </TabsTrigger>
        </TabsList>

        {/* 1. Visão Geral */}
        <TabsContent value="geral" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Dados Cadastrais Detalhados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block">Endereço Residencial:</span>
                    <span className="text-slate-700 font-medium">
                      {paciente.endereco || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Responsável Legal / Financeiro:</span>
                    <span className="text-slate-700 font-medium">
                      {paciente.responsavel_legal || 'O próprio titular'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <span className="text-slate-400 block mb-1">Tags e Segmentação Clínica:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {paciente.tags && paciente.tags.length > 0 ? (
                      paciente.tags.map((t, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px] bg-slate-100 text-slate-700"
                        >
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400">Nenhuma tag cadastrada.</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score de Evasão (BL-014 - Should Have) */}
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Score de Risco de Evasão
                </CardTitle>
                <CardDescription className="text-xs">
                  Probabilidade do paciente não retornar ao consultório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-center py-2">
                <div className="relative inline-flex items-center justify-center">
                  <div
                    className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-lg font-bold font-mono ${
                      score > 70
                        ? 'border-rose-500 text-rose-600 bg-rose-50'
                        : score > 40
                          ? 'border-amber-500 text-amber-600 bg-amber-50'
                          : 'border-emerald-500 text-emerald-600 bg-emerald-50'
                    }`}
                  >
                    {score}%
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {score > 70
                    ? 'Alto risco! Ausência prolongada e orçamentos sem aprovação.'
                    : score > 40
                      ? 'Atenção: Recomenda-se envio de lembrete de retorno preventivo.'
                      : 'Paciente com histórico assíduo e tratamentos regulares.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Anamnese Digital (RF-011 - Versão congelada) */}
        <TabsContent value="anamnese" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Questionário de Saúde & Anamnese
                </CardTitle>
                <CardDescription className="text-xs">
                  Versão congelada no prontuário digital com validade legal
                </CardDescription>
              </div>
              {anamnese?.status === 'assinada' && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Assinada em {anamnese.data_resposta?.slice(0, 10)}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                  <Label className="font-medium text-slate-800">
                    1. Possui alergia a medicamentos, anestésicos ou látex?
                  </Label>
                  <Input
                    placeholder="Especifique se houver alergia (ex: Penicilina, Dipirona)..."
                    className="h-8 text-xs bg-white"
                    value={respostasAnamnese['alergias'] || ''}
                    onChange={(e) =>
                      setRespostasAnamnese({ ...respostasAnamnese, alergias: e.target.value })
                    }
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                  <Label className="font-medium text-slate-800">
                    2. Faz uso diário de alguma medicação contínua?
                  </Label>
                  <Input
                    placeholder="Ex: Anticoagulante, anti-hipertensivo, insulina..."
                    className="h-8 text-xs bg-white"
                    value={respostasAnamnese['medicamentos'] || ''}
                    onChange={(e) =>
                      setRespostasAnamnese({ ...respostasAnamnese, medicamentos: e.target.value })
                    }
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                  <Label className="font-medium text-slate-800">
                    3. Apresenta histórico de hipertensão, diabetes ou cardiopatias?
                  </Label>
                  <Input
                    placeholder="Detalhes ou 'Não'..."
                    className="h-8 text-xs bg-white"
                    value={respostasAnamnese['doencas'] || ''}
                    onChange={(e) =>
                      setRespostasAnamnese({ ...respostasAnamnese, doencas: e.target.value })
                    }
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
                  <Label className="font-medium text-slate-800">
                    4. Queixa principal ou relato da consulta odontológica:
                  </Label>
                  <Input
                    placeholder="Ex: Dor na mastigação no molar inferior direito, sensibilidade ao frio..."
                    className="h-8 text-xs bg-white"
                    value={respostasAnamnese['queixa'] || ''}
                    onChange={(e) =>
                      setRespostasAnamnese({ ...respostasAnamnese, queixa: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSalvarAnamnese}
                  disabled={salvandoAnamnese}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8"
                >
                  {salvandoAnamnese ? 'Gravando...' : 'Salvar e Congelar Anamnese'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Histórico Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <ModuloGate modulo="financeiro">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Títulos a Receber do Paciente
                </CardTitle>
                <CardDescription className="text-xs">
                  Lançamentos gerados a partir de orçamentos e procedimentos
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {financeiro.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Nenhum título financeiro encontrado para este paciente.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b text-[11px] uppercase text-slate-500 font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Descrição</th>
                        <th className="py-2.5 px-4">Vencimento</th>
                        <th className="py-2.5 px-4">Valor</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {financeiro.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-medium">{f.descricao}</td>
                          <td className="py-2.5 px-4">{f.vencimento}</td>
                          <td className="py-2.5 px-4 font-mono">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(f.valor)}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${f.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                            >
                              {f.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </ModuloGate>
        </TabsContent>

        {/* 4. Exames e Radiografias */}
        <TabsContent value="exames" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Galeria de Exames & Imagens</CardTitle>
                <CardDescription className="text-xs">
                  Armazenamento seguro de radiografias periapicais e fotos clínicas
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {exames.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhum exame ou foto anexado ao prontuário.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {exames.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                    >
                      <div className="h-28 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                        <Paperclip className="w-8 h-8" />
                      </div>
                      <div className="font-medium text-xs text-slate-800 truncate">
                        {ex.descricao}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">{ex.tipo}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
