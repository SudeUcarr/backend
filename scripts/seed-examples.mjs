import {createExampleData} from '@kampuskit/shared/seed'
import {createClient} from '@supabase/supabase-js'
if(!process.argv.includes('--run'))throw new Error('Use --run to insert labeled shared examples into the configured project.')
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
{
 const data=createExampleData()
 for(const table of ['universities','campuses','courses','members','internships','posts','replies','listings','places','reviews','clubs','club_events','crowd_locations']){
  const rows=table==='internships'?data[table].map(r=>({...r,source_kind:'example',source_name:'Örnek ilan'})):data[table]
  const {error}=await client.from(table).upsert(rows,{onConflict:'id'})
  if(error)throw new Error(table+': '+error.message)
  console.log(`${table}: ${rows.length}`)
 }
 console.log('Shared examples installed. No private budgets, calendars, or simulated live crowd reports were inserted.')
}
