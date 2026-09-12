import { createClient } from '@supabase/supabase-js'
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const targets = process.argv.slice(2)
if (!targets.length) throw new Error('Pass explicit disposable test user IDs.')
async function check(operation) { for (let n = 0; n < 3; n++) { const result = await operation(); if (!result.error) return result.data; if (n === 2) throw new Error(result.error.message) } }
for (const id of targets) {
    const { user } = await check(() => client.auth.admin.getUserById(id))
    if (!/^kampuskit-test-[a-f0-9-]+@example\.com$/.test(user.email)) throw new Error('Not a disposable test account')
    const files = await check(() => client.storage.from('notes').list(id))
    if (files.length) await check(() => client.storage.from('notes').remove(files.map(f => id + '/' + f.name)))
    for (const table of ['posts', 'listings', 'reviews', 'crowd_reports']) await check(() => client.from(table).delete().eq('user_id', id))
    await check(() => client.auth.admin.deleteUser(id))
    await check(() => client.from('members').delete().eq('id', id))
    console.log('Disposable test account cleaned up.')
}
