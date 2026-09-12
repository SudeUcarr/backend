export type Source={provider:'lever'|'greenhouse';board:string;company:string;url:string}
export const sources:Source[]=[
 {provider:'lever',board:'insiderone',company:'Insider One',url:'https://jobs.lever.co/insiderone'},
 {provider:'lever',board:'lalamove',company:'Lalamove',url:'https://jobs.lever.co/lalamove'},
 {provider:'lever',board:'peakgames',company:'Peak',url:'https://jobs.lever.co/peakgames'},
 {provider:'lever',board:'dreamgames',company:'Dream Games',url:'https://jobs.lever.co/dreamgames'},
 {provider:'greenhouse',board:'constructortech',company:'Constructor TECH',url:'https://job-boards.greenhouse.io/constructortech'},
 {provider:'greenhouse',board:'udemybedi',company:'BEDI Partnerships / Udemy',url:'https://job-boards.greenhouse.io/udemybedi'},
]
export type ImportedJob={university_id:null;user_id:null;title:string;company:string;field:string;location:string;work_mode:string;description:string;source_url:string;deadline:null;is_example:false;source_kind:'import';source_provider:string;source_key:string;source_name:string;fetched_at:string;status:'active'}
type RawJob={id?:string|number;text?:string;title?:string;hostedUrl?:string;absolute_url?:string;categories?:{location?:string;commitment?:string;team?:string};location?:{name?:string};workplaceType?:string}
const text=(v:unknown,max=200)=>typeof v==='string'?v.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().slice(0,max):''
export const isInternship=(title:string,commitment='')=>/\b(intern(ship)?|stajyer(i)?|staj|trainee)\b/i.test(title+' '+commitment)
export function classifyField(title:string){if(/software|developer|engineer|security|qa|yazılım/i.test(title))return 'Yazılım';if(/design|tasarım/i.test(title))return 'Tasarım';if(/market|sales|growth|pazar/i.test(title))return 'Pazarlama';if(/data|research|analyst|veri/i.test(title))return 'Veri & Araştırma';if(/people|human|talent/i.test(title))return 'İnsan Kaynakları';return 'Diğer'}
export function normalizeJob(raw:RawJob,source:Source,now:string):ImportedJob|null{
 const title=text(raw.text||raw.title),location=text(raw.categories?.location||raw.location?.name)||'Belirtilmemiş'
 if(!raw.id||!title||!isInternship(title,raw.categories?.commitment))return null
 const sourceUrl=raw.hostedUrl||raw.absolute_url
 if(!sourceUrl)return null
 let url:URL;try{url=new URL(sourceUrl)}catch{return null}
 const allowed=source.provider==='lever'?['jobs.lever.co','jobs.eu.lever.co']:['boards.greenhouse.io','job-boards.greenhouse.io','job-boards.eu.greenhouse.io']
 if(url.protocol!=='https:'||!allowed.includes(url.hostname))return null
 const work_mode=raw.workplaceType==='remote'?'Uzaktan':raw.workplaceType==='hybrid'?'Hibrit':raw.workplaceType==='on-site'?'Ofiste':/remote|uzaktan/i.test(location)?'Uzaktan':'Belirtilmemiş'
 return {university_id:null,user_id:null,title,company:source.company,field:classifyField(title),location,work_mode,
 description:`${source.company} tarafından yayımlanan staj / başlangıç programı ilanı. Konum: ${location}. Başvuru şartları, ücret, çalışma izni ve program ayrıntıları için şirketin kaynak sayfasını incele. Kaynak akışında son başvuru tarihi belirtilmedi.`,
 source_url:url.href,deadline:null,is_example:false,source_kind:'import',source_provider:source.provider+':'+source.board,source_key:String(raw.id),source_name:source.company+' kariyer sayfası',fetched_at:now,status:'active'}
}
async function getJson(url:string,fetcher:typeof fetch){
 const r=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'KampusKit/1.0 (public internship index)'},signal:AbortSignal.timeout(15000),redirect:'error'})
 if(!r.ok)throw new Error('Source returned HTTP '+r.status)
 const raw=await r.text();if(raw.length>8_000_000)throw new Error('Source response too large')
 return JSON.parse(raw)
}
export async function collectSource(source:Source,fetcher:typeof fetch=fetch,now=new Date().toISOString()){
 const all:RawJob[]=[]
 if(source.provider==='lever'){
  let complete=false
  for(let page=0;page<20;page++){
   const data=await getJson(`https://api.lever.co/v0/postings/${source.board}?mode=json&commitment=Internship&commitment=Intern&limit=100&skip=${page*100}`,fetcher)
   if(!Array.isArray(data))throw new Error('Invalid Lever payload')
   all.push(...data);if(data.length<100){complete=true;break}
  }
  if(!complete)throw new Error('Pagination limit reached; existing records preserved')
 }else{
  const data=await getJson(`https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs`,fetcher)
  if(!Array.isArray(data.jobs))throw new Error('Invalid Greenhouse payload')
  all.push(...data.jobs)
 }
 // Keep source metadata and a factual summary; do not republish full job descriptions.
 const result=new Map<string,ImportedJob>()
 for(const raw of all){const job=normalizeJob(raw,source,now);if(job)result.set(job.source_key,job);else if(isInternship(text(raw.text||raw.title),raw.categories?.commitment))throw new Error('Invalid internship record; existing records preserved')}
 return [...result.values()]
}
