import {createClient} from '@supabase/supabase-js'
import type {Config} from '../config/env.ts'
import {Cookies, cookieNames} from '../http/cookies.ts'
import {ApiError} from '../http/errors.ts'

export function publicClient(config: Config, token?: string) {
  if (!config.configured) throw new ApiError(503, 'NOT_CONFIGURED', 'Hesap servisi henüz yapılandırılmadı.')
  return createClient(config.url, config.key, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    ...(token ? {global: {headers: {Authorization: `Bearer ${token}`}}} : {})
  })
}
export function authClient(config: Config, cookies: Cookies) {
  if (!config.configured) throw new ApiError(503, 'NOT_CONFIGURED', 'Hesap servisi henüz yapılandırılmadı.')
  const memory = new Map<string, string>()
  const verifierCookie = (key: string) => key === 'kampuskit-auth-code-verifier'
    ? cookieNames.verifier : 'kk_pkce_' + key.replace(/^kampuskit-auth-/, '')
  return createClient(config.url, config.key, {auth: {
    // The SDK ignores custom storage with persistSession:false. Persist only PKCE
    // slots to cookies; session JSON stays in this request's private memory.
    persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
    flowType: 'pkce', storageKey: 'kampuskit-auth',
    experimental: {appendPkceFlowIdToRedirects: true},
    storage: {
      getItem: key => key.endsWith('-code-verifier') ? cookies.get(verifierCookie(key)) : memory.get(key) || null,
      setItem: (key, value) => {if (key.endsWith('-code-verifier')) cookies.set(verifierCookie(key), value, 86400); else memory.set(key, value)},
      removeItem: key => {if (key.endsWith('-code-verifier')) cookies.delete(verifierCookie(key)); else memory.delete(key)}
    }
  }})
}
export function adminClient(config: Config) {
  if (!config.configured || !config.serviceKey) throw new ApiError(503, 'IMPORT_NOT_CONFIGURED', 'Staj toplama servisi henüz yapılandırılmadı.')
  return createClient(config.url, config.serviceKey, {auth: {persistSession: false, autoRefreshToken: false}})
}
