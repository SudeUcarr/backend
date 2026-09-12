import {getConfig} from './config/env.ts'
import type {RuntimeEnv} from './config/env.ts'
import {Cookies} from './http/cookies.ts'
import {ApiError, json} from './http/errors.ts'
import {publicClient} from './integrations/supabase.ts'
import {authRoutes} from './modules/auth/routes.ts'
import {dataRoutes} from './modules/data/routes.ts'
import {storageRoutes} from './modules/storage/routes.ts'
import {internshipRoutes} from './modules/internships/routes.ts'
import {placeRoutes} from './modules/places/routes.ts'
import {occupancyRoutes} from './modules/occupancy/routes.ts'

export async function handleRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  let cookies: Cookies | undefined
  let origin: string | undefined
  let response: Response
  try {
    const config = getConfig(env); origin = config.origin; cookies = new Cookies(request, config)
    const requestOrigin = request.headers.get('origin'), path = new URL(request.url).pathname
    if (requestOrigin && requestOrigin !== config.origin) throw new ApiError(403, 'ORIGIN_REJECTED', 'Bu uygulama adresinden istek kabul edilmiyor.')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && requestOrigin !== config.origin)
      throw new ApiError(403, 'CSRF_REJECTED', 'İstek uygulama üzerinden gönderilmeli.')
    if (request.method === 'OPTIONS') response = new Response(null, {status: 204})
    else if (path === '/api/health' && request.method === 'GET') {
      let databaseReady = false
      if (config.configured) {const result = await publicClient(config).rpc('app_status'); databaseReady = !result.error && Boolean(result.data)}
      response = json({configured: config.configured, databaseReady})
    } else response = await authRoutes(request, config, cookies)
      || await dataRoutes(request, config, cookies)
      || await storageRoutes(request, config, cookies)
      || await internshipRoutes(request, config, cookies)
      || await placeRoutes(request, config)
      || await occupancyRoutes(request)
      || json({error: {code: 'NOT_FOUND', message: 'API yolu veya istek yöntemi bulunamadı.'}}, 404)
  } catch (error) {
    const known = error instanceof ApiError
    response = json({error: {code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'İşlem tamamlanamadı. Yeniden deneyebilirsin.'}}, known ? error.status : 500)
  }
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Vary', 'Origin, Cookie')
  if (origin && request.headers.get('origin') === origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Headers', 'Content-Type')
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  }
  cookies?.apply(headers)
  return new Response(response.body, {status: response.status, headers})
}
