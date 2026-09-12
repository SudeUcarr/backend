import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { sources, collectSource } from '../_shared/internships.ts'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async req => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (req.method !== 'POST') return reply(405, { error: 'POST required' })
    const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
    if (!token) return reply(401, { error: 'Sign in required' })
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    if (token !== key) { const user = await admin.auth.getUser(token); if (user.error || !user.data.user) return reply(401, { error: 'Sign in required' }) }
    const result = await Promise.all(sources.map(async source => {
        const name = source.provider + ':' + source.board
        const claim = await admin.rpc('claim_ingestion', { source_name: name })
        if (claim.error) return { source: name, status: 'failed', error: 'Import lock unavailable' }
        if (!claim.data) return { source: name, status: 'cooldown' }
        try {
            const now = new Date().toISOString(), jobs = await collectSource(source, fetch, now)
            if (jobs.length) { const r = await admin.from('internships').upsert(jobs, { onConflict: 'source_provider,source_key' }); if (r.error) throw r.error }
            const close = await admin.from('internships').update({ status: 'closed' }).eq('source_provider', name).lt('fetched_at', now); if (close.error) throw close.error
            const finish = await admin.from('ingestion_runs').update({ status: 'success', finished_at: new Date().toISOString(), imported_count: jobs.length, error: null }).eq('source', name); if (finish.error) throw finish.error
            return { source: name, status: 'success', count: jobs.length }
        } catch (error) {
            // Log only operational errors, never API credentials or fetched HTML.
            const message = error instanceof Error ? error.message : 'Source could not be imported'
            await admin.from('ingestion_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error: message.slice(0, 300) }).eq('source', name)
            return { source: name, status: 'failed', error: message.slice(0, 300) }
        }
    }))
    return reply(result.every(r => r.status === 'failed') ? 502 : 200, { sources: result })
})
