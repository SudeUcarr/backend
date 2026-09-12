begin;
create or replace function public.claim_ingestion(source_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare claimed text;begin
 if source_name not in(
   'lever:insiderone','lever:lalamove','lever:peakgames','lever:dreamgames',
   'greenhouse:constructortech','greenhouse:udemybedi',
   'linkedin:turkey','toptalent:staj',
   'weworkremotely:programming','remotive:intern',
   'kariyer:stajyer'
 ) then raise exception 'Unknown source';end if;
 insert into public.ingestion_runs(source,last_started_at,status) values(source_name,now(),'running')
 on conflict(source) do update set last_started_at=now(),finished_at=null,status='running',error=null
 where public.ingestion_runs.last_started_at<now()-interval '1 hour' returning source into claimed;
 return claimed is not null;
end $$;
comment on function public.claim_ingestion(text) is 'Fixed source allowlist (including LinkedIn, Toptalent, WeWorkRemotely, Remotive, Kariyer, Lever and Greenhouse) and an atomic one-hour cooldown prevent concurrent or excessive imports.';
commit;
