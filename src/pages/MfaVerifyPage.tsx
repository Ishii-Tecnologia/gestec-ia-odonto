import React, { useState } from 'react'
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
import { ShieldCheck, KeyRound, LogOut, ArrowRight, HelpCircle, AlertCircle } from 'lucide-react'

export default function MfaVerifyPage() {
  const { user, verifyMfaLogin, logout } = useAuth()
  const { toast } = useToast()

  const [codigo, setCodigo] = useState('')
  const [usandoRecovery, setUsandoRecovery] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    const tokenClean = codigo.trim()
    if (!tokenClean) {
      setErro('Por favor, digite o código de verificação.')
      return
    }

    setLoading(true)
    try {
      const sucesso = await verifyMfaLogin(tokenClean)
      if (sucesso) {
        toast({
          title: 'Identidade confirmada!',
          description: 'Acesso liberado com autenticação multifator.',
        })
      } else {
        setErro(
          usandoRecovery
            ? 'Código de recuperação inválido ou já utilizado.'
            : 'Código TOTP incorreto ou expirado. Tente o código gerado no instante atual.',
        )
      }
    } catch (err: any) {
      setErro(err.message || 'Erro na verificação do segundo fator.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-2xl border-slate-700 bg-slate-900/90 text-slate-100 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-center font-bold text-white">
              Verificação em Duas Etapas
            </CardTitle>
            <CardDescription className="text-center text-xs text-slate-400">
              {usandoRecovery ? (
                <span>Digite um dos seus códigos de recuperação de uso único</span>
              ) : (
                <span>
                  Digite o código de 6 dígitos gerado pelo seu app autenticador para{' '}
                  <span className="text-cyan-300 font-medium">{user?.email}</span>
                </span>
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mfaToken" className="text-xs font-medium text-slate-300">
                  {usandoRecovery
                    ? 'Código de Recuperação (Ex: A4B9-8F21)'
                    : 'Código do Aplicativo (6 dígitos)'}
                </Label>
                <div className="relative">
                  <Input
                    id="mfaToken"
                    type="text"
                    inputMode={usandoRecovery ? 'text' : 'numeric'}
                    pattern={usandoRecovery ? undefined : '[0-9]*'}
                    maxLength={usandoRecovery ? 12 : 6}
                    placeholder={usandoRecovery ? 'XXXX-XXXX' : '000000'}
                    className={`h-12 text-center text-xl font-mono font-bold bg-slate-800/80 border-slate-700 text-cyan-400 placeholder:text-slate-600 focus:border-cyan-500 ${
                      usandoRecovery ? 'tracking-wider uppercase' : 'tracking-[0.3em]'
                    }`}
                    value={codigo}
                    onChange={(e) => {
                      if (usandoRecovery) {
                        setCodigo(e.target.value.toUpperCase())
                      } else {
                        setCodigo(e.target.value.replace(/\D/g, ''))
                      }
                    }}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {erro && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !codigo.trim()}
                className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2"
              >
                {loading ? 'Validando...' : 'Verificar e Entrar'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setUsandoRecovery(!usandoRecovery)
                  setCodigo('')
                  setErro(null)
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center justify-center gap-1.5 mx-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {usandoRecovery
                  ? 'Voltar e usar o código de 6 dígitos do app'
                  : 'Perdeu o celular? Entrar com código de recuperação'}
              </button>
            </div>
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
