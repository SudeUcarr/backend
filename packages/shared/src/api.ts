import type {DatabaseState, Profile} from './types.ts'

// API contracts contain no Supabase SDK types or authentication tokens.
export interface AppSession {user: {id: string; email?: string}}
export interface SessionResponse {session: AppSession | null}
export interface DataResponse {data: DatabaseState; profile: Profile | null}
export interface HealthResponse {configured: boolean; databaseReady: boolean}
export interface ApiErrorBody {error: {code: string; message: string}}
export interface SyncResponse {sources: {source: string; status: 'success' | 'failed' | 'cooldown'; count?: number; error?: string}[]}
export interface GooglePlace {
  id: string; name: string; address: string; point: {lat: number; lng: number};
  price: number | null; rating: number | null; count: number; url: string;
  attributions: {name: string; url: string | null}[];
}
