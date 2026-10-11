import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  PacienteRecord,
  AnamneseRecord,
  LancamentoFinanceiroRecord,
  ExameAnexoRecord,
  VinculoFamiliarRecord,
} from '@/types/gestec'
import { registrarAuditoria } from '@/lib/pocketbase/auditoria'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  CheckCircle2,
  ArrowLeft,
  Users,
  Building,
  UserCheck,
  ShieldAlert,
  Edit2,
  Save,
  FileSpreadsheet,
  Plus,
  Eye,
  Download,
  Trash2,
  UploadCloud,
  FileUp,
  ZoomIn,
  HeartHandshake,
  UserPlus,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ModuloGate } from '@/components/ModuloGate'
import { validarCPF, formatarCPF, formatarTelefone, calcularIdade } from '@/lib/validadores'

export default function PacienteDetalhes() {
  const { id } = useParams<{ id: string }>()
  const { tenantId, user, perfil, hasModule, canAccessClinical, unidades } = useAuth()
  const { toast } = useToast()

  const [paciente, setPaciente] = useState<PacienteRecord | null>(null)
  const [anamnese, setAnamnese] = useState<AnamneseRecord | null>(null)
  const [financeiro, setFinanceiro] = useState<LancamentoFinanceiroRecord[]>([])
  const [exames, setExames] = useState<ExameAnexoRecord[]>([])
  const [vinculos, setVinculos] = useState<VinculoFamiliarRecord[]>([])
  const [todosPacientes, setTodosPacientes] = useState<PacienteRecord[]>([])
  const [loading, setLoading] = useState(true)

  // BL-015: Upload de Exames e Modal de Zoom
  const [modalUploadExameAberto, setModalUploadExameAberto] = useState(false)
  const [uploadArquivo, setUploadArquivo] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState<
    'panoramica' | 'periapical' | 'tomografia' | 'foto_clinica' | 'documento' | 'laudo'
  >('panoramica')
  const [uploadTitulo, setUploadTitulo] = useState('')
  const [uploadDenteRef, setUploadDenteRef] = useState('')
  const [uploadTagsStr, setUploadTagsStr] = useState('')
  const [uploadDescricao, setUploadDescricao] = useState('')
  const [salvandoExame, setSalvandoExame] = useState(false)
  const [modalZoomAberto, setModalZoomAberto] = useState(false)
  const [exameZoom, setExameZoom] = useState<ExameAnexoRecord | null>(null)

  // BL-020: Vínculos Familiares
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false)
  const [vinculoRespId, setVinculoRespId] = useState('')
  const [vinculoRespNome, setVinculoRespNome] = useState('')
  const [vinculoRespCpf, setVinculoRespCpf] = useState('')
  const [vinculoRespTel, setVinculoRespTel] = useState('')
  const [vinculoParentesco, setVinculoParentesco] = useState<
    'pai' | 'mae' | 'filho' | 'filha' | 'conjuge' | 'irmao' | 'irma' | 'avo' | 'tutor' | 'outro'
  >('mae')
  const [vinculoFinanceiro, setVinculoFinanceiro] = useState(true)
  const [vinculoObs, setVinculoObs] = useState('')
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)

  // Modo de edição cadastral
  const [editando, setEditando] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editNasc, setEditNasc] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editGenero, setEditGenero] = useState<
    'masculino' | 'feminino' | 'outro' | 'nao_informado'
  >('nao_informado')
  const [editConvenio, setEditConvenio] = useState('')
  const [editResponsavelNome, setEditResponsavelNome] = useState('')
  const [editResponsavelCpf, setEditResponsavelCpf] = useState('')
  const [editStatus, setEditStatus] = useState<'ativo' | 'inativo' | 'em-tratamento'>('ativo')
  const [editObservacoes, setEditObservacoes] = useState('')
  const [editUnidadeId, setEditUnidadeId] = useState('')

  // Estados de Anamnese
  const [respostasAnamnese, setRespostasAnamnese] = useState<Record<string, string>>({})
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false)

  const carregarFicha = async () => {
    if (!id) return
    setLoading(true)
    try {
      // 1. Paciente
      const p = await pb.collection('pacientes').getOne<PacienteRecord>(id)
      setPaciente(p)

      // Preencher formulário de edição
      setEditNome(p.nome)
      setEditCpf(p.cpf || '')
      setEditNasc(p.data_nascimento || '')
      setEditTelefone(p.telefone || '')
      setEditEmail(p.email || '')
      setEditEndereco(p.endereco || '')
      setEditGenero(p.genero || 'nao_informado')
      setEditConvenio(p.convenio || 'Particular')
      setEditResponsavelNome(p.responsavel_legal || '')
      setEditResponsavelCpf(p.responsavel_cpf || '')
      setEditStatus(p.status)
      setEditObservacoes(p.observacoes || '')
      setEditUnidadeId(p.unidade_id || '')

      // 2. Anamnese (somente perfis clínicos devem ter acesso a dados clínicos detalhados)
      if (canAccessClinical()) {
        try {
          const a = await pb
            .collection('anamneses')
            .getFirstListItem<AnamneseRecord>(`paciente_id = '${id}'`)
          setAnamnese(a)
          if (a.respostas) setRespostasAnamnese(a.respostas)
        } catch {
          setAnamnese(null)
        }

        // 3. Exames anexados
        const exRes = await pb.collection('exames_anexos').getList<ExameAnexoRecord>(1, 50, {
          filter: `paciente_id = '${id}'`,
          sort: '-created',
        })
        setExames(exRes.items)
      }

      // 4. Vínculos Familiares (BL-020)
      const [vincRes, todosPacRes] = await Promise.all([
        pb.collection('vinculos_familiares').getList<VinculoFamiliarRecord>(1, 50, {
          filter: `paciente_id = '${id}' || responsavel_id = '${id}'`,
          sort: '-created',
          expand: 'paciente_id,responsavel_id',
        }),
        pb.collection('pacientes').getList<PacienteRecord>(1, 200, {
          filter: tenantId ? `tenant_id = '${tenantId}' && id != '${id}'` : `id != '${id}'`,
          sort: 'nome',
        }),
      ])
      setVinculos(vincRes.items)
      setTodosPacientes(todosPacRes.items)

      // 5. Financeiro (se ativo)
      if (hasModule('financeiro')) {
        const fRes = await pb
          .collection('lancamentos_financeiros')
          .getList<LancamentoFinanceiroRecord>(1, 20, {
            filter: `paciente_id = '${id}'`,
            sort: '-vencimento',
          })
        setFinanceiro(fRes.items)
      }

      // 6. Auditoria append-only LGPD: todo acesso à ficha gera registro
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'acessou_ficha_paciente',
        detalhes: `Acesso à ficha e dados cadastrais do paciente "${p.nome}" (ID: ${id}) pelo perfil ${perfil}`,
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

  useEffect(() => {
    carregarFicha()
  }, [id, tenantId])

  // Salvar alterações cadastrais
  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !paciente) return

    if (!editNome.trim()) {
      toast({ title: 'Nome completo é obrigatório', variant: 'destructive' })
      return
    }

    const cpfLimpo = editCpf.replace(/\D/g, '')
    if (cpfLimpo) {
      if (!validarCPF(cpfLimpo)) {
        toast({
          title: 'CPF inválido',
          description: 'O CPF informado não possui dígitos verificadores válidos.',
          variant: 'destructive',
        })
        return
      }
    }

    const idadeAtual = calcularIdade(editNasc)
    const isMenor = idadeAtual !== null && idadeAtual < 18

    if (isMenor && !editResponsavelNome.trim()) {
      toast({
        title: 'Responsável legal obrigatório',
        description: 'Paciente menor de 18 anos exige indicação do responsável.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoDados(true)
    try {
      const updated = await pb.collection('pacientes').update<PacienteRecord>(id, {
        nome: editNome.trim(),
        cpf: cpfLimpo ? formatarCPF(cpfLimpo) : '',
        data_nascimento: editNasc || '',
        telefone: editTelefone.trim() || '',
        email: editEmail.trim() || '',
        endereco: editEndereco.trim() || '',
        genero: editGenero,
        convenio: editConvenio.trim() || 'Particular',
        responsavel_legal: isMenor ? editResponsavelNome.trim() : '',
        responsavel_cpf: isMenor && editResponsavelCpf ? formatarCPF(editResponsavelCpf) : '',
        status: editStatus,
        observacoes: editObservacoes.trim() || '',
        unidade_id: editUnidadeId || paciente.unidade_id,
      })

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'atualizou_dados_paciente',
        detalhes: `Atualização dos dados cadastrais do paciente ${updated.nome}`,
      })

      setPaciente(updated)
      setEditando(false)
      toast({
        title: 'Dados atualizados com sucesso',
        description: 'As alterações cadastrais foram salvas.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar dados',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoDados(false)
    }
  }

  // BL-015: Manipulação de Exames & Radiografias
  const handleUploadExame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !canAccessClinical()) {
      toast({ title: 'Acesso restrito a perfis clínicos', variant: 'destructive' })
      return
    }

    if (!uploadArquivo && !uploadTitulo.trim()) {
      toast({ title: 'Selecione um arquivo ou informe um título', variant: 'destructive' })
      return
    }

    setSalvandoExame(true)
    try {
      const formData = new FormData()
      formData.append('tenant_id', tenantId || '')
      formData.append('paciente_id', id)
      formData.append('unidade_id', paciente?.unidade_id || '')
      formData.append('tipo', uploadTipo)
      formData.append('titulo', uploadTitulo.trim() || uploadArquivo?.name || 'Exame Anexo')
      formData.append('descricao', uploadDescricao.trim() || 'Anexo registrado no prontuário')
      if (uploadDenteRef) formData.append('dente_referencia', uploadDenteRef.trim())
      if (uploadArquivo) {
        formData.append('arquivo', uploadArquivo)
        formData.append('tamanho_bytes', String(uploadArquivo.size))
      }

      const tagsArray = uploadTagsStr
        ? uploadTagsStr
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []
      if (tagsArray.length > 0) {
        formData.append('tags', JSON.stringify(tagsArray))
      }
      formData.append('data_exame', new Date().toISOString().slice(0, 10))

      const novoExame = await pb.collection('exames_anexos').create<ExameAnexoRecord>(formData)

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'anexou_exame_radiografia',
        detalhes: `Upload do exame "${novoExame.titulo}" (${novoExame.tipo}) para o paciente ${paciente?.nome} com arquivo: ${uploadArquivo?.name || 'anexo'}.`,
      })

      toast({
        title: 'Exame anexado com sucesso!',
        description: 'Arquivo armazenado com integridade clínica e auditado.',
      })

      setModalUploadExameAberto(false)
      setUploadArquivo(null)
      setUploadTitulo('')
      setUploadDescricao('')
      setUploadDenteRef('')
      setUploadTagsStr('')
      carregarFicha()
    } catch (err: any) {
      toast({ title: 'Erro no upload do exame', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoExame(false)
    }
  }

  const handleExcluirExame = async (ex: ExameAnexoRecord) => {
    if (!canAccessClinical()) return
    const confirma = window.confirm(
      `Deseja realmente remover o exame "${ex.titulo || ex.descricao}"?`,
    )
    if (!confirma) return

    try {
      await pb.collection('exames_anexos').delete(ex.id)
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'excluiu_exame_anexo',
        detalhes: `Exclusão do exame "${ex.titulo || ex.id}" do prontuário por ${user?.email}.`,
      })
      toast({ title: 'Exame excluído com sucesso' })
      carregarFicha()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir exame', description: err.message, variant: 'destructive' })
    }
  }

  const handleAbrirZoom = (ex: ExameAnexoRecord) => {
    setExameZoom(ex)
    setModalZoomAberto(true)
    // Registrar auditoria de visualização detalhada
    registrarAuditoria({
      tenantId,
      userEmail: user?.email,
      perfil,
      targetPatientId: id,
      acao: 'visualizou_detalhe_exame',
      detalhes: `Inspeção detalhada/zoom do exame ID: ${ex.id} (${ex.tipo})`,
    })
  }

  const getArquivoUrl = (ex: ExameAnexoRecord) => {
    if (ex.arquivo) {
      return pb.files.getUrl(ex, ex.arquivo)
    }
    return ex.url_arquivo || ''
  }

  const isImagem = (ex: ExameAnexoRecord) => {
    const url = getArquivoUrl(ex).toLowerCase()
    return (
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.jpeg') ||
      url.endsWith('.webp') ||
      url.includes('img.usecurling.com') ||
      ['panoramica', 'periapical', 'tomografia', 'foto_clinica', 'raiox'].includes(ex.tipo)
    )
  }

  // BL-020: Vínculos Familiares
  const handleCadastrarVinculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    const nomeFinal =
      vinculoRespNome.trim() || todosPacientes.find((p) => p.id === vinculoRespId)?.nome || ''

    if (!nomeFinal) {
      toast({ title: 'Informe ou selecione o responsável', variant: 'destructive' })
      return
    }

    setSalvandoVinculo(true)
    try {
      await pb.collection('vinculos_familiares').create<VinculoFamiliarRecord>({
        tenant_id: tenantId,
        paciente_id: id,
        responsavel_id: vinculoRespId || undefined,
        responsavel_nome: nomeFinal,
        responsavel_cpf: vinculoRespCpf ? formatarCPF(vinculoRespCpf) : undefined,
        responsavel_telefone: vinculoRespTel || undefined,
        parentesco: vinculoParentesco,
        financeiro_responsavel: vinculoFinanceiro,
        observacoes: vinculoObs.trim() || undefined,
      })

      // Se for responsável financeiro, espelhar na ficha do paciente para garantia de menores
      if (vinculoFinanceiro) {
        await pb.collection('pacientes').update(id, {
          responsavel_legal: nomeFinal,
          responsavel_cpf: vinculoRespCpf ? formatarCPF(vinculoRespCpf) : paciente?.responsavel_cpf,
        })
      }

      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'cadastrou_vinculo_familiar',
        detalhes: `Vínculo familiar cadastrado: ${nomeFinal} (${vinculoParentesco}), Responsável financeiro: ${vinculoFinanceiro ? 'Sim' : 'Não'}.`,
      })

      toast({
        title: 'Vínculo familiar registrado com sucesso!',
        description: 'Responsável e parentesco associados ao prontuário.',
      })

      setModalVinculoAberto(false)
      setVinculoRespId('')
      setVinculoRespNome('')
      setVinculoRespCpf('')
      setVinculoRespTel('')
      setVinculoParentesco('mae')
      setVinculoFinanceiro(true)
      setVinculoObs('')
      carregarFicha()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar vínculo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoVinculo(false)
    }
  }

  const handleExcluirVinculo = async (vinc: VinculoFamiliarRecord) => {
    const confirma = window.confirm(
      `Remover o vínculo com "${vinc.responsavel_nome || 'responsável'}"?`,
    )
    if (!confirma) return

    try {
      await pb.collection('vinculos_familiares').delete(vinc.id)
      await registrarAuditoria({
        tenantId,
        userEmail: user?.email,
        perfil,
        targetPatientId: id,
        acao: 'removeu_vinculo_familiar',
        detalhes: `Vínculo ID ${vinc.id} removido do paciente.`,
      })
      toast({ title: 'Vínculo removido com sucesso' })
      carregarFicha()
    } catch (err: any) {
      toast({ title: 'Erro ao remover vínculo', description: err.message, variant: 'destructive' })
    }
  }

  // Salvar resposta de anamnese (somente perfis clínicos)
  const handleSalvarAnamnese = async () => {
    if (!id || !canAccessClinical()) return
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
      toast({ title: 'Erro ao salvar anamnese', description: err.message, variant: 'destructive' })
    } finally {
      setSalvandoAnamnese(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Carregando ficha e auditoria do paciente...
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-slate-600">Paciente não localizado no tenant atual.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/pacientes">Voltar para lista</Link>
        </Button>
      </div>
    )
  }

  const score = paciente.score_evasao || 0
  const idade = calcularIdade(paciente.data_nascimento || '')
  const unidadeEncontrada = unidades.find((u) => u.id === paciente.unidade_id)

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Voltar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-slate-500">
          <Link to="/pacientes">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Voltar à Lista de Pacientes
          </Link>
        </Button>

        <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
          Auditoria LGPD ativa
        </Badge>
      </div>

      {/* Header do Paciente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-100 text-[#0E7490] font-bold text-xl flex items-center justify-center shrink-0">
            {paciente.nome ? paciente.nome[0].toUpperCase() : 'P'}
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
              {unidadeEncontrada && (
                <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">
                  <Building className="w-3 h-3 mr-1" />
                  {unidadeEncontrada.nome}
                </Badge>
              )}
              {score >= 50 ? (
                <Badge className="text-xs px-2.5 py-0.5 bg-rose-100 text-rose-800 border-rose-300 font-bold flex items-center gap-1.5 shadow-sm animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Alto Risco de Evasão ({score}%)</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1"
                >
                  Score de Evasão: {score}%
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              {paciente.cpf && (
                <span>
                  CPF: <span className="font-mono text-slate-700">{paciente.cpf}</span>
                </span>
              )}
              {paciente.data_nascimento && (
                <span>
                  Nasc: {paciente.data_nascimento} {idade !== null ? `(${idade} anos)` : ''}
                </span>
              )}
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
              {paciente.convenio && (
                <span className="text-slate-600 font-medium">Plano: {paciente.convenio}</span>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditando(!editando)}
            className="text-xs h-9"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            {editando ? 'Cancelar Edição' : 'Editar Dados'}
          </Button>

          {canAccessClinical() && (
            <Button asChild className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9">
              <Link to={`/prontuario/${paciente.id}`}>
                <Stethoscope className="w-4 h-4 mr-1.5" />
                Prontuário & Odontograma (BL-006/007)
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Abas da Ficha do Paciente */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="geral" className="text-xs">
            Visão Geral & Cadastro
          </TabsTrigger>

          {/* Abas clínicas visíveis apenas para perfis clínicos (Dentista, ASB, Super Admin, Owner) */}
          {canAccessClinical() ? (
            <>
              <TabsTrigger value="anamnese" className="text-xs">
                Anamnese Digital (RF-011)
              </TabsTrigger>
              <TabsTrigger value="exames" className="text-xs">
                Exames & Radiografias (BL-015)
              </TabsTrigger>
            </>
          ) : (
            <div className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-slate-400 italic">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
              <span>Dados clínicos restritos a Dentistas/ASB</span>
            </div>
          )}

          <TabsTrigger value="familia" className="text-xs">
            Família & Responsáveis (BL-020)
          </TabsTrigger>

          {hasModule('orcamentos') && (
            <TabsTrigger value="orcamentos" className="text-xs">
              Orçamentos & Planos (BL-008)
            </TabsTrigger>
          )}

          {hasModule('financeiro') && (
            <TabsTrigger value="financeiro" className="text-xs">
              Histórico Financeiro (BL-009)
            </TabsTrigger>
          )}
        </TabsList>

        {/* 1. Visão Geral & Dados Cadastrais */}
        <TabsContent value="geral" className="space-y-4">
          {editando ? (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-[#0E7490]" />
                  Editar Dados Cadastrais do Paciente
                </CardTitle>
                <CardDescription className="text-xs">
                  Atualize as informações civis, contatos e responsáveis. Todas as alterações são
                  auditadas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSalvarEdicao} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome Completo *</Label>
                      <Input
                        required
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">CPF (Módulo-11)</Label>
                      <Input
                        value={editCpf}
                        onChange={(e) => setEditCpf(formatarCPF(e.target.value))}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={editNasc}
                        onChange={(e) => setEditNasc(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Gênero</Label>
                      <Select value={editGenero} onValueChange={(v: any) => setEditGenero(v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                          <SelectItem value="nao_informado">Não informado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Convênio / Plano</Label>
                      <Input
                        value={editConvenio}
                        onChange={(e) => setEditConvenio(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone / WhatsApp</Label>
                      <Input
                        value={editTelefone}
                        onChange={(e) => setEditTelefone(formatarTelefone(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Endereço Completo</Label>
                    <Input
                      value={editEndereco}
                      onChange={(e) => setEditEndereco(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded border border-amber-200">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-900">Responsável Legal (se menor)</Label>
                      <Input
                        value={editResponsavelNome}
                        onChange={(e) => setEditResponsavelNome(e.target.value)}
                        placeholder="Nome do pai/mãe ou tutor"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-amber-900">CPF do Responsável</Label>
                      <Input
                        value={editResponsavelCpf}
                        onChange={(e) => setEditResponsavelCpf(formatarCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        className="h-8 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Unidade de Atendimento</Label>
                      <Select value={editUnidadeId} onValueChange={setEditUnidadeId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {unidades.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="em-tratamento">Em Tratamento</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Observações Cadastrais</Label>
                    <Input
                      value={editObservacoes}
                      onChange={(e) => setEditObservacoes(e.target.value)}
                      placeholder="Observações administrativas..."
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditando(false)}
                      className="h-8 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={salvandoDados}
                      size="sm"
                      className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75]"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {salvandoDados ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2 border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Dados Cadastrais Detalhados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 block">Endereço Residencial:</span>
                      <span className="text-slate-700 font-medium">
                        {paciente.endereco || 'Não informado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Gênero / Sexo:</span>
                      <span className="text-slate-700 font-medium capitalize">
                        {paciente.genero && paciente.genero !== 'nao_informado'
                          ? paciente.genero
                          : 'Não informado'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Convênio / Plano de Saúde:</span>
                      <span className="text-slate-700 font-medium">
                        {paciente.convenio || 'Particular'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Unidade de Cadastro:</span>
                      <span className="text-slate-700 font-medium">
                        {unidadeEncontrada ? unidadeEncontrada.nome : 'Unidade Principal'}
                      </span>
                    </div>
                  </div>

                  {paciente.responsavel_legal && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                        <UserCheck className="w-4 h-4 text-amber-600" />
                        <span>Responsável Legal do Paciente (Menor de Idade)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-amber-800">
                        <div>
                          <span className="text-amber-600 block text-[11px]">Nome:</span>
                          <span className="font-medium">{paciente.responsavel_legal}</span>
                        </div>
                        <div>
                          <span className="text-amber-600 block text-[11px]">
                            CPF do Responsável:
                          </span>
                          <span className="font-mono font-medium">
                            {paciente.responsavel_cpf || 'Não informado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {paciente.observacoes && (
                    <div className="pt-2 border-t">
                      <span className="text-slate-400 block mb-1">Observações Gerais:</span>
                      <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100">
                        {paciente.observacoes}
                      </p>
                    </div>
                  )}

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

              {/* Card Lateral: Score de Evasão */}
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Score de Evasão
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Probabilidade estimada de abandono de tratamento
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
                      ? 'Alto risco! Ausência prolongada e orçamentos pendentes.'
                      : score > 40
                        ? 'Atenção: Recomendado acompanhamento de retorno preventivo.'
                        : 'Paciente pontual e engajado com plano de tratamento.'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 2. Anamnese Digital (RF-011 - Somente clínico) */}
        {canAccessClinical() && (
          <TabsContent value="anamnese" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Questionário de Saúde & Anamnese
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Versão congelada no prontuário digital com validade legal e auditoria
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
                        setRespostasAnamnese({
                          ...respostasAnamnese,
                          medicamentos: e.target.value,
                        })
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
        )}

        {/* 3. Exames e Radiografias (BL-015 - Restrito a perfis clínicos com auditoria LGPD) */}
        {canAccessClinical() && (
          <TabsContent value="exames" className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0E7490]" />
                    Galeria de Exames & Radiografias Digitais (BL-015)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Radiografias panorâmicas, periapicais, tomografias, fotos clínicas e laudos
                    vinculados a dentes
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setModalUploadExameAberto(true)}
                  className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Anexar Exame / Imagem</span>
                </Button>
              </CardHeader>
              <CardContent>
                {exames.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <Paperclip className="w-8 h-8 mx-auto text-slate-300" />
                    <p>Nenhum exame ou foto anexado ao prontuário até o momento.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModalUploadExameAberto(true)}
                      className="text-xs h-8"
                    >
                      Clique aqui para enviar o primeiro exame
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exames.map((ex) => {
                      const fileUrl = getArquivoUrl(ex)
                      const isImg = isImagem(ex)

                      return (
                        <div
                          key={ex.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between space-y-2.5"
                        >
                          <div>
                            {/* Preview visual */}
                            <div
                              onClick={() => handleAbrirZoom(ex)}
                              className="h-36 rounded-lg bg-slate-100 overflow-hidden relative cursor-pointer border border-slate-200 group flex items-center justify-center"
                            >
                              {fileUrl && isImg ? (
                                <img
                                  src={fileUrl}
                                  alt={ex.titulo || ex.descricao}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="text-center p-3 text-slate-400 space-y-1">
                                  <FileText className="w-10 h-10 mx-auto text-[#0E7490]" />
                                  <span className="text-[10px] uppercase font-mono block">
                                    Documento / Laudo PDF
                                  </span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                                <ZoomIn className="w-5 h-5" />
                                <span className="text-xs font-semibold">Visualizar</span>
                              </div>
                            </div>

                            {/* Informações clínicas */}
                            <div className="mt-2.5 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-xs text-slate-900 truncate">
                                  {ex.titulo || ex.descricao}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase font-semibold bg-cyan-50 text-cyan-800 border-cyan-200 shrink-0"
                                >
                                  {ex.tipo.replace(/_/g, ' ')}
                                </Badge>
                              </div>

                              {ex.dente_referencia && (
                                <div className="text-[11px] text-slate-600">
                                  <strong className="text-slate-700">Dente/Região:</strong>{' '}
                                  {ex.dente_referencia}
                                </div>
                              )}

                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {ex.descricao}
                              </p>

                              {ex.tags && ex.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {ex.tags.map((t, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Rodapé com data e ações */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{ex.data_exame || ex.created?.slice(0, 10)}</span>
                            <div className="flex items-center gap-1">
                              {fileUrl && (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="p-1 hover:text-[#0E7490] transition-colors"
                                  title="Baixar Arquivo Original"
                                  onClick={() => {
                                    registrarAuditoria({
                                      tenantId,
                                      userEmail: user?.email,
                                      perfil,
                                      targetPatientId: id,
                                      acao: 'baixou_exame_anexo',
                                      detalhes: `Download do exame ID ${ex.id} (${ex.titulo})`,
                                    })
                                  }}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => handleExcluirExame(ex)}
                                className="p-1 hover:text-rose-600 transition-colors"
                                title="Excluir do Prontuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 4. Vínculos Familiares & Responsáveis (BL-020) */}
        <TabsContent value="familia" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-[#0E7490]" />
                  Vínculos Familiares & Responsáveis Legais (BL-020)
                </CardTitle>
                <CardDescription className="text-xs">
                  Associação entre familiares, tutores e responsáveis financeiros com garantia para
                  menores de 18 anos
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setModalVinculoAberto(true)}
                className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-8 gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Adicionar Vínculo Familiar</span>
              </Button>
            </CardHeader>
            <CardContent>
              {/* Alerta de Menor de Idade sem Vínculo */}
              {idade !== null && idade < 18 && vinculos.length === 0 && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <strong>Atenção Regulatória (CFO / LGPD):</strong> Este paciente é menor de
                    idade ({idade} anos) e{' '}
                    <strong>
                      exige cadastro formal de pelo menos um responsável legal ou financeiro
                    </strong>
                    .
                  </div>
                </div>
              )}

              {vinculos.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-300" />
                  <p>Nenhum vínculo familiar cadastrado para este paciente.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalVinculoAberto(true)}
                    className="text-xs h-8"
                  >
                    Cadastrar Responsável / Parente
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vinculos.map((v) => {
                    const isPacPrincipal = v.paciente_id === id
                    const outroNome = isPacPrincipal
                      ? v.responsavel_nome || v.expand?.responsavel_id?.nome || 'Responsável'
                      : v.expand?.paciente_id?.nome || 'Paciente Vinculado'
                    const outroId = isPacPrincipal ? v.responsavel_id : v.paciente_id
                    const relacaoFmt = v.parentesco.toUpperCase()

                    return (
                      <div
                        key={v.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                              <span>{outroNome}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-cyan-50 text-cyan-800 border-cyan-200"
                              >
                                {relacaoFmt}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {v.responsavel_cpf && (
                                <span className="mr-2">
                                  CPF:{' '}
                                  <span className="font-mono text-slate-700">
                                    {v.responsavel_cpf}
                                  </span>
                                </span>
                              )}
                              {v.responsavel_telefone && (
                                <span>
                                  Tel:{' '}
                                  <span className="font-mono text-slate-700">
                                    {v.responsavel_telefone}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {v.financeiro_responsavel && (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 text-[10px]">
                                Resp. Financeiro
                              </Badge>
                            )}
                            <button
                              onClick={() => handleExcluirVinculo(v)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remover vínculo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {v.observacoes && (
                          <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600 border border-slate-100 italic">
                            "{v.observacoes}"
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          {outroId ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] text-[#0E7490] hover:bg-cyan-50"
                            >
                              <Link to={`/pacientes/${outroId}`}>
                                <User className="w-3 h-3 mr-1" />
                                Abrir Ficha do Vinculado
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Responsável externo (não paciente)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            Cadastrado em {v.created?.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Orçamentos vinculados ao Paciente (BL-008) */}
        {hasModule('orcamentos') && (
          <TabsContent value="orcamentos" className="space-y-4">
            <ModuloGate modulo="orcamentos">
              <Card className="border-slate-200">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#0E7490]" />
                      Planos de Tratamento e Orçamentos
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Propostas comerciais geradas para {paciente.nome}
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
                  >
                    <Link to={`/orcamentos?paciente_id=${paciente.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Gerar Orçamento
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      Consulte e aprove propostas comerciais deste paciente diretamente na central
                      de orçamentos.
                    </div>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link to={`/orcamentos?paciente_id=${paciente.id}`}>Abrir Central</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ModuloGate>
          </TabsContent>
        )}

        {/* 4. Histórico Financeiro (BL-009) */}
        {hasModule('financeiro') && (
          <TabsContent value="financeiro" className="space-y-4">
            <ModuloGate modulo="financeiro">
              <Card className="border-slate-200">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      Títulos a Receber do Paciente (BL-009)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Lançamentos gerados a partir de orçamentos aprovados e atendimentos
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm" className="text-xs h-8">
                    <Link to="/financeiro">Ver Central Financeira</Link>
                  </Button>
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
                            <td className="py-2.5 px-4 font-mono font-semibold">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(f.valor)}
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize font-medium ${
                                  f.status === 'pago'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
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
        )}
      </Tabs>

      {/* Modal BL-015: Upload de Exame / Radiografia */}
      <Dialog open={modalUploadExameAberto} onOpenChange={setModalUploadExameAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#0E7490]" />
              Anexar Exame / Radiografia ao Prontuário
            </DialogTitle>
            <DialogDescription className="text-xs">
              Arquivos de imagem (PNG, JPG) ou laudos PDF com vínculo odontológico e auditoria
              clínica.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadExame} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de Exame *</Label>
              <Select value={uploadTipo} onValueChange={(val: any) => setUploadTipo(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="panoramica">Radiografia Panorâmica</SelectItem>
                  <SelectItem value="periapical">Radiografia Periapical</SelectItem>
                  <SelectItem value="tomografia">Tomografia Cone Beam</SelectItem>
                  <SelectItem value="foto_clinica">Foto Clínica Intra/Extra-oral</SelectItem>
                  <SelectItem value="laudo">Laudo Especializado</SelectItem>
                  <SelectItem value="documento">Documento / Termo Escaneado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Título do Exame *</Label>
                <Input
                  required
                  placeholder="Ex: Panorâmica Inicial 2025"
                  value={uploadTitulo}
                  onChange={(e) => setUploadTitulo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dente(s) de Referência</Label>
                <Input
                  placeholder="Ex: 18, 28, 38, 48"
                  value={uploadDenteRef}
                  onChange={(e) => setUploadDenteRef(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tags (separadas por vírgula)</Label>
              <Input
                placeholder="Ex: siso, carie, implante, pre-operatorio"
                value={uploadTagsStr}
                onChange={(e) => setUploadTagsStr(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Descrição Clínica / Observações</Label>
              <Textarea
                placeholder="Descreva achados clínicos ou detalhes do exame..."
                value={uploadDescricao}
                onChange={(e) => setUploadDescricao(e.target.value)}
                className="h-16 text-xs resize-none"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Selecionar Arquivo (Imagem ou PDF) *</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                required
                onChange={(e) => {
                  const files = e.target.files
                  if (files && files[0]) {
                    setUploadArquivo(files[0])
                    if (!uploadTitulo) {
                      setUploadTitulo(files[0].name.replace(/\.[^/.]+$/, ''))
                    }
                  }
                }}
                className="h-9 text-xs file:text-xs file:bg-slate-100 file:border-0 file:mr-2"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalUploadExameAberto(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoExame}
                size="sm"
                className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoExame ? 'Enviando...' : 'Fazer Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal BL-015: Zoom de Exames */}
      <Dialog open={modalZoomAberto} onOpenChange={setModalZoomAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-sm font-semibold flex items-center justify-between">
              <span>{exameZoom?.titulo || 'Visualização do Exame'}</span>
              <Badge variant="outline" className="text-[10px] uppercase bg-cyan-50 text-cyan-800">
                {exameZoom?.tipo}
              </Badge>
            </DialogTitle>
            {exameZoom?.descricao && (
              <DialogDescription className="text-xs text-slate-600">
                {exameZoom.descricao}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-[350px] bg-slate-900 rounded-lg">
            {exameZoom && isImagem(exameZoom) ? (
              <img
                src={getArquivoUrl(exameZoom)}
                alt={exameZoom.titulo || 'Exame'}
                className="max-h-[65vh] max-w-full object-contain rounded"
              />
            ) : (
              <div className="text-center text-white space-y-3 p-6">
                <FileText className="w-16 h-16 mx-auto text-cyan-400" />
                <p className="text-xs text-slate-300">Visualização de arquivo PDF ou documento.</p>
                {exameZoom && getArquivoUrl(exameZoom) && (
                  <Button
                    asChild
                    size="sm"
                    className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs"
                  >
                    <a
                      href={getArquivoUrl(exameZoom)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Baixar Arquivo Completo
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 font-mono">
              {exameZoom?.dente_referencia && <span>Dente: {exameZoom.dente_referencia} • </span>}
              <span>Data: {exameZoom?.data_exame || exameZoom?.created?.slice(0, 10)}</span>
            </div>
            <div className="flex items-center gap-2">
              {exameZoom && getArquivoUrl(exameZoom) && (
                <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                  <a
                    href={getArquivoUrl(exameZoom)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download Original
                  </a>
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setModalZoomAberto(false)}
                className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal BL-020: Cadastro de Vínculo Familiar */}
      <Dialog open={modalVinculoAberto} onOpenChange={setModalVinculoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-[#0E7490]" />
              Cadastrar Vínculo Familiar / Responsável
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule um paciente já cadastrado ou registre um responsável legal externo com dados
              para cobrança.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCadastrarVinculo} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vincular a Paciente Já Cadastrado</Label>
              <Select
                value={vinculoRespId}
                onValueChange={(val) => {
                  setVinculoRespId(val)
                  const p = todosPacientes.find((x) => x.id === val)
                  if (p) {
                    setVinculoRespNome(p.nome)
                    if (p.cpf) setVinculoRespCpf(p.cpf)
                    if (p.telefone) setVinculoRespTel(p.telefone)
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione paciente ou preencha manual..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    -- Responsável não cadastrado (Preencher abaixo) --
                  </SelectItem>
                  {todosPacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.cpf ? `(${p.cpf})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome Completo do Responsável *</Label>
              <Input
                required
                placeholder="Ex: Maria Aparecida da Silva"
                value={vinculoRespNome}
                onChange={(e) => setVinculoRespNome(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Grau de Parentesco *</Label>
                <Select
                  value={vinculoParentesco}
                  onValueChange={(val: any) => setVinculoParentesco(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mae">Mãe</SelectItem>
                    <SelectItem value="pai">Pai</SelectItem>
                    <SelectItem value="filho">Filho(a)</SelectItem>
                    <SelectItem value="conjuge">Cônjuge</SelectItem>
                    <SelectItem value="irmao">Irmão/Irmã</SelectItem>
                    <SelectItem value="avo">Avô/Avó</SelectItem>
                    <SelectItem value="tutor">Tutor / Curador Legal</SelectItem>
                    <SelectItem value="outro">Outro Parentesco</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CPF do Responsável</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={vinculoRespCpf}
                  onChange={(e) => setVinculoRespCpf(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefone de Contato</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={vinculoRespTel}
                onChange={(e) => setVinculoRespTel(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-lg">
              <input
                type="checkbox"
                id="vinculoFinanceiroCheck"
                checked={vinculoFinanceiro}
                onChange={(e) => setVinculoFinanceiro(e.target.checked)}
                className="rounded border-slate-300 text-[#0E7490] focus:ring-[#0E7490]"
              />
              <label
                htmlFor="vinculoFinanceiroCheck"
                className="text-xs text-slate-700 cursor-pointer font-medium"
              >
                Responsável Financeiro (recebe cobranças e responde por títulos)
              </label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações / Detalhes de Guarda</Label>
              <Textarea
                placeholder="Ex: Guarda compartilhada, autorização para buscar na clínica..."
                value={vinculoObs}
                onChange={(e) => setVinculoObs(e.target.value)}
                className="h-16 text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalVinculoAberto(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoVinculo}
                size="sm"
                className="h-8 text-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
              >
                {salvandoVinculo ? 'Salvando...' : 'Gravar Vínculo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
