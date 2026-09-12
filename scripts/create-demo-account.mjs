import {createExampleData,uuid} from '@kampuskit/shared/seed'
import {createClient} from '@supabase/supabase-js'
import {randomUUID,randomBytes} from 'node:crypto'
import {writeFile,mkdir,readFile} from 'node:fs/promises'
if(!process.argv.includes('--run'))throw new Error('Use --run to create a confirmed demo account with sample data. No email is sent.')
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options)
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data}
{
 const sample=createExampleData()
 let credentials
 try{credentials=JSON.parse(await readFile('.artifacts/demo-account.json','utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
 if(!credentials){
  const email='kampuskit-demo-'+randomBytes(3).toString('hex')+'@example.com',password='Kampus!'+randomBytes(15).toString('base64url')
  const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{demo:true}}))
  credentials={email,password,id:user.id}
  await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/demo-account.json',JSON.stringify(credentials,null,2))
 }
 const user_id=credentials.id
 check(await admin.from('profiles').upsert({id:user_id,display_name:'Deniz · Demo',university_id:uuid(1),department:'Bilgisayar Mühendisliği'}))
 for(const table of ['budget_entries','calendar_items','club_follows']){
  const existing=check(await admin.from(table).select('id').eq('user_id',user_id))
  if(!existing.length)check(await admin.from(table).insert(sample[table].map(r=>({...r,id:randomUUID(),user_id}))))
 }
 const posts=check(await admin.from('posts').select('id').eq('user_id',user_id))
 if(!posts.length)check(await admin.from('posts').insert([{user_id,university_id:uuid(1),course_id:uuid(1002),kind:'question',title:'Demo · Takım projesinde Git akışını nasıl kuralım?',body:'Dört kişilik bir hackathon ekibiyiz. Her özellik için ayrı dal açıp küçük değişiklikler birleştirmeyi deniyoruz. Bu kayıt demo hesabının düzenlenebilir örnek paylaşımıdır.',published:true,is_example:true}]))
 const saved=check(await admin.from('saved_internships').select('id').eq('user_id',user_id))
 if(!saved.length){const jobs=check(await admin.from('internships').select('id').eq('source_kind','import').eq('status','active').limit(3));if(jobs.length)check(await admin.from('saved_internships').insert(jobs.map(j=>({user_id,internship_id:j.id}))))}
 const userClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,options)
 check(await userClient.auth.signInWithPassword({email:credentials.email,password:credentials.password}))
 const counts={}
 for(const table of ['budget_entries','calendar_items','posts','internships','places','clubs','listings'])counts[table]=check(await userClient.from(table).select('id')).length
 check(await userClient.auth.signOut())
 console.log('Demo login and populated account verified. Credentials saved only in ignored .artifacts/demo-account.json. Visible counts:',counts)
}
