export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code
  }
}
export function checkResult<T>(result: {data: T; error: {message: string; code?: string} | null}): T {
  if (result.error) {
    const code = result.error.code
    if (code === '42501') throw new ApiError(403, 'FORBIDDEN', 'Bu işlem için yetkin bulunmuyor.')
    if (code === '23505') throw new ApiError(409, 'CONFLICT', 'Bu kayıt zaten mevcut.')
    if (code?.startsWith('23') || code === '22P02')
      throw new ApiError(400, 'VALIDATION', 'Kayıt alanlarını ve ilişkili kayıtları kontrol et.')
    throw new ApiError(502, 'UPSTREAM_ERROR', 'Veri servisine ulaşılamadı. Yeniden deneyebilirsin.')
  }
  return result.data
}
export const json = (data: unknown, status = 200) => Response.json(data, {status})
