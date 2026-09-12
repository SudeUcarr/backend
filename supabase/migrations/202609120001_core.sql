-- KampüsKit schema. Run once as project owner (SQL Editor or Supabase CLI).
begin;
create table public.universities(id uuid primary key default gen_random_uuid(),name text not null,short_name text not null,city text not null);
create table public.campuses(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),name text not null,unique(id,university_id));
create table public.courses(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),name text not null,code text not null,unique(id,university_id));
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null check(length(trim(display_name)) between 1 and 60),university_id uuid not null references public.universities(id),department text not null check(length(trim(department)) between 1 and 100));
-- Intentionally minimal public identity; sample authors do not have login accounts.
create table public.members(id uuid primary key,display_name text not null);
create function public.sync_member() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.members(id,display_name) values(new.id,new.display_name) on conflict(id) do update set display_name=excluded.display_name;return new;end $$;
create trigger profile_member after insert or update of display_name on public.profiles for each row execute function public.sync_member();
create table public.internships(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),title text not null,company text not null,field text not null,location text not null,work_mode text not null,description text not null,source_url text check(source_url is null or source_url ~ '^https?://'),deadline timestamptz not null,is_example boolean not null default false);
create table public.posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.members(id),created_at timestamptz not null default now(),university_id uuid not null references public.universities(id),course_id uuid not null,kind text not null check(kind in('note','question')),title text not null check(length(trim(title)) between 3 and 150),body text not null check(length(trim(body)) between 1 and 10000),link_url text check(link_url is null or link_url ~ '^https?://'),attachment_path text,published boolean not null default true,is_example boolean not null default false,foreign key(course_id,university_id) references public.courses(id,university_id));
create table public.replies(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.members(id),created_at timestamptz not null default now(),post_id uuid not null references public.posts(id) on delete cascade,body text not null check(length(trim(body)) between 1 and 5000));
create table public.listings(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.members(id),created_at timestamptz not null default now(),university_id uuid not null references public.universities(id),kind text not null check(kind in('market','housing','roommate')),title text not null check(length(trim(title)) between 3 and 150),description text not null check(length(trim(description)) between 1 and 5000),category text not null,price_kurus bigint not null check(price_kurus between 1 and 10000000000),deposit_kurus bigint not null default 0 check(deposit_kurus between 0 and 10000000000),district text not null check(length(trim(district)) between 1 and 100),available_from date,lifestyle text not null default '' check(length(lifestyle)<=300),contact text not null default '' check(length(contact)<=200),image_path text,status text not null default 'active' check(status in('active','closed')),is_example boolean not null default false,check(kind='market' or available_from is not null));
create table public.budget_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),type text not null check(type in('income','expense')),amount_kurus bigint not null check(amount_kurus between 1 and 10000000000),category text not null,note text not null default '' check(length(note)<=200),occurred_on date not null,check((type='income' and category in('Aylık destek','Burs','Maaş','Diğer')) or (type='expense' and category in('Yemek','Barınma','Ulaşım','Ders','Sosyal','Diğer'))));
create table public.places(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),name text not null,category text not null,price_level int not null check(price_level between 1 and 3),district text not null,description text not null,symbol text not null default 'coffee',is_example boolean not null default false);
create table public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.members(id),created_at timestamptz not null default now(),place_id uuid not null references public.places(id),rating int not null check(rating between 1 and 5),body text not null check(length(trim(body)) between 1 and 2000),unique(user_id,place_id));
create table public.clubs(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),name text not null,category text not null,description text not null,initials text not null,color text not null,is_example boolean not null default false);
create table public.club_events(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),title text not null,starts_at timestamptz not null,location text not null,description text not null,is_example boolean not null default false);
create table public.calendar_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),title text not null check(length(trim(title)) between 3 and 150),kind text not null check(kind in('exam','deadline','event')),due_at timestamptz not null,reminder_minutes int not null default 1440 check(reminder_minutes in(5,60,1440)),email_enabled boolean not null default false,completed boolean not null default false,club_event_id uuid references public.club_events(id),revision int not null default 1,unique(user_id,club_event_id));
create table public.crowd_locations(id uuid primary key default gen_random_uuid(),university_id uuid not null references public.universities(id),campus_id uuid not null,name text not null,kind text not null check(kind in('library','dining')),foreign key(campus_id,university_id) references public.campuses(id,university_id));
create table public.crowd_reports(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.members(id),created_at timestamptz not null default now(),location_id uuid not null references public.crowd_locations(id),level int not null check(level between 1 and 3),is_example boolean not null default false,unique(user_id,location_id));
create table public.club_follows(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,club_id uuid not null references public.clubs(id),unique(user_id,club_id));
create table public.saved_internships(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,internship_id uuid not null references public.internships(id),unique(user_id,internship_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),calendar_id uuid references public.calendar_items(id) on delete cascade,revision int not null,title text not null,body text not null,read_at timestamptz,unique(calendar_id,revision));
create table public.reminder_jobs(id uuid primary key default gen_random_uuid(),calendar_id uuid references public.calendar_items(id) on delete set null,calendar_key uuid not null,user_id uuid not null references auth.users(id) on delete cascade,revision int not null,scheduled_at timestamptz not null,state text not null default 'pending' check(state in('pending','processing','retry','sent','failed','cancelled')),attempts int not null default 0,next_attempt_at timestamptz,lease_until timestamptz,first_attempt_at timestamptz,payload jsonb,provider_message_id text,sent_at timestamptz,last_error text,unique(calendar_key,revision));

create index posts_university on public.posts(university_id,created_at desc);
create index listings_university on public.listings(university_id,kind,status);
create index budgets_owner on public.budget_entries(user_id,occurred_on);
create index calendar_owner on public.calendar_items(user_id,due_at);
create index crowd_recent on public.crowd_reports(location_id,created_at desc);
create index reminders_due on public.reminder_jobs(state,scheduled_at,next_attempt_at);

-- Enforce immutable authorship, honest example labels, and server timestamps.
create function public.guard_owned_record() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in('authenticated','anon') then
  if new.user_id is distinct from auth.uid() then raise exception 'Record ownership mismatch' using errcode='42501';end if;
  if tg_op='UPDATE' and new.user_id is distinct from old.user_id then raise exception 'Owner is immutable';end if;
  if to_jsonb(new) ? 'is_example' and (to_jsonb(new)->>'is_example')::boolean then raise exception 'Example data is read only' using errcode='42501';end if;
  if to_jsonb(new) ? 'created_at' then
   if tg_op='INSERT' or tg_table_name='crowd_reports' then new.created_at=now();else new.created_at=old.created_at;end if;
  end if;
 end if;
 return new;
end $$;
do $$ declare t text;begin
 foreach t in array array['posts','replies','listings','budget_entries','reviews','calendar_items','crowd_reports','club_follows','saved_internships'] loop
 execute format('create trigger guard_owned before insert or update on public.%I for each row execute function public.guard_owned_record()',t);
 end loop;
end $$;

-- All product data requires a session. Catalogs are managed by project administrators.
do $$ declare t text;begin
 foreach t in array array['universities','campuses','courses','members','internships','places','clubs','club_events','crowd_locations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy member_read on public.%I for select to authenticated using(true)',t);
 end loop;
 foreach t in array array['profiles','budget_entries','calendar_items','club_follows','saved_internships'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy own_rows on public.%I for all to authenticated using(%I=(select auth.uid())) with check(%I=(select auth.uid()))',t,case when t='profiles' then 'id' else 'user_id' end,case when t='profiles' then 'id' else 'user_id' end);
 end loop;
 foreach t in array array['posts','replies','listings','reviews','crowd_reports'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end $$;
create policy shared_posts on public.posts for select to authenticated using(published or user_id=(select auth.uid()));
create policy shared_replies on public.replies for select to authenticated using(exists(select 1 from public.posts p where p.id=post_id and (p.published or p.user_id=(select auth.uid()))));
create policy reply_visible_parent on public.replies as restrictive for insert to authenticated with check(exists(select 1 from public.posts p where p.id=post_id and p.published));
create policy reply_visible_parent_update on public.replies as restrictive for update to authenticated using(true) with check(exists(select 1 from public.posts p where p.id=post_id and p.published));
create policy shared_listings on public.listings for select to authenticated using(status='active' or user_id=(select auth.uid()));
create policy shared_reviews on public.reviews for select to authenticated using(true);
create policy shared_crowd on public.crowd_reports for select to authenticated using(true);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy own_notifications on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy read_notifications on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.reminder_jobs enable row level security;
revoke all on public.reminder_jobs from anon,authenticated;
grant select(id,calendar_id,user_id,state,last_error) on public.reminder_jobs to authenticated;
grant all on public.reminder_jobs to service_role;
create policy own_job_status on public.reminder_jobs for select to authenticated using(user_id=(select auth.uid()));
revoke update on public.calendar_items from authenticated;
grant update(title,kind,due_at,reminder_minutes,email_enabled,completed,club_event_id) on public.calendar_items to authenticated;
-- The client may insert data fields only, never a chosen revision.
revoke insert on public.calendar_items from authenticated;
grant insert(user_id,title,kind,due_at,reminder_minutes,email_enabled,completed,club_event_id) on public.calendar_items to authenticated;

-- Private buckets and session-authenticated downloads (not public or bearer links).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('notes','notes',false,10485760,array['application/pdf']),
 ('listing-images','listing-images',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.owns_upload(bucket text,object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select object_path is null or (split_part(object_path,'/',1)=(select auth.uid())::text and exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=object_path))
$$;
create policy own_upload_insert on storage.objects for insert to authenticated with check(bucket_id in('notes','listing-images') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_upload_delete on storage.objects for delete to authenticated using(bucket_id in('notes','listing-images') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_note_read on storage.objects for select to authenticated using(bucket_id='notes' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.posts p where p.attachment_path=name and p.published)));
create policy private_listing_image_read on storage.objects for select to authenticated using(bucket_id='listing-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.listings l where l.image_path=name and l.status='active')));
create policy note_attachment_insert on public.posts as restrictive for insert to authenticated with check(public.owns_upload('notes',attachment_path));
create policy note_attachment_update on public.posts as restrictive for update to authenticated using(true) with check(public.owns_upload('notes',attachment_path));
create policy listing_image_insert on public.listings as restrictive for insert to authenticated with check(public.owns_upload('listing-images',image_path));
create policy listing_image_update on public.listings as restrictive for update to authenticated using(true) with check(public.owns_upload('listing-images',image_path));

create function public.calendar_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.revision=1;
 elsif row(new.title,new.kind,new.due_at,new.reminder_minutes,new.email_enabled,new.completed) is distinct from row(old.title,old.kind,old.due_at,old.reminder_minutes,old.email_enabled,old.completed) then new.revision=old.revision+1;
 else new.revision=old.revision;end if;
 return new;
end $$;
create trigger calendar_version before insert or update on public.calendar_items for each row execute function public.calendar_revision();
create function public.sync_reminder() returns trigger language plpgsql security definer set search_path='' as $$
declare k uuid;begin
 k=case when tg_op='DELETE' then old.id else new.id end;
 if tg_op='UPDATE' and new.revision=old.revision then return new;end if;
 update public.reminder_jobs set state='cancelled',lease_until=null where calendar_key=k and state in('pending','retry','processing');
 delete from public.notifications where calendar_id=k;
 if tg_op='DELETE' then return old;end if;
 if not new.completed and new.email_enabled and new.due_at>now() then
 insert into public.reminder_jobs(calendar_id,calendar_key,user_id,revision,scheduled_at)
 values(new.id,new.id,new.user_id,new.revision,new.due_at-make_interval(mins=>new.reminder_minutes)) on conflict(calendar_key,revision) do nothing;
 end if;
 return new;
end $$;
create trigger calendar_queue after insert or update or delete on public.calendar_items for each row execute function public.sync_reminder();

-- Called ONLY by the trusted worker. Database leases protect concurrent runners.
create function public.claim_reminders(batch_size int default 25) returns setof public.reminder_jobs language plpgsql security definer set search_path='' as $$
begin
 update public.reminder_jobs j set state='cancelled',lease_until=null where j.state in('pending','retry','processing') and not exists(select 1 from public.calendar_items c where c.id=j.calendar_id and c.revision=j.revision and c.email_enabled and not c.completed and c.due_at>now());
 update public.reminder_jobs set state='failed',last_error='Retry window expired',lease_until=null where state in('retry','processing') and (attempts>=5 or first_attempt_at<now()-interval '23 hours');
 insert into public.notifications(user_id,calendar_id,revision,title,body)
 select c.user_id,c.id,c.revision,c.title,to_char(c.due_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI') || ' · Yaklaşıyor'
 from public.calendar_items c where not c.completed and c.due_at>now() and c.due_at-make_interval(mins=>c.reminder_minutes)<=now()
 on conflict(calendar_id,revision) do nothing;
 return query
 with candidate as(select j.id from public.reminder_jobs j where j.scheduled_at<=now()
 and ((j.state in('pending','retry') and coalesce(j.next_attempt_at,j.scheduled_at)<=now()) or (j.state='processing' and j.lease_until<now()))
 and j.attempts<5 order by j.scheduled_at for update skip locked limit greatest(1,least(batch_size,50)))
 update public.reminder_jobs j set state='processing',attempts=j.attempts+1,lease_until=now()+interval '5 minutes',first_attempt_at=coalesce(j.first_attempt_at,now())
 from candidate where j.id=candidate.id returning j.*;
end $$;
create function public.prepare_reminder(job_id uuid,sender text,app_url text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.reminder_jobs;c public.calendar_items;recipient text;result jsonb;begin
 select * into j from public.reminder_jobs where id=job_id for update;
 if not found or j.state<>'processing' then return null;end if;
 select * into c from public.calendar_items where id=j.calendar_id and revision=j.revision and email_enabled and not completed and due_at>now() for share;
 if not found then update public.reminder_jobs set state='cancelled',lease_until=null where id=job_id;return null;end if;
 select email into recipient from auth.users where id=j.user_id and email_confirmed_at is not null;
 if recipient is null then update public.reminder_jobs set state='failed',last_error='No confirmed email address',lease_until=null where id=job_id;return null;end if;
 if j.payload is not null then return j.payload;end if;
 result=jsonb_build_object('from',sender,'to',recipient,'subject','KampüsKit · '||c.title,'text',c.title||E'\n'||to_char(c.due_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI')||E' (Türkiye saati)\n\nTakvimini aç: '||rtrim(app_url,'/')||'/#/app/takvim'||E'\n\nBu hatırlatmayı takviminde e-posta bildirimini açtığın için aldın. Takvim kaydından e-postayı kapatabilirsin.');
 update public.reminder_jobs set payload=result where id=job_id;
 return result;
end $$;
-- Only a version marker is public; no user data is exposed by this health check.
create function public.app_status() returns text language sql stable as $$select 'kampuskit-20260912'::text$$;
revoke all on function public.sync_member(),public.guard_owned_record(),public.calendar_revision(),public.sync_reminder(),public.claim_reminders(int),public.prepare_reminder(uuid,text,text),public.owns_upload(text,text) from public,anon,authenticated;
grant execute on function public.owns_upload(text,text) to authenticated;
grant execute on function public.claim_reminders(int),public.prepare_reminder(uuid,text,text) to service_role;
revoke all on function public.app_status() from public;
grant execute on function public.app_status() to anon,authenticated,service_role;
commit;
