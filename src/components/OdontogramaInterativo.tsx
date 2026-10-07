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

interface OdontogramaProps {
  payload: Record<string, DenteFaceStatus>
  onChange?: (novoPayload: Record<string, DenteFaceStatus>) => void
  readonly?: boolean
}

// Numeração FDI padrão de 32 dentes permanentes:
// Arcada Superior: 18 a 11 (Q1 - direito) e 21 a 28 (Q2 - esquerdo)
// Arcada Inferior: 48 a 41 (Q4 - direito) e 31 a 38 (Q3 - esquerdo)
const ARCADA_SUPERIOR_Q1 = ['18', '17', '16', '15', '14', '13', '12', '11']
const ARCADA_SUPERIOR_Q2 = ['21', '22', '23', '24', '25', '26', '27', '28']
const ARCADA_INFERIOR_Q4 = ['48', '47', '46', '45', '44', '43', '42', '41']
const ARCADA_INFERIOR_Q3 = ['31', '32', '33', '34', '35', '36', '37', '38']

export const STATUS_PROCEDIMENTOS = [
  { id: 'sadio', label: 'Hígido / Sadio', cor: '#E2E8F0', border: '#94A3B8' },
  { id: 'restauracao', label: 'Restauração', cor: '#3B82F6', border: '#1D4ED8' },
  { id: 'carie', label: 'Cárie Ativa', cor: '#EF4444', border: '#B91C1C' },
  { id: 'endodontia', label: 'Canal / Endodontia', cor: '#DC2626', border: '#991B1B' },
  { id: 'extracao', label: 'Extração Indicada', cor: '#F59E0B', border: '#D97706' },
  { id: 'protese', label: 'Prótese / Coroa', cor: '#10B981', border: '#047857' },
  { id: 'facetas', label: 'Faceta Estética', cor: '#8B5CF6', border: '#6D28D9' },
  { id: 'ausente', label: 'Dente Ausente', cor: '#64748B', border: '#334155' },
]

export const OdontogramaInterativo: React.FC<OdontogramaProps> = ({
  payload,
  onChange,
  readonly = false,
}) => {
  const [denteSelecionado, setDenteSelecionado] = useState<string | null>(null)
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)

  // Estado do dente em edição
  const [statusEscolhido, setStatusEscolhido] = useState<DenteFaceStatus['status']>('restauracao')
  const [facesEscolhidas, setFacesEscolhidas] = useState<('V' | 'L' | 'M' | 'D' | 'O')[]>(['O'])
  const [detalheTexto, setDetalheTexto] = useState('')

  const abrirEdicaoDente = (numeroDente: string) => {
    if (readonly) return
    setDenteSelecionado(numeroDente)
    const atual = payload[numeroDente] || { status: 'sadio', faces: [] }
    setStatusEscolhido(atual.status)
    setFacesEscolhidas(atual.faces || [])
    setDetalheTexto(atual.detalhe || '')
    setModalEdicaoAberto(true)
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
        faces: facesEscolhidas,
        cor: procInfo?.cor || '#3B82F6',
        detalhe: detalheTexto,
      },
    }
    onChange(novoPayload)
    setModalEdicaoAberto(false)
  }

  // Renderizar o dente geométrico individual com suas 5 faces:
  // V = Vestibular (topo ou base conforme arcada), O = Oclusal (centro), M = Mesial, D = Distal, L = Lingual/Palatina
  const renderDenteVisual = (denteNum: string, isSuperior: boolean) => {
    const info = payload[denteNum]
    const isAusente = info?.status === 'ausente'
    const statusColor = info?.cor || '#E2E8F0'

    return (
      <div
        key={denteNum}
        onClick={() => abrirEdicaoDente(denteNum)}
        className={`flex flex-col items-center group cursor-pointer transition-transform ${
          readonly ? 'cursor-default' : 'hover:scale-105'
        }`}
      >
        <span className="text-[11px] font-mono font-bold text-slate-600 mb-1">{denteNum}</span>

        {/* Representação esquemática do dente (quadrado com faces) */}
        <div
          className={`relative w-8 h-8 rounded border transition-colors ${
            info && info.status !== 'sadio'
              ? 'border-slate-400 shadow-xs'
              : 'border-slate-300 bg-white'
          } ${isAusente ? 'bg-slate-200 opacity-60' : ''}`}
          style={{
            backgroundColor: info?.status !== 'sadio' ? `${statusColor}20` : '#FFFFFF',
          }}
        >
          {/* Face Central (Oclusal) */}
          <div
            className="absolute inset-1.5 rounded-xs border border-slate-300 flex items-center justify-center text-[8px] font-mono"
            style={{
              backgroundColor: info?.faces?.includes('O') ? statusColor : 'transparent',
            }}
          >
            {info && info.status !== 'sadio' ? info.status[0].toUpperCase() : ''}
          </div>

          {/* Se ausente, desenhar um 'X' */}
          {isAusente && (
            <div className="absolute inset-0 flex items-center justify-center text-rose-600 font-bold text-xs pointer-events-none">
              ✕
            </div>
          )}
        </div>

        {/* Indicador de Status Resumido */}
        {info && info.status !== 'sadio' && (
          <span
            className="text-[9px] font-semibold mt-1 px-1 rounded truncate max-w-[36px]"
            style={{ color: info.cor }}
          >
            {info.status.slice(0, 4)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Grade Anatômica de 32 Dentes */}
      <div className="p-4 sm:p-6 bg-slate-50/70 rounded-xl border border-slate-200">
        <div className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Arcada Superior (Maxila) — Dentes 18 ao 28
        </div>

        {/* Arcada Superior */}
        <div className="flex justify-center items-center gap-1.5 sm:gap-3 flex-wrap pb-6 border-b border-dashed border-slate-300">
          <div className="flex gap-1 sm:gap-2">
            {ARCADA_SUPERIOR_Q1.map((d) => renderDenteVisual(d, true))}
          </div>
          <div className="w-px h-10 bg-slate-300 mx-1 hidden sm:block" />
          <div className="flex gap-1 sm:gap-2">
            {ARCADA_SUPERIOR_Q2.map((d) => renderDenteVisual(d, true))}
          </div>
        </div>

        <div className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider my-4">
          Arcada Inferior (Mandíbula) — Dentes 48 ao 38
        </div>

        {/* Arcada Inferior */}
        <div className="flex justify-center items-center gap-1.5 sm:gap-3 flex-wrap">
          <div className="flex gap-1 sm:gap-2">
            {ARCADA_INFERIOR_Q4.map((d) => renderDenteVisual(d, false))}
          </div>
          <div className="w-px h-10 bg-slate-300 mx-1 hidden sm:block" />
          <div className="flex gap-1 sm:gap-2">
            {ARCADA_INFERIOR_Q3.map((d) => renderDenteVisual(d, false))}
          </div>
        </div>
      </div>

      {/* Legenda de Procedimentos e Patologias */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs">
        <span className="font-semibold text-slate-700 block mb-2">
          Legenda de Procedimentos no Odontograma:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STATUS_PROCEDIMENTOS.map((proc) => (
            <div key={proc.id} className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded border shrink-0"
                style={{ backgroundColor: proc.cor, borderColor: proc.border }}
              />
              <span className="text-slate-600 truncate">{proc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Marcação por Face e Procedimento */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Apontamento Clínico — Dente {denteSelecionado}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina a intervenção diagnóstica ou restauradora para o elemento dentário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Escolha do Procedimento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tipo de Intervenção ou Estado:</Label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_PROCEDIMENTOS.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => setStatusEscolhido(proc.id as any)}
                    className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                      statusEscolhido === proc.id
                        ? 'border-[#0E7490] bg-cyan-50/50 text-[#0E7490] font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: proc.cor }} />
                    <span className="truncate">{proc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção de Faces Envolvidas */}
            {statusEscolhido !== 'ausente' && statusEscolhido !== 'sadio' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Faces Anatômicas Afetadas:</Label>
                <div className="flex gap-2">
                  {[
                    { id: 'O', label: 'Oclusal (O)' },
                    { id: 'M', label: 'Mesial (M)' },
                    { id: 'D', label: 'Distal (D)' },
                    { id: 'V', label: 'Vestibular (V)' },
                    { id: 'L', label: 'Lingual/Palatina (L)' },
                  ].map((face) => {
                    const ativo = facesEscolhidas.includes(face.id as any)
                    return (
                      <button
                        key={face.id}
                        type="button"
                        onClick={() => toggleFace(face.id as any)}
                        className={`px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
                          ativo
                            ? 'bg-[#0E7490] text-white border-[#0E7490]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {face.id}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Detalhe / Observação Clínica */}
            <div className="space-y-1">
              <Label className="text-xs">Observações do Elemento:</Label>
              <input
                type="text"
                placeholder="Ex: Resina composta estética, infiltração oclusal..."
                className="w-full h-8 px-2.5 border rounded text-xs"
                value={detalheTexto}
                onChange={(e) => setDetalheTexto(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
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
              Salvar Apontamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
