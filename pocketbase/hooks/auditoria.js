/**
 * Hook de Auditoria LGPD e Imutabilidade
 * - Registra automaticamente logs de visualização/leitura de prontuários clínicos e dados sensíveis
 */

onRecordViewRequest(
  (e) => {
    try {
      const authRecord = e.auth
      if (authRecord) {
        const collectionName = e.record.collection().name
        // Monitorar coleções sensíveis clínicas: odontogramas_snapshots, evolucoes_clinicas, exames_anexos, anamneses
        if (
          ['odontogramas_snapshots', 'evolucoes_clinicas', 'exames_anexos', 'anamneses'].includes(
            collectionName,
          )
        ) {
          const auditoriaCollection = $app.findCollectionByNameOrId('auditoria_acesso')
          const log = new Record(auditoriaCollection)

          log.set('tenant_id', authRecord.get('tenant_id') || e.record.get('tenant_id') || '')
          log.set('user_id', authRecord.id)
          log.set('user_email', authRecord.get('email') || '')
          log.set('perfil', authRecord.get('perfil') || 'owner')
          log.set('target_patient_id', e.record.get('paciente_id') || '')
          log.set('acao', 'visualizou_prontuario')
          log.set(
            'detalhes',
            'Acesso ao prontuário clínico na coleção: ' +
              collectionName +
              ' (ID: ' +
              e.record.id +
              ')',
          )
          log.set('ip', '127.0.0.1')
          log.set('timestamp', new Date().toISOString())

          $app.save(log)
        }
      }
    } catch (err) {
      console.error('Erro ao registrar auditoria LGPD:', err)
    }
    return e.next()
  },
  'odontogramas_snapshots',
  'evolucoes_clinicas',
  'exames_anexos',
  'anamneses',
)
