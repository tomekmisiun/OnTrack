const CLOSE_AS_SKIP = { closeButtonAction: 'skip' };

const STEPS_PL = [
  {
    target: '.sidebar-logo',
    title: 'Witaj w OnTrack!',
    content: 'Ten krótki samouczek pokaże Ci jak korzystać z aplikacji. Możesz go pominąć lub wrócić do niego z ustawień konta.',
    placement: 'right',
    disableBeacon: true,
    ...CLOSE_AS_SKIP,
  },
  {
    target: '.sidebar-profile',
    title: 'Profile',
    content: 'Tu wybierasz aktywny profil. Możesz dodać osoby z domowników, każdy ma swój plan posiłków, ale mogą dzielić te same produkty i przepisy.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
  },
  {
    target: '[data-tour="tab-macro"]',
    title: 'Kalkulator Makro',
    content: 'Wpisz swoje dane (wzrost, waga, wiek, aktywność) aby obliczyć dzienne zapotrzebowanie kaloryczne i makroskładniki. Wyniki zapisują się do profilu i możesz je wyeksportować jako Kartę Makro.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'macro',
  },
  {
    target: '[data-tour="tab-calendar"]',
    title: 'Planer posiłków',
    content: 'Główny widok, kalendarz tygodniowy. Przeciągnij przepis z listy po prawej na wybrany dzień, aby zaplanować posiłek.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'calendar',
  },
  {
    target: '[data-tour="tab-schedule"]',
    title: 'Rozkład dnia',
    content: 'Tygodniowa siatka godzin dla każdego profilu. Przeciągnij po komórkach w jednym dniu, wpisz nazwę zajęcia (np. praca, siłownia) — kliknij blok, aby go usunąć. Wypełniony plan lub pusty szablon możesz wydrukować z zakładki Eksport.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'schedule',
  },
  {
    target: '[data-tour="tab-recipes"]',
    title: 'Przepisy',
    content: 'Lista Twoich przepisów z kosztami i makro. Kliknij przepis aby rozwinąć składniki, kliknięcie w nazwę, ilość lub makro otwiera edycję.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'recipes',
  },
  {
    target: '[data-tour="tab-products"]',
    title: 'Produkty',
    content: 'Baza produktów z cenami i wartościami odżywczymi. Kliknij dowolny produkt na liście aby edytować jego dane - nazwę, cenę, gramaturę czy makro.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'products',
  },
  {
    target: '[data-tour="tab-summary"]',
    title: 'Wydatki',
    content: 'Podsumowanie kosztów jedzenia z zaplanowanych posiłków i wydatków stałych. Zaznacz kategorie które chcesz śledzić (czynsz, prąd, gaz...) i uzupełnij je raz, aplikacja będzie automatycznie wyliczać ich udział w każdym okresie.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'summary',
  },
  {
    target: '[data-tour="tab-export"]',
    title: 'Eksport',
    content: 'Generuj gotowe dokumenty do wydruku: podsumowanie wydatków, kartę makro, kalendarz posiłków, rozkład dnia, składniki przepisu lub listę zakupów z zaznaczonych dni.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'export',
  },
  {
    target: '.sidebar-footer',
    title: 'Konto i ustawienia',
    content: 'Z poziomu ustawień konta możesz wrócić do tego samouczka w dowolnym momencie. Powodzenia!',
    placement: 'right',
    ...CLOSE_AS_SKIP,
  },
];

const STEPS_EN = [
  {
    target: '.sidebar-logo',
    title: 'Welcome to OnTrack!',
    content: 'This short tutorial will show you how to use the app. You can skip it or come back to it any time from your account settings.',
    placement: 'right',
    disableBeacon: true,
    ...CLOSE_AS_SKIP,
  },
  {
    target: '.sidebar-profile',
    title: 'Profiles',
    content: 'Select the active profile here. You can add household members — each has their own meal plan, but they share the same products and recipes.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
  },
  {
    target: '[data-tour="tab-macro"]',
    title: 'Macro Calculator',
    content: 'Enter your details (height, weight, age, activity level) to calculate your daily calorie needs and macros. Results are saved to your profile and can be exported as a Macro Card.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'macro',
  },
  {
    target: '[data-tour="tab-calendar"]',
    title: 'Meal Planner',
    content: 'The main view — a weekly calendar. Drag a recipe from the list on the right onto any day to plan a meal.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'calendar',
  },
  {
    target: '[data-tour="tab-schedule"]',
    title: 'Daily schedule',
    content: 'A weekly hour grid for each profile. Drag across cells on one day, enter an activity name (e.g. work, gym) — click a block to remove it. Print a filled plan or blank template from the Export tab.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'schedule',
  },
  {
    target: '[data-tour="tab-recipes"]',
    title: 'Recipes',
    content: 'Your recipe list with costs and macros. Click a recipe to expand its ingredients; click any name, quantity or macro value to edit it.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'recipes',
  },
  {
    target: '[data-tour="tab-products"]',
    title: 'Products',
    content: 'Your product database with prices and nutritional values. Click any product in the list to edit its name, price, weight or macros.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'products',
  },
  {
    target: '[data-tour="tab-summary"]',
    title: 'Expenses',
    content: 'A summary of food costs from planned meals and fixed expenses. Select the categories you want to track (rent, electricity, gas…), fill them in once, and the app will automatically calculate their share for each period.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'summary',
  },
  {
    target: '[data-tour="tab-export"]',
    title: 'Export',
    content: 'Generate print-ready documents: expense summary, macro card, meal calendar, daily schedule, recipe ingredients or a shopping list from selected days.',
    placement: 'right',
    ...CLOSE_AS_SKIP,
    gotoTab: 'export',
  },
  {
    target: '.sidebar-footer',
    title: 'Account & Settings',
    content: 'From your account settings you can come back to this tutorial at any time. Good luck!',
    placement: 'right',
    ...CLOSE_AS_SKIP,
  },
];

export const getTourSteps = (lang) => lang === 'en' ? STEPS_EN : STEPS_PL;

export const getTourLocale = (lang) => lang === 'en'
  ? { back: 'Back', close: 'Close', last: 'Finish', next: 'Next', open: 'Open', skip: 'Skip' }
  : { back: 'Wstecz', close: 'Zamknij', last: 'Zakończ', next: 'Dalej', open: 'Otwórz', skip: 'Pomiń' };

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
  beaconInner: {
    backgroundColor: '#0d9488',
  },
  beaconOuter: {
    borderColor: '#0d9488',
    backgroundColor: 'rgba(13,148,136,0.2)',
  },
};
