import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Ban, RefreshCw, ShieldOff, Lock, Hourglass } from 'lucide-react'

/**
 * Etapa 6 (Hardening) — Painel de bloqueios de login (Super Admin).
 *
 * Lista os bloqueios ativos e em contagem (força bruta) via endpoint dedicado
 * do backend e permite liberar manualmente. Os dados vêm de
 * GET /backend/v1/gestec/bloqueios (somente superadmin) — a coleção
 * bloqueios_login não tem regras de API (manipulação 100% server-side).
 */

interface BloqueioItem {
  id: string
  email: string
  tentativas_falhas: number
  bloqueado_ate: string
  bloqueios_total: number
  ultima_tentativa_em: string
  bloqueado: boolean
  minutos_restantes: number
}

const formatarDataHora = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch (_) {
    return iso || '—'
  }
}

export const PainelBloqueios: React.FC = () => {
  const { toast } = useToast()
  const [bloqueios, setBloqueios] = useState<BloqueioItem[]>([])
  const [carregando, setCarregando] = useState(false)
  const [liberando, setLiberando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await pb.send<{ items: BloqueioItem[] }>('/backend/v1/gestec/bloqueios', {
        method: 'GET',
      })
      setBloqueios(res.items || [])
    } catch (err: any) {
      // 403/401: sem permissão (não-superadmin) — painel simplesmente omite
      console.warn('Não foi possível carregar os bloqueios de login:', err?.status)
      setBloqueios([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const liberar = async (item: BloqueioItem) => {
    if (
      !confirm(
        `Liberar o bloqueio de login do e-mail ${item.email}? A conta voltará a aceitar tentativas de acesso imediatamente.`,
      )
    ) {
      return
    }
    setLiberando(item.id)
    try {
      await pb.send('/backend/v1/gestec/liberar-bloqueio', {
        method: 'POST',
        body: { email: item.email },
      })
      toast({
        title: 'Bloqueio liberado',
        description: `A conta ${item.email} pode tentar entrar novamente agora.`,
      })
      await carregar()
    } catch (err: any) {
      const status = err?.status
      toast({
        title: 'Não foi possível liberar',
        description:
          status === 403
            ? 'Somente o Super Admin pode liberar bloqueios de acesso.'
            : 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      })
    } finally {
      setLiberando(null)
    }
  }

  const ativos = bloqueios.filter((b) => b.bloqueado)
  const emContagem = bloqueios.filter((b) => !b.bloqueado && b.tentativas_falhas > 0)

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Bloqueios de Login (Força Bruta)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Contas bloqueadas após 5 tentativas de senha incorretas (janela progressiva de 15 em
              15 minutos). Liberação manual pelo Super Admin.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={carregar}
            disabled={carregando}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {ativos.length === 0 && emContagem.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {carregando ? (
              'Carregando bloqueios...'
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ShieldOff className="w-4 h-4 text-emerald-600" />
                Nenhuma conta bloqueada ou em contagem de tentativas no momento.
              </span>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...ativos, ...emContagem].map((b) => (
              <div
                key={b.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {b.email}
                    </span>
                    {b.bloqueado ? (
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">
                        <Lock className="w-3 h-3 mr-1" />
                        Bloqueado — {b.minutos_restantes} min restantes
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                      >
                        <Hourglass className="w-3 h-3 mr-1" />
                        {b.tentativas_falhas} tentativa(s) incorreta(s)
                      </Badge>
                    )}
                    {b.bloqueios_total > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {b.bloqueios_total} bloqueio(s) anterior(es)
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Última tentativa: {formatarDataHora(b.ultima_tentativa_em)}
                    {b.bloqueado && (
                      <> • Liberação automática: {formatarDataHora(b.bloqueado_ate)}</>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  disabled={liberando === b.id}
                  onClick={() => liberar(b)}
                >
                  <ShieldOff className="w-3.5 h-3.5 mr-1" />
                  {liberando === b.id ? 'Liberando...' : 'Liberar acesso'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PainelBloqueios
