"use client";

import type { LangCode } from "@/lib/i18n/translations";
import "./privacy-modal.css";

const CONTENT = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: May 2026",
    sections: [
      {
        heading: "1. Who we are",
        text: 'Ontrack ("we", "our", "the app") is a personal meal planning and budgeting application. We are committed to protecting your personal data and being transparent about how we use it.',
      },
      {
        heading: "2. Data we collect",
        text: "You can create an account in two ways. Depending on the method, we collect:",
        list: [
          "Username and password sign-up: your chosen username, preferred language (Polish or English), and your password — stored only as a secure one-way hash; we never save or see your plain-text password",
          "Google sign-in: your email address from your Google account",
        ],
        text2:
          "We do not require an email address for username and password accounts. We do not collect payment information or use your data for advertising.",
      },
      {
        heading: "3. How we use your data",
        text: "We use your data solely to:",
        list: [
          "Create and maintain your Ontrack account",
          "Authenticate you when you sign in (username/password or Google)",
          "Associate your meal plans, recipes, and products with your account",
          "Apply your preferred language setting in the app",
        ],
        text2:
          "We do not use your data for advertising, profiling, or any automated decision-making.",
      },
      {
        heading: "4. Data sharing",
        text: "We do not sell, rent, or share your personal data with any third parties. Your data is stored on our servers and is only accessible to you.",
      },
      {
        heading: "5. Data retention",
        text: "Your data is stored for as long as your account is active. You can delete your account at any time from the account settings — this permanently deletes all your personal data, meal plans, recipes and products.",
      },
      {
        heading: "6. Cookies",
        text: "We use a single authentication token stored in your browser's local storage to keep you logged in. We do not use tracking or advertising cookies.",
      },
      {
        heading: "7. Your rights",
        text: "You have the right to:",
        list: [
          "Access your personal data",
          "Correct inaccurate data",
          "Delete your account and all associated data",
          "Object to processing of your data",
        ],
        text2: "To exercise any of these rights, please contact us.",
      },
      {
        heading: "8. Contact",
        text: "If you have any questions about this Privacy Policy or how we handle your data, please contact us at: tomek.misiun@gmail.com",
      },
    ],
  },
  pl: {
    title: "Polityka Prywatności",
    updated: "Ostatnia aktualizacja: maj 2026",
    sections: [
      {
        heading: "1. Kim jesteśmy",
        text: 'Ontrack („my", „aplikacja") to aplikacja do planowania posiłków i zarządzania budżetem. Zobowiązujemy się do ochrony Twoich danych osobowych i przejrzystości w zakresie ich używania.',
      },
      {
        heading: "2. Jakie dane zbieramy",
        text: "Konto możesz założyć na dwa sposoby. W zależności od wybranej metody zbieramy:",
        list: [
          "Rejestracja nazwą użytkownika i hasłem: wybrana nazwa użytkownika, preferowany język (polski lub angielski) oraz hasło — przechowywane wyłącznie w postaci zaszyfrowanego skrótu jednokierunkowego; nigdy nie zapisujemy hasła w formie jawnej",
          "Logowanie przez Google: adres e-mail z Twojego konta Google",
        ],
        text2:
          "Przy rejestracji nazwą użytkownika i hasłem nie wymagamy adresu e-mail. Nie zbieramy danych płatniczych ani nie wykorzystujemy Twoich danych do celów reklamowych.",
      },
      {
        heading: "3. Jak używamy Twoich danych",
        text: "Twoje dane wykorzystujemy wyłącznie w celu:",
        list: [
          "Utworzenia i utrzymania Twojego konta Ontrack",
          "Uwierzytelniania przy logowaniu (nazwa użytkownika i hasło lub Google)",
          "Powiązania Twoich planów posiłków, przepisów i produktów z kontem",
          "Zastosowania wybranego języka interfejsu aplikacji",
        ],
        text2:
          "Nie wykorzystujemy Twoich danych do celów reklamowych, profilowania ani żadnego zautomatyzowanego podejmowania decyzji.",
      },
      {
        heading: "4. Udostępnianie danych",
        text: "Nie sprzedajemy, nie wynajmujemy ani nie udostępniamy Twoich danych osobowych żadnym podmiotom trzecim. Twoje dane są przechowywane na naszych serwerach i dostępne wyłącznie dla Ciebie.",
      },
      {
        heading: "5. Czas przechowywania danych",
        text: "Twoje dane są przechowywane przez cały czas aktywności konta. Możesz usunąć swoje konto w dowolnym momencie z poziomu ustawień — spowoduje to trwałe usunięcie wszystkich Twoich danych osobowych, planów posiłków, przepisów i produktów.",
      },
      {
        heading: "6. Pliki cookie",
        text: "Używamy jednego tokenu uwierzytelniającego zapisywanego w lokalnym magazynie Twojej przeglądarki, który utrzymuje Cię zalogowanym. Nie używamy plików cookie śledzących ani reklamowych.",
      },
      {
        heading: "7. Twoje prawa",
        text: "Masz prawo do:",
        list: [
          "Dostępu do swoich danych osobowych",
          "Poprawiania nieprawidłowych danych",
          "Usunięcia konta i wszystkich powiązanych danych",
          "Sprzeciwu wobec przetwarzania Twoich danych",
        ],
        text2: "Aby skorzystać z któregokolwiek z tych praw, skontaktuj się z nami.",
      },
      {
        heading: "8. Kontakt",
        text: "Jeśli masz pytania dotyczące niniejszej Polityki Prywatności lub sposobu przetwarzania Twoich danych, skontaktuj się z nami: tomek.misiun@gmail.com",
      },
    ],
  },
} as const;

type PrivacyPolicyProps = {
  lang?: LangCode;
  onClose: () => void;
};

export function PrivacyPolicyModal({
  lang = "en",
  onClose,
}: PrivacyPolicyProps) {
  const c = CONTENT[lang] ?? CONTENT.en;

  return (
    <div className="privacy-modal-backdrop" onClick={onClose}>
      <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <div>
            <h2 className="privacy-modal-title">{c.title}</h2>
            <p className="privacy-modal-updated">{c.updated}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="privacy-modal-close"
          >
            ×
          </button>
        </div>

        <div className="privacy-modal-body dark-scroll">
          {c.sections.map((s, i) => (
            <div key={i} className="privacy-section">
              <h3 className="privacy-section-heading">{s.heading}</h3>
              <p className="privacy-section-text">{s.text}</p>
              {"list" in s && s.list && (
                <ul className="privacy-section-list">
                  {s.list.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
              {"text2" in s && s.text2 && (
                <p className="privacy-section-text privacy-section-text--tail">
                  {s.text2}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
