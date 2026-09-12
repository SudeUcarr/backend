import {readJson, stringField} from '../../http/body.ts'
import {ApiError, json} from '../../http/errors.ts'
import {getOccupancyDemo, predictOccupancy} from './service.ts'

export async function occupancyRoutes(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname
  if (path === '/api/occupancy/demo' && request.method === 'GET') return json(getOccupancyDemo())
  if (path !== '/api/occupancy/predict' || request.method !== 'POST') return null
  const body = await readJson(request)
  if (Object.keys(body).some(key => !['timestamp', 'extraEntries'].includes(key)))
    throw new ApiError(400, 'VALIDATION', 'Tahmin yalnızca kayıt saati ve deneme giriş sayısını kabul eder.')
  const timestamp = stringField(body, 'timestamp', 19, 19)
  const extraEntries = body.extraEntries === undefined ? 0 : body.extraEntries
  if (typeof extraEntries !== 'number') throw new ApiError(400, 'VALIDATION', 'Deneme giriş sayısı sayı olmalı.')
  return json(predictOccupancy(timestamp, extraEntries))
}
