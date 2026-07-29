/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export const LanguageContext = React.createContext({ language: 'en', setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [language, setLanguage] = React.useState(() => {
    const saved = localStorage.getItem('language');
    if (saved) return saved;
    // First visit: follow the browser language when we support it (fixes
    // French visitors landing on an English site until they switch manually).
    const nav = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en').slice(0, 2).toLowerCase();
    return ['en', 'fr', 'de', 'es', 'pt'].includes(nav) ? nav : 'en';
  });
  const setAndPersist = React.useCallback((lang) => {
    localStorage.setItem('language', lang);
    setLanguage(lang);
  }, []);
  return (
    <LanguageContext.Provider value={{ language, setLanguage: setAndPersist }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return React.useContext(LanguageContext);
}
