import { pb } from './client'

export async function registrarAuditoria(params: {
  tenantId: string
  userEmail?: string
  perfil?: string
  targetPatientId?: string
  acao: string
  detalhes?: string
}) {
  try {
    const authModel = pb.authStore.model
    await pb.collection('auditoria_acesso').create({
      tenant_id: params.tenantId,
      user_id: authModel?.id || '',
      user_email: params.userEmail || authModel?.email || 'sistema@gestecodonto.com.br',
      perfil: params.perfil || (authModel as any)?.perfil || 'sistema',
      target_patient_id: params.targetPatientId || '',
      acao: params.acao,
      detalhes: params.detalhes || '',
      ip: '127.0.0.1 (Web App)',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Registro de auditoria falhou silenciosamente:', err)
  }
}
