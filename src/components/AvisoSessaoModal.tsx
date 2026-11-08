import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface AvisoState {
  segundosRestantes: number
  aoContinuar: () => void
}

/**
 * Etapa 6 — Modal de aviso de expiração de sessão.
 * Abre 2 min antes de a sessão expirar por inatividade, dando a chance de
 * continuar (protegendo formulários não salvos). Se o usuário não responder,
 * a sessão cai normalmente no tempo.
 */
export const AvisoSessaoModal: React.FC = () => {
  const [aviso, setAviso] = useState<AvisoState | null>(null)
  const [restante, setRestante] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AvisoState>).detail
      setAviso(detail)
      setRestante(detail.segundosRestantes)
    }
    window.addEventListener('gestec:sessao-aviso', handler)
    return () => window.removeEventListener('gestec:sessao-aviso', handler)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = window.setInterval(() => {
      setRestante((r) => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [aviso])

  if (!aviso) return null

  const minutos = Math.floor(restante / 60)
  const segundos = restante % 60
  const tempo = minutos > 0 ? `${minutos} min ${segundos}s` : `${segundos} segundos`

  const continuar = () => {
    aviso.aoContinuar()
    setAviso(null)
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && continuar()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Sessão prestes a expirar</DialogTitle>
          <DialogDescription>
            Por segurança, sua sessão será encerrada em {tempo} por falta de atividade. Se você
            tiver informações não salvas, elas podem ser perdidas. Deseja continuar usando o
            sistema?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => window.location.assign('/login')}>
            Encerrar agora
          </Button>
          <Button onClick={continuar}>Continuar sessão</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
