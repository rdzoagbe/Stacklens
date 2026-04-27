import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, LANGUAGES } from '../i18n/translations'

const LangContext = createContext({})

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('fitscore_lang')
    if (saved && translations[saved]) return saved
    // Detect browser language
    const browser = navigator.language?.split('-')[0]
    if (browser && translations[browser]) return browser
    return 'en'
  })

  const changeLang = (l) => {
    setLang(l)
    localStorage.setItem('fitscore_lang', l)
  }

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key

  return <LangContext.Provider value={{ lang, changeLang, t, languages: LANGUAGES }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
