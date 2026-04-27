import { createClient } from "@supabase/supabase-js"
import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'
import crypto from 'crypto'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are an ATS specialist, recruiter, and career coach with 15+ years of experience. You run DETERMINISTIC analyses — same CV + same job MUST always yield the same scores.

Apply this RIGID scoring rubric exactly:

KEYWORD MATCH SCORE (0-100):
- Extract ALL technical skills, tools, methodologies, certifications, and domain terms from the job offer (the "required keyword set")
- Count how many appear VERBATIM (case-insensitive) in the CV
- Score = (matched_count / total_required_count) * 100, rounded to nearest integer

REQUIREMENTS MATCH SCORE (0-100):
- Identify ALL hard requirements (years of experience, education, certifications, language fluency, location, work authorization)
- For each, score 100 if met, 50 if partially met, 0 if absent
- Score = average of all hard requirements

OVERALL VERDICT:
- "likely_passed" if BOTH keyword_match.score >= 70 AND requirements_check.score >= 70 AND no critical_gaps
- "borderline" if keyword_match.score >= 50 AND requirements_check.score >= 50
- "likely_filtered" otherwise

MATCH PROBABILITY (0-100):
- Formula: (display_score * 0.5) + (requirements_score * 0.5) - (10 * critical_gaps_count), bounded 0-100

SENIORITY ALIGNMENT:
- Extract candidate_level from CV: count years of relevant experience + assess role progression
- candidate_level values: "intern" | "junior" (0-2y) | "mid" (3-5y) | "senior" (6-9y) | "lead" (8-12y, with leadership) | "staff_principal" (10+y, scope) | "executive" (director+)
- Extract job_level from job offer same way (look at title + required years + responsibilities)
- alignment values:
  - "right_level" — same level
  - "stretch" — job is 1 level above candidate (worth applying, ambitious fit)
  - "reach" — job is 2+ levels above (apply only with strong edge cases)
  - "below_level" — candidate is 1+ levels above job (likely overqualified, flight risk)
  - "pivot" — different career track entirely (e.g. IC vs management, different domain)

Return ONLY a JSON object — no markdown, no preamble:

{
  "job_context": {
    "title": "<exact job title>",
    "company": "<company name or 'Not specified'>",
    "location": "<city, country, or 'Remote' or 'Not specified'>",
    "work_mode": "<remote | hybrid | onsite | unknown>",
    "contract_type": "<CDI | CDD | freelance | internship | apprenticeship | temp | unknown>",
    "salary_range": "<exact salary with currency, or 'Not specified'>",
    "experience_required": "<e.g. '3-5 years' or 'Not specified'>",
    "posted_date": "<date or 'Unknown'>",
    "languages_required": ["language1"]
  },
  "job_summary": "<2 sentences max>",
  "match_probability": <integer 0-100>,
  "match_reasoning": "<one sentence>",
  "seniority": {
    "candidate_level": "<intern|junior|mid|senior|lead|staff_principal|executive>",
    "job_level": "<intern|junior|mid|senior|lead|staff_principal|executive>",
    "alignment": "<right_level|stretch|reach|below_level|pivot>",
    "alignment_label": "<2-3 word summary, e.g. 'Right level' or 'Slight stretch'>",
    "alignment_reason": "<one sentence explaining the verdict>",
    "candidate_years": <number — total years of relevant experience>,
    "job_years_required": <number — years required by the role>
  },
  "red_flags": ["<posting red flag if any, max 3>"],
  "salary_assessment": {
    "specified": <true|false>,
    "assessment": "<below_market | market | above_market | unknown | not_specified>",
    "comment": "<brief>"
  },
  "verdict": "<one sentence verdict, max 12 words>",
  "keyword_match": {
    "score": <0-100>,
    "found": ["max 10 keywords found verbatim in CV"],
    "missing_required": ["max 6 critical missing keywords"],
    "missing_nice": ["max 4 nice-to-have missing"]
  },
  "requirements_check": {
    "score": <0-100>,
    "met": ["max 5 requirements met"],
    "unmet": ["max 4 requirements not met"]
  },
  "format_warnings": ["<max 3, empty if clean>"],
  "critical_gaps": ["<max 3, empty if none>"],
  "quick_wins": ["<exactly 4 specific copy-paste-ready fixes>"],
  "overall_verdict": "<likely_filtered | borderline | likely_passed>",
  "overall_reason": "<one sentence>",
  "interview_prep": {
    "likely_questions": [
      "<5 specific interview questions tailored to THIS role + THIS candidate's CV gaps. Not generic ('Tell me about yourself'). Be specific — reference actual technologies, gaps, or experience from CV/job. E.g. 'How would you handle the React migration mentioned in the JD given your Vue background?'>"
    ],
    "your_edges": [
      "<3 things from candidate CV that EXCEED what the role requires. These are selling points to lean on in interview. Each: one concrete sentence quoting CV evidence.>"
    ],
    "weak_spots": [
      "<3 areas where candidate will be challenged in interview. Each item: one object {area: '<weak area>', prep_tip: '<concrete prep advice, 1 sentence>'}>"
    ],
    "salary_negotiation_hint": "<one sentence strategic advice based on salary range + candidate level. If salary not specified, advise asking range early.>",
    "show_prep": <boolean — true if display_score >= 50, else false>
  }
}

CRITICAL: Apply the rubric mechanically. Do not introduce subjective judgment. Same input = same output.

For interview_prep:
- likely_questions: think like a real hiring manager. Reference specific tech/gaps/CV items by name.
- your_edges: only include if genuinely above requirement. If candidate is junior for the role, this array can be smaller or focus on transferable strengths.
- weak_spots: be honest. Each weak spot must have a concrete prep_tip the candidate can act on.
- show_prep should be true if display_score >= 50 (worth interviewing for), else false.`

async function fetchJobText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }
  })
  if (!res.ok) throw new Error(`Could not fetch job page (${res.status}). Try Indeed or Welcome to the Jungle instead.`)
  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ').trim()
  if (text.length < 100) throw new Error('Could not extract text from this page. Try Indeed or Welcome to the Jungle instead.')
  return text.slice(0, 6000)
}

async function extractCvText(base64Data, mimeType) {
  const buffer = Buffer.from(base64Data, 'base64')
  if (mimeType === 'application/pdf') return (await pdfParse(buffer)).text
  if (mimeType.includes('word') || mimeType.includes('officedocument')) return (await mammoth.extractRawText({ buffer })).value
  throw new Error('Unsupported file type. Please upload a PDF or Word document.')
}

function hashContent(...parts) {
  return crypto.createHash('sha256').update(parts.join('||')).digest('hex')
}

// RATE LIMIT: max 10 analyses per user per hour, max 30 per day
async function checkRateLimit(supabase, userId) {
  if (!supabase || !userId) return { allowed: true }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: hourCount } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo)

  if ((hourCount ?? 0) >= 10) {
    return { allowed: false, reason: 'hourly', message: 'Hourly limit reached (10 analyses/hour). Please try again later.' }
  }

  const { count: dayCount } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo)

  if ((dayCount ?? 0) >= 30) {
    return { allowed: false, reason: 'daily', message: 'Daily limit reached (30 analyses/day). Please try again tomorrow.' }
  }

  return { allowed: true }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const { jobUrl, jobText: providedJobText, cvBase64, cvMimeType, userId, cvFileName } = req.body
    if ((!jobUrl && !providedJobText) || !cvBase64 || !cvMimeType) return res.status(400).json({ error: 'Missing required fields' })

    // Setup admin Supabase client
    let supabaseClient = null
    try {
      const url = process.env.SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) supabaseClient = createClient(url, key, { auth: { persistSession: false } })
    } catch {}

    // SECURITY: rate limit check
    if (supabaseClient && userId) {
      const rl = await checkRateLimit(supabaseClient, userId)
      if (!rl.allowed) {
        return res.status(429).json({ error: rl.message, rate_limited: true, reason: rl.reason })
      }
    }

    const [jobText, cvText] = await Promise.all([
      providedJobText ? Promise.resolve(providedJobText.slice(0, 6000)) : fetchJobText(jobUrl),
      extractCvText(cvBase64, cvMimeType)
    ])

    if (!cvText || cvText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from your CV. Make sure it is not a scanned image.' })
    }

    // CACHE: same content = same result
    const cacheKey = hashContent(cvText.slice(0, 4000), resolvedJobText.slice(0, 4000))

    if (supabaseClient && userId) {
      const { data: cached } = await supabaseClient
        .from('analyses')
        .select('result, created_at')
        .eq('user_id', userId)
        .eq('cache_key', cacheKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (cached?.result) {
        return res.status(200).json({ success: true, analysis: cached.result, cached: true })
      }
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: `JOB OFFER:\n${resolvedJobText}\n\n---\n\nCV:\n${cvText}` }]
    })

    const raw = message.content.map(b => b.text || '').join('').trim().replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(raw)
    analysis.display_score = Math.round((analysis.keyword_match.score * 0.6) + (analysis.requirements_check.score * 0.4))
    analysis.job_url = jobUrl || null
    analysis.job_source = jobUrl ? 'url' : 'pasted'
    analysis.job_title = analysis.job_context?.title || null

    // Save with cache_key
    try {
      if (supabaseClient && userId) {
        await supabaseClient.from('analyses').insert({
          user_id: userId,
          job_url: jobUrl || 'manual_paste',
          job_title: analysis.job_context?.title || null,
          score: analysis.display_score,
          result: analysis,
          cv_file_path: null,
          cv_file_name: cvFileName || null,
          cache_key: cacheKey
        })
      }
    } catch (e) { console.log('Save failed:', e.message) }

    return res.status(200).json({ success: true, analysis })
  } catch (e) {
    console.error('Handler error:', e.message)
    return res.status(500).json({ error: e.message || 'Analysis failed' })
  }
}
