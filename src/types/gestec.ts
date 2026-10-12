export type UserPerfil = 'superadmin' | 'owner' | 'dentista' | 'recepcao' | 'financeiro' | 'asb'

export type ModuloId =
  | 'core'
  | 'agenda'
  | 'pacientes'
  | 'prontuario'
  | 'financeiro'
  | 'orcamentos'
  | 'comunicacao'
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
  comunicacao?: boolean
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

export interface UserMfaConfig {
  secret: string
  activated_at: string
  recovery_codes: string[]
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
  precisa_trocar_senha?: boolean
  mfa_ativo?: boolean
  mfa_config?: UserMfaConfig | null
  senha_modificada_em?: string
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
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  procedimento?: string
  periodo_preferencia?: 'manha' | 'tarde' | 'noite' | 'qualquer'
  dias_semana?: string[]
  data_desejada?: string
  prioridade?: number // 1 a 5
  status: 'aguardando' | 'ofertado' | 'atendido' | 'cancelado'
  contato_telefone?: string
  observacoes?: string
  oferta_enviada_em?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
  }
}

export interface VinculoFamiliarRecord {
  id: string
  tenant_id: string
  paciente_id: string
  responsavel_id?: string
  responsavel_nome?: string
  responsavel_cpf?: string
  responsavel_telefone?: string
  parentesco:
    | 'pai'
    | 'mae'
    | 'filho'
    | 'filha'
    | 'conjuge'
    | 'irmao'
    | 'irma'
    | 'avo'
    | 'tutor'
    | 'outro'
  financeiro_responsavel?: boolean
  observacoes?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    responsavel_id?: PacienteRecord
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
  valor_unitario?: number
  valor_total?: number
  valor: number
}

export interface OrcamentoRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  plano_id?: string
  numero_orcamento?: string
  valor_bruto: number
  desconto_percentual?: number
  desconto_valor?: number
  valor_liquido: number
  parcelas: number
  status: 'rascunho' | 'enviado' | 'negociacao' | 'aprovado' | 'rejeitado' | 'recusado' | 'vencido'
  itens: OrçamentoItem[]
  validade?: string
  observacoes?: string
  motivo_rejeicao?: string
  data_aprovacao?: string
  aprovado_por?: string
  assinatura?: {
    rubrica?: string
    data_hora?: string
    ip?: string
    documento_identidade?: string
    valido?: boolean
    assinado?: boolean
  }
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
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
  unidade_id?: string
  paciente_id?: string
  orcamento_id?: string
  profissional_id?: string
  descricao: string
  tipo: 'receber' | 'pagar'
  categoria?: 'tratamento' | 'consulta' | 'procedimento' | 'ortodontia' | 'protese' | 'outro'
  numero_parcela?: number
  total_parcelas?: number
  valor: number
  valor_desconto?: number
  valor_juros_multa?: number
  valor_liquido?: number
  vencimento: string
  status: 'aberto' | 'pago' | 'parcial' | 'vencido' | 'cancelado'
  modalidades?: ModalidadePagamento[]
  forma_pagamento_principal?: string
  data_pagamento?: string
  valor_pago?: number
  comprovante_transacao?: string
  observacoes?: string
  responsavel_baixa_email?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
    orcamento_id?: OrcamentoRecord
  }
}

export interface MessageLembreteRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  agendamento_id?: string
  paciente_id?: string
  destinatario_nome: string
  telefone: string
  mensagem: string
  canal: 'whatsapp' | 'sms' | 'in_app'
  tipo_gatilho:
    | 'confirmacao_48h'
    | 'confirmacao_24h'
    | 'retorno_preventivo'
    | 'cobranca_inadimplente'
    | 'lembrete_manual'
    | 'boas_vindas'
  status:
    | 'agendado'
    | 'enviado'
    | 'entregue'
    | 'respondido_confirmado'
    | 'respondido_reagendar'
    | 'pendente_integracao_externa'
    | 'falhou'
  data_envio?: string
  data_resposta?: string
  resposta_paciente?: string
  tentativas?: number
  erro_motivo?: string
  enviado_por?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    agendamento_id?: AgendamentoRecord
  }
}

export interface ExameAnexoRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  arquivo?: string
  url_arquivo?: string
  tipo:
    | 'raiox'
    | 'panoramica'
    | 'periapical'
    | 'tomografia'
    | 'foto_clinica'
    | 'documento'
    | 'laudo'
    | 'outro'
  titulo?: string
  descricao: string
  data_exame?: string
  dente_referencia?: string
  tags?: string[]
  tamanho_bytes?: number
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
  }
}

export interface MedicamentoPrescrito {
  medicamento: string
  dosagem?: string
  via?: string
  posologia: string
  duracao?: string
  quantidade?: string
}

export interface PrescricaoRecord {
  id: string
  tenant_id: string
  unidade_id?: string
  paciente_id: string
  profissional_id?: string
  tipo_documento:
    | 'receituario_simples'
    | 'receituario_controle_especial'
    | 'atestado_comparecimento'
    | 'atestado_afastamento'
    | 'orientacao_pos_operatoria'
  data: string
  dias_afastamento?: number
  cid10?: string
  medicamentos: MedicamentoPrescrito[]
  instrucoes?: string
  dentista_nome: string
  cro: string
  cro_uf?: string
  assinatura_digital_hash?: string
  emitido_em?: string
  created?: string
  updated?: string
  expand?: {
    paciente_id?: PacienteRecord
    profissional_id?: ProfissionalRecord
  }
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
