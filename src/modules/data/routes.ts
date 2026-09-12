import {tableNames} from '@kampuskit/shared/types'
import type {Config} from '../../config/env.ts'
import type {Cookies} from '../../http/cookies.ts'
import {readJson, stringField} from '../../http/body.ts'
import {ApiError, checkResult, json} from '../../http/errors.ts'
import {publicClient} from '../../integrations/supabase.ts'
import {requireIdentity} from '../auth/session.ts'
import {recordId, validateRow, writableTable} from './validation.ts'

export async function dataRoutes(request: Request, config: Config, cookies: Cookies): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method
  if (path === '/api/public/internships' && method === 'GET') {
    if (!config.configured) return json([])
    return json(checkResult(await publicClient(config).rpc('public_imported_internships')))
  }
  if (path === '/api/data' && method === 'GET') {
    const {client, user} = await requireIdentity(config, cookies)
    const [tables, profile] = await Promise.all([
      Promise.all(tableNames.map(async table => [table, checkResult(await client.from(table).select(table === 'reminder_jobs' ? 'id,calendar_id,user_id,state,last_error' : '*'))])),
      client.from('profiles').select('*').eq('id', user.id).maybeSingle()
    ])
    return json({data: Object.fromEntries(tables), profile: checkResult(profile)})
  }
  if (path === '/api/profile' && method === 'PUT') {
    const {client, user} = await requireIdentity(config, cookies), body = await readJson(request)
    if (Object.keys(body).some(key => !['display_name', 'university_id', 'department'].includes(key))) throw new ApiError(400, 'PROTECTED_FIELD', 'Profil alanları geçersiz.')
    const row = {display_name: stringField(body, 'display_name', 1, 60).trim(),
      university_id: recordId(stringField(body, 'university_id', 36, 36)), department: stringField(body, 'department', 1, 100).trim()}
    checkResult(await client.from('profiles').upsert({...row, id: user.id}))
    return json({ok: true})
  }
  const match = path.match(/^\/api\/records\/([a-z_]+)(?:\/([^/]+))?$/)
  if (!match || !['POST', 'PATCH', 'DELETE'].includes(method)) return null
  const [, table, id] = match
  writableTable(table, method)
  if ((method === 'POST' && id) || (method !== 'POST' && !id)) throw new ApiError(400, 'VALIDATION', 'İşlem ve kayıt yolu uyuşmuyor.')
  if (id) recordId(id)
  const {client, user} = await requireIdentity(config, cookies)
  let result
  if (method === 'DELETE') result = await client.from(table).delete().eq('id', id!).eq('user_id', user.id).select('id')
  else {
    const row = validateRow(table, await readJson(request), method)
    result = method === 'POST'
      ? await client.from(table).insert({...row, user_id: user.id}).select('id')
      : await client.from(table).update(row).eq('id', id!).eq('user_id', user.id).select('id')
  }
  const rows = checkResult(result)
  if (!rows?.length) throw new ApiError(404, 'NOT_FOUND', 'Kayıt bulunamadı veya bu kayıt için yetkin yok.')
  return json({id: rows[0].id}, method === 'POST' ? 201 : 200)
}
