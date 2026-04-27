import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Returns last 5 unique job URLs from analysis history
export function useJobUrlHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    (async () => {
      const { data } = await supabase
        .from('analyses')
        .select('job_url, job_title, score, result, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      // Dedupe by URL, keep most recent
      const seen = new Set()
      const unique = (data || []).filter(a => {
        if (!a.job_url || seen.has(a.job_url)) return false
        seen.add(a.job_url)
        return true
      }).slice(0, 5)
      setHistory(unique)
      setLoading(false)
    })()
  }, [user])

  return { history, loading }
}
