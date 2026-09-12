import {createServer} from 'node:http'
import {Readable} from 'node:stream'
import {handleRequest} from './app.ts'

const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'), port = Number(process.env.PORT || 3001)
const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers()
    for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    const init: RequestInit & {duplex?: 'half'} = {method: incoming.method, headers}
    if (!['GET', 'HEAD'].includes(incoming.method || 'GET')) {init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = 'half'}
    const request = new Request(`http://${host}:${port}${incoming.url || '/'}`, init)
    const path = new URL(request.url).pathname
    const response = path === '/api' || path.startsWith('/api/') ? await handleRequest(request, process.env) : new Response('Not found', {status: 404})
    outgoing.statusCode = response.status
    response.headers.forEach((value, key) => {if (key !== 'set-cookie') outgoing.setHeader(key, value)})
    const cookies = response.headers.getSetCookie(); if (cookies.length) outgoing.setHeader('Set-Cookie', cookies)
    if (request.method === 'HEAD' || !response.body) outgoing.end()
    else {
      const stream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
      stream.on('error', () => outgoing.destroy())
      outgoing.on('close', () => stream.destroy())
      stream.pipe(outgoing)
    }
  } catch {outgoing.statusCode = 500; outgoing.end('Request could not be completed.')}
})
server.requestTimeout = 120000
server.listen(port, host, () => {
  const address = server.address()
  console.log(`KampüsKit API: http://${host}:${typeof address === 'object' && address ? address.port : port}`)
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)))

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const {createClient} = await import('@supabase/supabase-js')
  const {processReminders} = await import('./modules/reminders/service.ts')
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false}
  })
  const interval = setInterval(async () => {
    try {
      await processReminders(admin, {
        resendApiKey: process.env.RESEND_API_KEY,
        appUrl: process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
        simulate: !process.env.RESEND_API_KEY
      })
    } catch {
      // Ignore background processing errors to preserve server uptime.
    }
  }, 60000)
  interval.unref?.()
}
