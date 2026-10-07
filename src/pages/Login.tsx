import React, { useState } from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useNavigate, Link } from 'react-router-dom'
import { Activity, Lock, Mail, ShieldCheck, Stethoscope, UserCircle2 } from 'lucide-react'
import { UserPerfil } from '@/types/gestec'

export default function Login() {
  const { login, isLoading } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !senha) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor, preencha o e-mail e a senha.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await login(email, senha)
      toast({
        title: 'Bem-vindo ao GesTec-IA-Odonto!',
        description: 'Autenticação realizada com sucesso.',
      })
      navigate('/')
    } catch (err: any) {
      toast({
        title: 'Falha no login',
        description:
          'E-mail ou senha inválidos. Verifique as credenciais ou use os botões de demonstração rápida.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail)
    setSenha('Skip@Pass123')
    setSubmitting(true)
    try {
      await login(demoEmail, 'Skip@Pass123')
      toast({
        title: 'Login de Demonstração',
        description: `Conectado como ${demoEmail}`,
      })
      navigate('/')
    } catch (err: any) {
      toast({
        title: 'Falha ao logar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-50 via-cyan-50/40 to-slate-100 p-4">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#0E7490] flex items-center justify-center text-white shadow-md">
          <Stethoscope className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            GesTec-IA-Odonto
            <span className="text-xs bg-cyan-100 text-[#0E7490] px-2 py-0.5 rounded-full font-medium">
              SaaS v2.0
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Gestão Clínica, Operacional e Financeira para Consultórios
          </p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-slate-200 bg-white">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center font-semibold text-slate-900">
            Acesso Seguro à Clínica
          </CardTitle>
          <CardDescription className="text-center text-xs text-slate-500">
            Ambiente em conformidade com as diretrizes do CFO e da LGPD (Lei nº 13.709/2018)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                E-mail Corporativo
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@consultorio.com.br"
                  className="pl-9 h-10 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha" className="text-xs font-medium text-slate-700">
                  Senha
                </Label>
                <Link to="/forgot-password" className="text-xs text-[#0E7490] hover:underline">
                  Esqueceu sua senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 h-10 text-sm"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full h-10 bg-[#0E7490] hover:bg-[#155E75] text-white font-medium"
            >
              {submitting ? 'Verificando credenciais...' : 'Entrar no Sistema'}
            </Button>
          </form>

          {/* Perfis de Teste Rápido do MVP */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Acesso Rápido por Perfil (Ambiente de Demonstração):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto py-1.5 px-2.5 text-slate-700 hover:bg-cyan-50"
                onClick={() => handleQuickLogin('owner@gestecodonto.com.br')}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 mr-1.5 shrink-0" />
                <div>
                  <div className="font-medium">Dra. Renata</div>
                  <div className="text-[10px] text-slate-400">Owner / RT</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto py-1.5 px-2.5 text-slate-700 hover:bg-cyan-50"
                onClick={() => handleQuickLogin('dentista@gestecodonto.com.br')}
              >
                <Stethoscope className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0" />
                <div>
                  <div className="font-medium">Dr. Marcelo</div>
                  <div className="text-[10px] text-slate-400">Cirurgião-Dentista</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto py-1.5 px-2.5 text-slate-700 hover:bg-cyan-50"
                onClick={() => handleQuickLogin('recepcao@gestecodonto.com.br')}
              >
                <UserCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0" />
                <div>
                  <div className="font-medium">Camila</div>
                  <div className="text-[10px] text-slate-400">Recepção / Agenda</div>
                </div>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto py-1.5 px-2.5 text-slate-700 hover:bg-cyan-50"
                onClick={() => handleQuickLogin('financeiro@gestecodonto.com.br')}
              >
                <Activity className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
                <div>
                  <div className="font-medium">Eduardo</div>
                  <div className="text-[10px] text-slate-400">Financeiro</div>
                </div>
              </Button>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              to="/agendar-online"
              className="text-xs text-[#0E7490] font-medium hover:underline"
            >
              → Acessar Agendamento Online Público para Pacientes
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
