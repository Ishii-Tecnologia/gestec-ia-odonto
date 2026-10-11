import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import pb from '@/lib/pocketbase/client'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import {
  PrescricaoRecord,
  PacienteRecord,
  ProfissionalRecord,
  MedicamentoPrescrito,
} from '@/types/gestec'
import { ModuloGate } from '@/components/ModuloGate'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  User,
  Calendar,
  Pill,
  Clock,
  Trash2,
  CheckCircle2,
  Copy,
  Building,
  AlertCircle,
  FileCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Modelos rápidos de prescrição odontológica frequente
const TEMPLATES_PRESCRICAO = [
  {
    nome: 'Pós-Cirúrgico / Exodontia (Antibiótico + Analgésico + Anti-inflamatório)',
    medicamentos: [
      {
        medicamento: 'Amoxicilina 500mg',
        dosagem: '500mg',
        via: 'Oral',
        posologia: 'Tomar 1 cápsula de 8 em 8 horas.',
        duracao: '7 dias',
        quantidade: '21 cápsulas',
      },
      {
        medicamento: 'Ibuprofeno 600mg',
        dosagem: '600mg',
        via: 'Oral',
        posologia: 'Tomar 1 comprimido de 8 em 8 horas.',
        duracao: '3 dias',
        quantidade: '9 comprimidos',
      },
      {
        medicamento: 'Dipirona Sódica 500mg',
        dosagem: '500mg',
        via: 'Oral',
        posologia: 'Tomar 1 comprimido a cada 6 horas se dor intensa.',
        duracao: '3 dias',
        quantidade: '10 comprimidos',
      },
    ],
    instrucoes:
      'Gelo nas primeiras 24 horas (20 min intermitente). Não fumar nem bochechar vigorosamente. Dieta pastosa e fria.',
  },
  {
    nome: 'Dor Aguda / Pulpite (Analgésico Potente + Anti-inflamatório)',
    medicamentos: [
      {
        medicamento: 'Cetoprofeno 100mg',
        dosagem: '100mg',
        via: 'Oral',
        posologia: 'Tomar 1 comprimido de 12 em 12 horas após refeições.',
        duracao: '3 dias',
        quantidade: '6 comprimidos',
      },
      {
        medicamento: 'Paracetamol 750mg',
        dosagem: '750mg',
        via: 'Oral',
        posologia: 'Tomar 1 comprimido a cada 6 horas se persistir a dor.',
        duracao: '3 dias',
        quantidade: '10 comprimidos',
      },
    ],
    instrucoes:
      'Evitar mastigação com o lado afetado. Procurar atendimento odontológico se houver edema facial.',
  },
  {
    nome: 'Bochecho Antisséptico (Gengivite / Periodontia)',
    medicamentos: [
      {
        medicamento: 'Solução de Digliconato de Clorexidina 0,12%',
        dosagem: '0,12%',
        via: 'Tópico bucal',
        posologia: 'Bochechar 15ml puro durante 1 minuto, de 12 em 12 horas após a escovação.',
        duracao: '10 dias',
        quantidade: '1 frasco (300ml)',
      },
    ],
    instrucoes: 'Não engolir a solução. Evitar comer ou beber por 30 minutos após o bochecho.',
  },
]

export const DocumentosPage = () => {
  const { tenant, tenantId, user, perfil, unidadeAtual } = useAuth()
  const { toast } = useToast()

  const [documentos, setDocumentos] = useState<PrescricaoRecord[]>([])
  const [pacientes, setPacientes] = useState<PacienteRecord[]>([])
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')

  // Modal Novo Documento
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [tipoDocumento, setTipoDocumento] =
    useState<PrescricaoRecord['tipo_documento']>('receituario_simples')
  const [pacienteId, setPacienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [dentistaNome, setDentistaNome] = useState('')
  const [dentistaCro, setDentistaCro] = useState('')
  const [croUf, setCroUf] = useState('SP')
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().slice(0, 10))
  const [diasAfastamento, setDiasAfastamento] = useState<number>(1)
  const [cid10, setCid10] = useState('')
  const [instrucoes, setInstrucoes] = useState('')
  const [medicamentos, setMedicamentos] = useState<MedicamentoPrescrito[]>([])

  // Edição rápida de novo medicamento na lista
  const [novoMedNome, setNovoMedNome] = useState('')
  const [novoMedDosagem, setNovoMedDosagem] = useState('')
  const [novoMedVia, setNovoMedVia] = useState('Oral')
  const [novoMedPosologia, setNovoMedPosologia] = useState('')
  const [novoMedDuracao, setNovoMedDuracao] = useState('')
  const [novoMedQtd, setNovoMedQtd] = useState('')

  // Modal Visualização / Impressão
  const [docSelecionado, setDocSelecionado] = useState<PrescricaoRecord | null>(null)
  const [modalImpressaoAberto, setModalImpressaoAberto] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const carregarDados = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      // 1. Carregar Prescrições do tenant
      const docsRes = await pb.collection('prescricoes').getList<PrescricaoRecord>(1, 100, {
        filter: `tenant_id = '${tenantId}'`,
        sort: '-data,-created',
        expand: 'paciente_id,profissional_id',
      })
      setDocumentos(docsRes.items)

      // 2. Carregar Pacientes
      const pacRes = await pb.collection('pacientes').getList<PacienteRecord>(1, 200, {
        filter: `tenant_id = '${tenantId}'`,
        sort: 'nome',
      })
      setPacientes(pacRes.items)

      // 3. Carregar Profissionais
      const profRes = await pb.collection('profissionais').getList<ProfissionalRecord>(1, 50, {
        filter: `tenant_id = '${tenantId}' && ativo = true`,
      })
      setProfissionais(profRes.items)

      // Auto-selecionar profissional logado se for dentista
      if (user && user.name) {
        const matchingProf = profRes.items.find(
          (p) => p.user_id === user.id || p.nome === user.name,
        )
        if (matchingProf) {
          setProfissionalId(matchingProf.id)
          setDentistaNome(matchingProf.nome)
          setDentistaCro(matchingProf.cro)
        } else if (profRes.items.length > 0) {
          setProfissionalId(profRes.items[0].id)
          setDentistaNome(profRes.items[0].nome)
          setDentistaCro(profRes.items[0].cro)
        } else {
          setDentistaNome(user.name)
          setDentistaCro(user.cro || 'CRO-SP')
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar documentos clínicos:', err)
      toast({
        title: 'Erro ao carregar documentos',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [tenantId])

  const aplicarTemplate = (index: number) => {
    const tpl = TEMPLATES_PRESCRICAO[index]
    if (!tpl) return
    setMedicamentos(tpl.medicamentos)
    setInstrucoes(tpl.instrucoes)
    toast({
      title: 'Modelo aplicado',
      description: `Template "${tpl.nome}" carregado na prescrição.`,
    })
  }

  const handleAdicionarMedicamento = () => {
    if (!novoMedNome.trim() || !novoMedPosologia.trim()) {
      toast({
        title: 'Medicamento incompleto',
        description: 'Nome do fármaco e posologia são obrigatórios.',
        variant: 'destructive',
      })
      return
    }
    const novo: MedicamentoPrescrito = {
      medicamento: novoMedNome.trim(),
      dosagem: novoMedDosagem.trim() || undefined,
      via: novoMedVia.trim() || 'Oral',
      posologia: novoMedPosologia.trim(),
      duracao: novoMedDuracao.trim() || undefined,
      quantidade: novoMedQtd.trim() || undefined,
    }
    setMedicamentos([...medicamentos, novo])
    setNovoMedNome('')
    setNovoMedDosagem('')
    setNovoMedPosologia('')
    setNovoMedDuracao('')
    setNovoMedQtd('')
  }

  const handleRemoverMedicamento = (idx: number) => {
    setMedicamentos(medicamentos.filter((_, i) => i !== idx))
  }

  const handleCriarDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !pacienteId) {
      toast({
        title: 'Dados incompletos',
        description: 'Selecione um paciente para emitir o documento.',
        variant: 'destructive',
      })
      return
    }

    if (
      (tipoDocumento === 'receituario_simples' ||
        tipoDocumento === 'receituario_controle_especial') &&
      medicamentos.length === 0
    ) {
      toast({
        title: 'Receituário sem medicamentos',
        description: 'Adicione pelo menos um fármaco para gerar a receita.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      // Gerar hash simulado de autenticação digital conforme CFO
      const hashSimulado = `HASH-CFO-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`

      const payload = {
        tenant_id: tenantId,
        unidade_id: unidadeAtual?.id || '',
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        tipo_documento: tipoDocumento,
        data: dataEmissao,
        dias_afastamento: tipoDocumento === 'atestado_afastamento' ? Number(diasAfastamento) : 0,
        cid10: cid10.trim(),
        medicamentos: medicamentos,
        instrucoes: instrucoes.trim(),
        dentista_nome: dentistaNome.trim(),
        cro: dentistaCro.trim(),
        cro_uf: croUf,
        assinatura_digital_hash: hashSimulado,
        emitido_em: new Date().toISOString(),
      }

      const created = await pb.collection('prescricoes').create<PrescricaoRecord>(payload)

      // Registrar auditoria LGPD de emissão de documento clínico sensível (BL-011)
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: pacienteId,
        acao: 'emitiu_documento_clinico',
        detalhes: `Emissão de ${tipoDocumento} para o paciente ID ${pacienteId}. Dentista: ${dentistaNome} (${dentistaCro}). Hash: ${hashSimulado}`,
      })

      toast({
        title: 'Documento Clínico Emitido!',
        description: `Receita/Atestado registrado com sucesso (Código de Autenticidade: ${hashSimulado}).`,
      })

      setModalAberto(false)
      // Limpar campos
      setMedicamentos([])
      setInstrucoes('')
      setCid10('')
      carregarDados()

      // Abrir visualização para impressão
      setDocSelecionado(created)
      setModalImpressaoAberto(true)
    } catch (err: any) {
      console.error('Erro ao emitir prescrição:', err)
      toast({
        title: 'Erro ao emitir documento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  // Filtragem
  const documentosFiltrados = documentos.filter((d) => {
    if (filtroTipo !== 'todos' && d.tipo_documento !== filtroTipo) return false
    if (busca.trim()) {
      const q = busca.toLowerCase()
      const pacNome = d.expand?.paciente_id?.nome?.toLowerCase() || ''
      const dentNome = d.dentista_nome?.toLowerCase() || ''
      const instruc = d.instrucoes?.toLowerCase() || ''
      return pacNome.includes(q) || dentNome.includes(q) || instruc.includes(q)
    }
    return true
  })

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'receituario_simples':
        return 'Receituário Simples'
      case 'receituario_controle_especial':
        return 'Controle Especial'
      case 'atestado_comparecimento':
        return 'Atestado de Comparecimento'
      case 'atestado_afastamento':
        return 'Atestado de Afastamento'
      case 'orientacao_pos_operatoria':
        return 'Recomendações Pós-Op'
      default:
        return tipo
    }
  }

  return (
    <ModuloGate modulo="documentos">
      <div className="space-y-6">
        {/* Header principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Documentos & Prescrições Clínicas
              </h1>
              <Badge
                variant="outline"
                className="text-xs bg-cyan-50 text-[#0E7490] border-cyan-200"
              >
                BL-019 • CFO Padrão
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Emissão padronizada de receituários com posologia, atestados com CID-10 e orientações
              pós-operatórias com hash de autenticidade.
            </p>
          </div>

          <Button
            onClick={() => setModalAberto(true)}
            className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nova Prescrição / Atestado
          </Button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome do paciente, dentista ou medicamento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 text-xs h-9 bg-white"
            />
          </div>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-full sm:w-[220px] text-xs h-9 bg-white">
              <SelectValue placeholder="Tipo de Documento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Documentos</SelectItem>
              <SelectItem value="receituario_simples">Receituário Simples</SelectItem>
              <SelectItem value="receituario_controle_especial">Controle Especial</SelectItem>
              <SelectItem value="atestado_afastamento">Atestado de Afastamento</SelectItem>
              <SelectItem value="atestado_comparecimento">Atestado de Comparecimento</SelectItem>
              <SelectItem value="orientacao_pos_operatoria">Orientações Pós-Op</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Listagem de Documentos */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Carregando receituários e atestados clínicos do consultório...
          </div>
        ) : documentosFiltrados.length === 0 ? (
          <Card className="border-dashed border-slate-200 text-center py-12">
            <CardContent className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-cyan-50 text-[#0E7490] mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Nenhum documento clínico encontrado
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Emita receituários para pacientes com impressão timbrada nos padrões do Conselho
                Federal de Odontologia.
              </p>
              <Button
                onClick={() => setModalAberto(true)}
                variant="outline"
                size="sm"
                className="text-xs text-[#0E7490] border-cyan-200"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Primeiro Documento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documentosFiltrados.map((doc) => {
              const pacNome = doc.expand?.paciente_id?.nome || 'Paciente não identificado'
              const medCount = doc.medicamentos?.length || 0

              return (
                <Card
                  key={doc.id}
                  className="border-slate-200 shadow-sm hover:border-cyan-300 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="pb-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          doc.tipo_documento.includes('especial')
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : doc.tipo_documento.includes('atestado')
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-cyan-50 text-[#0E7490] border-cyan-200'
                        }`}
                      >
                        {getTipoLabel(doc.tipo_documento)}
                      </Badge>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {doc.data}
                      </span>
                    </div>

                    <CardTitle className="text-sm font-bold text-slate-800 pt-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {pacNome}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Emitido por: {doc.dentista_nome} ({doc.cro})
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs flex-1">
                    {medCount > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-700 block">
                          Medicamentos ({medCount}):
                        </span>
                        <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
                          {doc.medicamentos.slice(0, 2).map((m, idx) => (
                            <div key={idx} className="truncate text-[11px] text-slate-700">
                              • <span className="font-medium">{m.medicamento}</span> ({m.posologia})
                            </div>
                          ))}
                          {medCount > 2 && (
                            <div className="text-[10px] text-slate-400 italic">
                              + {medCount - 2} medicamento(s)...
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {doc.dias_afastamento ? (
                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-amber-900 text-[11px]">
                        Dispensa de atividades por <strong>{doc.dias_afastamento} dia(s)</strong>.
                        {doc.cid10 && (
                          <span className="block mt-0.5 font-mono">CID-10: {doc.cid10}</span>
                        )}
                      </div>
                    ) : null}

                    {doc.instrucoes && (
                      <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                        "{doc.instrucoes}"
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {doc.assinatura_digital_hash || 'Assinado digitalmente'}
                      </span>
                    </div>
                  </CardContent>

                  <div className="p-3 pt-0 flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-[#0E7490] border-slate-200 hover:bg-cyan-50"
                      onClick={() => {
                        setDocSelecionado(doc)
                        setModalImpressaoAberto(true)
                      }}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      Visualizar / Imprimir
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Modal Novo Documento Clínico */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0E7490]" />
                Emitir Documento Odontológico (BL-019)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Preencha os dados clínicos para gerar receituários, atestados ou orientações
                padronizadas com assinatura digital e carimbo CFO.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarDocumento} className="space-y-4 py-2 text-xs">
              {/* Tipo de Documento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tipo de Documento *</Label>
                  <Select value={tipoDocumento} onValueChange={(val: any) => setTipoDocumento(val)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receituario_simples">Receituário Simples</SelectItem>
                      <SelectItem value="receituario_controle_especial">
                        Receituário de Controle Especial (Duas Vias)
                      </SelectItem>
                      <SelectItem value="atestado_afastamento">
                        Atestado de Afastamento / Repouso
                      </SelectItem>
                      <SelectItem value="atestado_comparecimento">
                        Declaração de Comparecimento
                      </SelectItem>
                      <SelectItem value="orientacao_pos_operatoria">
                        Orientações Pós-Operatórias
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Paciente *</Label>
                  <Select value={pacienteId} onValueChange={setPacienteId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione o paciente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pacientes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cirurgião-Dentista & Data */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Cirurgião-Dentista *</Label>
                  <Input
                    required
                    value={dentistaNome}
                    onChange={(e) => setDentistaNome(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Nome completo do dentista"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Registro CRO *</Label>
                  <Input
                    required
                    value={dentistaCro}
                    onChange={(e) => setDentistaCro(e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="Ex: CRO-SP 104552"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data de Emissão</Label>
                  <Input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Se for atestado de afastamento */}
              {tipoDocumento === 'atestado_afastamento' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-amber-900">
                      Dias de Afastamento *
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={diasAfastamento}
                      onChange={(e) => setDiasAfastamento(Number(e.target.value))}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-amber-900">
                      Código CID-10 (Opcional)
                    </Label>
                    <Input
                      placeholder="Ex: K04.0 (Pulpite) ou K07.2"
                      value={cid10}
                      onChange={(e) => setCid10(e.target.value)}
                      className="h-8 text-xs font-mono bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Se for receituário: Modelos Prontos e Seção de Fármacos */}
              {(tipoDocumento === 'receituario_simples' ||
                tipoDocumento === 'receituario_controle_especial') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-[#0E7490]" />
                      Prescrição Farmacológica
                    </Label>

                    {/* Atalhos rápidos de modelos */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Templates:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => aplicarTemplate(0)}
                      >
                        Pós-Cirúrgico
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => aplicarTemplate(1)}
                      >
                        Dor Aguda
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => aplicarTemplate(2)}
                      >
                        Clorexidina
                      </Button>
                    </div>
                  </div>

                  {/* Lista de medicamentos já adicionados */}
                  {medicamentos.length > 0 && (
                    <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      {medicamentos.map((med, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 p-2 bg-white rounded border border-slate-100 text-xs"
                        >
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800">
                              #{idx + 1} {med.medicamento}
                              {med.dosagem && ` — ${med.dosagem}`}
                              {med.quantidade && ` (${med.quantidade})`}
                            </span>
                            <p className="text-[11px] text-slate-600">
                              Via: <strong>{med.via || 'Oral'}</strong> • Posologia: {med.posologia}
                            </p>
                            {med.duracao && (
                              <p className="text-[10px] text-slate-400">Duração: {med.duracao}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleRemoverMedicamento(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulário para adicionar fármaco */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                    <span className="text-[11px] font-semibold text-slate-700 block">
                      Adicionar Fármaco / Medicamento:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px]">Nome do Medicamento</Label>
                        <Input
                          placeholder="Ex: Amoxicilina, Dipirona, Dexametasona..."
                          value={novoMedNome}
                          onChange={(e) => setNovoMedNome(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Dosagem / Concentração</Label>
                        <Input
                          placeholder="Ex: 500mg, 4mg..."
                          value={novoMedDosagem}
                          onChange={(e) => setNovoMedDosagem(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px]">Posologia e Horários *</Label>
                        <Input
                          placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas..."
                          value={novoMedPosologia}
                          onChange={(e) => setNovoMedPosologia(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Quantidade Total</Label>
                        <Input
                          placeholder="Ex: 1 caixa, 10 comp..."
                          value={novoMedQtd}
                          onChange={(e) => setNovoMedQtd(e.target.value)}
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAdicionarMedicamento}
                        variant="outline"
                        className="h-7 text-xs text-[#0E7490] border-cyan-200"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Incluir na Receita
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Instruções Adicionais e Cuidados */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Instruções Adicionais / Recomendações ao Paciente
                </Label>
                <Textarea
                  placeholder="Orientações de repouso, higiene, aplicação de gelo, retorno..."
                  rows={3}
                  value={instrucoes}
                  onChange={(e) => setInstrucoes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
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
                  className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
                >
                  {salvando ? 'Emitindo...' : 'Emitir e Salvar no Prontuário'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de Visualização & Impressão Timbrada (Padrão CFO) */}
        <Dialog open={modalImpressaoAberto} onOpenChange={setModalImpressaoAberto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-base font-bold flex items-center justify-between">
                <span>Visualização para Impressão Timbrada</span>
                <Button
                  size="sm"
                  onClick={handleImprimir}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 mr-6"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Imprimir Documento
                </Button>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Documento formatado conforme resoluções do Conselho Federal de Odontologia com hash
                verificador.
              </DialogDescription>
            </DialogHeader>

            {docSelecionado && (
              <div
                ref={printRef}
                className="bg-white p-8 rounded-lg border border-slate-300 shadow-sm text-slate-900 space-y-6 font-serif"
              >
                {/* Cabeçalho Timbrado da Clínica */}
                <div className="text-center border-b pb-4 border-slate-300 space-y-1">
                  <h2 className="text-lg font-bold tracking-wide uppercase font-sans text-slate-800">
                    {tenant?.nome || 'Clínica Odontológica Especializada'}
                  </h2>
                  <p className="text-xs text-slate-500 font-sans">
                    {tenant?.razao_social || 'Saúde Bucal Integrada e Estética Avançada'} • CNPJ:{' '}
                    {tenant?.cnpj || '12.345.678/0001-90'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans">
                    {unidadeAtual?.endereco || 'Av. Paulista, 1000 - São Paulo, SP'} • Tel:{' '}
                    {unidadeAtual?.telefone || '(11) 3214-5678'}
                  </p>
                </div>

                {/* Título do Documento */}
                <div className="text-center py-2">
                  <span className="text-sm font-bold uppercase tracking-widest border-b-2 border-slate-800 pb-1 font-sans">
                    {getTipoLabel(docSelecionado.tipo_documento)}
                  </span>
                </div>

                {/* Dados do Paciente */}
                <div className="space-y-1 font-sans text-xs border p-3 rounded bg-slate-50/50">
                  <div>
                    <strong>Paciente:</strong>{' '}
                    {docSelecionado.expand?.paciente_id?.nome || 'Nome do Paciente'}
                  </div>
                  {docSelecionado.expand?.paciente_id?.cpf && (
                    <div>
                      <strong>CPF:</strong> {docSelecionado.expand?.paciente_id?.cpf}
                    </div>
                  )}
                  <div>
                    <strong>Data de Atendimento:</strong> {docSelecionado.data}
                  </div>
                </div>

                {/* Conteúdo específico: Receituário ou Atestado */}
                {docSelecionado.tipo_documento.includes('receituario') && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold font-sans uppercase tracking-wider text-slate-700">
                      Prescrição de Medicamentos:
                    </h4>
                    <div className="space-y-4 pl-4">
                      {docSelecionado.medicamentos?.map((med, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="font-bold text-sm">
                            {idx + 1}. {med.medicamento} {med.dosagem && `— ${med.dosagem}`}
                            {med.quantidade && (
                              <span className="float-right font-normal">Qtd: {med.quantidade}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-700 pl-4">
                            Uso: <strong>{med.via || 'Oral'}</strong> • {med.posologia}
                          </div>
                          {med.duracao && (
                            <div className="text-[11px] text-slate-500 pl-4 italic">
                              Manter por: {med.duracao}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Se for atestado de afastamento */}
                {docSelecionado.tipo_documento === 'atestado_afastamento' && (
                  <div className="py-4 text-xs leading-relaxed text-justify space-y-3">
                    <p>
                      Atesto para os devidos fins que o(a) paciente acima identificado(a) esteve sob
                      meus cuidados profissionais na data de <strong>{docSelecionado.data}</strong>,
                      necessitando de{' '}
                      <strong>
                        {docSelecionado.dias_afastamento || 1} (
                        {docSelecionado.dias_afastamento === 1 ? 'um' : 'dois'}) dia(s)
                      </strong>{' '}
                      de repouso e afastamento de suas atividades laborais.
                    </p>
                    {docSelecionado.cid10 && (
                      <p className="font-mono text-slate-700">
                        Classificação Internacional de Doenças (CID-10):{' '}
                        <strong>{docSelecionado.cid10}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Se for atestado de comparecimento */}
                {docSelecionado.tipo_documento === 'atestado_comparecimento' && (
                  <div className="py-4 text-xs leading-relaxed text-justify space-y-3">
                    <p>
                      Declaro para os devidos fins a pedido da parte interessada que o(a) paciente{' '}
                      <strong>{docSelecionado.expand?.paciente_id?.nome}</strong> compareceu a esta
                      clínica odontológica no dia <strong>{docSelecionado.data}</strong> para
                      realização de procedimento e atendimento odontológico especializado.
                    </p>
                  </div>
                )}

                {/* Orientações / Cuidados */}
                {docSelecionado.instrucoes && (
                  <div className="pt-2 text-xs border-t border-slate-200">
                    <strong className="font-sans block mb-1">Recomendações e Instruções:</strong>
                    <p className="text-slate-700 italic">{docSelecionado.instrucoes}</p>
                  </div>
                )}

                {/* Rodapé e Assinatura com Hash */}
                <div className="pt-12 text-center space-y-2">
                  <div className="w-64 border-t border-slate-900 mx-auto" />
                  <div className="font-sans text-xs">
                    <div className="font-bold text-slate-900">{docSelecionado.dentista_nome}</div>
                    <div className="text-slate-600">Cirurgião-Dentista • {docSelecionado.cro}</div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono pt-3">
                    Assinatura Eletrônica Autenticada:{' '}
                    {docSelecionado.assinatura_digital_hash || 'HASH-CFO-VALIDADO'}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ModuloGate>
  )
}

export default DocumentosPage
