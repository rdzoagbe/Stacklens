import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function useAnalyze() {
  const [state, setState] = useState({ status: 'idle', data: null, error: null })
  const { user } = useAuth()

  // jobUrl OR jobText — one must be provided
  const analyze = async (jobUrl, cvFile, jobText = null) => {
    setState({ status: 'loading', data: null, error: null })
    try {
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
          jobUrl: jobUrl || null,
          jobText: jobText || null,
          cvBase64,
          cvMimeType: cvFile.type,
          cvFileName: cvFile.name,
          userId: user?.id || null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      setState({ status: 'done', data: data.analysis, error: null })
    } catch (e) {
      setState({ status: 'error', data: null, error: e.message })
    }
  }

  const reset = () => setState({ status: 'idle', data: null, error: null })
  return { ...state, analyze, reset }
}
