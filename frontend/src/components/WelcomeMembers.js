import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import MemberToggles from './MemberToggles';
import './WelcomeMembers.css';

export default function WelcomeMembers() {
  const { t } = useLanguage();

  return (
    <div className="welcome-members">
      <MemberToggles variant="welcome" />
      <p className="welcome-members-hint">{t('welcome_members_hint')}</p>
    </div>
  );
}
