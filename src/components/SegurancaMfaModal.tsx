import React, { useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  generateTotpSecret,
  generateRecoveryCodes,
  getOtpauthUri,
  verifyTotpCode,
} from '@/services/totp'
import { QrCodeDisplay } from '@/components/QrCodeDisplay'
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Copy,
  Check,
  Download,
  KeyRound,
  RefreshCw,
  Trash2,
  Lock,
} from 'lucide-react'

interface SegurancaMfaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const SegurancaMfaModal: React.FC<SegurancaMfaModalProps> = ({ open, onOpenChange }) => {
  const { user, enableMfaForUser, disableMfaForUser, regenerateRecoveryCodes, isSuperAdmin } =
    useAuth()
  const { toast } = useToast()

  const [modo, setModo] = useState<'status' | 'ativar' | 'desativar' | 'recovery'>('status')
  const [novoSecret, setNovoSecret] = useState('')
  const [novosRecoveryCodes, setNovosRecoveryCodes] = useState<string[]>([])
  const [codigoConfirmacao, setCodigoConfirmacao] = useState('')
  const [codigoDesativacao, setCodigoDesativacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false)

  const isMfaAtivo = Boolean(user?.mfa_ativo)
  const isPerfilObrigatorio = user?.perfil === 'superadmin' || user?.perfil === 'owner'

  const iniciarAtivacao = () => {
    const s = generateTotpSecret()
    const r = generateRecoveryCodes(8)
    setNovoSecret(s)
    setNovosRecoveryCodes(r)
    setCodigoConfirmacao('')
    setRecoveryAcknowledged(false)
    setModo('ativar')
  }

  const handleValidarEAtivar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigoConfirmacao || codigoConfirmacao.length !== 6) {
      toast({
        title: 'Código incompleto',
        description: 'Digite o código de 6 dígitos gerado pelo app autenticador.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const valido = await verifyTotpCode(novoSecret, codigoConfirmacao, 1)
      if (!valido) {
        toast({
          title: 'Código incorreto',
          description: 'O código informado não confere com o segredo gerado.',
          variant: 'destructive',
        })
        return
      }

      await enableMfaForUser(novoSecret, novosRecoveryCodes)
      toast({
        title: 'MFA Ativado!',
        description: 'Verificação em duas etapas ativada com sucesso nesta conta.',
      })
      setModo('recovery')
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDesativar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await disableMfaForUser(codigoDesativacao)
      toast({
        title: 'MFA Desativado',
        description: 'A verificação em duas etapas foi desativada desta conta.',
      })
      setModo('status')
      setCodigoDesativacao('')
    } catch (err: any) {
      toast({
        title: 'Falha ao desativar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegenerarCodes = async () => {
    setSubmitting(true)
    try {
      const codes = await regenerateRecoveryCodes()
      setNovosRecoveryCodes(codes)
      setModo('recovery')
      toast({
        title: 'Novos códigos gerados!',
        description: 'Os códigos de recuperação anteriores foram invalidados.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao regenerar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadTxt = (codes: string[]) => {
    const content = `GesTec-IA-Odonto - Códigos de Recuperação MFA\nUsuário: ${user?.email}\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gestec-mfa-recovery-${user?.email}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const otpUri = novoSecret && user?.email ? getOtpauthUri(novoSecret, user.email) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0E7490]" />
            Segurança da Conta & MFA
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Gerencie a proteção por segundo fator (TOTP) e políticas de acesso
          </DialogDescription>
        </DialogHeader>

        {modo === 'status' && (
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Status do Segundo Fator:
                </span>
                {isMfaAtivo ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs gap-1">
                    <Check className="w-3 h-3" />
                    Ativo (TOTP RFC 6238)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-300 text-xs">
                    Inativo
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-600">
                {isMfaAtivo
                  ? 'Sua conta está protegida com confirmação por código temporário de 6 dígitos gerado em aplicativo autenticador.'
                  : isPerfilObrigatorio
                    ? 'Para perfis administrativos (superadmin e owner), a ativação do MFA é mandatória para prevenção de invasões.'
                    : 'Adicione uma camada extra de proteção ao seu login ativando a verificação em duas etapas.'}
              </p>

              {user?.mfa_config?.activated_at && (
                <div className="text-[11px] text-slate-400">
                  Ativado em: {new Date(user.mfa_config.activated_at).toLocaleString('pt-BR')}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="space-y-2 pt-2">
              {!isMfaAtivo ? (
                <Button
                  type="button"
                  onClick={iniciarAtivacao}
                  className="w-full bg-[#0E7490] hover:bg-[#155E75] text-white text-xs h-9"
                >
                  <Smartphone className="w-4 h-4 mr-1.5" />
                  Ativar Verificação em Duas Etapas
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg border border-cyan-100 bg-cyan-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-800">
                        Códigos de Recuperação
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {user?.mfa_config?.recovery_codes?.length || 0} código(s) restantes
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerarCodes}
                      disabled={submitting}
                      className="text-xs h-8 border-cyan-300 text-[#0E7490] hover:bg-cyan-100"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Regenerar Códigos
                    </Button>
                  </div>

                  {(!isPerfilObrigatorio || isSuperAdmin()) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setModo('desativar')}
                      className="w-full text-xs h-9 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Desativar MFA
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {modo === 'ativar' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-200">
              <QrCodeDisplay value={otpUri} size={150} />
              <div className="font-mono text-[11px] text-slate-700 mt-2 text-center break-all select-all">
                {novoSecret}
              </div>
            </div>

            <form onSubmit={handleValidarEAtivar} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="codeMfa" className="text-xs text-slate-700">
                  Código de 6 dígitos do aplicativo autenticador
                </Label>
                <Input
                  id="codeMfa"
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-[0.2em] h-10"
                  value={codigoConfirmacao}
                  onChange={(e) => setCodigoConfirmacao(e.target.value.replace(/\D/g, ''))}
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModo('status')}
                  className="w-1/2 text-xs"
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || codigoConfirmacao.length !== 6}
                  className="w-1/2 bg-[#0E7490] hover:bg-[#155E75] text-white text-xs"
                >
                  {submitting ? 'Validando...' : 'Confirmar e Ativar'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {modo === 'recovery' && (
          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px]">
              Salve estes 8 códigos de recuperação. Cada um só poderá ser usado uma única vez.
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-xs bg-slate-50 p-2.5 rounded border border-slate-200">
              {novosRecoveryCodes.map((code, idx) => (
                <div
                  key={code}
                  className="p-1 rounded bg-white border border-slate-200 text-center"
                >
                  <span className="text-[10px] text-slate-400 mr-1">{idx + 1}.</span>
                  <span className="font-semibold text-slate-800">{code}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(novosRecoveryCodes.join('\n'))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex-1 text-xs"
              >
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? 'Copiados' : 'Copiar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTxt(novosRecoveryCodes)}
                className="flex-1 text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Baixar .TXT
              </Button>
            </div>

            <Button
              type="button"
              onClick={() => {
                setModo('status')
                onOpenChange(false)
              }}
              className="w-full bg-[#0E7490] hover:bg-[#155E75] text-white text-xs"
            >
              Concluído
            </Button>
          </div>
        )}

        {modo === 'desativar' && (
          <form onSubmit={handleDesFinal} className="space-y-3 py-2 text-xs">
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800 text-xs">
              Para desativar o segundo fator, informe o código de 6 dígitos gerado atualmente pelo
              seu app autenticador.
            </div>

            <div className="space-y-1">
              <Label htmlFor="desToken" className="text-xs text-slate-700">
                Código TOTP Atual
              </Label>
              <Input
                id="desToken"
                type="text"
                maxLength={6}
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.2em] h-10"
                value={codigoDesativacao}
                onChange={(e) => setCodigoDesativacao(e.target.value.replace(/\D/g, ''))}
                disabled={submitting}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModo('status')}
                className="w-1/2 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || (!isSuperAdmin() && codigoDesativacao.length !== 6)}
                className="w-1/2 bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                {submitting ? 'Desativando...' : 'Confirmar Desativação'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )

  function handleDesFinal(e: React.FormEvent) {
    handleDesativar(e)
  }
}
