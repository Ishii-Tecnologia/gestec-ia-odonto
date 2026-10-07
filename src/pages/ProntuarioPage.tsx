import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  PacienteRecord,
  OdontogramaSnapshotRecord,
  EvolucaoClinicaRecord,
  DenteFaceStatus,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { OdontogramaInterativo } from '@/components/OdontogramaInterativo'
import { RequireProfile } from '@/components/RequireProfile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Stethoscope,
  ShieldCheck,
  History,
  Save,
  Plus,
  Clock,
  ArrowLeft,
  Calendar,
  Lock,
  FileCheck,
} from 'lucide-react'

const TEMPLATES_EVOLUCAO: Record<string, string> = {
  geral:
    'Realizada consulta de avaliação geral e profilaxia com ultrassom e jato de bicarbonato. Sem queixas álgicas agudas relatadas pelo paciente.',
  exodontia:
    'Anestesia infiltrativa com Articaína 4% com epinefrina 1:100.000. Realizada sindesmotomia e exodontia do elemento dentário por fórceps sem intercorrências. Sutura com fio de seda 3-0. Prescrita medicação pós-operatória e orientações de repouso e gelo.',
  endodontia:
    'Isolamento absoluto com dique de borracha. Acesso coronário e odontometria eletrônica. Instrumentação rotatória com limas reciprocantes. Irrigação com NaOCl a 2,5%. Curativo de demora com hidróxido de cálcio e selamento provisório.',
  ortodontia:
    'Atendimento de manutenção ortodôntica mensal. Troca de arcos de NiTi para aço 0.016. Ajuste de torque e substituição das ligaduras elásticas. Próxima consulta em 30 dias.',
  protese:
    'Moldagem de precisão com silicone de condensação (pasta pesada e fluida) para coroa cerâmica sobre dente preparado. Realizada checagem de oclusão e cor pelo guia Vita.',
}

export default function ProntuarioPage() {
  const { id } = useParams<{ id: string }>()
  const { tenantId, user, perfil } = useAuth()
  const { toast } = useToast()

  const [paciente, setPaciente] = useState<PacienteRecord | null>(null)
  const [snapshots, setSnapshots] = useState<OdontogramaSnapshotRecord[]>([])
  const [currentPayload, setCurrentPayload] = useState<Record<string, DenteFaceStatus>>({})
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('novo')

  const [evolucoes, setEvolucoes] = useState<EvolucaoClinicaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Nova Evolução
  const [novaEvolucaoTexto, setNovaEvolucaoTexto] = useState(TEMPLATES_EVOLUCAO.geral)
  const [novaEspecialidade, setNovaEspecialidade] =
    useState<EvolucaoClinicaRecord['especialidade']>('geral')
  const [salvandoEvolucao, setSalvandoEvolucao] = useState(false)
  const [salvandoSnapshot, setSalvandoSnapshot] = useState(false)

  useEffect(() => {
    if (!id) return
    async function carregarProntuario() {
      setLoading(true)
      try {
        // 1. Paciente
        const p = await pb.collection('pacientes').getOne<PacienteRecord>(id!)
        setPaciente(p)

        // 2. Snapshots do Odontograma (RF-020)
        const snaps = await pb
          .collection('odontogramas_snapshots')
          .getList<OdontogramaSnapshotRecord>(1, 50, {
            filter: `paciente_id = '${id}'`,
            sort: '-created',
          })
        setSnapshots(snaps.items)

        if (snaps.items.length > 0) {
          setCurrentPayload(snaps.items[0].payload || {})
          setSelectedSnapshotId(snaps.items[0].id)
        } else {
          setCurrentPayload({})
          setSelectedSnapshotId('novo')
        }

        // 3. Evoluções Clínicas (Append-Only - RF-026)
        const evs = await pb
          .collection('evolucoes_clinicas')
          .getList<EvolucaoClinicaRecord>(1, 100, {
            filter: `paciente_id = '${id}'`,
            sort: '-created',
          })
        setEvolucoes(evs.items)

        // 4. Auditoria LGPD Indelével de visualização do prontuário (CA-LGPD / BL-011)
        await registrarAuditoria({
          tenantId,
          userEmail: user?.email,
          perfil,
          targetPatientId: id,
          acao: 'visualizou_prontuario',
          detalhes: `Acesso clínico ao odontograma e evolução do paciente ${p.nome}`,
        })
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar prontuário',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    carregarProntuario()
  }, [id, tenantId])

  // Salvar Novo Snapshot do Odontograma (Gera nova versão congelada - RF-026)
  const handleGravarSnapshot = async () => {
    if (!id) return
    setSalvandoSnapshot(true)
    try {
      const snap = await pb.collection('odontogramas_snapshots').create<OdontogramaSnapshotRecord>({
        tenant_id: tenantId,
        paciente_id: id,
        data: new Date().toISOString().slice(0, 10),
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        payload: currentPayload,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'gravou_snapshot_odontograma',
        detalhes: `Versão imutável do odontograma gravada com sucesso (ID: ${snap.id})`,
      })

      toast({
        title: 'Snapshot do Odontograma Salvo (RF-026)',
        description: 'Nova versão imutável do mapa dentário registrada com data de hoje.',
      })

      // Recarregar snapshots
      const snaps = await pb
        .collection('odontogramas_snapshots')
        .getList<OdontogramaSnapshotRecord>(1, 50, {
          filter: `paciente_id = '${id}'`,
          sort: '-created',
        })
      setSnapshots(snaps.items)
      setSelectedSnapshotId(snap.id)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar odontograma',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoSnapshot(false)
    }
  }

  // Gravar Nova Evolução Clínica (Append-Only - sem edição de anteriores)
  const handleGravarEvolucao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !novaEvolucaoTexto.trim()) return

    setSalvandoEvolucao(true)
    try {
      const agoraStr = new Date().toLocaleString('pt-BR')
      const nova = await pb.collection('evolucoes_clinicas').create<EvolucaoClinicaRecord>({
        tenant_id: tenantId,
        paciente_id: id,
        data: agoraStr,
        especialidade: novaEspecialidade,
        descricao: novaEvolucaoTexto.trim(),
        dentista_nome: user?.name || 'Cirurgião-Dentista',
        cro: user?.cro || 'CRO-SP 89234',
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'adicionou_evolucao_clinica',
        detalhes: `Novo adendo clínico em modo append-only (Especialidade: ${novaEspecialidade})`,
      })

      toast({
        title: 'Evolução Clínica Registrada!',
        description: 'Registro adicionado de forma append-only sem sobrescrita (CA-Prontuário).',
      })

      setNovaEvolucaoTexto(TEMPLATES_EVOLUCAO[novaEspecialidade] || '')
      // Recarregar evoluções
      const evs = await pb.collection('evolucoes_clinicas').getList<EvolucaoClinicaRecord>(1, 100, {
        filter: `paciente_id = '${id}'`,
        sort: '-created',
      })
      setEvolucoes(evs.items)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar evolução', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoEvolucao(false)
    }
  }

  // Trocar visualização do snapshot histórico
  const handleSelecionarSnapshot = (snapId: string) => {
    setSelectedSnapshotId(snapId)
    if (snapId === 'novo') {
      setCurrentPayload({})
    } else {
      const s = snapshots.find((item) => item.id === snapId)
      if (s) setCurrentPayload(s.payload || {})
    }
  }

  return (
    <RequireProfile allowed={['owner', 'dentista']}>
      <div className="space-y-6">
        {/* Breadcrumb e Auditoria Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-slate-500 w-fit">
            <Link to={id ? `/pacientes/${id}` : '/pacientes'}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Ficha do Paciente
            </Link>
          </Button>

          {/* Banner de Auditoria e Conformidade LGPD/CFO */}
          <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Auditoria Ativa (LGPD/CFO):</strong> Acesso registrado com IP e carimbo de
              tempo. Histórico imutável protegido.
            </span>
          </div>
        </div>

        {/* Header do Prontuário */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Prontuário Odontológico Digital</h1>
              <Badge
                variant="outline"
                className="text-[10px] bg-cyan-50 text-cyan-800 border-cyan-200"
              >
                Imutabilidade Ativa
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Paciente: <span className="font-semibold text-slate-800">{paciente?.nome}</span> •
              CPF: {paciente?.cpf || '—'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link to="/orcamentos">Novo Orçamento a partir do Plano</Link>
            </Button>
          </div>
        </div>

        {/* Abas do Prontuário: Odontograma e Evolução Clínica */}
        <Tabs defaultValue="odontograma" className="space-y-4">
          <TabsList className="bg-slate-100 p-1 border border-slate-200">
            <TabsTrigger value="odontograma" className="text-xs flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              Odontograma 32 Dentes (RF-020)
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Evolução Clínica Append-Only (RF-026)
            </TabsTrigger>
          </TabsList>

          {/* 1. Odontograma 32 Dentes */}
          <TabsContent value="odontograma" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Mapeamento Anatômico Dental Interativo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Clique sobre qualquer dente para apontar cáries, restaurações, endodontia ou
                    facetas por face
                  </CardDescription>
                </div>

                {/* Seletor de Snapshots Históricos */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Versão:</span>
                  <Select value={selectedSnapshotId} onValueChange={handleSelecionarSnapshot}>
                    <SelectTrigger className="h-8 text-xs w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Versão em Edição Atual</SelectItem>
                      {snapshots.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Snapshot de {s.data} ({s.dentista_nome || 'Dentista'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleGravarSnapshot}
                    disabled={salvandoSnapshot}
                    size="sm"
                    className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{salvandoSnapshot ? 'Gravando...' : 'Salvar Nova Versão'}</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <OdontogramaInterativo
                  payload={currentPayload}
                  onChange={setCurrentPayload}
                  readonly={selectedSnapshotId !== 'novo'}
                />

                {selectedSnapshotId !== 'novo' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      Você está visualizando uma versão histórica congelada do odontograma. Para
                      realizar novas marcações, selecione "Versão em Edição Atual".
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Evolução Clínica (Append-Only - RF-026) */}
          <TabsContent value="evolucao" className="space-y-4">
            {/* Formulário de Adicionar Nova Evolução */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#0E7490]" />
                  Adicionar Nova Evolução Clínica
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro imediato em modo append-only assinado pelo cirurgião-dentista
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGravarEvolucao} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Especialidade Clínica</Label>
                      <Select
                        value={novaEspecialidade}
                        onValueChange={(val: any) => {
                          setNovaEspecialidade(val)
                          setNovaEvolucaoTexto(TEMPLATES_EVOLUCAO[val] || '')
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="geral">Clínica Geral & Preventiva</SelectItem>
                          <SelectItem value="exodontia">Cirurgia / Exodontia</SelectItem>
                          <SelectItem value="endodontia">Endodontia</SelectItem>
                          <SelectItem value="ortodontia">Ortodontia</SelectItem>
                          <SelectItem value="periodontia">Periodontia</SelectItem>
                          <SelectItem value="protese">Prótese Dentária</SelectItem>
                          <SelectItem value="implantodontia">Implantodontia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Profissional Responsável</Label>
                      <Input
                        disabled
                        value={`${user?.name || 'Dr. Marcelo'} (${user?.cro || 'CRO-SP 104552'})`}
                        className="h-8 text-xs bg-slate-50 text-slate-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Descrição Clínica Detalhada *</Label>
                    <Textarea
                      required
                      rows={4}
                      className="text-xs font-sans leading-relaxed"
                      value={novaEvolucaoTexto}
                      onChange={(e) => setNovaEvolucaoTexto(e.target.value)}
                      placeholder="Descreva o procedimento, anestésico utilizado, faces restauradas e orientações..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        Após confirmação, este registro não poderá ser modificado ou excluído.
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={salvandoEvolucao}
                      className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 px-4"
                    >
                      {salvandoEvolucao ? 'Assinando...' : 'Assinar e Gravar Evolução'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Linha do Tempo das Evoluções Existentes */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Histórico Cronológico de Atendimentos
                </CardTitle>
                <CardDescription className="text-xs">
                  Trilha probatória e legal de todas as intervenções executadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evolucoes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Nenhuma evolução clínica registrada ainda para este paciente.
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-cyan-200 space-y-6">
                    {evolucoes.map((ev) => (
                      <div key={ev.id} className="relative group">
                        {/* Ponto na timeline */}
                        <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#0E7490] border-2 border-white ring-2 ring-cyan-100" />

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-cyan-100 text-[#0E7490] border-cyan-300 uppercase"
                              >
                                {ev.especialidade}
                              </Badge>
                              <span className="text-xs font-semibold text-slate-800">
                                {ev.dentista_nome} {ev.cro ? `(${ev.cro})` : ''}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ev.data}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {ev.descricao}
                          </p>

                          <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-emerald-600" />
                            <span>Documento digital imutável assinado eletronicamente</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RequireProfile>
  )
}
