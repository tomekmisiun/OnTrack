// Każdy krok może mieć pole `gotoTab` — App.js przełączy zakładkę przed wyświetleniem
export const TOUR_STEPS = [
  {
    target: '.sidebar-logo',
    title: 'Witaj w Meal Planner!',
    content: 'Ten krótki samouczek pokaże Ci jak korzystać z aplikacji. Możesz go pominąć lub wrócić do niego z ustawień konta.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '.sidebar-profile',
    title: 'Profile',
    content: 'Tu wybierasz aktywny profil. Możesz dodać osoby z domowników, każdy ma swój plan posiłków, ale mogą dzielić te same produkty i przepisy.',
    placement: 'right',
  },
  {
    target: '[data-tour="tab-macro"]',
    title: 'Kalkulator Makro',
    content: 'Wpisz swoje dane (wzrost, waga, wiek, aktywność) aby obliczyć dzienne zapotrzebowanie kaloryczne i makroskładniki. Wyniki zapisują się do profilu i możesz je wyeksportować jako Kartę Makro.',
    placement: 'right',
    gotoTab: 'macro',
  },
  {
    target: '[data-tour="tab-calendar"]',
    title: 'Planer posiłków',
    content: 'Główny widok, kalendarz tygodniowy. Przeciągnij przepis z listy po prawej na wybrany dzień, aby zaplanować posiłek.',
    placement: 'right',
    gotoTab: 'calendar',
  },
  {
    target: '[data-tour="tab-recipes"]',
    title: 'Przepisy',
    content: 'Lista Twoich przepisów z kosztami i makro. Kliknij przepis aby rozwinąć składniki, kliknięcie w nazwę, ilość lub makro otwiera edycję.',
    placement: 'right',
    gotoTab: 'recipes',
  },
  {
    target: '[data-tour="tab-products"]',
    title: 'Produkty',
    content: 'Baza produktów z cenami i wartościami odżywczymi. Kliknij dowolny produkt na liście aby edytować jego dane - nazwę, cenę, gramaturę czy makro.',
    placement: 'right',
    gotoTab: 'products',
  },
  {
    target: '[data-tour="tab-summary"]',
    title: 'Wydatki',
    content: 'Podsumowanie kosztów jedzenia z zaplanowanych posiłków i wydatków stałych. Zaznacz kategorie które chcesz śledzić (czynsz, prąd, gaz...) i uzupełnij je raz, aplikacja będzie automatycznie wyliczać ich udział w każdym okresie.',
    placement: 'right',
    gotoTab: 'summary',
  },
  {
    target: '[data-tour="tab-export"]',
    title: 'Eksport',
    content: 'Generuj gotowe dokumenty do wydruku: podsumowanie wydatków, kartę makro, kalendarz posiłków, składniki przepisu lub listę zakupów z zaznaczonych dni.',
    placement: 'right',
    gotoTab: 'export',
  },
  {
    target: '.sidebar-footer',
    title: 'Konto i ustawienia',
    content: 'Z poziomu ustawień konta możesz wrócić do tego samouczka w dowolnym momencie. Powodzenia!',
    placement: 'right',
  },
];

export const TOUR_LOCALE = {
  back: 'Wstecz',
  close: 'Zamknij',
  last: 'Zakończ',
  next: 'Dalej',
  open: 'Otwórz',
  skip: 'Pomiń',
};

export const TOUR_STYLES = {
  options: {
    primaryColor: '#0d9488',
    backgroundColor: '#111827',
    textColor: '#f1f5f9',
    arrowColor: '#111827',
    overlayColor: 'rgba(0,0,0,0.6)',
    zIndex: 9000,
  },
  tooltip: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: '16px 20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    border: '1px solid #374151',
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0d9488',
    marginBottom: 8,
  },
  tooltipContent: {
    fontSize: 13,
    lineHeight: 1.65,
    color: '#d1d5db',
    padding: '0 0 4px',
    fontWeight: 600,
  },
  tooltipFooter: {
    marginTop: 12,
  },
  buttonNext: {
    backgroundColor: '#0d9488',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 16px',
    color: '#fff',
  },
  buttonBack: {
    color: '#9ca3af',
    fontSize: 13,
    marginRight: 8,
    background: 'none',
  },
  buttonSkip: {
    color: '#6b7280',
    fontSize: 12,
  },
  buttonClose: {
    color: '#6b7280',
  },
};
