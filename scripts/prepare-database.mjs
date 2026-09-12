import {createExampleData} from '@kampuskit/shared/seed'
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises'
{
 const data=createExampleData()
 const value=v=>v===null?'null':typeof v==='boolean'||typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'"
 const tables=['universities','campuses','courses','crowd_locations']
 const statements=tables.map(table=>{
   const rows=data[table],keys=Object.keys(rows[0])
   return `insert into public.${table}(${keys.join(',')}) values\n${rows.map(row=>'('+keys.map(k=>value(row[k])).join(',')+')').join(',\n')}\non conflict(id) do nothing;`
 }).join('\n\n')
 const seed='-- Campus catalog. Safe to run again.\nbegin;\n'+statements+'\ncommit;\n'
 await writeFile('supabase/seed-catalog.sql',seed)
 await mkdir('.artifacts',{recursive:true})
 const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()
 const schema=(await Promise.all(files.map(f=>readFile('supabase/migrations/'+f,'utf8')))).join('\n')
 await writeFile('.artifacts/install-supabase.sql',schema+'\n'+seed)
 console.log('Database install prepared: all migrations + campus catalog.')
}
