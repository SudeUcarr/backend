import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createClient } from '@supabase/supabase-js'
import { processReminders } from '../src/modules/reminders/service.ts'

const isLive = process.argv.includes('--live')

if (isLive) {
  // Live mode: runs against real Supabase
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey) {
    console.error('Hata: Canlı mod için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY değişkenleri gereklidir.')
    process.exit(1)
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  console.log('--- CANLI SUPABASE HATIRLATMA İŞÇİSİ ---')
  console.log('Kuyruktaki bekleyen hatırlatmalar kontrol ediliyor...')
  const result = await processReminders(client, {
    resendApiKey: resendKey,
    appUrl: process.env.APP_ORIGIN || 'http://127.0.0.1:5173',
    simulate: !resendKey
  })
  console.log(`Tamamlandı: ${result.processed} iş işlendi, ${result.sent} e-posta iletildi.`)
  if (result.details.length) {
    console.table(result.details)
  }
} else {
  // Demo mode: in-memory PGlite with full database triggers and lifecycle
  console.log('\n======================================================')
  console.log('   KAMPÜSKİT TAKVİM E-POSTA HATIRLATMA DEMOSU')
  console.log('======================================================\n')

  console.log('[1/5] Bellek içi PostgreSQL veritabanı hazırlanıyor...')
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id, name));
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on all tables in schema storage, auth to service_role;
  `)

  // Apply all migrations in order
  const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = await readFile('supabase/migrations/' + file, 'utf8')
    await db.exec(sql)
  }

  // Create demo student
  const studentId = '00000000-0000-4000-8000-000000000101'
  const studentEmail = 'ahmet.yilmaz@itu.edu.tr'
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at)
    values ('${studentId}', '${studentEmail}', now());
  `)
  console.log(`[2/5] Örnek öğrenci hazırlandı: ${studentEmail}`)

  // Set role as student and insert a calendar item
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${studentId}', false);`)
  const eventTitle = 'Yazılım Mühendisliği Final Projesi Teslimi'
  const dueMinutes = 4 // due in 4 minutes, reminder set to 5 minutes before -> due right now!
  const insertQuery = `
    insert into public.calendar_items (user_id, title, kind, due_at, reminder_minutes, email_enabled)
    values (
      '${studentId}',
      '${eventTitle}',
      'deadline',
      now() + interval '${dueMinutes} minutes',
      5,
      true
    )
    returning id, title, kind, due_at, reminder_minutes, email_enabled, revision;
  `
  const { rows: [calendarItem] } = await db.query(insertQuery)
  console.log(`[3/5] Takvime etkinlik eklendi (E-posta hatırlatması AÇIK):`)
  console.log(`      Başlık: "${calendarItem.title}"`)
  console.log(`      Teslim: ${new Date(calendarItem.due_at).toLocaleTimeString('tr-TR')} (4 dakika sonra)`)
  console.log(`      Hatırlatma: Etkinlikten 5 dakika önce`)

  // Verify the trigger automatically created a reminder job
  await db.exec('reset role; set role service_role;')
  const { rows: jobs } = await db.query('select id, state, scheduled_at from public.reminder_jobs;')
  console.log(`\n[4/5] Otomatik Veritabanı Trigger Durumu (sync_reminder):`)
  console.log(`      İş Kimliği (Job ID): ${jobs[0].id}`)
  console.log(`      Kuyruk Durumu: ${jobs[0].state.toUpperCase()} (beklemede)`)
  console.log(`      Planlanan Çalışma: ${new Date(jobs[0].scheduled_at).toLocaleTimeString('tr-TR')}`)

  // Claim reminders and prepare payload
  console.log(`\n[5/5] Hatırlatma İşçisi (Worker) Çalıştırılıyor...`)
  const claimedJobs = (await db.query('select * from public.claim_reminders(25);')).rows
  console.log(`      -> ${claimedJobs.length} adet vadesi gelen iş kilitlendi (state = 'processing').`)

  const sender = 'KampüsKit Hatırlatma <hatirlatma@kampuskit.com>'
  const appUrl = 'https://kampuskit.com'
  const { rows: [prep] } = await db.query(`select public.prepare_reminder('${claimedJobs[0].id}', '${sender}', '${appUrl}') as payload;`)
  const emailPayload = prep.payload

  console.log('\n------------------ ÜRETİLEN E-POSTA ------------------')
  console.log(`Kimden : ${emailPayload.from}`)
  console.log(`Kime   : ${emailPayload.to}`)
  console.log(`Konu   : ${emailPayload.subject}`)
  console.log(`Gövde  :`)
  console.log(emailPayload.text.split('\n').map(l => '  | ' + l).join('\n'))
  console.log('------------------------------------------------------\n')

  // Mark job as sent
  await db.exec(`update public.reminder_jobs set state='sent', sent_at=now() where id='${claimedJobs[0].id}';`)
  const { rows: [sentJob] } = await db.query(`select id, state, sent_at from public.reminder_jobs where id='${claimedJobs[0].id}';`)

  console.log(`Sonuç: E-posta başarıyla iletildi!`)
  console.log(`       İş Durumu: ${sentJob.state.toUpperCase()} (gönderildi) - ${new Date(sentJob.sent_at).toLocaleTimeString('tr-TR')}`)
  console.log('\nÖzet: Takvime eklenen etkinlik, trigger ile sıraya alındı ve işçi tarafından e-postaya dönüştürülüp gönderildi!\n')

  await db.close()
}
