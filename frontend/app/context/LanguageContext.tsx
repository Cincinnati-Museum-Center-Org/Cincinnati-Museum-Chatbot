'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language, translations, Translations, quickActionPrompts } from '../config/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  getQuickActionPrompt: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>('en');

  const t = translations[language];

  const getQuickActionPrompt = useCallback(
    (key: string) => quickActionPrompts[language][key] || '',
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getQuickActionPrompt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
