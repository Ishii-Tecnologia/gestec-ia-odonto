import pb from '@/lib/pocketbase/client'
import type {
  InsumoRecord,
  LoteEstoqueRecord,
  MovimentacaoEstoqueRecord,
  UserPerfil,
} from '@/types/gestec'

/** Perfis que podem cadastrar insumos, dar entrada de lote e ver relatórios de custo. */
export const PODE_GERENCIAR_ESTOQUE: UserPerfil[] = ['owner', 'financeiro', 'superadmin']

export function podeGerenciarEstoque(perfil?: UserPerfil | string): boolean {
  return PODE_GERENCIAR_ESTOQUE.includes((perfil || '') as UserPerfil)
}

export const CATEGORIAS_INSUMO = [
  'anestesicos',
  'resinas',
  'descartaveis',
  'epi',
  'instrumentais',
  'moldagem',
  'outros',
] as const

export const LABEL_CATEGORIA: Record<string, string> = {
  anestesicos: 'Anestésicos',
  resinas: 'Resinas',
  descartaveis: 'Descartáveis',
  epi: 'EPI',
  instrumentais: 'Instrumentais',
  moldagem: 'Moldagem',
  outros: 'Outros',
}

export const LABEL_TIPO_MOV: Record<string, string> = {
  entrada: 'Entrada',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
  perda: 'Perda/Vencimento',
}

/** Alerta de validade: dias restantes para considerar "validade próxima". */
export const DIAS_ALERTA_VALIDADE = 30

export interface SituacaoValidade {
  status: 'ok' | 'proximo' | 'vencido' | 'sem_validade'
  diasRestantes: number | null
}

export function situacaoValidade(validade?: string): SituacaoValidade {
  if (!validade) return { status: 'sem_validade', diasRestantes: null }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dt = new Date(validade + 'T00:00:00')
  if (isNaN(dt.getTime())) return { status: 'sem_validade', diasRestantes: null }
  const dias = Math.ceil((dt.getTime() - hoje.getTime()) / 86400000)
  if (dias < 0) return { status: 'vencido', diasRestantes: dias }
  if (dias <= DIAS_ALERTA_VALIDADE) return { status: 'proximo', diasRestantes: dias }
  return { status: 'ok', diasRestantes: dias }
}

export interface SaldoInsumo {
  saldo: number
  valorTotal: number // custo de referência × saldo (fallback quando não há lotes)
}

/** Saldo do insumo = soma das movimentações (entrada +, consumo/perda −, ajuste =). */
export function calcularSaldo(movimentacoes: MovimentacaoEstoqueRecord[]): number {
  let saldo = 0
  for (const m of movimentacoes) {
    const qtd = Number(m.quantidade) || 0
    if (m.tipo === 'entrada') saldo += qtd
    else if (m.tipo === 'consumo' || m.tipo === 'perda') saldo -= qtd
    else if (m.tipo === 'ajuste') saldo = qtd
  }
  return saldo
}

export interface InsumoComSaldo {
  insumo: InsumoRecord
  saldo: number
  valorTotal: number
  lotes: LoteEstoqueRecord[]
  situacaoEstoque: 'sem_estoque' | 'baixo' | 'ok'
  piorValidade: SituacaoValidade // vencido > proximo > ok > sem_validade
}

export function classificarInsumo(
  insumo: InsumoRecord,
  saldo: number,
  lotes: LoteEstoqueRecord[],
): InsumoComSaldo {
  const minimo = Number(insumo.estoque_minimo) || 0
  let situacao: InsumoComSaldo['situacaoEstoque'] = 'ok'
  if (saldo <= 0) situacao = 'sem_estoque'
  else if (saldo <= minimo) situacao = 'baixo'

  let pior: SituacaoValidade = { status: 'sem_validade', diasRestantes: null }
  const ordem: SituacaoValidade['status'][] = ['sem_validade', 'ok', 'proximo', 'vencido']
  for (const lote of lotes) {
    const s = situacaoValidade(lote.validade)
    if (ordem.indexOf(s.status) > ordem.indexOf(pior.status)) pior = s
  }

  const valorTotal = lotes.length
    ? lotes.reduce(
        (acc, l) =>
          acc +
          (Number(l.quantidade_restante ?? l.quantidade) || 0) * (Number(l.custo_unitario) || 0),
        0,
      )
    : saldo * (Number(insumo.custo_referencia) || 0)

  return { insumo, saldo, valorTotal, lotes, situacaoEstoque: situacao, piorValidade: pior }
}

/** Carrega insumos + movimentações + lotes da unidade e consolida os saldos. */
export async function carregarEstoque(unidadeId: string): Promise<InsumoComSaldo[]> {
  const insumos = await pb.collection('insumos').getFullList<InsumoRecord>({
    filter: `unidade_id = '${unidadeId}' && ativo = true`,
    sort: 'nome',
    requestKey: 'estoque-insumos',
  })

  const movs = await pb.collection('movimentacoes_estoque').getFullList<MovimentacaoEstoqueRecord>({
    filter: `unidade_id = '${unidadeId}'`,
    requestKey: 'estoque-movs',
  })

  const lotes = await pb.collection('lotes_estoque').getFullList<LoteEstoqueRecord>({
    filter: `unidade_id = '${unidadeId}'`,
    requestKey: 'estoque-lotes',
  })

  return insumos
    .map((insumo) => {
      const movsInsumo = movs.filter((m) => m.insumo_id === insumo.id)
      const lotesInsumo = lotes.filter((l) => l.insumo_id === insumo.id)
      const saldo = calcularSaldo(movsInsumo)
      return classificarInsumo(insumo, saldo, lotesInsumo)
    })
    .sort((a, b) => {
      // estoque baixo/vencido primeiro
      const peso = (x: InsumoComSaldo) =>
        x.piorValidade.status === 'vencido'
          ? 0
          : x.situacaoEstoque === 'baixo' || x.situacaoEstoque === 'sem_estoque'
            ? 1
            : 2
      if (peso(a) !== peso(b)) return peso(a) - peso(b)
      return a.insumo.nome.localeCompare(b.insumo.nome)
    })
}

/** Lista de insumos com alerta (baixo/vencido), para o Dashboard. */
export function filtrarAlertas(itens: InsumoComSaldo[]): InsumoComSaldo[] {
  return itens.filter(
    (i) =>
      i.situacaoEstoque === 'baixo' ||
      i.situacaoEstoque === 'sem_estoque' ||
      i.piorValidade.status === 'vencido' ||
      i.piorValidade.status === 'proximo',
  )
}
