import { useLanguage } from '../contexts/LanguageContext';

export default function AppFooter({ className = '' }) {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const text = typeof t('login_copyright') === 'function'
    ? t('login_copyright')(year)
    : t('login_copyright');

  return (
    <footer className={`app-site-footer${className ? ` ${className}` : ''}`}>
      {text}
    </footer>
  );
}
