import type {Config} from '../../config/env.ts'
import type {Cookies} from '../../http/cookies.ts'
import {json} from '../../http/errors.ts'
import {requireIdentity} from '../auth/session.ts'
import {syncInternships} from './service.ts'

export async function internshipRoutes(request: Request, config: Config, cookies: Cookies): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/internships/sync' || request.method !== 'POST') return null
  await requireIdentity(config, cookies)
  const result = await syncInternships(config)
  return json(result, result.sources.every(source => source.status === 'failed') ? 502 : 200)
}
