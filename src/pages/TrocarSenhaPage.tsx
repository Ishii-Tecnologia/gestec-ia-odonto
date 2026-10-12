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
import { validarForcaSenha } from '@/services/totp'
import {
  Lock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  LogOut,
  ArrowRight,
  KeyRound,
} from 'lucide-react'

export default function TrocarSenhaPage() {
  const { user, completePasswordChange, logout } = useAuth()
  const { toast } = useToast()

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  const avaliacao = validarForcaSenha(novaSenha)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroLocal(null)

    if (!novaSenha || !confirmacao) {
      setErroLocal('Preencha os dois campos de senha.')
      return
    }

    if (novaSenha !== confirmacao) {
      setErroLocal('A confirmação da senha não confere com a nova senha digitada.')
      return
    }

    if (!avaliacao.valida) {
      setErroLocal('A senha não cumpre todos os requisitos de segurança.')
      return
    }

    if (novaSenha === 'Skip@Pass123' || novaSenha === 'Skip@Pass') {
      setErroLocal('A nova senha não pode ser igual à senha provisória padrão.')
      return
    }

    setLoading(true)
    try {
      await completePasswordChange(novaSenha)
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua conta agora está protegida com a sua nova credencial pessoal.',
      })
    } catch (err: any) {
      setErroLocal(err.message || 'Erro ao alterar a senha.')
      toast({
        title: 'Falha na alteração',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Banner superior de aviso de segurança */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-semibold text-amber-300">Hardening Obrigatório — 1º Acesso</div>
            <div>
              Por exigência da política de segurança da clínica e LGPD, senhas de demonstração ou
              provisórias devem ser substituídas antes de qualquer operação.
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-slate-700 bg-slate-900/90 text-slate-100 backdrop-blur">
          <CardHeader className="space-y-1 pb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-2">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-center font-bold text-white">
              Defina sua Nova Senha
            </CardTitle>
            <CardDescription className="text-center text-xs text-slate-400">
              Conta de <span className="font-semibold text-cyan-300">{user?.email}</span> (
              {user?.name || user?.perfil})
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="novaSenha" className="text-xs font-medium text-slate-300">
                  Nova Senha Forte
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <Input
                    id="novaSenha"
                    type="password"
                    placeholder="Mínimo 10 caracteres..."
                    className="pl-9 h-10 text-sm bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Checklist de requisitos de segurança */}
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 space-y-1.5 text-[11px]">
                <div className="font-medium text-slate-400 mb-1">Critérios de Aceite da Senha:</div>
                <div className="flex items-center gap-1.5">
                  {novaSenha.length >= 10 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className={novaSenha.length >= 10 ? 'text-emerald-300' : 'text-slate-400'}>
                    Mínimo de 10 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/[A-Z]/.test(novaSenha) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className={/[A-Z]/.test(novaSenha) ? 'text-emerald-300' : 'text-slate-400'}>
                    Ao menos uma letra maiúscula (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/[a-z]/.test(novaSenha) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className={/[a-z]/.test(novaSenha) ? 'text-emerald-300' : 'text-slate-400'}>
                    Ao menos uma letra minúscula (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/[0-9]/.test(novaSenha) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className={/[0-9]/.test(novaSenha) ? 'text-emerald-300' : 'text-slate-400'}>
                    Ao menos um número (0-9)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(novaSenha) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span
                    className={
                      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(novaSenha)
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                    }
                  >
                    Ao menos um caractere especial (!@#$...)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {novaSenha && novaSenha !== 'Skip@Pass123' && novaSenha !== 'Skip@Pass' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span
                    className={
                      novaSenha && novaSenha !== 'Skip@Pass123' && novaSenha !== 'Skip@Pass'
                        ? 'text-emerald-300'
                        : 'text-slate-400'
                    }
                  >
                    Diferente da senha padrão anterior
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmacao" className="text-xs font-medium text-slate-300">
                  Confirme a Nova Senha
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <Input
                    id="confirmacao"
                    type="password"
                    placeholder="Repita exatamente a nova senha..."
                    className="pl-9 h-10 text-sm bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {erroLocal && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{erroLocal}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !avaliacao.valida || novaSenha !== confirmacao}
                className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2"
              >
                {loading ? 'Salvando nova credencial...' : 'Salvar Nova Senha e Continuar'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>GesTec-IA Hardening Security</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-400 hover:text-red-400 hover:bg-slate-800 h-8 gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cancelar e Sair
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
