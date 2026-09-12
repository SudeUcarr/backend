import {createClient} from '@supabase/supabase-js'
import {writeFile,mkdir} from 'node:fs/promises'
import {sources,collectSource} from '../src/integrations/internship-sources.ts'
const persist=process.argv.includes('--persist')
const client=persist?createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}):null
const all=[],status=[]
for(const source of sources){
 const name=source.provider+':'+source.board
 try{
  if(client){const claim=await client.rpc('claim_ingestion',{source_name:name});if(claim.error)throw claim.error;if(!claim.data){status.push({source:name,status:'cooldown'});continue}}
  const now=new Date().toISOString(),jobs=await collectSource(source,fetch,now)
  all.push(...jobs)
  if(client){
   if(jobs.length){const r=await client.from('internships').upsert(jobs,{onConflict:'source_provider,source_key'});if(r.error)throw r.error}
   const closed=await client.from('internships').update({status:'closed'}).eq('source_provider',name).lt('fetched_at',now);if(closed.error)throw closed.error
   const r=await client.from('ingestion_runs').update({status:'success',finished_at:new Date().toISOString(),imported_count:jobs.length,error:null}).eq('source',name);if(r.error)throw r.error
  }
  status.push({source:name,status:'success',count:jobs.length})
 }catch(error){
  status.push({source:name,status:'failed',error:error.message})
  if(client)await client.from('ingestion_runs').update({status:'failed',finished_at:new Date().toISOString(),error:String(error.message).slice(0,300)}).eq('source',name)
 }
}
await mkdir('.artifacts',{recursive:true})
await writeFile('.artifacts/internship-import.json',JSON.stringify({checked_at:new Date().toISOString(),status,jobs:all},null,2))
console.log(JSON.stringify({total:all.length,sources:status},null,2))
if(status.some(s=>s.status==='failed'))process.exitCode=1
