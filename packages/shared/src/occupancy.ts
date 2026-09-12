export interface Entry {time: string; count: number}
export type VenueKind = 'library' | 'cafeteria' | 'gym'
export interface Venue {
  id: string; university: string; city: string; campus: string; name: string;
  kind: VenueKind; capacity: number; capacityType: string; sourceUrl: string;
  sourceTitle: string; sourceYear: number | null; retrievedAt: string; scope: string;
}
interface Metric {mae: number; rmse: number}
interface Split {rows: number; days: number; from: string; to: string}
export interface Sample {timestamp: string; day: string; target: number; prediction: number; entries15: number}
export interface OccupancyDemo {
  source: {name: string; url: string; license: string};
  report: {trainingSeconds: number; test: Metric; split: Record<'train' | 'validation' | 'test', Split>;
    audit: {rawRows: number; rawDays: number; sha256: string}; baselines: {clock: Metric; fixedWindow: Metric}};
  rows: Sample[];
}
export interface FutureSample {timestamp: string; forecastTime: string; futureTarget: number; forecastPrediction: number}
export interface OccupancyForecast {
  report: {horizonMinutes: number; sourceSha256: string; test: Metric; trainingSeconds: number;
    split: Record<'train' | 'validation' | 'test', Split>; baselines: {holdCurrentEstimate: Metric; clock: Metric}};
  rows: FutureSample[];
}
export interface OccupancyBundle {demo: OccupancyDemo; forecast: OccupancyForecast; venues: Venue[]}
export interface OccupancyPrediction {
  timestamp: string; extraEntries: number; nowEstimate: number;
  futureEstimate: number | null; forecastTime: string | null; features: number[];
}

// Scenario rules do not infer campus occupancy from the office model.
export function density(people: number, capacity: number) {
  if (!Number.isFinite(people) || people < 0 || !Number.isFinite(capacity) || capacity <= 0) throw new Error('Geçersiz kişi sayısı veya kapasite.')
  const ratio = people / capacity
  return {percent: Math.round(ratio * 100), barPercent: Math.min(100, ratio * 100),
    level: ratio > 1 ? 'Kapasite üstü' : ratio === 1 ? 'Tam kapasite' : ratio >= .8 ? 'Yoğun' : ratio >= .4 ? 'Orta' : 'Sakin',
    tone: ratio >= .8 ? 'busy' : ratio >= .4 ? 'moderate' : 'quiet'}
}
export function examScenario(people: number, kind: VenueKind, enabled: boolean, upliftPercent: number) {
  if (!Number.isFinite(people) || people < 0 || !Number.isFinite(upliftPercent) || upliftPercent < 0 || upliftPercent > 100) throw new Error('Geçersiz sınav senaryosu.')
  return Math.round(people * (kind === 'library' && enabled ? 1 + upliftPercent / 100 : 1))
}
