import type {Session, User} from '@supabase/supabase-js'
import type {AppSession} from '@kampuskit/shared/api'
import type {Config} from '../../config/env.ts'
import {Cookies, cookieNames} from '../../http/cookies.ts'
import {ApiError} from '../../http/errors.ts'
import {authClient, publicClient} from '../../integrations/supabase.ts'

export const viewSession = (user: User): AppSession => ({user: {id: user.id, email: user.email}})
export function setSession(cookies: Cookies, session: Session) {
  // Keep the access cookie until the refresh cookie expires so expired JWTs can be renewed.
  cookies.set(cookieNames.access, session.access_token, 30 * 86400)
  cookies.set(cookieNames.refresh, session.refresh_token, 30 * 86400)
}
export interface Identity {user: User; token: string; client: ReturnType<typeof publicClient>}

// Serialize refresh-token rotation in a single process/isolate. No user sessions are cached.
const refreshes = new Map<string, Promise<Session | null>>()
async function refresh(config: Config, token: string): Promise<Session | null> {
  const existing = refreshes.get(token)
  if (existing) return existing
  const promise = publicClient(config).auth.refreshSession({refresh_token: token}).then(({data, error}) => {
    if (error && (!('status' in error) || !error.status || error.status >= 500))
      throw new ApiError(502, 'AUTH_UNAVAILABLE', 'Hesap servisine ulaşılamadı. Yeniden deneyebilirsin.')
    return error ? null : data.session
  })
  refreshes.set(token, promise)
  try {return await promise} finally {refreshes.delete(token)}
}
export async function identify(config: Config, cookies: Cookies): Promise<Identity | null> {
  let token = cookies.get(cookieNames.access)
  const refreshToken = cookies.get(cookieNames.refresh)
  if (!token && !refreshToken) return null
  if (token) {
    const {data, error} = await publicClient(config).auth.getUser(token)
    if (!error && data.user) return {user: data.user, token, client: publicClient(config, token)}
    if (error && (!error.status || error.status >= 500))
      throw new ApiError(502, 'AUTH_UNAVAILABLE', 'Hesap servisine ulaşılamadı. Yeniden deneyebilirsin.')
  }
  if (refreshToken) {
    const session = await refresh(config, refreshToken)
    if (session) {
      setSession(cookies, session); token = session.access_token
      return {user: session.user, token, client: publicClient(config, token)}
    }
  }
  cookies.clearSession()
  return null
}
export async function requireIdentity(config: Config, cookies: Cookies): Promise<Identity> {
  const identity = await identify(config, cookies)
  if (!identity) throw new ApiError(401, 'UNAUTHENTICATED', 'İşlemi yapmak için hesabına giriş yap.')
  return identity
}
export async function exchangeCode(config: Config, cookies: Cookies, code: string, flowId?: string) {
  const {data, error} = await authClient(config, cookies).auth.exchangeCodeForSession(code, flowId ? {flowId} : undefined)
  if (error || !data.session) throw new ApiError(400, 'CALLBACK_FAILED', 'Bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.')
  setSession(cookies, data.session)
  return viewSession(data.session.user)
}
