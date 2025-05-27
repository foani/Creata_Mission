// frontend/src/i18n/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 번역 파일들
import koTranslation from '../locales/ko.json';
import enTranslation from '../locales/en.json';
import viTranslation from '../locales/vi.json';
import jaTranslation from '../locales/ja.json';

const resources = {
  ko: {
    translation: koTranslation
  },
  en: {
    translation: enTranslation
  },
  vi: {
    translation: viTranslation
  },
  ja: {
    translation: jaTranslation
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko',
    debug: false,
    
    interpolation: {
      escapeValue: false
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

export default i18n;