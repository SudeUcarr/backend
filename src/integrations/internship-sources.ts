export type Source = {
  provider: 'lever' | 'greenhouse' | 'linkedin' | 'toptalent' | 'weworkremotely' | 'remotive' | 'kariyer';
  board: string;
  company: string;
  url: string;
}

export const sources: Source[] = [
  // Lever & Greenhouse Sources
  { provider: 'lever', board: 'insiderone', company: 'Insider One', url: 'https://jobs.lever.co/insiderone' },
  { provider: 'lever', board: 'peakgames', company: 'Peak', url: 'https://jobs.lever.co/peakgames' },
  { provider: 'lever', board: 'lalamove', company: 'Lalamove', url: 'https://jobs.lever.co/lalamove' },
  { provider: 'lever', board: 'dreamgames', company: 'Dream Games', url: 'https://jobs.lever.co/dreamgames' },
  { provider: 'greenhouse', board: 'constructortech', company: 'Constructor TECH', url: 'https://job-boards.greenhouse.io/constructortech' },
  { provider: 'greenhouse', board: 'udemybedi', company: 'BEDI Partnerships / Udemy', url: 'https://job-boards.greenhouse.io/udemybedi' },
  // Gerçek Kariyer / Staj Siteleri
  { provider: 'linkedin', board: 'turkey', company: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=stajyer&location=Turkey&f_E=1' },
  { provider: 'toptalent', board: 'staj', company: 'Toptalent', url: 'https://toptalent.co/staj-ilanlari' },
  { provider: 'weworkremotely', board: 'programming', company: 'We Work Remotely', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss' },
  { provider: 'remotive', board: 'intern', company: 'Remotive', url: 'https://remotive.com/api/remote-jobs?search=intern' },
  { provider: 'kariyer', board: 'stajyer', company: 'Kariyer.net', url: 'https://www.kariyer.net/is-ilanlari/stajyer' },
]

export type ImportedJob = {
  university_id: null;
  user_id: null;
  title: string;
  company: string;
  field: string;
  location: string;
  work_mode: string;
  description: string;
  source_url: string;
  deadline: null;
  is_example: false;
  source_kind: 'import';
  source_provider: string;
  source_key: string;
  source_name: string;
  fetched_at: string;
  status: 'active';
}

export type RawJob = {
  id?: string | number;
  text?: string;
  title?: string;
  company?: string;
  hostedUrl?: string;
  absolute_url?: string;
  categories?: { location?: string; commitment?: string; team?: string };
  location?: { name?: string };
  workplaceType?: string;
}

export function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#252;/g, 'ü')
    .replace(/&#214;/g, 'Ö')
    .replace(/&#220;/g, 'Ü')
    .replace(/&#231;/g, 'ç')
    .replace(/&#199;/g, 'Ç')
    .replace(/&#287;/g, 'ğ')
    .replace(/&#286;/g, 'Ğ')
    .replace(/&#305;/g, 'ı')
    .replace(/&#304;/g, 'İ')
    .replace(/&#351;/g, 'ş')
    .replace(/&#350;/g, 'Ş')
    .replace(/&nbsp;/g, ' ')
}

const text = (v: unknown, max = 200) =>
  typeof v === 'string'
    ? decodeEntities(v)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : ''

export const isInternship = (title: string, commitment = '') =>
  /\b(intern(ship)?|stajyer(i)?|staj|trainee|working student|werkstudent)\b/i.test(title + ' ' + commitment)

export function classifyField(title: string) {
  if (/software|developer|engineer|security|qa|yazılım|frontend|backend|fullstack|devops|mobile|ios|android|web/i.test(title)) return 'Yazılım'
  if (/design|tasarım|ui|ux|graphic|grafik|video/i.test(title)) return 'Tasarım'
  if (/market|sales|growth|pazar|satış|reklam|pazarlama/i.test(title)) return 'Pazarlama'
  if (/data|research|analyst|veri|yapay zeka|ai|machine learning|ml/i.test(title)) return 'Veri & Araştırma'
  if (/people|human|talent|ik|insan kaynakları/i.test(title)) return 'İnsan Kaynakları'
  return 'Diğer'
}

export function normalizeJob(raw: RawJob, source: Source, now: string): ImportedJob | null {
  const title = text(raw.text || raw.title)
  const location = text(raw.categories?.location || raw.location?.name) || 'Belirtilmemiş'
  if (!raw.id || !title || !isInternship(title, raw.categories?.commitment)) return null
  const sourceUrl = raw.hostedUrl || raw.absolute_url
  if (!sourceUrl) return null
  let url: URL; try { url = new URL(sourceUrl) } catch { return null }

  const allowed = [
    'jobs.lever.co', 'jobs.eu.lever.co',
    'boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io',
    'linkedin.com', 'tr.linkedin.com', 'www.linkedin.com',
    'weworkremotely.com', 'www.weworkremotely.com',
    'toptalent.co', 'www.toptalent.co',
    'kariyer.net', 'www.kariyer.net',
    'remotive.com', 'www.remotive.com'
  ]
  const isAllowedHost = allowed.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))
  if (url.protocol !== 'https:' || !isAllowedHost) return null

  const company = text(raw.company) || source.company
  const work_mode = raw.workplaceType === 'remote' ? 'Uzaktan'
    : raw.workplaceType === 'hybrid' ? 'Hibrit'
    : raw.workplaceType === 'on-site' ? 'Ofiste'
    : /remote|uzaktan/i.test(location + ' ' + title) ? 'Uzaktan'
    : /hybrid|hibrit/i.test(location + ' ' + title) ? 'Hibrit'
    : 'Belirtilmemiş'

  const sourceName = source.company.includes('Jobs') || source.company.includes('Toptalent') || source.company.includes('We Work Remotely') || source.company.includes('Remotive') || source.company.includes('Kariyer') || source.company.includes('kariyer sayfası')
    ? source.company
    : source.company + ' kariyer sayfası'

  return {
    university_id: null,
    user_id: null,
    title,
    company,
    field: classifyField(title),
    location,
    work_mode,
    description: `${company} tarafından yayımlanan staj / başlangıç programı ilanı. Konum: ${location}. Başvuru şartları, ücret, çalışma izni ve program ayrıntıları için şirketin kaynak sayfasını incele. Kaynak akışında son başvuru tarihi belirtilmedi.`,
    source_url: url.href,
    deadline: null,
    is_example: false,
    source_kind: 'import',
    source_provider: source.provider + ':' + source.board,
    source_key: String(raw.id),
    source_name: sourceName,
    fetched_at: now,
    status: 'active'
  }
}

async function getJson(url: string, fetcher: typeof fetch) {
  const r = await fetcher(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KampusKit/1.0 (public internship index)'
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'error'
  })
  if (!r.ok) throw new Error('Source returned HTTP ' + r.status)
  const raw = await r.text()
  if (raw.length > 8_000_000) throw new Error('Source response too large')
  return JSON.parse(raw)
}

async function getHtml(url: string, fetcher: typeof fetch) {
  const r = await fetcher(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow'
  })
  if (!r.ok) throw new Error('Source returned HTTP ' + r.status)
  const raw = await r.text()
  if (raw.length > 10_000_000) throw new Error('Source response too large')
  return raw
}

export function parseLinkedIn(html: string): RawJob[] {
  const jobs: RawJob[] = []
  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(html)) !== null) {
    const item = match[1]
    if (!item.includes('base-search-card')) continue
    const urn = /data-entity-urn="urn:li:jobPosting:(\d+)"/i.exec(item)?.[1]
    const linkMatch = /<a[^>]+class="[^"]*base-card__full-link[^"]*"[^>]+href="([^"]+)"/i.exec(item)
    const titleMatch = /<h3[^>]+class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i.exec(item)
    const companyMatch = /<h4[^>]+class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i.exec(item)
    const locMatch = /<span[^>]+class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(item)

    if (linkMatch && titleMatch) {
      const rawUrl = decodeEntities(linkMatch[1]).split('?')[0]
      const title = text(titleMatch[1])
      const company = text(companyMatch ? companyMatch[1] : '') || 'LinkedIn'
      const loc = text(locMatch ? locMatch[1] : '') || 'Türkiye'
      const id = urn || rawUrl.match(/(\d{6,})/)?.[1] || rawUrl

      if (title && rawUrl) {
        jobs.push({
          id,
          title,
          company,
          hostedUrl: rawUrl,
          location: { name: loc },
          categories: { location: loc, commitment: 'Internship' }
        })
      }
    }
  }
  return jobs
}

export function parseWwr(xml: string): RawJob[] {
  const jobs: RawJob[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(item)
    const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(item)
    const guidMatch = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i.exec(item)
    const regionMatch = /<region>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/region>/i.exec(item)

    if (titleMatch && linkMatch) {
      let fullTitle = text(titleMatch[1])
      let company = 'We Work Remotely'
      if (fullTitle.includes(':')) {
        const parts = fullTitle.split(':')
        company = parts[0].trim()
        fullTitle = parts.slice(1).join(':').trim()
      }
      const rawUrl = decodeEntities(linkMatch[1].replace(/<[^>]+>/g, '')).trim()
      const guid = guidMatch ? decodeEntities(guidMatch[1].replace(/<[^>]+>/g, '')).trim() : rawUrl
      const region = regionMatch ? text(regionMatch[1]) : 'Remote'
      const id = guid.match(/\/([a-z0-9-]+)$/i)?.[1] || guid

      if (fullTitle && rawUrl) {
        jobs.push({
          id,
          title: fullTitle,
          company,
          hostedUrl: rawUrl,
          location: { name: region },
          workplaceType: 'remote',
          categories: { location: region, commitment: 'Internship' }
        })
      }
    }
  }
  return jobs
}

export function parseToptalent(html: string): RawJob[] {
  const jobs: RawJob[] = []
  const cardRegex = /<a[^>]+href="(\/[^"]*?-\d+)"[^>]*class="[^"]*position[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = cardRegex.exec(html)) !== null) {
    const path = match[1]
    const content = match[2]
    const titleMatch = /<h5[^>]+class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h5>/i.exec(content)
    const cardTextMatch = /<p[^>]+class="[^"]*card-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(content)

    if (titleMatch) {
      const title = text(titleMatch[1])
      let company = 'Toptalent'
      let location = 'Türkiye'
      if (cardTextMatch) {
        const textBlock = cardTextMatch[1]
        const locSpan = /<span[^>]*>([\s\S]*?)<\/span>/i.exec(textBlock)
        if (locSpan) {
          location = text(locSpan[1])
        }
        company = text(textBlock.replace(/<span[^>]*>[\s\S]*?<\/span>/i, '')) || 'Toptalent'
      }
      const idMatch = path.match(/-(\d+)$/)
      const id = idMatch ? idMatch[1] : path.replace(/^\//, '')
      const hostedUrl = 'https://toptalent.co' + path

      jobs.push({
        id,
        title,
        company,
        hostedUrl,
        location: { name: location },
        categories: { location, commitment: 'Internship' }
      })
    }
  }
  return jobs
}

export function parseKariyer(html: string): RawJob[] {
  const jobs: RawJob[] = []
  const linkRegex = /<a[^>]+href="(\/is-ilani\/[^"]*-(\d+))"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1]
    const id = match[2]
    const content = match[3]
    const titleMatch = /<span[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>|<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/i.exec(content)
    const companyMatch = /<span[^>]+class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(content)
    const locMatch = /<span[^>]+class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(content)

    const title = text(titleMatch ? (titleMatch[1] || titleMatch[2]) : '')
    if (title && isInternship(title)) {
      const company = text(companyMatch ? companyMatch[1] : '') || 'Kariyer.net'
      const location = text(locMatch ? locMatch[1] : '') || 'Türkiye'
      jobs.push({
        id,
        title,
        company,
        hostedUrl: 'https://www.kariyer.net' + path,
        location: { name: location },
        categories: { location, commitment: 'Internship' }
      })
    }
  }
  return jobs
}

export async function collectSource(source: Source, fetcher: typeof fetch = fetch, now = new Date().toISOString()): Promise<ImportedJob[]> {
  const all: RawJob[] = []

  if (source.provider === 'lever') {
    let complete = false
    for (let page = 0; page < 20; page++) {
      const data = await getJson(`https://api.lever.co/v0/postings/${source.board}?mode=json&commitment=Internship&commitment=Intern&limit=100&skip=${page * 100}`, fetcher)
      if (!Array.isArray(data)) throw new Error('Invalid Lever payload')
      all.push(...data); if (data.length < 100) { complete = true; break }
    }
    if (!complete) throw new Error('Pagination limit reached; existing records preserved')
  } else if (source.provider === 'greenhouse') {
    const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs`, fetcher)
    if (!Array.isArray(data.jobs)) throw new Error('Invalid Greenhouse payload')
    all.push(...data.jobs)
  } else if (source.provider === 'linkedin') {
    const html = await getHtml(source.url, fetcher)
    all.push(...parseLinkedIn(html))
  } else if (source.provider === 'weworkremotely') {
    const xml = await getHtml(source.url, fetcher)
    all.push(...parseWwr(xml))
  } else if (source.provider === 'toptalent') {
    const html = await getHtml(source.url, fetcher)
    all.push(...parseToptalent(html))
  } else if (source.provider === 'remotive') {
    const data = await getJson(source.url, fetcher)
    if (Array.isArray(data.jobs)) {
      for (const job of data.jobs) {
        all.push({
          id: String(job.id),
          title: job.title,
          company: job.company_name,
          hostedUrl: job.url,
          location: { name: job.candidate_required_location || 'Uzaktan' },
          workplaceType: 'remote',
          categories: { location: job.candidate_required_location, commitment: 'Internship' }
        })
      }
    }
  } else if (source.provider === 'kariyer') {
    try {
      const html = await getHtml(source.url, fetcher)
      all.push(...parseKariyer(html))
    } catch {
      // Kariyer.net anti-bot protection may return 403; fallback keeps existing records
    }
  }

  const result = new Map<string, ImportedJob>()
  for (const raw of all) {
    const job = normalizeJob(raw, source, now)
    if (job) result.set(job.source_key, job)
    else if (isInternship(text(raw.text || raw.title), raw.categories?.commitment)) {
      if (source.provider === 'lever' || source.provider === 'greenhouse') {
        throw new Error('Invalid internship record; existing records preserved')
      }
    }
  }
  return [...result.values()]
}
