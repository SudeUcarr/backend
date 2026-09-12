import type {Config} from '../config/env.ts'

export const cookieNames = {access: 'kk_access', refresh: 'kk_refresh', verifier: 'kk_verifier'}
export class Cookies {
  private values = new Map<string, string>()
  private updates = new Map<string, string>()
  private secure: boolean
  constructor(request: Request, config: Config) {
    this.secure = config.secure
    for (const pair of (request.headers.get('cookie') || '').split(';')) {
      const index = pair.indexOf('=')
      if (index < 0) continue
      try {this.values.set(pair.slice(0, index).trim(), decodeURIComponent(pair.slice(index + 1)))} catch { /* Ignore malformed cookies. */ }
    }
  }
  get(name: string) {return this.values.get(name) || null}
  set(name: string, value: string, maxAge: number) {
    this.values.set(name, value)
    this.updates.set(name, `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.secure ? '; Secure' : ''}`)
  }
  delete(name: string) {this.set(name, '', 0); this.values.delete(name)}
  clearSession() {this.delete(cookieNames.access); this.delete(cookieNames.refresh)}
  apply(headers: Headers) {for (const value of this.updates.values()) headers.append('Set-Cookie', value)}
}
