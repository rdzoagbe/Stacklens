/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export const LanguageContext = React.createContext({ language: 'en', setLanguage: () => {} });

export function LanguageProvider({ children }) {
  const [language, setLanguage] = React.useState(
    () => localStorage.getItem('language') || 'en'
  );
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
