import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are an expert ATS (Applicant Tracking System) analyzer and career coach.
Analyze the CV against the job offer and return ONLY a valid JSON object (no markdown, no backticks, no text outside JSON):
{
  "score": <integer 0-100>,
  "verdict": "<one punchy sentence verdict, max 12 words>",
  "categories": {
    "keywords": <0-100>,
    "skills": <0-100>,
    "experience": <0-100>,
    "education": <0-100>
  },
  "found_keywords": ["keyword1", ...],
  "missing_keywords": ["keyword1", ...],
  "advice": [
    {"type": "add", "text": "..."},
    {"type": "reword", "text": "..."},
    {"type": "remove", "text": "..."}
  ]
}
Rules:
- found_keywords: max 10 important keywords from the job offer found in the CV
- missing_keywords: max 8 critical keywords from job offer NOT in CV
- advice: exactly 5 specific actionable items (mix of add/reword/remove)
- type values: "add" | "reword" | "remove"
- Score 80+ = strong ATS match. Be honest and precise.`

async function fetchJobText(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Could not fetch job page (${res.status})`)
  const html = await res.text()
  // Strip HTML tags and clean up whitespace
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (text.length < 100) throw new Error('Could not extract text from this page. Try copying the job description manually.')
  // Return first 6000 chars — enough for any job posting
  return text.slice(0, 6000)
}

async function extractCvText(base64Data, mimeType) {
  const buffer = Buffer.from(base64Data, 'base64')
  if (mimeType === 'application/pdf') {
    const result = await pdfParse(buffer)
    return result.text
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  throw new Error('Unsupported file type. Please upload a PDF or Word document.')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  try {
    const { jobUrl, cvBase64, cvMimeType } = req.body

    if (!jobUrl || !cvBase64 || !cvMimeType) {
      return res.status(400).json({ error: 'Missing jobUrl, cvBase64, or cvMimeType' })
    }

    // Fetch job text and extract CV text in parallel
    const [jobText, cvText] = await Promise.all([
      fetchJobText(jobUrl),
      extractCvText(cvBase64, cvMimeType)
    ])

    if (!cvText || cvText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract text from your CV. Make sure it is not a scanned image.' })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `JOB OFFER:\n${jobText}\n\n---\n\nCV:\n${cvText}` }]
    })

    const raw = message.content.map(b => b.text || '').join('').trim().replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(raw)

    return res.status(200).json({ success: true, analysis, jobPreview: jobText.slice(0, 200) })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || 'Analysis failed' })
  }
}
