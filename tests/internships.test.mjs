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
