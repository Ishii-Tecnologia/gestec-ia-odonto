import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Smartphone,
  Copy,
  Check,
  AlertTriangle,
  Download,
  ArrowRight,
  LogOut,
  RefreshCw,
} from 'lucide-react'

export default function MfaSetupPage() {
  const { user, enableMfaForUser, logout } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState<'qr' | 'recovery'>('qr')
  const [secret, setSecret] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [codigoConfirmacao, setCodigoConfirmacao] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false)

  // Inicializar segredo TOTP e recovery codes
  useEffect(() => {
    const s = generateTotpSecret()
    const r = generateRecoveryCodes(8)
    setSecret(s)
    setRecoveryCodes(r)
  }, [])

  const otpauthUri = secret && user?.email ? getOtpauthUri(secret, user.email) : ''

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
    toast({ title: 'Chave copiada para a área de transferência' })
  }

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
    toast({ title: 'Códigos de recuperação copiados' })
  }

  const handleDownloadCodes = () => {
    const content = `GesTec-IA-Odonto - Códigos de Recuperação MFA
Usuário: ${user?.email}
Data de Emissão: ${new Date().toLocaleString('pt-BR')}

Guarde este arquivo em local seguro. Cada código só pode ser utilizado uma única vez:

${recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gestec-mfa-recovery-codes-${user?.email || 'user'}.txt`
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Arquivo baixado com sucesso!' })
  }

  const handleValidarCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigoConfirmacao || codigoConfirmacao.trim().length !== 6) {
      toast({
        title: 'Código incompleto',
        description: 'Digite o código de 6 dígitos gerado pelo seu app autenticador.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const valido = await verifyTotpCode(secret, codigoConfirmacao, 1)
      if (!valido) {
        toast({
          title: 'Código inválido ou expirado',
          description: 'Verifique se a hora do seu celular está sincronizada e tente novamente.',
          variant: 'destructive',
        })
        return
      }

      // Código válido! Ir para tela de exibição dos Recovery Codes
      setStep('recovery')
      toast({
        title: 'Segundo fator validado!',
        description: 'Agora guarde seus códigos de recuperação de uso único.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro na validação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleConcluirAtivacao = async () => {
    if (!recoveryAcknowledged) {
      toast({
        title: 'Confirmação obrigatória',
        description: 'Marque que você salvou seus códigos de recuperação para continuar.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await enableMfaForUser(secret, recoveryCodes)
      toast({
        title: 'MFA Ativado com Sucesso!',
        description: 'Sua conta agora exige verificação em duas etapas para acesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar MFA',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 p-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Banner de obrigatoriedade */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <div className="font-semibold text-cyan-300">
              Autenticação em Duas Etapas (MFA / TOTP)
            </div>
            <div>
              Perfis de gestão administrativa ({user?.perfil?.toUpperCase()}) exigem proteção por
              token temporário (RFC 6238) para conformidade com normas de segurança odontológica.
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-slate-700 bg-slate-900/90 text-slate-100 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center font-bold text-white flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              {step === 'qr' ? 'Configurar App Autenticador' : 'Códigos de Recuperação'}
            </CardTitle>
            <CardDescription className="text-center text-xs text-slate-400">
              {step === 'qr'
                ? 'Abra o Google Authenticator, Microsoft Authenticator ou 1Password'
                : 'Guarde estes códigos em segurança. Eles permitirão o acesso caso perca o celular.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'qr' ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-2">
                  {otpauthUri ? (
                    <QrCodeDisplay value={otpauthUri} size={190} />
                  ) : (
                    <div className="w-48 h-48 bg-slate-800 flex items-center justify-center rounded text-xs text-slate-400">
                      Gerando QR...
                    </div>
                  )}
                  <span className="text-[11px] text-slate-400 mt-2 text-center">
                    Escaneie o QR Code acima com o app autenticador do seu celular
                  </span>
                </div>

                {/* Chave de configuração manual */}
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">
                      Não consegue escanear? Use a chave:
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopySecret}
                      className="h-6 px-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-slate-700"
                    >
                      {copiedSecret ? (
                        <Check className="w-3 h-3 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      {copiedSecret ? 'Copiada' : 'Copiar'}
                    </Button>
                  </div>
                  <div className="font-mono text-cyan-300 tracking-wider text-xs break-all bg-slate-900/80 p-2 rounded border border-slate-700/80 select-all">
                    {secret}
                  </div>
                </div>

                <form onSubmit={handleValidarCodigo} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="codigo" className="text-xs font-medium text-slate-300">
                      Digite o código de 6 dígitos exibido no aplicativo
                    </Label>
                    <Input
                      id="codigo"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Ex: 123456"
                      className="h-12 text-center text-xl tracking-[0.3em] font-mono font-bold bg-slate-800/80 border-slate-700 text-cyan-400 placeholder:text-slate-600 focus:border-cyan-500"
                      value={codigoConfirmacao}
                      onChange={(e) => setCodigoConfirmacao(e.target.value.replace(/\D/g, ''))}
                      disabled={submitting}
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || codigoConfirmacao.length !== 6}
                    className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Verificando código...' : 'Verificar e Salvar Configuração'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Atenção:</strong> Estes códigos são exibidos apenas uma vez. Cada um
                    pode ser usado para realizar login caso você não tenha acesso ao seu app
                    autenticador.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-3 rounded-lg border border-slate-700 font-mono text-xs text-cyan-300">
                  {recoveryCodes.map((code, index) => (
                    <div
                      key={code}
                      className="flex items-center gap-1.5 p-1.5 rounded bg-slate-900/60 border border-slate-700/60"
                    >
                      <span className="text-[10px] text-slate-500">{index + 1}.</span>
                      <span className="font-semibold tracking-wider">{code}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCodes}
                    className="flex-1 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    {copiedCodes ? (
                      <Check className="w-3.5 h-3.5 mr-1" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1" />
                    )}
                    {copiedCodes ? 'Copiados!' : 'Copiar Todos'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCodes}
                    className="flex-1 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Baixar .TXT
                  </Button>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={recoveryAcknowledged}
                      onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <span>
                      Confirmo que copiei ou salvei meus 8 códigos de recuperação em um local
                      seguro.
                    </span>
                  </label>
                </div>

                <Button
                  type="button"
                  onClick={handleConcluirAtivacao}
                  disabled={submitting || !recoveryAcknowledged}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2"
                >
                  {submitting
                    ? 'Finalizando configuração...'
                    : 'Concluir Ativação e Acessar o Sistema'}
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>Hardening TOTP (RFC 6238)</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
