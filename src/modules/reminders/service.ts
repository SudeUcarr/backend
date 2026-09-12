import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReminderResult {
  processed: number
  sent: number
  failed: number
  details: Array<{
    id: string
    recipient?: string
    subject?: string
    status: 'sent' | 'failed' | 'simulated'
    error?: string
  }>
}

export async function processReminders(
  client: SupabaseClient,
  options: {
    sender?: string
    appUrl?: string
    resendApiKey?: string
    simulate?: boolean
  } = {}
): Promise<ReminderResult> {
  const sender = options.sender || process.env.RESEND_FROM_EMAIL || 'KampüsKit <onboarding@resend.dev>'
  const appUrl = options.appUrl || 'http://127.0.0.1:5173'
  const result: ReminderResult = { processed: 0, sent: 0, failed: 0, details: [] }

  // 1. Claim up to 25 pending reminder jobs
  const claimRes = await client.rpc('claim_reminders', { batch_size: 25 })
  if (claimRes.error) throw claimRes.error
  const jobs = claimRes.data || []
  if (!Array.isArray(jobs) || !jobs.length) return result

  result.processed = jobs.length

  // 2. Process each claimed job
  for (const job of jobs) {
    try {
      const prepRes = await client.rpc('prepare_reminder', {
        job_id: job.id,
        sender,
        app_url: appUrl
      })
      if (prepRes.error) throw prepRes.error
      const payload = prepRes.data
      if (!payload || !payload.to) {
        result.failed++
        result.details.push({ id: job.id, status: 'failed', error: 'Payload oluşturulamadı' })
        continue
      }

      let messageId: string | null = null

      // 3. Send real email if Resend API key is available and not in simulation mode
      if (options.resendApiKey && !options.simulate) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: payload.from,
            to: payload.to,
            subject: payload.subject,
            text: payload.text
          })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.message || `Resend HTTP ${response.status}`)
        }
        messageId = data.id || null
      }

      // 4. Update reminder_jobs state to sent
      const updateRes = await client
        .from('reminder_jobs')
        .update({
          state: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: messageId
        })
        .eq('id', job.id)

      if (updateRes.error) throw updateRes.error

      result.sent++
      result.details.push({
        id: job.id,
        recipient: payload.to,
        subject: payload.subject,
        status: options.resendApiKey && !options.simulate ? 'sent' : 'simulated'
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed++
      result.details.push({ id: job.id, status: 'failed', error: message })
      await client
        .from('reminder_jobs')
        .update({
          state: 'retry',
          next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          last_error: message.slice(0, 300)
        })
        .eq('id', job.id)
    }
  }

  return result
}
