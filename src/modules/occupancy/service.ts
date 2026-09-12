import demoJson from './assets/demo.json' with {type: 'json'}
import forecastJson from './assets/forecast.json' with {type: 'json'}
import forestJson from './assets/forest.json' with {type: 'json'}
import futureForestJson from './assets/forecast-forest.json' with {type: 'json'}
import venuesJson from './assets/capacities.json' with {type: 'json'}
import {buildFeatures, predict, predictFuture, featureNames} from './model.ts'
import type {Forest} from './model.ts'
import type {Entry, OccupancyBundle, OccupancyDemo, OccupancyPrediction} from '@kampuskit/shared/occupancy'
import {ApiError} from '../../http/errors.ts'

const training = demoJson as unknown as OccupancyDemo & {entryDays: Record<string, Entry[]>}
const forecast = forecastJson as unknown as OccupancyBundle['forecast']
const forest = forestJson as Forest, futureForest = futureForestJson as Forest
const venues = venuesJson as OccupancyBundle['venues']
const rows = new Map(training.rows.map(row => [row.timestamp, row]))
const futureRows = new Map(forecast.rows.map(row => [row.timestamp, row]))
const ready = training.rows.length > 0 && venuesJson.length > 0
  && forecast.report.sourceSha256 === training.report.audit.sha256
  && futureForest.horizonMinutes === 60 && forecast.report.horizonMinutes === 60
  && [forest, futureForest].every(model => model.trees.length > 0 && model.features.join('|') === featureNames.join('|'))
function requireModels() {
  if (!ready) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'Yoğunluk modeli eksik veya veri setiyle uyumsuz.')
}
export function getOccupancyDemo(): OccupancyBundle {
  requireModels()
  // Tree weights and raw entrance histories stay on the server.
  return {demo: {source: training.source, report: training.report,
    rows: training.rows.map(({timestamp, day, target, prediction, entries15}) => ({timestamp, day, target, prediction, entries15}))},
    forecast, venues}
}
export function predictOccupancy(timestamp: string, extraEntries = 0): OccupancyPrediction {
  requireModels()
  const row = rows.get(timestamp)
  if (!row) throw new ApiError(400, 'OUTSIDE_MODEL_DATA', 'Tahmin için kayıtlı bir test günü ve saati seç.')
  if (!Number.isSafeInteger(extraEntries) || extraEntries < 0 || extraEntries > 10000)
    throw new ApiError(400, 'VALIDATION', 'Deneme giriş sayısı 0–10.000 arasında tam sayı olmalı.')
  const entries = training.entryDays[row.day]
  if (!entries) throw new ApiError(503, 'MODEL_UNAVAILABLE', 'Seçilen günün giriş kayıtları bulunamadı.')
  const features = buildFeatures(extraEntries ? [...entries, {time: timestamp, count: extraEntries}] : entries, timestamp)
  const future = futureRows.get(timestamp)
  // Missing +60-minute coverage is unknown, never zero or an invented closing time.
  return {timestamp, extraEntries, features, nowEstimate: predict(forest, features),
    futureEstimate: future ? predictFuture(futureForest, features) : null, forecastTime: future?.forecastTime ?? null}
}
