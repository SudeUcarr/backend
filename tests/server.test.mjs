import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import worker from '../src/worker.ts'

test('Node HTTP adapter preserves request bodies, RLS identity and separate session cookies',async t=>{
  const user={id:'00000000-0000-4000-8000-000000000101',email:'student@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}}
  const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),Buffer.from('signature').toString('base64url')].join('.')
  const upstream=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json')
    if(req.url==='/rest/v1/rpc/app_status'){res.end(JSON.stringify('kampuskit-20260912'));return}
    if(req.url?.startsWith('/auth/v1/token')){
      let raw='';for await(const chunk of req)raw+=chunk
      const body=JSON.parse(raw)
      if(body.email!==user.email||body.password!=='password123'){res.statusCode=400;res.end('{}');return}
      res.end(JSON.stringify({access_token:token,refresh_token:'refresh-secret',token_type:'bearer',expires_in:3600,user}));return
    }
    if(req.url==='/auth/v1/user'&&req.headers.authorization==='Bearer '+token){res.end(JSON.stringify(user));return}
    res.statusCode=401;res.end(JSON.stringify({msg:'Unauthorized'}))
  })
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise(resolve=>{upstream.closeAllConnections();upstream.close(resolve)}))
  const origin='http://127.0.0.1:5173'
  const child=spawn(process.execPath,['--experimental-strip-types',fileURLToPath(new URL('../src/server.ts',import.meta.url))],{
    env:{...process.env,PORT:'0',HOST:'127.0.0.1',APP_ORIGIN:origin,NODE_ENV:'development',SUPABASE_URL:'http://127.0.0.1:'+upstream.address().port,SUPABASE_PUBLISHABLE_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe']
  })
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}})
  const address=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Backend startup timed out')),10000)
    let output=''
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/KampüsKit API: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1])}})
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Backend exited: '+code))})
  })
  const health=await fetch(address+'/api/health')
  assert.equal(health.status,200);assert.deepEqual(await health.json(),{configured:true,databaseReady:true})
  const login=await fetch(address+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'password123'})})
  assert.equal(login.status,200)
  const cookies=login.headers.getSetCookie();assert.equal(cookies.length,2)
  const result=await fetch(address+'/api/auth/session',{headers:{Cookie:cookies.map(cookie=>cookie.split(';')[0]).join('; ')}})
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{session:{user:{id:user.id,email:user.email}}})
  assert.equal((await fetch(address+'/api/data')).status,401)
  assert.equal((await fetch(address+'/')).status,404)
  assert.equal((await fetch(address+'/legal/occupancy-data-license.txt')).status,404)
})
test('Worker adapter routes API requests and static assets independently',async()=>{
  let called=false
  const env={APP_ORIGIN:'https://campus.example.invalid',ASSETS:{fetch:()=>{called=true;return new Response('asset')}}}
  const health=await worker.fetch(new Request(env.APP_ORIGIN+'/api/health'),env)
  assert.equal(health.status,200);assert.equal(called,false)
  assert.equal(await (await worker.fetch(new Request(env.APP_ORIGIN+'/'),env)).text(),'asset');assert.equal(called,true)
  assert.equal((await worker.fetch(new Request(env.APP_ORIGIN+'/'),{APP_ORIGIN:env.APP_ORIGIN})).status,404)
})
