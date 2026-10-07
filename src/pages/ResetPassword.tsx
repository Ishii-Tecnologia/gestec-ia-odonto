import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Stethoscope, Lock } from 'lucide-react'
import { pb } from '@/lib/pocketbase/client'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { toast } = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'Mínimo de 8 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (password !== confirmPassword) {
      toast({
        title: 'Senhas divergentes',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirmPassword)
      toast({
        title: 'Senha atualizada!',
        description: 'Você já pode acessar o sistema com sua nova senha.',
      })
      navigate('/login')
    } catch (err: any) {
      toast({
        title: 'Erro ao redefinir',
        description: err.message || 'Token expirado ou inválido.',
        variant: 'destructive',
      })
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
          <CardTitle className="text-lg font-semibold">Definir Nova Senha</CardTitle>
          <CardDescription className="text-xs">
            Digite a nova senha para sua conta de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nova Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className="pl-9 h-10 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  type="password"
                  placeholder="Repita a nova senha"
                  className="pl-9 h-10 text-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E7490] hover:bg-[#155E75]"
            >
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-xs text-[#0E7490] hover:underline">
                Cancelar e voltar ao login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
