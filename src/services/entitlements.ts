import { ModuloId, ModuloCatalogoItem, PlanoTenant, TenantModulos } from '@/types/gestec'

/**
 * Catálogo Oficial de Módulos GesTec-IA-Odonto (BL-002, BL-011)
 * Inclui:
 * - Árvore e cadeia de dependências
 * - Itens da Fase 1 ativos / degradáveis
 * - Itens BL-024 a BL-029 bloqueados formalmente
 */
export const CATALOGO_MODULOS: ModuloCatalogoItem[] = [
  {
    id: 'core',
    nome: 'Core & Multi-tenancy',
    descricao:
      'Fundação do consultório, unidades, salas, controle de acessos RBAC e auditoria LGPD.',
    categoria: 'gestao',
    obrigatorio: true,
    dependencias: [],
    icone: 'Shield',
    planoMinimo: 'consultorio-essencial',
    bundle: 'essencial',
  },
  {
    id: 'pacientes',
    nome: 'Gestão de Pacientes',
    descricao: 'Cadastro clínico, anamnese, vínculos familiares e score de evasão de retorno.',
    categoria: 'clinico',
    obrigatorio: true,
    dependencias: ['core'],
    icone: 'Users',
    planoMinimo: 'consultorio-essencial',
    bundle: 'essencial',
  },
  {
    id: 'agenda',
    nome: 'Agenda Inteligente',
    descricao:
      'Grade multi-cadeiras, status de atendimento em tempo real e agendamento online público.',
    categoria: 'gestao',
    obrigatorio: true,
    dependencias: ['core', 'pacientes'],
    icone: 'Calendar',
    planoMinimo: 'consultorio-essencial',
    bundle: 'essencial',
  },
  {
    id: 'prontuario',
    nome: 'Prontuário & Odontograma',
    descricao:
      'Odontograma interativo bidirecional, evoluções clínicas append-only e anamnese digital.',
    categoria: 'clinico',
    obrigatorio: false,
    dependencias: ['core', 'pacientes'],
    icone: 'Stethoscope',
    planoMinimo: 'suite-clinica',
    bundle: 'clinico',
  },
  {
    id: 'orcamentos',
    nome: 'Orçamentos & Planos',
    descricao:
      'Geração de orçamentos odontológicos, planos de tratamento por fase e aceite digital.',
    categoria: 'gestao',
    obrigatorio: false,
    dependencias: ['core', 'pacientes'],
    icone: 'FileSpreadsheet',
    planoMinimo: 'suite-clinica',
    bundle: 'clinico',
  },
  {
    id: 'financeiro',
    nome: 'Gestão Financeira & Pix',
    descricao: 'Contas a receber, split de pagamentos (Pix, cartão), conciliação e fluxo de caixa.',
    categoria: 'gestao',
    obrigatorio: false,
    dependencias: ['core', 'orcamentos'],
    icone: 'DollarSign',
    planoMinimo: 'suite-gestao',
    bundle: 'gestao',
  },
  {
    id: 'documentos',
    nome: 'Documentos & Prescrições',
    descricao: 'Atestados, receituários de medicamentos conforme CFO e termos de consentimento.',
    categoria: 'clinico',
    obrigatorio: false,
    dependencias: ['core', 'prontuario'],
    icone: 'FileText',
    planoMinimo: 'suite-clinica',
    bundle: 'clinico',
  },
  {
    id: 'bi',
    nome: 'BI & Relatórios Estratégicos',
    descricao: 'Painéis analíticos de ocupação de cadeiras, ticket médio e taxa de no-show.',
    categoria: 'gestao',
    obrigatorio: false,
    dependencias: ['core', 'financeiro'],
    icone: 'BarChart3',
    planoMinimo: 'suite-gestao',
    bundle: 'gestao',
  },
  // Módulos bloqueados da Fase 1 (BL-024 a BL-029)
  {
    id: 'tiss',
    nome: 'Faturamento TISS (Convênios)',
    descricao:
      'Geração e validação de guias TISS/TUSS com auditoria de glosas (Bloqueado Fase 1 - BL-024).',
    categoria: 'avancado',
    obrigatorio: false,
    bloqueadoFase1: true,
    dependencias: ['core', 'financeiro'],
    icone: 'FileCheck',
    planoMinimo: 'suite-completa',
    bundle: 'pro',
  },
  {
    id: 'automacoes',
    nome: 'Motor de Automações & WhatsApp',
    descricao:
      'Disparo de confirmações 48h/24h via mensageria inteligente (Bloqueado Fase 1 - BL-025).',
    categoria: 'avancado',
    obrigatorio: false,
    bloqueadoFase1: true,
    dependencias: ['core', 'agenda'],
    icone: 'Zap',
    planoMinimo: 'suite-completa',
    bundle: 'pro',
  },
  {
    id: 'ia',
    nome: 'IA Assistiva Clínica & Diagnóstico',
    descricao: 'Análise multimodal de imagens e copiloto de anotações (Bloqueado Fase 1 - BL-026).',
    categoria: 'avancado',
    obrigatorio: false,
    bloqueadoFase1: true,
    dependencias: ['core', 'prontuario'],
    icone: 'Bot',
    planoMinimo: 'suite-completa',
    bundle: 'pro',
  },
  {
    id: 'estoque',
    nome: 'Controle de Estoque & Insumos',
    descricao:
      'Baixa automática por procedimento clínico e ponto de reposição (Bloqueado Fase 1 - BL-027).',
    categoria: 'gestao',
    obrigatorio: false,
    bloqueadoFase1: true,
    dependencias: ['core'],
    icone: 'Package',
    planoMinimo: 'suite-gestao',
    bundle: 'gestao',
  },
  {
    id: 'api_publica',
    nome: 'API Pública & Webhooks',
    descricao:
      'Endpoints de integração para ERPs externos e parceiros (Bloqueado Fase 1 - BL-028).',
    categoria: 'integracao',
    obrigatorio: false,
    bloqueadoFase1: true,
    dependencias: ['core'],
    icone: 'Code',
    planoMinimo: 'suite-completa',
    bundle: 'pro',
  },
]

/**
 * Validação de dependências para ativação de um módulo
 * Retorna lista de dependências não satisfeitas se houver
 */
export function validarDependenciasModulo(
  moduloId: ModuloId,
  modulosAtivos: TenantModulos,
): { satisfeito: boolean; faltando: ModuloId[] } {
  const item = CATALOGO_MODULOS.find((m) => m.id === moduloId)
  if (!item) return { satisfeito: true, faltando: [] }

  const faltando: ModuloId[] = []
  for (const dep of item.dependencias) {
    if (!modulosAtivos[dep]) {
      faltando.push(dep)
    }
  }

  return {
    satisfeito: faltando.length === 0,
    faltando,
  }
}

/**
 * Módulos recomendados por Plano
 */
export const MODULOS_POR_PLANO: Record<PlanoTenant, TenantModulos> = {
  'consultorio-essencial': {
    core: true,
    pacientes: true,
    agenda: true,
    prontuario: false,
    orcamentos: false,
    financeiro: false,
    documentos: false,
    bi: false,
    tiss: false,
    automacoes: false,
    ia: false,
    estoque: false,
    api_publica: false,
  },
  'suite-clinica': {
    core: true,
    pacientes: true,
    agenda: true,
    prontuario: true,
    orcamentos: true,
    financeiro: false,
    documentos: true,
    bi: false,
    tiss: false,
    automacoes: false,
    ia: false,
    estoque: false,
    api_publica: false,
  },
  'suite-gestao': {
    core: true,
    pacientes: true,
    agenda: true,
    prontuario: true,
    orcamentos: true,
    financeiro: true,
    documentos: true,
    bi: true,
    tiss: false,
    automacoes: false,
    ia: false,
    estoque: false,
    api_publica: false,
  },
  'suite-completa': {
    core: true,
    pacientes: true,
    agenda: true,
    prontuario: true,
    orcamentos: true,
    financeiro: true,
    documentos: true,
    bi: true,
    tiss: false, // Bloqueado Fase 1
    automacoes: false, // Bloqueado Fase 1
    ia: false, // Bloqueado Fase 1
    estoque: false, // Bloqueado Fase 1
    api_publica: false, // Bloqueado Fase 1
  },
  custom: {
    core: true,
    pacientes: true,
    agenda: true,
  },
}
