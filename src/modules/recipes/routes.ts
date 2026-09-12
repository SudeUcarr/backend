import type {Config} from '../../config/env.ts'
import {ApiError, json} from '../../http/errors.ts'
import {readJson} from '../../http/body.ts'

interface RawIngredient {name?: string; image?: string}
interface RawMatch {
  id?: number; title?: string; image?: string;
  usedIngredientCount?: number; missedIngredientCount?: number;
  missedIngredients?: RawIngredient[]; likes?: number
}
const NAME_PATTERN = /^[a-zA-ZğüşıöçĞÜŞİÖÇ0-9 '-]{2,40}$/
function slug(title: string) {
  return title.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
export async function recipeRoutes(request: Request, config: Config): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/recipes/find-by-ingredients' || request.method !== 'POST') return null
  if (!config.recipesKey) throw new ApiError(503, 'RECIPES_NOT_CONFIGURED', 'Tarif arama servisi henüz yapılandırılmadı.')
  const body = await readJson(request), ingredients = body.ingredients
  if (!Array.isArray(ingredients) || ingredients.length < 1 || ingredients.length > 8 || !ingredients.every(item => typeof item === 'string' && NAME_PATTERN.test(item)))
    throw new ApiError(400, 'VALIDATION', 'Malzeme listesi 1–8 öge içermeli; her öge 2–40 karakter olmalı.')
  const params = new URLSearchParams({
    apiKey: config.recipesKey, ingredients: ingredients.join(','),
    number: '12', ranking: '1', ignorePantry: 'true'
  })
  const response = await fetch('https://api.spoonacular.com/recipes/findByIngredients?' + params.toString(), {signal: AbortSignal.timeout(15000)})
  if (response.status === 402) throw new ApiError(503, 'RECIPES_QUOTA', 'Tarif servisi günlük kotasına ulaştı.')
  if (!response.ok) throw new ApiError(502, 'RECIPES_UNAVAILABLE', 'Tarif servisine ulaşılamadı. Biraz sonra tekrar dene.')
  const data = await response.json() as RawMatch[]
  return json((Array.isArray(data) ? data : []).filter(item => item.id && item.title).map(item => ({
    id: item.id, title: item.title, image: item.image || '',
    usedCount: item.usedIngredientCount ?? 0, missedCount: item.missedIngredientCount ?? 0,
    missedIngredients: (item.missedIngredients || []).map(ing => ({name: ing.name || '', image: ing.image ? 'https://spoonacular.com/cdn/ingredients_100x100/' + ing.image : ''})),
    likes: item.likes ?? 0, url: 'https://spoonacular.com/recipes/' + slug(item.title || '') + '-' + item.id
  })))
}
