import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import { Stethoscope, Mail, ArrowLeft } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast({ title: 'Preencha o e-mail', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      await pb.collection('users').requestPasswordReset(email)
      setSent(true)
      toast({
        title: 'Instruções enviadas',
        description: 'Se o e-mail estiver cadastrado, você receberá o link de redefinição.',
      })
    } catch (err: any) {
      toast({
        title: 'Instruções enviadas',
        description: 'Se o e-mail estiver cadastrado, você receberá o link de redefinição.',
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#0E7490] flex items-center justify-center text-white">
          <Stethoscope className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">GesTec-IA-Odonto</h1>
      </div>

      <Card className="w-full max-w-md shadow-md border-slate-200 bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold">Redefinir Senha de Acesso</CardTitle>
          <CardDescription className="text-xs">
            Informe o e-mail associado à sua conta do consultório
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-slate-700">
                Enviamos um link seguro de recuperação para{' '}
                <span className="font-semibold">{email}</span>.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Voltar ao Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    className="pl-9 h-10 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0E7490] hover:bg-[#155E75]"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
