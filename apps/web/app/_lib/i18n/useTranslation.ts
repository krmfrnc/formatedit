'use client';

import { useLanguage } from './LanguageContext';

type NestedKeys<T> = {
  [K in keyof T & (string | number)]: T[K] extends Record<string, any>
    ? `${K}.${NestedKeys<T[K]>}`
    : `${K}`;
}[keyof T & (string | number)];

export function useTranslation() {
  const { dict, language } = useLanguage();

  function t(key: NestedKeys<typeof dict> | (string & {})): string {
    const keys = key.split('.');
    let value: any = dict;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // return key if translation is missing
      }
    }
    
    return typeof value === 'string' ? value : key;
  }

  return { t, language };
}
