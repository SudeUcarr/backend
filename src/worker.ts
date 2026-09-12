import {handleRequest} from './app.ts'
import type {RuntimeEnv} from './config/env.ts'

interface WorkerEnv extends RuntimeEnv {ASSETS?: {fetch: (request: Request) => Promise<Response>}}
export default {
  async fetch(request: Request, env: WorkerEnv) {
    const path = new URL(request.url).pathname
    if (path === '/api' || path.startsWith('/api/')) return handleRequest(request, {...env, NODE_ENV: 'production'})
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', {status: 404})
  }
}
