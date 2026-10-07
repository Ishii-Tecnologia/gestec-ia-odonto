import React from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { UserPerfil } from '@/types/gestec'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

interface RequireProfileProps {
  allowed: UserPerfil[]
  children: React.ReactNode
}

export const RequireProfile: React.FC<RequireProfileProps> = ({ allowed, children }) => {
  const { hasProfile, perfil, user } = useAuth()

  if (hasProfile(allowed)) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-[450px] p-6">
      <Card className="max-w-md w-full border-red-200 bg-white shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2 text-red-600">
            <ShieldX className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl text-slate-800">
            Acesso Restrito por Perfil (LGPD/CFO)
          </CardTitle>
          <CardDescription className="text-slate-600">
            Seu perfil atual ({perfil.toUpperCase()}) não possui autorização regulatória ou de
            negócio para visualizar esta área.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-xs text-slate-500">
            Por determinação da LGPD e do CFO, dados de saúde e prontuários são restritos
            exclusivamente a profissionais clínicos.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Voltar ao Painel Geral</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
