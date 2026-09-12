import type {Config} from '../../config/env.ts'
import {ApiError, json} from '../../http/errors.ts'
import {readJson} from '../../http/body.ts'

interface RawPlace {
  id: string; displayName?: {text?: string}; formattedAddress?: string;
  location?: {latitude: number; longitude: number}; priceLevel?: string;
  rating?: number; userRatingCount?: number; googleMapsUri?: string;
  attributions?: {provider?: string; providerUri?: string}[];
}
export async function placeRoutes(request: Request, config: Config): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/places/nearby' || request.method !== 'POST') return null
  if (!config.placesKey) throw new ApiError(503, 'PLACES_NOT_CONFIGURED', 'Mekan arama servisi henüz yapılandırılmadı.')
  const body = await readJson(request), lat = body.lat, lng = body.lng, radius = body.radius, category = body.category
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || typeof radius !== 'number' || !Number.isFinite(radius) || radius < 500 || radius > 5000 || !['cafe', 'restaurant', 'library'].includes(String(category)))
    throw new ApiError(400, 'VALIDATION', 'Mekan arama konumu, kategorisi veya yarıçapı geçersiz.')
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: {'Content-Type': 'application/json', 'X-Goog-Api-Key': config.placesKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.rating,places.userRatingCount,places.googleMapsUri,places.attributions'},
    body: JSON.stringify({locationRestriction: {circle: {center: {latitude: lat, longitude: lng}, radius}}, includedPrimaryTypes: [category], maxResultCount: 20, rankPreference: 'DISTANCE', languageCode: 'tr'})
  })
  if (!response.ok) throw new ApiError(502, 'PLACES_UNAVAILABLE', 'Mekan servisine ulaşılamadı. Biraz sonra tekrar dene.')
  const data = await response.json() as {places?: RawPlace[]}
  const prices: Record<string, number> = {PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4}
  return json((data.places || []).filter(place => place.location).map(place => ({
    id: place.id, name: place.displayName?.text || 'İsimsiz mekan', address: place.formattedAddress || '',
    point: {lat: place.location!.latitude, lng: place.location!.longitude}, price: prices[place.priceLevel || ''] ?? null,
    rating: place.rating ?? null, count: place.userRatingCount ?? 0,
    url: place.googleMapsUri || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.displayName?.text || '') + '&query_place_id=' + encodeURIComponent(place.id),
    attributions: (place.attributions || []).map(item => ({name: item.provider || 'Google Maps', url: item.providerUri || null}))
  })))
}
