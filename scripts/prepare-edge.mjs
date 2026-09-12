import {readFile,writeFile,mkdir} from 'node:fs/promises'
await mkdir('.artifacts',{recursive:true})
const shared=await readFile('src/integrations/internship-sources.ts','utf8')
const entry=await readFile('supabase/functions/sync-internships/index.ts','utf8')
await writeFile('.artifacts/sync-internships.ts',entry.replace("import {sources,collectSource} from '../_shared/internships.ts'",shared))
console.log('Single-file dashboard deployment prepared.')
