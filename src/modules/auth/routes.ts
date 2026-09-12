import type {Config} from '../../config/env.ts'
import type {Cookies} from '../../http/cookies.ts'
import {readJson, stringField} from '../../http/body.ts'
import {ApiError, json} from '../../http/errors.ts'
import {authClient} from '../../integrations/supabase.ts'
import {exchangeCode, identify, requireIdentity, setSession, viewSession} from './session.ts'

function authError(error: {status?: number; code?: string} | null) {
  if (!error) return
  if (error.status === 429) throw new ApiError(429, 'RATE_LIMITED', 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.')
  if (!error.status || error.status >= 500) throw new ApiError(502, 'AUTH_UNAVAILABLE', 'Hesap servisine ulaşılamadı.')
  throw new ApiError(400, 'AUTH_FAILED', 'Hesap bilgilerini veya bağlantının geçerliliğini kontrol et.')
}
export async function authRoutes(request: Request, config: Config, cookies: Cookies): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method
  if (path === '/api/auth/session' && method === 'GET') {
    const identity = config.configured ? await identify(config, cookies) : null
    return json({session: identity ? viewSession(identity.user) : null})
  }
  if (path === '/api/auth/callback' && method === 'GET') {
    let route = url.searchParams.get('flow') === 'recovery' ? '/sifre-yenile' : '/app'
    try {
      const code = url.searchParams.get('code')
      if (!code || url.searchParams.has('error')) throw new Error()
      await exchangeCode(config, cookies, code, url.searchParams.get('sb_flow_id') || undefined)
    } catch {route = '/giris?auth_error=' + encodeURIComponent('Bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.')}
    return new Response(null, {status: 303, headers: {Location: config.origin + '/#' + route}})
  }
  if (!path.startsWith('/api/auth/') || method !== 'POST') return null
  if (path === '/api/auth/logout') {
    const identity = await identify(config, cookies)
    if (identity) {
      const result = await authClient(config, cookies).auth.admin.signOut(identity.token, 'local')
      authError(result.error)
    }
    cookies.clearSession()
    return json({session: null})
  }
  if (!['/api/auth/login', '/api/auth/signup', '/api/auth/reset', '/api/auth/password', '/api/auth/exchange'].includes(path)) return null
  const body = await readJson(request)
  if (path === '/api/auth/exchange') return json({session: await exchangeCode(config, cookies, stringField(body, 'code', 1, 2048), typeof body.flowId === 'string' ? body.flowId : undefined)})
  const client = authClient(config, cookies)
  if (path === '/api/auth/password') {
    const identity = await requireIdentity(config, cookies), password = stringField(body, 'password', 8, 128)
    const {data, error} = await client.auth.setSession({access_token: identity.token, refresh_token: cookies.get('kk_refresh') || ''})
    authError(error)
    if (data.session) setSession(cookies, data.session)
    const result = await client.auth.updateUser({password}); authError(result.error)
    return json({session: result.data.user ? viewSession(result.data.user) : null})
  }
  const email = stringField(body, 'email', 3, 254).trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'VALIDATION', 'Geçerli bir e-posta adresi gir.')
  if (path === '/api/auth/reset') {
    const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo: config.origin + '/api/auth/callback?flow=recovery'})
    authError(error); return json({ok: true})
  }
  const password = stringField(body, 'password', path === '/api/auth/login' ? 1 : 8, 128)
  const result = path === '/api/auth/login'
    ? await client.auth.signInWithPassword({email, password})
    : await client.auth.signUp({email, password, options: {emailRedirectTo: config.origin + '/api/auth/callback'}})
  authError(result.error)
  if (result.data.session) setSession(cookies, result.data.session)
  return json({session: result.data.session ? viewSession(result.data.session.user) : null})
}
