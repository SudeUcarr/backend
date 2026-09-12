import type {Config} from '../../config/env.ts'
import type {Cookies} from '../../http/cookies.ts'
import {readBytes} from '../../http/body.ts'
import {ApiError, checkResult, json} from '../../http/errors.ts'
import {requireIdentity} from '../auth/session.ts'

const buckets: Record<string, {max: number; types: Record<string, string>}> = {
  notes: {max: 10 * 1024 * 1024, types: {'application/pdf': 'pdf'}},
  'listing-images': {max: 5 * 1024 * 1024, types: {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}}
}
function validSignature(bytes: Uint8Array, type: string) {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 12))
  if (type === 'application/pdf') return head.startsWith('%PDF-')
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  return head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP'
}
export async function storageRoutes(request: Request, config: Config, cookies: Cookies): Promise<Response | null> {
  const url = new URL(request.url), match = url.pathname.match(/^\/api\/files\/([^/]+)$/)
  if (!match || !['GET', 'POST'].includes(request.method)) return null
  const bucket = match[1]
  if (!Object.hasOwn(buckets, bucket)) throw new ApiError(400, 'INVALID_BUCKET', 'Dosya deposu geçersiz.')
  const {client, user} = await requireIdentity(config, cookies)
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') || '', rule = buckets[bucket]
    if (!Object.hasOwn(rule.types, type)) throw new ApiError(415, 'FILE_TYPE', 'Desteklenen bir dosya türü seç.')
    const bytes = await readBytes(request, rule.max)
    if (!validSignature(bytes, type)) throw new ApiError(400, 'FILE_TYPE', 'Dosya içeriği seçilen dosya türüyle uyuşmuyor.')
    const path = user.id + '/' + crypto.randomUUID() + '.' + rule.types[type]
    checkResult(await client.storage.from(bucket).upload(path, bytes, {contentType: type, upsert: false}))
    return json({path}, 201)
  }
  const path = url.searchParams.get('path') || ''
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i.test(path)) throw new ApiError(400, 'VALIDATION', 'Dosya yolu geçersiz.')
  const blob = checkResult(await client.storage.from(bucket).download(path))
  if (!blob) throw new ApiError(404, 'FILE_NOT_FOUND', 'Dosya bulunamadı veya bu dosya için yetkin yok.')
  return new Response(blob, {headers: {'Content-Type': blob.type || 'application/octet-stream', 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff'}})
}
