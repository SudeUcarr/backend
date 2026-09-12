import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('Supabase schema, ownership, private files and reminder lifecycle', async t => {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant all on all tables in schema storage,auth to service_role;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202609120001_core.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202609120002_discovery.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202609120003_campus_discovery.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202609120004_discovery_sources.sql',import.meta.url),'utf8'))
  await db.exec(`
    insert into public.universities values('${id(1)}','Test Üniversitesi A','A','İstanbul'),('${id(2)}','Test Üniversitesi B','B','İstanbul');
    insert into public.campuses values('${id(3)}','${id(1)}','Merkez');
    insert into public.courses values('${id(4)}','${id(1)}','Programlama','BLG101');
    insert into public.crowd_locations values('${id(5)}','${id(1)}','${id(3)}','Kütüphane','library');
    insert into auth.users values('${id(101)}','test-a@example.invalid',now()),('${id(102)}','test-b@example.invalid',now()),('${id(103)}','test-c@example.invalid',now());
  `)
  async function asUser(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',false)`)}
  for(const n of [101,102,103]){
    await asUser(n)
    await db.exec(`insert into public.profiles(id,display_name,university_id,department) values('${id(n)}','Öğrenci ${n}','${id(n===103?2:1)}','Bilgisayar')`)
  }
  await t.test('private budgets are isolated across three accounts', async()=>{
    await asUser(101)
    await db.exec(`insert into public.budget_entries(user_id,type,amount_kurus,category,note,occurred_on) values('${id(101)}','expense',12345,'Yemek','Öğle yemeği',current_date)`)
    assert.equal((await db.query('select * from public.budget_entries')).rows.length,1)
    for(const n of [102,103]){await asUser(n);assert.equal((await db.query('select * from public.budget_entries')).rows.length,0)}
    await assert.rejects(()=>db.exec(`insert into public.budget_entries(user_id,type,amount_kurus,category,occurred_on) values('${id(101)}','expense',100,'Yemek',current_date)`))
    await db.exec('reset role;set role anon')
    await assert.rejects(()=>db.exec('select * from public.budget_entries'))
  })
  await t.test('shared posts are readable, editing and file uploads require ownership',async()=>{
    await asUser(101)
    await assert.rejects(()=>db.exec(`insert into public.posts(user_id,university_id,course_id,kind,title,body,attachment_path) values('${id(101)}','${id(1)}','${id(4)}','note','Ders notu','Notlar','${id(102)}/secret.pdf')`))
    await db.exec(`insert into storage.objects(bucket_id,name) values('notes','${id(101)}/notes.pdf'),('notes','${id(101)}/private.pdf')`)
    await db.exec(`insert into public.posts(id,user_id,university_id,course_id,kind,title,body,attachment_path) values('${id(201)}','${id(101)}','${id(1)}','${id(4)}','note','Ders notu','Notlar','${id(101)}/notes.pdf')`)
    await asUser(103)
    assert.equal((await db.query('select * from public.posts')).rows.length,1)
    assert.equal((await db.query('select * from storage.objects')).rows.length,1)
    assert.equal((await db.query(`update public.posts set title='Başkasının değişikliği' where id='${id(201)}' returning id`)).rows.length,0)
    await assert.rejects(()=>db.exec(`insert into storage.objects(bucket_id,name) values('notes','${id(101)}/bad.pdf')`))
    await assert.rejects(()=>db.exec(`insert into public.posts(user_id,university_id,course_id,kind,title,body,is_example) values('${id(103)}','${id(1)}','${id(4)}','note','Sahte örnek','Notlar',true)`))
  })
  await t.test('calendar revisions cancel old jobs and prevent repeat claims',async()=>{
    await asUser(101)
    const {rows:[calendar]}=await db.query(`insert into public.calendar_items(user_id,title,kind,due_at,reminder_minutes,email_enabled) values('${id(101)}','Proje teslimi','deadline',now()+interval '4 minutes',5,true) returning id,revision`)
    assert.equal(calendar.revision,1)
    await assert.rejects(()=>db.exec(`update public.calendar_items set revision=900 where id='${calendar.id}'`))
    await assert.rejects(()=>db.exec('select payload from public.reminder_jobs'))
    assert.equal((await db.query('select id,state from public.reminder_jobs')).rows[0].state,'pending')
    await asUser(102)
    assert.equal((await db.query('select * from public.calendar_items')).rows.length,0)
    await db.exec('reset role;set role service_role')
    const jobs=(await db.query('select * from public.claim_reminders(25)')).rows
    assert.equal(jobs.length,1)
    assert.equal((await db.query('select * from public.claim_reminders(25)')).rows.length,0)
    const payload=(await db.query(`select public.prepare_reminder('${jobs[0].id}','KampüsKit <test@example.invalid>','https://example.invalid') as payload`)).rows[0].payload
    assert.equal(payload.to,'test-a@example.invalid')
    const again=(await db.query(`select public.prepare_reminder('${jobs[0].id}','Different <other@example.invalid>','https://different.invalid') as payload`)).rows[0].payload
    assert.deepEqual(again,payload)
    await asUser(101)
    await db.exec(`update public.calendar_items set due_at=now()+interval '3 minutes' where id='${calendar.id}'`)
    assert.deepEqual((await db.query('select state from public.reminder_jobs order by state')).rows.map(r=>r.state),['cancelled','pending'])
    await db.exec(`update public.calendar_items set completed=true where id='${calendar.id}'`)
    assert.ok((await db.query('select state from public.reminder_jobs')).rows.every(r=>r.state==='cancelled'))
    assert.equal((await db.query('select * from public.notifications')).rows.length,0)
  })
  await t.test('a new crowd report refreshes its server timestamp',async()=>{
    await asUser(101)
    await db.exec(`insert into public.crowd_reports(id,user_id,location_id,level) values('${id(301)}','${id(101)}','${id(5)}',1)`)
    await db.exec(`reset role;update public.crowd_reports set created_at=now()-interval '2 hours' where id='${id(301)}'`)
    await asUser(101)
    await db.exec(`update public.crowd_reports set level=3 where id='${id(301)}'`)
    assert.equal((await db.query(`select created_at>now()-interval '1 minute' as fresh from public.crowd_reports where id='${id(301)}'`)).rows[0].fresh,true)
  })
  await t.test('student internships and places enforce ownership and protected source fields',async()=>{
    await asUser(101)
    const job=(await db.query(`insert into public.internships(user_id,university_id,title,company,field,location,work_mode,description,source_url) values('${id(101)}','${id(1)}','Yazılım stajyeri','Test şirketi','Yazılım','İstanbul','Hibrit','Test ilanı','https://example.invalid/job') returning id`)).rows[0]
    await assert.rejects(()=>db.exec(`update public.internships set source_kind='import' where id='${job.id}'`))
    await asUser(102)
    assert.equal((await db.query(`select id from public.internships where id='${job.id}'`)).rows.length,1)
    assert.equal((await db.query(`update public.internships set status='closed' where id='${job.id}' returning id`)).rows.length,0)
    await db.exec(`insert into public.places(user_id,university_id,name,category,price_level,district,description,address) values('${id(102)}','${id(1)}','Öğrenci önerisi','Kafe',1,'Merkez','Deneyim','Test adresi')`)
    await assert.rejects(()=>db.exec(`insert into public.places(user_id,university_id,name,category,price_level,district,description,is_example) values('${id(102)}','${id(1)}','Öneri','Kafe',1,'Merkez','Test',true)`))
    await assert.rejects(()=>db.exec(`select public.claim_ingestion('lever:lalamove')`))
    await db.exec('reset role;set role service_role')
    assert.equal((await db.query(`select public.claim_ingestion('lever:lalamove') as ok`)).rows[0].ok,true)
    assert.equal((await db.query(`select public.claim_ingestion('lever:lalamove') as ok`)).rows[0].ok,false)
    assert.equal((await db.query(`select public.claim_ingestion('linkedin:turkey') as ok`)).rows[0].ok,true)
    await assert.rejects(()=>db.exec(`select public.claim_ingestion('arbitrary-url')`))
  })
  await db.close()
})
