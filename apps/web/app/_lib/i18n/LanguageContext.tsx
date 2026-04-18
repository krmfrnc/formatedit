'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import trDict from '../../locales/tr.json';
import enDict from '../../locales/en.json';

type Dictionary = typeof trDict;

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  dict: Dictionary;
}

const dictionaries: Record<string, Dictionary> = {
  tr: trDict,
  en: enDict as Dictionary,
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'tr',
  setLanguage: () => {},
  dict: trDict,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('tr');

  useEffect(() => {
    // Client-side execution: Try to get from localStorage first
    const stored = window.localStorage.getItem('formatedit-lang-preference');
    if (stored && dictionaries[stored]) {
      setLanguageState(stored);
      document.documentElement.lang = stored;
    } else {
      // Very basic browser detection
      const browserLang = navigator.language.startsWith('tr') ? 'tr' : 'en';
      setLanguageState(browserLang);
      document.documentElement.lang = browserLang;
    }
  }, []);

  const setLanguage = (lang: string) => {
    if (dictionaries[lang]) {
      setLanguageState(lang);
      window.localStorage.setItem('formatedit-lang-preference', lang);
      document.documentElement.lang = lang;
    }
  };

  const dict = dictionaries[language] || trDict;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dict }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
