import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isInternship,normalizeJob,collectSource,sources} from '../src/integrations/internship-sources.ts'
test('internship classification excludes internal job titles',()=>{
 assert.equal(isInternship('Internal Communications Manager'),false)
 assert.equal(isInternship('International Sales'),false)
 assert.equal(isInternship('Marketing Intern'),true)
 assert.equal(isInternship('Yazılım Stajyeri'),true)
})
test('job normalization preserves unknown deadline and rejects unsafe source URLs',()=>{
 const source=sources[0],job={id:'a',text:'Software Intern',categories:{location:'Istanbul'},hostedUrl:'https://jobs.lever.co/insiderone/a'}
 const row=normalizeJob(job,source,'2026-09-12T10:00:00Z')
 assert.equal(row.deadline,null);assert.equal(row.work_mode,'Belirtilmemiş');assert.equal(row.is_example,false)
 assert.equal(normalizeJob({...job,hostedUrl:'javascript:alert(1)'},source,''),null)
 assert.equal(normalizeJob({...job,hostedUrl:'https://unrelated.invalid/job'},source,''),null)
})
test('Lever collector paginates and deduplicates',async()=>{
 let calls=0
 const raw={id:'a',text:'Design Intern',hostedUrl:'https://jobs.lever.co/insiderone/a'}
 const rows=await collectSource(sources[0],async()=>{calls++;return new Response(JSON.stringify(calls===1?Array(100).fill(raw):[raw]))})
 assert.equal(calls,2);assert.equal(rows.length,1)
})
test('source failures and malformed feeds fail explicitly',async()=>{
 await assert.rejects(()=>collectSource(sources[0],async()=>new Response('denied',{status:429})))
 await assert.rejects(()=>collectSource(sources[0],async()=>new Response('{}')))
})
test('LinkedIn parser extracts job details and normalizes to imported job',async()=>{
 const source=sources.find(s=>s.provider==='linkedin')
 const mockHtml=`
   <ul>
     <li>
       <div class="base-search-card" data-entity-urn="urn:li:jobPosting:12345678">
         <a class="base-card__full-link" href="https://tr.linkedin.com/jobs/view/software-engineering-intern-12345678?refId=xyz"></a>
         <div class="base-search-card__info">
           <h3 class="base-search-card__title">Software Engineering Intern</h3>
           <h4 class="base-search-card__subtitle"><a href="#">Paynion</a></h4>
           <div class="base-search-card__metadata"><span class="job-search-card__location">Istanbul, Turkey</span></div>
         </div>
       </div>
     </li>
   </ul>`
 const rows=await collectSource(source,async()=>new Response(mockHtml,{status:200}))
 assert.equal(rows.length,1)
 assert.equal(rows[0].title,'Software Engineering Intern')
 assert.equal(rows[0].company,'Paynion')
 assert.equal(rows[0].field,'Yazılım')
 assert.equal(rows[0].location,'Istanbul, Turkey')
 assert.equal(rows[0].source_key,'12345678')
 assert.equal(rows[0].source_url,'https://tr.linkedin.com/jobs/view/software-engineering-intern-12345678')
})
test('WeWorkRemotely RSS parser extracts remote internship and sets remote work mode',async()=>{
 const source=sources.find(s=>s.provider==='weworkremotely')
 const mockXml=`<?xml version="1.0" encoding="UTF-8"?>
   <rss version="2.0"><channel>
     <item>
       <title>Acme Corp: Remote Software Intern</title>
       <link>https://weworkremotely.com/remote-jobs/acme-intern</link>
       <guid>https://weworkremotely.com/remote-jobs/acme-intern</guid>
       <region>Worldwide</region>
     </item>
   </channel></rss>`
 const rows=await collectSource(source,async()=>new Response(mockXml,{status:200}))
 assert.equal(rows.length,1)
 assert.equal(rows[0].title,'Remote Software Intern')
 assert.equal(rows[0].company,'Acme Corp')
 assert.equal(rows[0].work_mode,'Uzaktan')
 assert.equal(rows[0].source_provider,'weworkremotely:programming')
})
test('Toptalent parser extracts position cards and maps fields',async()=>{
 const source=sources.find(s=>s.provider==='toptalent')
 const mockHtml=`
   <a href="/fiss-ai-video-produksiyon-stajyeri-121756" class="position">
     <div class="card-body">
       <h5 class="card-title">AI Video Prodüksiyon Stajyeri</h5>
       <p class="card-text">FISS <span class="text-grey-l">Tüm Türkiye</span></p>
     </div>
   </a>`
 const rows=await collectSource(source,async()=>new Response(mockHtml,{status:200}))
 assert.equal(rows.length,1)
 assert.equal(rows[0].title,'AI Video Prodüksiyon Stajyeri')
 assert.equal(rows[0].company,'FISS')
 assert.equal(rows[0].location,'Tüm Türkiye')
 assert.equal(rows[0].source_key,'121756')
 assert.equal(rows[0].source_url,'https://toptalent.co/fiss-ai-video-produksiyon-stajyeri-121756')
})
test('Remotive JSON collector maps remote internships',async()=>{
 const source=sources.find(s=>s.provider==='remotive')
 const mockData={jobs:[{id:98765,title:'Frontend Intern',company_name:'TechLab',url:'https://remotive.com/remote-jobs/frontend-intern-98765',candidate_required_location:'Worldwide'}]}
 const rows=await collectSource(source,async()=>new Response(JSON.stringify(mockData),{status:200}))
 assert.equal(rows.length,1)
 assert.equal(rows[0].title,'Frontend Intern')
 assert.equal(rows[0].company,'TechLab')
 assert.equal(rows[0].work_mode,'Uzaktan')
 assert.equal(rows[0].source_provider,'remotive:intern')
})

