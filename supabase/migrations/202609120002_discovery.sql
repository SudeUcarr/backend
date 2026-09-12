begin;
alter table public.internships alter column university_id drop not null;
alter table public.internships alter column deadline drop not null;
alter table public.internships add column user_id uuid references public.members(id);
alter table public.internships add column created_at timestamptz not null default now();
alter table public.internships add column source_kind text not null default 'student' check(source_kind in('student','import','example'));
alter table public.internships add column source_provider text;
alter table public.internships add column source_key text;
alter table public.internships add column source_name text not null default 'Öğrenci paylaşımı';
alter table public.internships add column fetched_at timestamptz;
alter table public.internships add column status text not null default 'active' check(status in('active','closed'));
alter table public.internships add constraint internship_source_unique unique(source_provider,source_key);
update public.internships set source_kind='example',source_name='Örnek ilan' where is_example;
drop policy member_read on public.internships;
create policy internships_read on public.internships for select to authenticated using(status='active' or user_id=(select auth.uid()));
grant insert(user_id,university_id,title,company,field,location,work_mode,description,source_url,deadline) on public.internships to authenticated;
grant update(title,company,field,location,work_mode,description,source_url,deadline,status) on public.internships to authenticated;
grant delete on public.internships to authenticated;
create policy internships_insert on public.internships for insert to authenticated with check(user_id=(select auth.uid()) and source_kind='student' and source_url is not null and not is_example);
create policy internships_update on public.internships for update to authenticated using(user_id=(select auth.uid()) and source_kind='student') with check(user_id=(select auth.uid()) and source_kind='student' and source_url is not null and not is_example);
create policy internships_delete on public.internships for delete to authenticated using(user_id=(select auth.uid()) and source_kind='student');
create trigger guard_owned before insert or update on public.internships for each row execute function public.guard_owned_record();
create index internships_active on public.internships(status,source_provider,fetched_at);

alter table public.campuses add column latitude double precision check(latitude between -90 and 90);
alter table public.campuses add column longitude double precision check(longitude between -180 and 180);
alter table public.campuses add column address text;
alter table public.campuses add column source_url text;
alter table public.places add column user_id uuid references public.members(id);
alter table public.places add column created_at timestamptz not null default now();
alter table public.places add column campus_id uuid;
alter table public.places add constraint place_campus foreign key(campus_id,university_id) references public.campuses(id,university_id);
alter table public.places add column address text not null default '' check(length(address)<=500);
alter table public.places add column maps_url text check(maps_url is null or maps_url ~ '^https://');
alter table public.places add column latitude double precision check(latitude between -90 and 90);
alter table public.places add column longitude double precision check(longitude between -180 and 180);
alter table public.places add column meal_price_kurus bigint check(meal_price_kurus between 1 and 10000000);
alter table public.places add column price_observed_on date;
alter table public.places add constraint place_coordinates check((latitude is null)=(longitude is null));
grant insert(user_id,university_id,campus_id,name,category,price_level,district,description,symbol,address,maps_url,latitude,longitude,meal_price_kurus,price_observed_on) on public.places to authenticated;
grant update(campus_id,name,category,price_level,district,description,symbol,address,maps_url,latitude,longitude,meal_price_kurus,price_observed_on) on public.places to authenticated;
create policy places_insert on public.places for insert to authenticated with check(user_id=(select auth.uid()) and not is_example);
create policy places_update on public.places for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and not is_example);
create trigger guard_owned before insert or update on public.places for each row execute function public.guard_owned_record();

create table public.ingestion_runs(source text primary key,last_started_at timestamptz not null,finished_at timestamptz,status text not null check(status in('running','success','failed')),imported_count int not null default 0,error text);
alter table public.ingestion_runs enable row level security;
revoke all on public.ingestion_runs from anon,authenticated;
grant select on public.ingestion_runs to authenticated;
grant all on public.ingestion_runs to service_role;
create policy ingestion_read on public.ingestion_runs for select to authenticated using(true);
create function public.claim_ingestion(source_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare claimed text;begin
 if source_name not in('lever:insiderone','lever:lalamove','lever:peakgames','lever:dreamgames','greenhouse:constructortech','greenhouse:udemybedi') then raise exception 'Unknown source';end if;
 insert into public.ingestion_runs(source,last_started_at,status) values(source_name,now(),'running')
 on conflict(source) do update set last_started_at=now(),finished_at=null,status='running',error=null
 where public.ingestion_runs.last_started_at<now()-interval '1 hour' returning source into claimed;
 return claimed is not null;
end $$;
revoke all on function public.claim_ingestion(text) from public,anon,authenticated;
grant execute on function public.claim_ingestion(text) to service_role;
comment on function public.claim_ingestion(text) is 'Fixed source allowlist and an atomic one-hour cooldown prevent concurrent or excessive imports.';
commit;
