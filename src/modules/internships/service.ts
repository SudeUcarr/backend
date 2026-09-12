import {sources, collectSource} from '../../integrations/internship-sources.ts'
import {adminClient} from '../../integrations/supabase.ts'
import {checkResult} from '../../http/errors.ts'
import type {Config} from '../../config/env.ts'
import type {SyncResponse} from '@kampuskit/shared/api'

export async function syncInternships(config: Config): Promise<SyncResponse> {
  const admin = adminClient(config)
  const runs: SyncResponse['sources'] = []
  // Sequential requests keep Worker subrequest and memory usage bounded.
  for (const source of sources) {
    const name = source.provider + ':' + source.board
    const claim = await admin.rpc('claim_ingestion', {source_name: name})
    if (claim.error) {runs.push({source: name, status: 'failed', error: 'Kaynak kilidi alınamadı.'}); continue}
    if (!claim.data) {runs.push({source: name, status: 'cooldown'}); continue}
    try {
      const now = new Date().toISOString(), jobs = await collectSource(source, fetch, now)
      if (jobs.length) checkResult(await admin.from('internships').upsert(jobs, {onConflict: 'source_provider,source_key'}))
      checkResult(await admin.from('internships').update({status: 'closed'}).eq('source_provider', name).lt('fetched_at', now))
      checkResult(await admin.from('ingestion_runs').update({status: 'success', finished_at: new Date().toISOString(), imported_count: jobs.length, error: null}).eq('source', name))
      runs.push({source: name, status: 'success', count: jobs.length})
    } catch {
      const error = 'Kaynağa ulaşılamadı. Mevcut ilanlar korundu.'
      await admin.from('ingestion_runs').update({status: 'failed', finished_at: new Date().toISOString(), error}).eq('source', name)
      runs.push({source: name, status: 'failed', error})
    }
  }
  return {sources: runs}
}
