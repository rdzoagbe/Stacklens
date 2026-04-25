import { useState } from 'react'

export function useAnalyze() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null })

  const analyze = async (jobUrl, cvFile) => {
    setState({ status: 'loading', data: null, error: null })
    try {
      // Read file as base64
      const cvBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(cvFile)
      })

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUrl,
          cvBase64,
          cvMimeType: cvFile.type
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

      setState({ status: 'done', data: data.analysis, jobPreview: data.jobPreview, error: null })
    } catch (e) {
      setState({ status: 'error', data: null, error: e.message })
    }
  }

  const reset = () => setState({ status: 'idle', data: null, error: null })

  return { ...state, analyze, reset }
}
