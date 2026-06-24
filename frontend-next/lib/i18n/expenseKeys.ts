/**
 * Maps internal expense/drink ids (Polish, used in localStorage) to English i18n keys.
 * Internal ids must not change — they are persisted in the browser.
 */
export const EXPENSE_I18N_KEY: Record<string, string> = {
  czynsz: "exp_rent",
  prad: "exp_electricity",
  gaz_oplata: "exp_gas",
  media: "exp_utilities",
  ogrzewanie: "exp_heating",
  kredyt: "exp_loan",
  dziecko: "exp_child",
  zwierze: "exp_pet",
  lekarze: "exp_medical",
  paliwo: "exp_fuel",
  pranie: "exp_laundry",
  zmywanie: "exp_dishwashing",
  sprzatan: "exp_cleaning",
  higiena: "exp_hygiene",
  biurowe: "exp_office_supplies",
};

export const DRINK_I18N_KEY: Record<string, string> = {
  kawa: "drink_coffee",
  herbata: "drink_tea",
  napoje: "drink_soft_drinks",
  woda: "drink_water",
  sodaStream: "drink_soda_stream",
};

export function expenseI18nKey(id: string): string {
  return EXPENSE_I18N_KEY[id] ?? id;
}

export function drinkI18nKey(id: string): string {
  return DRINK_I18N_KEY[id] ?? id;
}
