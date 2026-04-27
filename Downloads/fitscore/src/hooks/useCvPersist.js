import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const DB_NAME = 'fitscore_cv'
const STORE = 'cvs'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbSet(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

async function dbGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbDel(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export function useCvPersist() {
  const { user } = useAuth()
  const [cvFile, setCvFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const userId = user?.id

  // Load saved CV on mount
  useEffect(() => {
    if (!userId) { setLoading(false); return }
    (async () => {
      try {
        const stored = await dbGet(`cv_${userId}`)
        if (stored?.blob && stored?.name) {
          // Reconstruct File from stored data
          const file = new File([stored.blob], stored.name, { type: stored.type, lastModified: stored.lastModified || Date.now() })
          setCvFile(file)
        }
      } catch (e) { console.log('CV load error:', e.message) }
      setLoading(false)
    })()
  }, [userId])

  const saveCv = async (file) => {
    setCvFile(file)
    if (!userId) return
    try {
      const blob = await file.arrayBuffer().then(b => new Blob([b], { type: file.type }))
      await dbSet(`cv_${userId}`, {
        blob,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified || Date.now()
      })
    } catch (e) { console.log('CV save error:', e.message) }
  }

  const clearCv = async () => {
    setCvFile(null)
    if (userId) try { await dbDel(`cv_${userId}`) } catch {}
  }

  return { cvFile, loading, saveCv, clearCv }
}
