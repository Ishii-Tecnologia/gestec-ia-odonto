export type UserPerfil = 'superadmin' | 'owner' | 'dentista' | 'recepcao' | 'financeiro' | 'asb'

export type ModuloId =
  | 'core'
  | 'agenda'
  | 'pacientes'
  | 'prontuario'
  | 'financeiro'
  | 'orcamentos'
  | 'tiss'
  | 'documentos'
  | 'automacoes'
  | 'ia'
  | 'estoque'
  | 'bi'
  | 'api_publica'

export type PlanoTenant =
  | 'consultorio-essencial'
  | 'suite-clinica'
  | 'suite-gestao'
  | 'suite-completa'
  | 'custom'

export interface ModuloCatalogoItem {
  id: ModuloId
  nome: string
  descricao: string
  categoria: 'clinico' | 'gestao' | 'avancado' | 'integracao'
  obrigatorio?: boolean // Não pode ser desativado (ex: core)
  bloqueadoFase1?: boolean // BL-024 a BL-029 (Bloqueado)
  dependencias: ModuloId[] // Módulos necessários para este funcionar
  icone: string
  planoMinimo: PlanoTenant
  bundle?: 'essencial' | 'clinico' | 'gestao' | 'pro'
}

export interface TenantModulos {
  core: boolean
  agenda?: boolean
  pacientes?: boolean
  prontuario?: boolean
  financeiro?: boolean
  orcamentos?: boolean
  tiss?: boolean
  documentos?: boolean
  automacoes?: boolean
  ia?: boolean
  estoque?: boolean
  bi?: boolean
  api_publica?: boolean
}

export type TenantSituacao = 'ativa' | 'suspensa'

export interface SalaRecord {
  id: string
  tenant_id?: string
  unidade_id: string
  nome: string
  descricao?: string
  cadeiras_qtd?: number
  ativo?: boolean
  ordem?: number
  created?: string
  updated?: string
}

export interface UnidadeRecord {
  id: string
  tenant_id: string
  nome: string
  endereco?: string
  telefone?: string
  cidade?: string
  estado?: string
  ativa?: boolean
  ordem?: number
  salas?: SalaRecord[]
  created?: string
  updated?: string
}

export interface TenantRecord {
  id: string
  nome: string
  razao_social?: string
  cnpj?: string
  plano: PlanoTenant
  situacao?: TenantSituacao
  configuracoes?: Record<string, any>
  modulos_ativos: TenantModulos
  limites?: {
    profissionais_max?: number
    cadeiras_max?: number
    mensagens_mes?: number
    unidades_max?: number
  }
  unidades?: UnidadeRecord[]
  ativo: boolean
  created?: string
  updated?: string
}

export interface UserRecord {
  id: string
  email: string
  name: string
  tenant_id?: string
  perfil?: UserPerfil
  cro?: string
  todas_unidades?: boolean
  unidades_ids?: string[]
  created?: string
  updated?: string
}

export interface ProfissionalRecord {
  id: string
  tenant_id: string
  user_id?: string
  nome: string
  cro: string
  especialidade?: string
  telefone?: string
  email?: string
  comissao_percentual?: number
  cor_agenda?: string
  ativo: boolean
}

export interface PacienteRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  nome: string
  cpf?: string
  data_nascimento?: string
  telefone?: string
  email?: string
  endereco?: string
  genero?: 'masculino' | 'feminino' | 'outro' | 'nao_informado'
  convenio?: string
  responsavel_legal?: string
  responsavel_cpf?: string
  score_evasao?: number
  status: 'ativo' | 'inativo' | 'em-tratamento'
  tags?: string[]
  observacoes?: string
  created?: string
  updated?: string
}

export interface ProcedimentoRecord {
  id: string
  tenant_id: string
  codigo?: string
  nome: string
  descricao?: string
  duracao_minutos: number
  valor: number
  categoria?:
    | 'diagnostico'
    | 'prevencao'
    | 'restauradora'
    | 'endodontia'
    | 'periodontia'
    | 'cirurgia'
    | 'ortodontia'
    | 'protese'
    | 'estetica'
}

export interface AgendamentoRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  sala_id?: string
  paciente_id: string
  profissional_id: string
  procedimento: string
  duracao_minutos?: number
  data_inicio: string // ISO string YYYY-MM-DDTHH:mm:ss
  data_fim: string
  sala?: string
  tipo_consulta?: 'primeira_consulta' | 'retorno' | 'procedimento' | 'urgencia' | 'avaliacao'
  status:
    | 'pendente'
    | 'confirmado'
    | 'presente'
    | 'em_atendimento'
    | 'concluido'
    | 'cancelado'
    | 'falta'
  confirmacao_status?: 'pendente' | 'confirmado' | 'nao_confirmou' | 'no_show'
  tentativa_confirmacao_em?: string
  confirmado_em?: string
  motivo_cancelamento_ou_falta?: string
  origem?: 'recepcao' | 'online' | 'retorno'
  recorrencia?: {
    frequencia: 'semanal' | 'quinzenal' | 'mensal'
    ocorrencias: number
  }
  observacoes?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
  }
}

export interface FilaEsperaRecord {
  id: string
  tenant_id: string
  paciente_id: string
  profissional_id?: string
  data_desejada?: string
  prioridade?: number
  status: 'aguardando' | 'ofertado' | 'atendido' | 'cancelado'
  observacoes?: string
  created?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
  }
}

export interface DenteFaceStatus {
  status:
    | 'sadio'
    | 'restauracao'
    | 'carie'
    | 'endodontia'
    | 'extracao'
    | 'protese'
    | 'facetas'
    | 'implante'
    | 'ausente'
  faces?: ('V' | 'L' | 'M' | 'D' | 'O')[]
  cor?: string
  detalhe?: string
}

export interface OdontogramaSnapshotRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  data: string
  atendimento_id?: string
  payload: Record<string, DenteFaceStatus>
  dentista_nome?: string
  cro?: string
  versao?: number
  descricao_alteracao?: string
  created?: string
}

export interface EvolucaoClinicaRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  data: string
  tipo?: 'anamnese' | 'evolucao' | 'prescricao' | 'observacao' | 'retificacao' | 'procedimento'
  especialidade:
    | 'geral'
    | 'exodontia'
    | 'endodontia'
    | 'ortodontia'
    | 'periodontia'
    | 'protese'
    | 'implantodontia'
    | 'odontopediatria'
    | 'estetica'
  descricao: string
  dentista_nome?: string
  cro?: string
  retifica_evolucao_id?: string
  motivo_retificacao?: string
  procedimento_relacionado?: string
  created?: string
}

export interface AnamnesePergunta {
  id: string
  pergunta: string
  tipo: 'texto' | 'sim_nao' | 'multipla_escolha'
  opcoes?: string[]
  resposta?: string
}

export interface AnamneseRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  dentista_nome?: string
  cro?: string
  perguntas: AnamnesePergunta[]
  respostas?: Record<string, string>
  status: 'pendente' | 'respondida' | 'assinada'
  token?: string
  data_resposta?: string
  created?: string
  updated?: string
}

export interface OrçamentoItem {
  procedimento_id?: string
  procedimento: string
  dente?: string
  face?: string
  quantidade?: number
  valor: number
}

export interface OrcamentoRecord {
  id: string
  tenant_id: string
  paciente_id: string
  plano_id?: string
  valor_bruto: number
  desconto_percentual?: number
  valor_liquido: number
  parcelas: number
  status: 'rascunho' | 'negociacao' | 'aprovado' | 'recusado' | 'vencido'
  itens: OrçamentoItem[]
  validade?: string
  assinatura?: {
    rubrica?: string
    data_hora?: string
    ip?: string
    valido?: boolean
  }
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
  }
}

export interface ModalidadePagamento {
  modalidade: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'boleto'
  valor: number
  comprovante?: string
}

export interface LancamentoFinanceiroRecord {
  id: string
  tenant_id: string
  paciente_id?: string
  orcamento_id?: string
  descricao: string
  tipo: 'receber' | 'pagar'
  valor: number
  vencimento: string
  status: 'aberto' | 'pago' | 'parcial' | 'vencido' | 'cancelado'
  modalidades?: ModalidadePagamento[]
  data_pagamento?: string
  valor_pago?: number
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
  }
}

export interface MessageLembreteRecord {
  id: string
  tenant_id: string
  agendamento_id?: string
  destinatario_nome: string
  telefone: string
  mensagem: string
  canal: 'whatsapp' | 'sms'
  tipo_gatilho:
    | 'confirmacao_48h'
    | 'confirmacao_24h'
    | 'retorno_preventivo'
    | 'cobranca_inadimplente'
  status:
    | 'agendado'
    | 'enviado'
    | 'entregue'
    | 'respondido_confirmado'
    | 'respondido_reagendar'
    | 'falhou'
  data_envio?: string
  created?: string
}

export interface ExameAnexoRecord {
  id: string
  tenant_id: string
  paciente_id: string
  arquivo: string
  tipo: 'raiox' | 'foto_clinica' | 'documento' | 'laudo'
  descricao: string
  data_exame?: string
  created?: string
}

export interface PrescricaoRecord {
  id: string
  tenant_id: string
  paciente_id: string
  data: string
  medicamentos: any[]
  instrucoes?: string
  dentista_nome: string
  cro: string
  created?: string
}

export interface AuditoriaAcessoRecord {
  id: string
  tenant_id: string
  user_id?: string
  user_email?: string
  perfil?: string
  target_patient_id?: string
  acao: string
  detalhes?: string
  ip?: string
  timestamp: string
}
