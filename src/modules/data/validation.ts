import {ApiError} from '../../http/errors.ts'

const fields: Record<string, string[]> = {
  posts: ['university_id', 'course_id', 'kind', 'title', 'body', 'link_url', 'attachment_path', 'published'],
  replies: ['post_id', 'body'],
  listings: ['university_id', 'kind', 'title', 'description', 'category', 'price_kurus', 'deposit_kurus', 'district', 'available_from', 'lifestyle', 'contact', 'image_path', 'status'],
  budget_entries: ['type', 'amount_kurus', 'category', 'note', 'occurred_on'],
  calendar_items: ['title', 'kind', 'due_at', 'reminder_minutes', 'email_enabled', 'completed', 'club_event_id'],
  club_follows: ['club_id'], saved_internships: ['internship_id'],
  crowd_reports: ['location_id', 'level'], reviews: ['place_id', 'rating', 'body'],
  internships: ['university_id', 'title', 'company', 'field', 'location', 'work_mode', 'description', 'source_url', 'deadline', 'status'],
  places: ['university_id', 'campus_id', 'name', 'category', 'price_level', 'district', 'description', 'symbol', 'address', 'maps_url', 'latitude', 'longitude', 'meal_price_kurus', 'price_observed_on'],
  notifications: ['read_at']
}
export function recordId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new ApiError(400, 'VALIDATION', 'Geçerli bir kayıt kimliği gerekli.')
  return value
}
export function writableTable(table: string, method: string) {
  if (!Object.hasOwn(fields, table)) throw new ApiError(403, 'READ_ONLY', 'Bu tablo API üzerinden değiştirilemez.')
  if (table === 'notifications' && method !== 'PATCH') throw new ApiError(403, 'READ_ONLY', 'Bildirimlerde yalnızca okundu bilgisi güncellenebilir.')
  if (table === 'places' && method === 'DELETE') throw new ApiError(403, 'READ_ONLY', 'Mekan silme işlemi desteklenmiyor.')
}
export function validateRow(table: string, row: Record<string, unknown>, method: string) {
  writableTable(table, method)
  if (!Object.keys(row).length) throw new ApiError(400, 'VALIDATION', 'En az bir kayıt alanı gerekli.')
  const allowed = fields[table]
  for (const [key, value] of Object.entries(row)) {
    if (!allowed.includes(key) || (method === 'PATCH' && ['university_id', 'kind'].includes(key) && table === 'internships') || (method === 'POST' && table === 'internships' && key === 'status'))
      throw new ApiError(400, 'PROTECTED_FIELD', `${key} alanı bu işlemde değiştirilemez.`)
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new ApiError(400, 'VALIDATION', `${key} alanı geçersiz.`)
    if (typeof value === 'string' && value.length > 10000) throw new ApiError(400, 'VALIDATION', `${key} alanı çok uzun.`)
    if (key.endsWith('_kurus') && value !== null && (!Number.isSafeInteger(value) || Number(value) < (key === 'deposit_kurus' ? 0 : 1) || Number(value) > 10000000000))
      throw new ApiError(400, 'VALIDATION', 'Tutar tam sayı kuruş olarak gönderilmeli.')
    if (['published', 'email_enabled', 'completed'].includes(key) && typeof value !== 'boolean')
      throw new ApiError(400, 'VALIDATION', `${key} alanı doğru/yanlış olmalı.`)
    if (['link_url', 'source_url', 'maps_url'].includes(key) && value !== null) {
      try {if (!['http:', 'https:'].includes(new URL(String(value)).protocol)) throw new Error()} catch {throw new ApiError(400, 'VALIDATION', 'Geçerli bir HTTP veya HTTPS bağlantısı gir.')}
    }
  }
  return row
}
