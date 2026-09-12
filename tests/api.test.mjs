import {test} from 'node:test'
import assert from 'node:assert/strict'
import {handleRequest} from '../src/app.ts'

const userId='00000000-0000-4000-8000-000000000101'
const otherId='00000000-0000-4000-8000-000000000102'
const user={id:userId,email:'student@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-09-12T00:00:00Z'}
const jwt=(exp)=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:userId,exp})).toString('base64url'),Buffer.from('signature').toString('base64url')].join('.')
const access=jwt(Math.floor(Date.now()/1000)+3600)
const session={access_token:access,refresh_token:'refresh-secret',token_type:'bearer',expires_in:3600,user}
const env={APP_ORIGIN:'http://127.0.0.1:5173',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'admin-secret'}
const cookie=`kk_access=${access}; kk_refresh=refresh-secret`
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
function request(path,method='GET',body,extra={}) {
  return new Request('http://127.0.0.1:3001/api'+path,{method,headers:{Origin:env.APP_ORIGIN,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
}
function intercept(t,handler) {t.mock.method(globalThis,'fetch',async(input,init)=>handler(new Request(input,init)))}
function authorized(req) {assert.equal(req.headers.get('authorization'),`Bearer ${access}`);assert.equal(req.headers.get('apikey'),'public-key')}

test('unconfigured backend preserves public demo and reports readiness',async()=>{
  const empty={APP_ORIGIN:env.APP_ORIGIN}
  assert.deepEqual(await (await handleRequest(request('/health'),empty)).json(),{configured:false,databaseReady:false})
  assert.deepEqual(await (await handleRequest(request('/public/internships'),empty)).json(),[])
  assert.deepEqual(await (await handleRequest(request('/auth/session'),empty)).json(),{session:null})
})
test('private data, files and source refresh require an authenticated cookie',async()=>{
  for(const [path,method] of [['/data','GET'],['/files/notes?path=x','GET'],['/internships/sync','POST']]) {
    const result=await handleRequest(request(path,method),env)
    assert.equal(result.status,401)
  }
})
test('CSRF and disallowed origins are rejected before contacting Supabase',async t=>{
  intercept(t,()=>{throw new Error('Upstream must not be contacted')})
  assert.equal((await handleRequest(request('/auth/login','POST',{}, {Origin:'https://evil.invalid'}),env)).status,403)
  const noOrigin=new Request('http://127.0.0.1:3001/api/auth/logout',{method:'POST',headers:{Cookie:cookie}})
  assert.equal((await handleRequest(noOrigin,env)).status,403)
  const preflight=await handleRequest(request('/profile','OPTIONS'),env)
  assert.equal(preflight.status,204)
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),env.APP_ORIGIN)
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),'true')
})
test('login keeps tokens in HttpOnly cookies and returns only a public session',async t=>{
  intercept(t,async req=>{
    assert.equal(new URL(req.url).pathname,'/auth/v1/token')
    assert.deepEqual(await req.json(),{email:user.email,password:'  password123  ',gotrue_meta_security:{}})
    return response(session)
  })
  const result=await handleRequest(request('/auth/login','POST',{email:user.email,password:'  password123  '}),env)
  assert.equal(result.status,200)
  assert.deepEqual(await result.json(),{session:{user:{id:userId,email:user.email}}})
  const cookies=result.headers.getSetCookie()
  assert.equal(cookies.length,2)
  for(const value of cookies){assert.match(value,/HttpOnly/);assert.match(value,/SameSite=Lax/);assert.match(value,/Path=\/api/)}
  assert.equal(result.headers.get('cache-control'),'no-store')
})
test('production session cookies require HTTPS and carry Secure',async t=>{
  intercept(t,()=>response(session))
  const production={...env,NODE_ENV:'production',APP_ORIGIN:'https://campus.example.invalid'}
  const req=request('/auth/login','POST',{email:user.email,password:'password123'},{Origin:production.APP_ORIGIN})
  const result=await handleRequest(req,production)
  assert.equal(result.status,200)
  for(const value of result.headers.getSetCookie())assert.match(value,/; Secure/)
  assert.equal((await handleRequest(request('/health'),{...env,NODE_ENV:'production'})).status,503)
})
test('PKCE verifier is kept server-side and recovery callback creates a session',async t=>{
  let verifier,flowId
  intercept(t,async req=>{
    const url=new URL(req.url)
    if(url.pathname==='/auth/v1/recover'){
      const body=await req.json();assert.equal(typeof body.code_challenge,'string');assert.equal(body.code_challenge_method,'s256')
      const redirect=new URL(url.searchParams.get('redirect_to'));assert.equal(redirect.origin,env.APP_ORIGIN);assert.equal(redirect.pathname,'/api/auth/callback');assert.equal(redirect.searchParams.get('flow'),'recovery');flowId=redirect.searchParams.get('sb_flow_id');assert.ok(flowId)
      return response({})
    }
    assert.equal(url.searchParams.get('grant_type'),'pkce')
    const body=await req.json();assert.equal(body.auth_code,'valid-code');assert.equal(body.code_verifier,verifier)
    return response(session)
  })
  const reset=await handleRequest(request('/auth/reset','POST',{email:user.email}),env)
  assert.equal(reset.status,200)
  const verifierCookie=reset.headers.getSetCookie().find(value=>value.startsWith('kk_verifier='))
  assert.ok(verifierCookie)
  verifier=JSON.parse(decodeURIComponent(verifierCookie.split(';')[0].split('=')[1])).split('/')[0]
  const callback=new Request('http://127.0.0.1:3001/api/auth/callback?code=valid-code&flow=recovery&sb_flow_id='+flowId,{headers:{Cookie:reset.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')}})
  const result=await handleRequest(callback,env)
  assert.equal(result.status,303)
  assert.equal(result.headers.get('location'),env.APP_ORIGIN+'/#/sifre-yenile')
  assert.ok(result.headers.getSetCookie().some(value=>value.startsWith('kk_access=')))
})
test('expired access token refreshes on the backend without exposing tokens',async t=>{
  const expired=jwt(1)
  intercept(t,async req=>{
    if(new URL(req.url).pathname==='/auth/v1/user')return response({msg:'JWT expired',code:'bad_jwt'},401)
    assert.equal(new URL(req.url).searchParams.get('grant_type'),'refresh_token')
    assert.equal((await req.json()).refresh_token,'refresh-secret')
    return response({...session,refresh_token:'rotated-refresh'})
  })
  const result=await handleRequest(request('/auth/session','GET',undefined,{Cookie:`kk_access=${expired}; kk_refresh=refresh-secret`}),env)
  assert.equal(result.status,200)
  assert.deepEqual(await result.json(),{session:{user:{id:userId,email:user.email}}})
  assert.ok(result.headers.getSetCookie().some(value=>value.includes('rotated-refresh')))
})
test('aggregated data uses user credentials and limits reminder columns',async t=>{
  let count=0
  intercept(t,req=>{
    authorized(req)
    const url=new URL(req.url)
    if(url.pathname==='/auth/v1/user')return response(user)
    count++
    if(url.pathname==='/rest/v1/reminder_jobs')assert.equal(url.searchParams.get('select'),'id,calendar_id,user_id,state,last_error')
    if(url.pathname==='/rest/v1/profiles'){assert.equal(url.searchParams.get('id'),'eq.'+userId);return response([])}
    return response([])
  })
  const result=await handleRequest(request('/data','GET',undefined,{Cookie:cookie}),env)
  assert.equal(result.status,200)
  const body=await result.json();assert.equal(Object.keys(body.data).length,20);assert.equal(body.profile,null);assert.equal(count,21)
})
test('record writes derive ownership from validated session and keep RLS credentials',async t=>{
  intercept(t,async req=>{
    authorized(req)
    if(new URL(req.url).pathname==='/auth/v1/user')return response(user)
    assert.equal(req.method,'POST')
    assert.equal((await req.json()).user_id,userId)
    return response([{id:otherId}],201)
  })
  const result=await handleRequest(request('/records/budget_entries','POST',{type:'expense',amount_kurus:1250,category:'Yemek',occurred_on:'2026-09-12'},{Cookie:cookie}),env)
  assert.equal(result.status,201)
})
test('protected fields, arbitrary tables and non-integer amounts cannot be written',async t=>{
  intercept(t,req=>{assert.equal(new URL(req.url).pathname,'/auth/v1/user');return response(user)})
  for(const row of [{user_id:otherId},{revision:100},{is_example:true},{amount_kurus:12.5}]) {
    const result=await handleRequest(request('/records/budget_entries','POST',row,{Cookie:cookie}),env)
    assert.equal(result.status,400)
  }
  assert.equal((await handleRequest(request('/records/profiles','POST',{}, {Cookie:cookie}),env)).status,403)
  assert.equal((await handleRequest(request('/records/notifications','POST',{read_at:null},{Cookie:cookie}),env)).status,403)
})
test('updates additionally filter by owner and report invisible records without success',async t=>{
  intercept(t,req=>{
    authorized(req);const url=new URL(req.url)
    if(url.pathname==='/auth/v1/user')return response(user)
    assert.equal(url.searchParams.get('user_id'),'eq.'+userId);assert.equal(url.searchParams.get('id'),'eq.'+otherId)
    return response([])
  })
  assert.equal((await handleRequest(request('/records/budget_entries/'+otherId,'PATCH',{note:'Test'},{Cookie:cookie}),env)).status,404)
})
test('file upload checks size and file signature before Storage writes',async t=>{
  intercept(t,req=>{assert.equal(new URL(req.url).pathname,'/auth/v1/user');return response(user)})
  const fake=new Request('http://127.0.0.1:3001/api/files/notes',{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:cookie,'Content-Type':'application/pdf'},body:'not a PDF'})
  assert.equal((await handleRequest(fake,env)).status,400)
  const oversized=new Request('http://127.0.0.1:3001/api/files/listing-images',{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:cookie,'Content-Type':'image/png','Content-Length':String(5*1024*1024+1)},body:'small'})
  assert.equal((await handleRequest(oversized,env)).status,413)
})
test('private file download passes the user JWT to Storage',async t=>{
  const path=userId+'/'+otherId+'.pdf'
  intercept(t,req=>{
    authorized(req)
    if(new URL(req.url).pathname==='/auth/v1/user')return response(user)
    assert.ok(req.url.endsWith('/storage/v1/object/notes/'+path))
    return new Response('%PDF-1.7 test',{headers:{'Content-Type':'application/pdf'}})
  })
  const result=await handleRequest(request('/files/notes?path='+encodeURIComponent(path),'GET',undefined,{Cookie:cookie}),env)
  assert.equal(result.status,200);assert.match(await result.text(),/^%PDF/)
  assert.equal(result.headers.get('content-disposition'),'attachment')
})
test('Google nearby searches use the server key and preserve unknown prices',async t=>{
  intercept(t,async req=>{
    assert.equal(req.url,'https://places.googleapis.com/v1/places:searchNearby')
    assert.equal(req.headers.get('x-goog-api-key'),'places-secret')
    const body=await req.json();assert.equal(body.maxResultCount,20);assert.equal(body.locationRestriction.circle.radius,3000)
    return response({places:[{id:'p',displayName:{text:'Kafe'},location:{latitude:41,longitude:29},rating:4.5}]})
  })
  const result=await handleRequest(request('/places/nearby','POST',{lat:41,lng:29,radius:3000,category:'cafe'}),{...env,GOOGLE_PLACES_API_KEY:'places-secret'})
  assert.equal(result.status,200);assert.equal((await result.json())[0].price,null)
})
test('password update operates on the authenticated server session',async t=>{
  let updated=false
  intercept(t,async req=>{
    assert.equal(new URL(req.url).pathname,'/auth/v1/user')
    authorized(req)
    if(req.method==='PUT'){assert.equal((await req.json()).password,'new-password123');updated=true}
    return response(user)
  })
  const result=await handleRequest(request('/auth/password','POST',{password:'new-password123'},{Cookie:cookie}),env)
  assert.equal(result.status,200);assert.ok(updated)
  assert.deepEqual(await result.json(),{session:{user:{id:userId,email:user.email}}})
})
test('logout revokes the current Supabase session and clears HttpOnly cookies',async t=>{
  let revoked=false
  intercept(t,req=>{
    authorized(req);const url=new URL(req.url)
    if(url.pathname==='/auth/v1/user')return response(user)
    assert.equal(url.pathname,'/auth/v1/logout');assert.equal(url.searchParams.get('scope'),'local');revoked=true
    return response({})
  })
  const result=await handleRequest(request('/auth/logout','POST',undefined,{Cookie:cookie}),env)
  assert.equal(result.status,200);assert.ok(revoked);assert.deepEqual(await result.json(),{session:null})
  for(const value of result.headers.getSetCookie())assert.match(value,/Max-Age=0/)
})
test('valid PDF upload generates a user-owned path and uses RLS credentials',async t=>{
  intercept(t,req=>{
    authorized(req)
    const url=new URL(req.url)
    if(url.pathname==='/auth/v1/user')return response(user)
    assert.ok(url.pathname.startsWith('/storage/v1/object/notes/'+userId+'/'))
    assert.equal(req.method,'POST')
    return response({Id:otherId,Key:url.pathname.replace('/storage/v1/object/','')})
  })
  const file=new Request('http://127.0.0.1:3001/api/files/notes',{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:cookie,'Content-Type':'application/pdf'},body:'%PDF-1.7 test'})
  const result=await handleRequest(file,env)
  assert.equal(result.status,201)
  assert.match((await result.json()).path,new RegExp('^'+userId+'/[0-9a-f-]{36}\\.pdf$'))
})
