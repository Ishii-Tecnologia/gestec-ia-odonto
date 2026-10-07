import React from 'react'
import { useAuth } from '@/lib/pocketbase/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, ShieldAlert, ArrowRight } from 'lucide-react'
import { ModuloId } from '@/types/gestec'
import { useToast } from '@/hooks/use-toast'

interface ModuloGateProps {
  modulo: ModuloId
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
}

export const ModuloGate: React.FC<ModuloGateProps> = ({
  modulo,
  children,
  fallbackTitle,
  fallbackDescription,
}) => {
  const { hasModule, toggleModuleEntitlement, perfil } = useAuth()
  const { toast } = useToast()
  const isEnabled = hasModule(modulo)

  if (isEnabled) {
    return <>{children}</>
  }

  const handleAtivarTrial = async () => {
    try {
      await toggleModuleEntitlement(modulo, true)
      toast({
        title: 'Módulo ativado!',
        description: `O módulo ${modulo.toUpperCase()} foi habilitado para seu consultório em conformidade com CA-MOD-2.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full border-cyan-200 bg-gradient-to-b from-white to-cyan-50/40 shadow-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-2 text-cyan-700">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl text-slate-800">
            {fallbackTitle || `Módulo ${modulo.toUpperCase()} disponível no Plano Pro`}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {fallbackDescription ||
              `Este recurso faz parte dos módulos avançados do GesTec-IA-Odonto. O tenant atual está configurado sem esta funcionalidade ativa no momento.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-white rounded-lg border text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Degradação Graciosa (v2.0):</p>
            <p>
              O sistema continua operando sem interrupções nas rotas essenciais de agenda e
              pacientes.
            </p>
          </div>

          {perfil === 'owner' ? (
            <Button
              onClick={handleAtivarTrial}
              className="w-full bg-[#0E7490] hover:bg-[#155E75] text-white flex items-center justify-center gap-2"
            >
              <span>Ativar Módulo Agora (Simular Upgrade)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-50 text-amber-800 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Solicite ao Administrador (Owner) da clínica para habilitar este módulo.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
