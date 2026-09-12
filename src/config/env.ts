import {ApiError} from '../http/errors.ts'

export interface RuntimeEnv {
  NODE_ENV?: string; APP_ORIGIN?: string; SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string; SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string; GOOGLE_PLACES_API_KEY?: string; SPOONACULAR_API_KEY?: string;
}
export function getConfig(env: RuntimeEnv) {
  const origin = env.APP_ORIGIN || (env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5173')
  let parsed: URL
  try { parsed = new URL(origin) } catch { throw new ApiError(503, 'CONFIGURATION', 'Backend APP_ORIGIN ayarı eksik veya geçersiz.') }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin)
    throw new ApiError(503, 'CONFIGURATION', 'APP_ORIGIN yalnızca uygulamanın tam origin adresi olmalı.')
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    throw new ApiError(503, 'CONFIGURATION', 'Üretim ortamında HTTPS gerekli.')
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || ''
  return {origin, secure: parsed.protocol === 'https:', url: env.SUPABASE_URL || '', key,
    configured: Boolean(env.SUPABASE_URL && key), serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    placesKey: env.GOOGLE_PLACES_API_KEY, recipesKey: env.SPOONACULAR_API_KEY}
}
export type Config = ReturnType<typeof getConfig>
