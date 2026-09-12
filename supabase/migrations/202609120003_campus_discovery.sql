begin;
update public.campuses set latitude=41.101422,longitude=29.021206,source_url='https://sustecs.itu.edu.tr/bize-ulasin/' where id='00000000-0000-4000-8000-000000001000';
update public.campuses set latitude=41.025694,longitude=28.888035,source_url='https://erasmus.yildiz.edu.tr/page/Erasmus--Europe/Campuses/852' where id='00000000-0000-4000-8000-000000002000';
update public.campuses set latitude=40.986114,longitude=29.05335,source_url='https://sks.marmara.edu.tr/contact' where id='00000000-0000-4000-8000-000000003000';
-- Demo exposes only company-sourced public jobs, never student content or private records.
create function public.public_imported_internships() returns setof public.internships language sql stable security definer set search_path='' as $$
 select * from public.internships where source_kind='import' and status='active' and not is_example and user_id is null and (deadline is null or deadline>now()) order by fetched_at desc limit 200
$$;
revoke all on function public.public_imported_internships() from public;
grant execute on function public.public_imported_internships() to anon,authenticated;
commit;
