import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
if (!process.argv.includes('--run')) throw new Error('Use --run to create and clean up three disposable test accounts.')
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, pub = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
if (!url || !key || !pub) throw new Error('Supabase environment is missing')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, key, options), users = [], paths = []
const check = r => { if (r.error) throw new Error(r.error.message); return r.data }
try {
    const universities = check(await admin.from('universities').select('id').order('id'))
    for (let i = 0; i < 3; i++) {
        const email = `kampuskit-test-${randomUUID()}@example.com`, password = randomUUID() + 'aA1!'
        const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true }))
        users.push({ id: user.id, email, password, client: createClient(url, pub, options) })
        const entry = users.at(-1)
        check(await entry.client.auth.signInWithPassword({ email, password }))
        check(await entry.client.from('profiles').insert({ id: user.id, display_name: 'Disposable integration test', university_id: universities[i === 2 ? 1 : 0].id, department: 'Test' }))
    }
    const [a, b, c] = users
    const budget = check(await a.client.from('budget_entries').insert({ user_id: a.id, type: 'expense', amount_kurus: 12345, category: 'Yemek', note: 'Disposable test', occurred_on: '2026-09-12' }).select().single())
    await a.client.auth.signOut()
    check(await a.client.auth.signInWithPassword({ email: a.email, password: a.password }))
    assert.equal(check(await a.client.from('budget_entries').select('amount_kurus').eq('id', budget.id)).at(0).amount_kurus, 12345)
    for (const other of [b, c]) {
        assert.equal(check(await other.client.from('budget_entries').select('id').eq('id', budget.id)).length, 0)
        assert.equal(check(await other.client.from('budget_entries').update({ amount_kurus: 1 }).eq('id', budget.id).select('id')).length, 0)
    }
    const path = a.id + '/' + randomUUID() + '.pdf'; paths.push(path)
    check(await a.client.storage.from('notes').upload(path, new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' })))
    assert.ok((await b.client.storage.from('notes').download(path)).error)
    const course = check(await a.client.from('courses').select('id').eq('university_id', universities[0].id).limit(1)).at(0)
    const post = check(await a.client.from('posts').insert({ user_id: a.id, university_id: universities[0].id, course_id: course.id, kind: 'note', title: 'Disposable integration test', body: 'Will be removed by the test cleanup.', attachment_path: path }).select('id').single())
    assert.equal(check(await c.client.from('posts').select('id').eq('id', post.id)).length, 1)
    assert.ok(check(await b.client.storage.from('notes').download(path)))
    const calendar = check(await a.client.from('calendar_items').insert({ user_id: a.id, title: 'Disposable calendar test', kind: 'deadline', due_at: new Date(Date.now() + 3600000).toISOString(), email_enabled: false }).select('id').single())
    assert.equal(check(await b.client.from('calendar_items').select('id').eq('id', calendar.id)).length, 0)
    const status = check(await a.client.from('reminder_jobs').select('id,calendar_id,user_id,state,last_error'))
    assert.ok(Array.isArray(status))
    console.log('PASS: real Supabase Auth sign-in/out, persistent writes, 3-account RLS, shared posts, private and shared files, private calendar.')
} finally {
    async function retry(action) { let last; for (let i = 0; i < 3; i++) { try { return check(await action()) } catch (e) { last = e; await new Promise(r => setTimeout(r, 500 * (i + 1))) } } throw last }
    if (paths.length) await retry(() => admin.storage.from('notes').remove(paths))
    for (const user of users) {
        for (const table of ['posts', 'listings', 'reviews', 'crowd_reports']) await retry(() => admin.from(table).delete().eq('user_id', user.id))
        await retry(() => admin.auth.admin.deleteUser(user.id))
        await retry(() => admin.from('members').delete().eq('id', user.id))
    }
    console.log('Disposable test accounts and records cleaned up; no emails sent.')
}
