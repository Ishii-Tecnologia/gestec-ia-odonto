import React, { useState } from 'react'
import { DenteFaceStatus } from '@/types/gestec'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Baby, Sparkles, History as HistoryIcon } from 'lucide-react'

interface OdontogramaProps {
  payload: Record<string, DenteFaceStatus>
  onChange?: (novoPayload: Record<string, DenteFaceStatus>) => void
  readonly?: boolean
  isMenorDeIdade?: boolean
  historicoSnapshots?: {
    id: string
    data: string
    versao?: number
    dentista_nome?: string
    payload: Record<string, DenteFaceStatus>
  }[]
}

// Numeração FDI padrão de 32 dentes permanentes (Adulto):
// Arcada Superior: 18 a 11 (Q1 - direito) e 21 a 28 (Q2 - esquerdo)
// Arcada Inferior: 48 a 41 (Q4 - direito) e 31 a 38 (Q3 - esquerdo)
const ARCADA_SUPERIOR_Q1 = ['18', '17', '16', '15', '14', '13', '12', '11']
const ARCADA_SUPERIOR_Q2 = ['21', '22', '23', '24', '25', '26', '27', '28']
const ARCADA_INFERIOR_Q4 = ['48', '47', '46', '45', '44', '43', '42', '41']
const ARCADA_INFERIOR_Q3 = ['31', '32', '33', '34', '35', '36', '37', '38']

// Numeração FDI de 20 dentes decíduos (Dentição Infantil / Menor de 18):
// Arcada Decídua Superior: 55 a 51 (Q5) e 61 a 65 (Q6)
// Arcada Decídua Inferior: 85 a 81 (Q8) e 71 a 75 (Q7)
const DECIDUOS_SUPERIOR_Q5 = ['55', '54', '53', '52', '51']
const DECIDUOS_SUPERIOR_Q6 = ['61', '62', '63', '64', '65']
const DECIDUOS_INFERIOR_Q8 = ['85', '84', '83', '82', '81']
const DECIDUOS_INFERIOR_Q7 = ['71', '72', '73', '74', '75']

export const STATUS_PROCEDIMENTOS: {
  id: DenteFaceStatus['status']
  label: string
  cor: string
  border: string
  descricao: string
}[] = [
  {
    id: 'sadio',
    label: 'Hígido / Sadio',
    cor: '#E2E8F0',
    border: '#94A3B8',
    descricao: 'Elemento sem patologias ou restaurações',
  },
  {
    id: 'restauracao',
    label: 'Restauração',
    cor: '#3B82F6',
    border: '#1D4ED8',
    descricao: 'Restauração em resina, amálgama ou ionômero',
  },
  {
    id: 'carie',
    label: 'Cárie Ativa',
    cor: '#EF4444',
    border: '#B91C1C',
    descricao: 'Lesão cariosa ativa a tratar',
  },
  {
    id: 'endodontia',
    label: 'Canal / Endodontia',
    cor: '#DC2626',
    border: '#991B1B',
    descricao: 'Tratamento endodôntico realizado ou necessário',
  },
  {
    id: 'protese',
    label: 'Prótese / Coroa',
    cor: '#10B981',
    border: '#047857',
    descricao: 'Coroa unitária, bloco cerâmico ou prótese fixa',
  },
  {
    id: 'implante',
    label: 'Implante',
    cor: '#06B6D4',
    border: '#0891B2',
    descricao: 'Implante osteointegrado instalado',
  },
  {
    id: 'facetas',
    label: 'Faceta Estética',
    cor: '#8B5CF6',
    border: '#6D28D9',
    descricao: 'Faceta laminada em porcelana ou resina',
  },
  {
    id: 'extracao',
    label: 'Extração Indicada',
    cor: '#F59E0B',
    border: '#D97706',
    descricao: 'Exodontia planejada do elemento',
  },
  {
    id: 'ausente',
    label: 'Dente Ausente',
    cor: '#64748B',
    border: '#334155',
    descricao: 'Elemento ausente ou já extraído',
  },
]

export const OdontogramaInterativo: React.FC<OdontogramaProps> = ({
  payload,
  onChange,
  readonly = false,
  isMenorDeIdade = false,
  historicoSnapshots = [],
}) => {
  const [denteSelecionado, setDenteSelecionado] = useState<string | null>(null)
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [modalHistoricoDenteAberto, setModalHistoricoDenteAberto] = useState(false)

  // Alternador da visualização de dentes decíduos (infantil)
  const [mostrarDeciduos, setMostrarDeciduos] = useState<boolean>(isMenorDeIdade)

  // Estado do dente em edição
  const [statusEscolhido, setStatusEscolhido] = useState<DenteFaceStatus['status']>('restauracao')
  const [facesEscolhidas, setFacesEscolhidas] = useState<('V' | 'L' | 'M' | 'D' | 'O')[]>(['O'])
  const [detalheTexto, setDetalheTexto] = useState('')

  const abrirEdicaoDente = (numeroDente: string) => {
    setDenteSelecionado(numeroDente)
    const atual = payload[numeroDente] || { status: 'sadio', faces: [] }
    setStatusEscolhido(atual.status)
    setFacesEscolhidas(atual.faces || [])
    setDetalheTexto(atual.detalhe || '')

    if (readonly) {
      setModalHistoricoDenteAberto(true)
    } else {
      setModalEdicaoAberto(true)
    }
  }

  const toggleFace = (face: 'V' | 'L' | 'M' | 'D' | 'O') => {
    if (facesEscolhidas.includes(face)) {
      setFacesEscolhidas(facesEscolhidas.filter((f) => f !== face))
    } else {
      setFacesEscolhidas([...facesEscolhidas, face])
    }
  }

  const handleSalvarDente = () => {
    if (!denteSelecionado || !onChange) return
    const procInfo = STATUS_PROCEDIMENTOS.find((p) => p.id === statusEscolhido)
    const novoPayload = {
      ...payload,
      [denteSelecionado]: {
        status: statusEscolhido,
        faces: statusEscolhido === 'ausente' || statusEscolhido === 'sadio' ? [] : facesEscolhidas,
        cor: procInfo?.cor || '#3B82F6',
        detalhe: detalheTexto.trim(),
      },
    }
    onChange(novoPayload)
    setModalEdicaoAberto(false)
  }

  // Filtrar histórico específico do dente selecionado entre os snapshots
  const historicoDenteAtual = denteSelecionado
    ? historicoSnapshots
        .map((snap) => ({
          snapshotId: snap.id,
          data: snap.data,
          versao: snap.versao,
          dentista_nome: snap.dentista_nome,
          info: snap.payload[denteSelecionado],
        }))
        .filter((h) => h.info !== undefined)
    : []

  /**
   * Renderização anatômica em SVG do dente e suas 5 faces:
   * - Topo / Base = Vestibular (V) ou Lingual (L) dependendo da arcada
   * - Centro = Oclusal (O)
   * - Lados = Mesial (M) e Distal (D)
   */
  const renderDenteSVG = (denteNum: string, isSuperior: boolean, isDeciduo: boolean = false) => {
    const info = payload[denteNum]
    const isAusente = info?.status === 'ausente'
    const statusColor = info?.cor || '#3B82F6'

    // Definir faces anatômicas
    // Superior: Topo = Vestibular, Base = Palatina/Lingual
    // Inferior: Topo = Lingual, Base = Vestibular
    const faceTopo = isSuperior ? 'V' : 'L'
    const faceBase = isSuperior ? 'L' : 'V'
    // Q1 e Q4: Direita do paciente (esquerda da tela): Direita = Mesial, Esquerda = Distal
    // Q2 e Q3: Esquerda do paciente (direita da tela): Esquerda = Mesial, Direita = Distal
    const numInt = parseInt(denteNum, 10)
    const isLadoDireitoPaciente =
      (numInt >= 11 && numInt <= 18) ||
      (numInt >= 41 && numInt <= 48) ||
      (numInt >= 51 && numInt <= 55) ||
      (numInt >= 81 && numInt <= 85)
    const faceEsquerda = isLadoDireitoPaciente ? 'D' : 'M'
    const faceDireita = isLadoDireitoPaciente ? 'M' : 'D'

    const temFace = (f: 'V' | 'L' | 'M' | 'D' | 'O') => {
      if (!info || info.status === 'sadio' || info.status === 'ausente') return false
      // Se não especificou faces (ex: endodontia geral ou coroa total), pinta tudo ou oclusal
      if (!info.faces || info.faces.length === 0) return f === 'O'
      return info.faces.includes(f)
    }

    const corDefault = '#FFFFFF'
    const getFaceFill = (f: 'V' | 'L' | 'M' | 'D' | 'O') => {
      if (isAusente) return '#F1F5F9'
      return temFace(f) ? statusColor : corDefault
    }

    const size = isDeciduo ? 34 : 40

    return (
      <div
        key={denteNum}
        onClick={() => abrirEdicaoDente(denteNum)}
        className={`flex flex-col items-center group cursor-pointer select-none transition-all p-1 rounded-lg ${
          readonly ? 'hover:bg-slate-100/80' : 'hover:bg-cyan-50/80 hover:shadow-xs hover:scale-105'
        }`}
        title={`Dente FDI ${denteNum}: ${info?.status ? info.status.toUpperCase() : 'Hígido'}`}
      >
        <span
          className={`font-mono font-bold leading-none mb-1 ${
            isDeciduo ? 'text-[10px] text-amber-700' : 'text-[11px] text-slate-700'
          }`}
        >
          {denteNum}
        </span>

        {/* SVG de 5 faces geométricas anatômicas */}
        <div className="relative">
          <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            className={`border rounded ${
              info && info.status !== 'sadio' ? 'border-slate-400 shadow-xs' : 'border-slate-300'
            }`}
          >
            {/* Face Topo */}
            <polygon
              points="0,0 100,0 75,25 25,25"
              fill={getFaceFill(faceTopo)}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            {/* Face Base */}
            <polygon
              points="25,75 75,75 100,100 0,100"
              fill={getFaceFill(faceBase)}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            {/* Face Esquerda */}
            <polygon
              points="0,0 25,25 25,75 0,100"
              fill={getFaceFill(faceEsquerda)}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            {/* Face Direita */}
            <polygon
              points="100,0 100,100 75,75 75,25"
              fill={getFaceFill(faceDireita)}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
            {/* Face Central (Oclusal) */}
            <rect
              x="25"
              y="25"
              width="50"
              height="50"
              fill={getFaceFill('O')}
              stroke="#94A3B8"
              strokeWidth="1.5"
            />

            {/* Marcador de Dente Ausente (X vermelho) */}
            {isAusente && (
              <g stroke="#E11D48" strokeWidth="6" strokeLinecap="round">
                <line x1="15" y1="15" x2="85" y2="85" />
                <line x1="85" y1="15" x2="15" y2="85" />
              </g>
            )}

            {/* Marcador de Implante (Parafuso / I) */}
            {info?.status === 'implante' && (
              <text
                x="50"
                y="58"
                textAnchor="middle"
                fontSize="24"
                fontWeight="bold"
                fill="#FFFFFF"
                fontFamily="sans-serif"
              >
                IMP
              </text>
            )}

            {/* Marcador de Endodontia (Canal) */}
            {info?.status === 'endodontia' && <circle cx="50" cy="50" r="10" fill="#991B1B" />}
          </svg>
        </div>

        {/* Indicador de Status Resumido */}
        {info && info.status !== 'sadio' ? (
          <span
            className="text-[9px] font-semibold mt-1 px-1 rounded truncate max-w-[46px] text-center"
            style={{ color: info.cor || '#0E7490' }}
          >
            {info.status === 'restauracao'
              ? 'Rest.'
              : info.status === 'endodontia'
                ? 'Canal'
                : info.status === 'carie'
                  ? 'Cárie'
                  : info.status === 'protese'
                    ? 'Prótese'
                    : info.status === 'facetas'
                      ? 'Faceta'
                      : info.status === 'implante'
                        ? 'Impl.'
                        : info.status === 'extracao'
                          ? 'Extr.'
                          : 'Aus.'}
          </span>
        ) : (
          <span className="text-[9px] text-slate-300 mt-1">Hígido</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Barra de Ferramentas do Odontograma */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] bg-slate-50 text-slate-700 border-slate-300 font-mono"
          >
            Notação FDI Internacional
          </Badge>

          {isMenorDeIdade && (
            <Badge
              variant="outline"
              className="text-[11px] bg-amber-50 text-amber-800 border-amber-300 flex items-center gap-1"
            >
              <Baby className="w-3.5 h-3.5 text-amber-600" />
              Paciente Menor de Idade (&lt;18)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mostrarDeciduos ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMostrarDeciduos(!mostrarDeciduos)}
            className={`text-xs h-7 px-2.5 ${
              mostrarDeciduos
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'text-slate-600 border-slate-300'
            }`}
          >
            <Baby className="w-3.5 h-3.5 mr-1" />
            {mostrarDeciduos
              ? 'Ocultar Dentes Decíduos (Infantil)'
              : 'Exibir Dentes Decíduos (Infantil)'}
          </Button>

          {readonly && (
            <Badge variant="secondary" className="text-[11px] bg-amber-100 text-amber-900">
              Modo Visualização Imutável
            </Badge>
          )}
        </div>
      </div>

      {/* Grade Anatômica Odontológica Principal */}
      <div className="p-4 sm:p-6 bg-slate-50/80 rounded-xl border border-slate-200 space-y-6">
        {/* Arcada Superior Adulta (Maxila) */}
        <div>
          <div className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
            <span>Arcada Superior Permanente (Maxila) — 18 ao 28</span>
          </div>

          <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap pb-4 border-b border-slate-200">
            <div className="flex gap-0.5 sm:gap-1.5">
              {ARCADA_SUPERIOR_Q1.map((d) => renderDenteSVG(d, true))}
            </div>
            <div className="w-px h-12 bg-slate-300 mx-1 hidden md:block" />
            <div className="flex gap-0.5 sm:gap-1.5">
              {ARCADA_SUPERIOR_Q2.map((d) => renderDenteSVG(d, true))}
            </div>
          </div>
        </div>

        {/* Dentes Decíduos Superiores (quando ativado) */}
        {mostrarDeciduos && (
          <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/80">
            <div className="text-center text-[11px] font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <Baby className="w-3.5 h-3.5 text-amber-600" />
              <span>Dentição Decídua Superior (Dentes de Leite 55 ao 65)</span>
            </div>
            <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap pb-2 border-b border-amber-200/50">
              <div className="flex gap-1">
                {DECIDUOS_SUPERIOR_Q5.map((d) => renderDenteSVG(d, true, true))}
              </div>
              <div className="w-px h-10 bg-amber-300 mx-2 hidden sm:block" />
              <div className="flex gap-1">
                {DECIDUOS_SUPERIOR_Q6.map((d) => renderDenteSVG(d, true, true))}
              </div>
            </div>

            <div className="text-center text-[11px] font-semibold text-amber-800 uppercase tracking-wider my-2 flex items-center justify-center gap-1.5">
              <Baby className="w-3.5 h-3.5 text-amber-600" />
              <span>Dentição Decídua Inferior (Dentes de Leite 85 ao 75)</span>
            </div>
            <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
              <div className="flex gap-1">
                {DECIDUOS_INFERIOR_Q8.map((d) => renderDenteSVG(d, false, true))}
              </div>
              <div className="w-px h-10 bg-amber-300 mx-2 hidden sm:block" />
              <div className="flex gap-1">
                {DECIDUOS_INFERIOR_Q7.map((d) => renderDenteSVG(d, false, true))}
              </div>
            </div>
          </div>
        )}

        {/* Arcada Inferior Adulta (Mandíbula) */}
        <div>
          <div className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Arcada Inferior Permanente (Mandíbula) — 48 ao 38
          </div>

          <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
            <div className="flex gap-0.5 sm:gap-1.5">
              {ARCADA_INFERIOR_Q4.map((d) => renderDenteSVG(d, false))}
            </div>
            <div className="w-px h-12 bg-slate-300 mx-1 hidden md:block" />
            <div className="flex gap-0.5 sm:gap-1.5">
              {ARCADA_INFERIOR_Q3.map((d) => renderDenteSVG(d, false))}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda de Patologias e Procedimentos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-semibold text-slate-800">
            Convenções Clínicas & Patologias Odontológicas:
          </span>
          <span className="text-[11px] text-slate-400">
            Clique em qualquer dente para editar ou inspecionar histórico
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {STATUS_PROCEDIMENTOS.map((proc) => (
            <div
              key={proc.id}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
            >
              <span
                className="w-3.5 h-3.5 rounded border shrink-0 shadow-xs"
                style={{ backgroundColor: proc.cor, borderColor: proc.border }}
              />
              <div className="truncate">
                <span className="text-slate-800 font-medium block truncate text-[11px]">
                  {proc.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Edição de Dente */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center justify-between">
              <span>Apontamento Clínico — Dente {denteSelecionado}</span>
              <Badge variant="outline" className="font-mono text-xs">
                FDI {denteSelecionado}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o procedimento, patologia e as faces afetadas do elemento dentário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Escolha do Procedimento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Condição ou Intervenção Odontológica:
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-0.5">
                {STATUS_PROCEDIMENTOS.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setStatusEscolhido(proc.id)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      statusEscolhido === proc.id
                        ? 'border-[#0E7490] bg-cyan-50/60 text-[#0E7490] font-semibold ring-1 ring-[#0E7490]'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded shrink-0 shadow-xs"
                      style={{ backgroundColor: proc.cor, borderColor: proc.border }}
                    />
                    <span className="truncate text-xs">{proc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Faces Envolvidas */}
            {statusEscolhido !== 'ausente' && statusEscolhido !== 'sadio' && (
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Label className="text-xs font-semibold text-slate-700 block">
                  Faces Anatômicas Comprometidas:
                </Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: 'O', label: 'Oclusal / Incisal (O)' },
                    { id: 'M', label: 'Mesial (M)' },
                    { id: 'D', label: 'Distal (D)' },
                    { id: 'V', label: 'Vestibular (V)' },
                    { id: 'L', label: 'Lingual / Palatina (L)' },
                  ].map((face) => {
                    const ativo = facesEscolhidas.includes(face.id as any)
                    return (
                      <button
                        key={face.id}
                        type="button"
                        onClick={() => toggleFace(face.id as any)}
                        className={`px-3 py-1.5 rounded text-xs border font-mono font-medium transition-colors ${
                          ativo
                            ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {face.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Detalhe / Observação Clínica */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Observações Clínicas e Materiais:
              </Label>
              <Input
                type="text"
                placeholder="Ex: Resina composta Filtek Z350 cor A2, infiltração oclusal..."
                className="h-8 text-xs"
                value={detalheTexto}
                onChange={(e) => setDetalheTexto(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalEdicaoAberto(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarDente}
              size="sm"
              className="bg-[#0E7490] hover:bg-[#155E75] text-white text-xs"
            >
              Confirmar Apontamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico por Dente (Visualização / Auditoria) */}
      <Dialog open={modalHistoricoDenteAberto} onOpenChange={setModalHistoricoDenteAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-[#0E7490]" />
              <span>Histórico do Dente {denteSelecionado}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Trilha de versões e intervenções registradas neste elemento dentário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {historicoDenteAtual.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                Nenhum registro anterior localizado para o elemento {denteSelecionado}.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {historicoDenteAtual.map((h, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        Versão {h.versao || i + 1} ({h.data})
                      </span>
                      <Badge
                        variant="outline"
                        style={{ color: h.info?.cor, borderColor: h.info?.cor }}
                        className="text-[10px] capitalize font-medium"
                      >
                        {h.info?.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Profissional:{' '}
                      <span className="font-medium">{h.dentista_nome || 'Dentista'}</span>
                    </div>
                    {h.info?.faces && h.info.faces.length > 0 && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        Faces: {h.info.faces.join(', ')}
                      </div>
                    )}
                    {h.info?.detalhe && (
                      <div className="text-xs text-slate-700 italic bg-white p-2 rounded border border-slate-100 mt-1">
                        "{h.info.detalhe}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalHistoricoDenteAberto(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
