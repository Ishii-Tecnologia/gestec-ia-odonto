import React, { useEffect, useState } from 'react'
import { pb } from '@/lib/pocketbase/client'
import {
  ProfissionalRecord,
  ProcedimentoRecord,
  AgendamentoRecord,
  PacienteRecord,
} from '@/types/gestec'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Calendar,
  Clock,
  User,
  Stethoscope,
  CheckCircle2,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AgendamentoPublico() {
  const { toast } = useToast()

  const [etapa, setEtapa] = useState<1 | 2 | 3 | 4>(1)
  const [profissionais, setProfissionais] = useState<ProfissionalRecord[]>([])
  const [procedimentos, setProcedimentos] = useState<ProcedimentoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Form selections
  const [selectedProfId, setSelectedProfId] = useState<string>('')
  const [selectedProcId, setSelectedProcId] = useState<string>('')
  const [selectedData, setSelectedData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [selectedHora, setSelectedHora] = useState<string>('09:00')

  // Dados do paciente
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState<AgendamentoRecord | null>(null)

  useEffect(() => {
    async function carregarOpcoes() {
      setLoading(true)
      try {
        const [profRes, procRes] = await Promise.all([
          pb
            .collection('profissionais')
            .getList<ProfissionalRecord>(1, 20, { filter: 'ativo = true' }),
          pb.collection('procedimentos').getList<ProcedimentoRecord>(1, 20, { sort: 'nome' }),
        ])
        setProfissionais(profRes.items)
        setProcedimentos(procRes.items)
        if (profRes.items.length > 0) setSelectedProfId(profRes.items[0].id)
        if (procRes.items.length > 0) setSelectedProcId(procRes.items[0].id)
      } catch (err: any) {
        console.error('Erro ao carregar opções públicas:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarOpcoes()
  }, [])

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !telefone.trim()) {
      toast({ title: 'Preencha seu nome e telefone', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      // 1. Obter tenant_id da primeira clínica
      const tenantsList = await pb.collection('tenants').getList(1, 1)
      const tenantId = tenantsList.items[0]?.id || 'demo-tenant'

      // 2. Localizar ou cadastrar paciente automaticamente
      let paciente: PacienteRecord
      try {
        paciente = await pb
          .collection('pacientes')
          .getFirstListItem<PacienteRecord>(
            `tenant_id = '${tenantId}' && (cpf = '${cpf}' || telefone = '${telefone}')`,
          )
      } catch {
        // Criar paciente se não existir
        paciente = await pb.collection('pacientes').create<PacienteRecord>({
          tenant_id: tenantId,
          nome: nome.trim(),
          cpf: cpf.trim() || undefined,
          telefone: telefone.trim(),
          email: email.trim() || undefined,
          status: 'ativo',
          score_evasao: 5,
        })
      }

      // 3. Procedimento selecionado
      const proc = procedimentos.find((p) => p.id === selectedProcId)
      const procNome = proc ? proc.nome : 'Consulta de Avaliação'
      const duracao = proc ? proc.duracao_minutos : 30

      const [h, m] = selectedHora.split(':').map(Number)
      const endMinutes = h * 60 + m + duracao
      const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
      const endM = String(endMinutes % 60).padStart(2, '0')

      const dataInicioStr = `${selectedData}T${selectedHora}:00`
      const dataFimStr = `${selectedData}T${endH}:${endM}:00`

      // 4. Criar Agendamento (RF-004: reflete na agenda operacional via realtime em < 5s)
      const ag = await pb.collection('agendamentos').create<AgendamentoRecord>({
        tenant_id: tenantId,
        paciente_id: paciente.id,
        profissional_id: selectedProfId,
        procedimento: procNome,
        duracao_minutos: duracao,
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        sala: 'Cadeira 1 - Ortodontia',
        status: 'pendente',
        origem: 'online',
      })

      // 5. Enfileirar mensagem de confirmação WhatsApp (RF-005)
      await pb.collection('messages_lembretes').create({
        tenant_id: tenantId,
        agendamento_id: ag.id,
        destinatario_nome: nome,
        telefone: telefone,
        mensagem: `Olá, ${nome}! Seu agendamento para ${selectedData} às ${selectedHora} foi recebido com sucesso no GesTec-IA-Odonto. Nossa recepção confirmará seu horário.`,
        canal: 'whatsapp',
        tipo_gatilho: 'confirmacao_48h',
        status: 'agendado',
      })

      setAgendamentoConfirmado(ag)
      setEtapa(4) // Tela de Sucesso
      toast({
        title: 'Agendamento Confirmado!',
        description: 'Sua solicitação foi registrada no sistema da clínica.',
      })
    } catch (err: any) {
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const profObj = profissionais.find((p) => p.id === selectedProfId)
  const procObj = procedimentos.find((p) => p.id === selectedProcId)

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/60 via-slate-50 to-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#0E7490] flex items-center justify-center text-white shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">GesTec-IA-Odonto</h1>
            <p className="text-[11px] text-slate-500">
              Agendamento Online de Consultas Odontológicas
            </p>
          </div>
        </div>

        <Link to="/login" className="text-xs text-[#0E7490] hover:underline font-medium">
          Área da Clínica →
        </Link>
      </header>

      {/* Card Central */}
      <div className="max-w-xl mx-auto w-full my-auto">
        <Card className="border-slate-200 shadow-lg bg-white">
          <CardHeader className="text-center pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">
              {etapa === 1 && '1. Escolha o Profissional e Procedimento'}
              {etapa === 2 && '2. Escolha a Data e o Horário'}
              {etapa === 3 && '3. Seus Dados de Contato'}
              {etapa === 4 && 'Agendamento Concluído com Sucesso!'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {etapa !== 4 &&
                'Passo ' + etapa + ' de 3 — Confirmação direta na grade do consultório'}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Carregando horários disponíveis...
              </div>
            ) : etapa === 1 ? (
              /* Passo 1: Profissional e Procedimento */
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Cirurgião-Dentista de Preferência
                  </Label>
                  <Select value={selectedProfId} onValueChange={setSelectedProfId}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {profissionais.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — {p.especialidade || p.cro}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Procedimento ou Tratamento
                  </Label>
                  <Select value={selectedProcId} onValueChange={setSelectedProcId}>
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Selecione o procedimento" />
                    </SelectTrigger>
                    <SelectContent>
                      {procedimentos.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>
                          {pr.nome} ({pr.duracao_minutos} min) —{' '}
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(pr.valor)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => setEtapa(2)}
                    className="w-full h-10 bg-[#0E7490] hover:bg-[#155E75] text-white font-medium flex items-center justify-center gap-2"
                  >
                    <span>Continuar para Escolha de Horário</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : etapa === 2 ? (
              /* Passo 2: Data e Horário */
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Data Desejada</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={selectedData}
                    onChange={(e) => setSelectedData(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Horário Disponível</Label>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSelectedHora(h)}
                        className={`py-2 text-xs font-mono font-medium rounded-lg border transition-all ${
                          selectedHora === h
                            ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-cyan-50'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg text-slate-600 space-y-1 mt-2">
                  <p className="font-semibold text-slate-800">Resumo da Escolha:</p>
                  <p>
                    • {profObj?.nome} ({profObj?.especialidade})
                  </p>
                  <p>
                    • {procObj?.nome} ({procObj?.duracao_minutos} min)
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button variant="outline" onClick={() => setEtapa(1)} className="h-10 text-xs">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Button>
                  <Button
                    onClick={() => setEtapa(3)}
                    className="flex-1 h-10 bg-[#0E7490] hover:bg-[#155E75] text-white font-medium"
                  >
                    Próximo: Meus Dados
                  </Button>
                </div>
              </div>
            ) : etapa === 3 ? (
              /* Passo 3: Dados Pessoais */
              <form onSubmit={handleFinalizar} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Nome Completo *</Label>
                  <Input
                    required
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">WhatsApp / Telefone *</Label>
                    <Input
                      required
                      placeholder="(11) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">CPF (Opcional)</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">E-mail para Confirmação</Label>
                  <Input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="p-2.5 bg-cyan-50/60 rounded-lg border border-cyan-100 text-[11px] text-cyan-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#0E7490]" />
                  <span>
                    Seus dados são protegidos sob a LGPD e usados unicamente para sua consulta.
                  </span>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEtapa(2)}
                    className="h-10 text-xs"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-10 bg-[#0E7490] hover:bg-[#155E75] text-white font-medium"
                  >
                    {submitting ? 'Confirmando Horário...' : 'Confirmar Reserva de Horário'}
                  </Button>
                </div>
              </form>
            ) : (
              /* Passo 4: Confirmação Concluída */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Agendamento Realizado!</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Seu horário foi reservado em tempo real na agenda da clínica. Enviamos uma
                    mensagem de confirmação para o seu WhatsApp.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border text-xs text-left space-y-1.5 max-w-sm mx-auto">
                  <div>
                    <strong>Paciente:</strong> {nome}
                  </div>
                  <div>
                    <strong>Data:</strong> {selectedData} às {selectedHora}
                  </div>
                  <div>
                    <strong>Profissional:</strong> {profObj?.nome}
                  </div>
                  <div>
                    <strong>Procedimento:</strong> {procObj?.nome}
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setEtapa(1)
                      setNome('')
                      setCpf('')
                      setTelefone('')
                    }}
                    variant="outline"
                    className="text-xs h-9"
                  >
                    Fazer Novo Agendamento
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-400 py-3">
        GesTec-IA-Odonto © {new Date().getFullYear()} — Sistema Integrado de Saúde Bucal
      </footer>
    </div>
  )
}
