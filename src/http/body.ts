import {ApiError} from './errors.ts'

export async function readBytes(request: Request, max: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'))
  if (declared > max) throw new ApiError(413, 'BODY_TOO_LARGE', 'İstek boyutu izin verilen sınırı aşıyor.')
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > max) {await reader.cancel(); throw new ApiError(413, 'BODY_TOO_LARGE', 'İstek boyutu izin verilen sınırı aşıyor.')}
      chunks.push(value)
    }
  } finally {reader.releaseLock()}
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength}
  return bytes
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new ApiError(415, 'CONTENT_TYPE', 'JSON isteği gerekli.')
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(await readBytes(request, 64 * 1024)))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, 'INVALID_JSON', 'Geçerli bir JSON nesnesi gönder.')
  }
}
export function stringField(row: Record<string, unknown>, key: string, min: number, max: number) {
  const value = row[key]
  if (typeof value !== 'string' || value.length < min || value.length > max)
    throw new ApiError(400, 'VALIDATION', `${key} alanı ${min}–${max} karakter olmalı.`)
  return value
}
