import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Stores CV file in Supabase Storage so users don't re-upload every time
export function useCvStore() {
  const { user } = useAuth()
  const [storedCv, setStoredCv] = useState(null) // { name, path, url }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    // Check localStorage for cached CV info
    const cached = localStorage.getItem(`fitscore_cv_${user.id}`)
    if (cached) {
      try { setStoredCv(JSON.parse(cached)) } catch {}
    }
    setLoading(false)
  }, [user])

  const uploadCv = async (file) => {
    if (!user) return null
    try {
      const buffer = await file.arrayBuffer()
      const path = `${user.id}/cv_${Date.now()}_${file.name}`
      const { data, error } = await supabase.storage
        .from('cvs').upload(path, buffer, { contentType: file.type, upsert: true })
      if (error) throw error

      const { data: urlData } = supabase.storage.from('cvs').getPublicUrl(path)
      const cvInfo = { name: file.name, path, url: urlData?.publicUrl || null, size: file.size, type: file.type }
      localStorage.setItem(`fitscore_cv_${user.id}`, JSON.stringify(cvInfo))
      setStoredCv(cvInfo)
      return cvInfo
    } catch (e) {
      console.error('CV upload error:', e.message)
      return null
    }
  }

  const clearCv = () => {
    if (user) localStorage.removeItem(`fitscore_cv_${user.id}`)
    setStoredCv(null)
  }

  return { storedCv, loading, uploadCv, clearCv }
}
