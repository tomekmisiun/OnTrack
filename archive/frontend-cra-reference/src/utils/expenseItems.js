import { OTHER_TYPES, OTHER_DEFAULTS, DRINKS_DEFAULTS, SHARED_KEYS } from '../components/DrinksCard';

export function loadDrinksFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('drinksConfig') || '{}');
    return Object.fromEntries(Object.entries(DRINKS_DEFAULTS).map(([k, def]) => {
      const s = { ...(saved[k] || {}) };
      if ('sugar' in s && !('sugarType' in s)) { s.sugarType = s.sugar ? 'cukier' : null; delete s.sugar; }
      return [k, { ...def, ...s }];
    }));
  } catch {
    return { ...DRINKS_DEFAULTS };
  }
}

export function loadOtherExpensesFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('otherExpenses') || '{}');
    return Object.fromEntries(OTHER_TYPES.map(ot => [ot.key, { ...OTHER_DEFAULTS[ot.key], ...(saved[ot.key] || {}) }]));
  } catch {
    return { ...OTHER_DEFAULTS };
  }
}

export function resolveSugarPrices(productList = []) {
  const cukierStored = localStorage.getItem('drinksCukierPrice');
  const slodzikStored = localStorage.getItem('drinksSlodzikPrice');
  const cukierProduct = productList.find(p => /cukier/i.test(p.name) && p.unit === 'g');
  const slodzikProduct = productList.find(p => /słodzik/i.test(p.name) && p.unit === 'g');
  const effCukierPrice = cukierStored !== null ? parseFloat(cukierStored) : (cukierProduct ? cukierProduct.price * 10 : 3.5);
  const effSlodzikPrice = slodzikStored !== null ? parseFloat(slodzikStored) : (slodzikProduct ? slodzikProduct.price * 10 : 15);
  return { effCukierPrice, effSlodzikPrice };
}

/** Same totals as DrinksCard enabled tiles + Summary pie chart extras. */
export function computeExpenseItems(days, drinks, otherExpenses, effCukierPrice, effSlodzikPrice) {
  const n = (v) => parseFloat(v) || 0;
  const list = [];
  const priceForType = (t) => (3 / 1000) * (t === 'cukier' ? effCukierPrice : effSlodzikPrice);
  const d = drinks;

  if (d.kawa?.enabled) {
    const gPerDay = n(d.kawa.cupsPerDay) * n(d.kawa.spoonsPerCup) * 3;
    const daily = (gPerDay / Math.max(1, n(d.kawa.pkgG))) * n(d.kawa.pkgPrice);
    list.push({ daily, total: daily * days, _dk: 'kawa' });
    if (d.kawa.sugarType) {
      const sd = n(d.kawa.cupsPerDay) * n(d.kawa.sugarSpoons) * priceForType(d.kawa.sugarType);
      list.push({ daily: sd, total: sd * days, _dk: 'kawa' });
    }
    if (d.kawa.milkType && n(d.kawa.milkPkgMl) > 0) {
      const md = n(d.kawa.cupsPerDay) * n(d.kawa.milkMlPerCup) / n(d.kawa.milkPkgMl) * n(d.kawa.milkPrice);
      list.push({ daily: md, total: md * days, _dk: 'kawa' });
    }
  }
  if (d.herbata?.enabled) {
    const daily = (n(d.herbata.cupsPerDay) / Math.max(1, n(d.herbata.sachetPerPkg))) * n(d.herbata.pkgPrice);
    list.push({ daily, total: daily * days, _dk: 'herbata' });
    if (d.herbata.sugarType) {
      const sd = n(d.herbata.cupsPerDay) * n(d.herbata.sugarSpoons) * priceForType(d.herbata.sugarType);
      list.push({ daily: sd, total: sd * days, _dk: 'herbata' });
    }
    if (d.herbata.milkType && n(d.herbata.milkPkgMl) > 0) {
      const md = n(d.herbata.cupsPerDay) * n(d.herbata.milkMlPerCup) / n(d.herbata.milkPkgMl) * n(d.herbata.milkPrice);
      list.push({ daily: md, total: md * days, _dk: 'herbata' });
    }
  }
  if (d.napoje?.enabled) {
    const daily = (n(d.napoje.litersPerDay) / Math.max(0.001, n(d.napoje.pkgL))) * n(d.napoje.pkgPrice);
    list.push({ daily, total: daily * days, _dk: 'napoje' });
  }
  if (d.woda?.enabled) {
    const daily = (n(d.woda.litersPerDay) / Math.max(0.001, n(d.woda.pkgL))) * n(d.woda.pkgPrice);
    list.push({ daily, total: daily * days, _dk: 'woda' });
  }
  if (d.sodaStream?.enabled) {
    const syrupDaily = n(d.sodaStream.litersPerDay) * (n(d.sodaStream.mlPer1L) / Math.max(1, n(d.sodaStream.syrupMl))) * n(d.sodaStream.syrupPrice);
    const cylDaily = n(d.sodaStream.cylinderDays) > 0 ? n(d.sodaStream.cylinderCost) / n(d.sodaStream.cylinderDays) : 0;
    const daily = syrupDaily + cylDaily;
    list.push({ daily, total: daily * days, _dk: 'sodaStream' });
  }

  OTHER_TYPES.forEach(ot => {
    const o = otherExpenses[ot.key];
    if (!o?.enabled) return;
    const nn = v => Math.min(99999, parseFloat(v) || 0);
    let daily = 0;
    if (ot.key === 'papier') {
      daily = (nn(o.dailyRolls) / Math.max(1, nn(o.rollsPerPkg))) * nn(o.pkgPrice);
    } else if (ot.key === 'pranie') {
      const washesPerDay = nn(o.washesPerWeek) / 7;
      let det = 0;
      if (o.detergentType === 'proszek') det = (nn(o.proszekPerWash) / Math.max(1, nn(o.proszekPkgKg) * 1000)) * nn(o.proszekPkgPrice);
      else if (o.detergentType === 'plyn') det = (nn(o.plynPerWash) / Math.max(1, nn(o.plynPkgL) * 1000)) * nn(o.plynPkgPrice);
      else det = nn(o.kapsulkiPkgPrice) / Math.max(1, nn(o.kapsulkiPerPkg));
      let plu = 0;
      if (o.plukanie) plu = (nn(o.plukaniePerWash) / Math.max(1, nn(o.plukanieL) * 1000)) * nn(o.plukaniePkgPrice);
      daily = (det + plu) * washesPerDay;
    } else if (ot.key === 'sprzatan') {
      const bagDaily = (nn(o.bagsPerWeek) / 7) * (nn(o.bagsPkgPrice) / Math.max(1, nn(o.bagsPerPkg)));
      const cleanDaily = (o.cleaningItems || []).reduce((s, ci) => s + (nn(ci.perMonth) * nn(ci.pkgPrice)) / 30, 0);
      daily = bagDaily + cleanDaily;
    } else if (ot.key === 'higiena') {
      const h = o;
      const nn2 = v => Math.min(99999, parseFloat(v) || 0);
      daily += (nn2(h.zbRazDzien) * nn2(h.zbPastaG) / Math.max(1, nn2(h.zbTubkaMl))) * nn2(h.zbTubkaPrice);
      daily += nn2(h.zbSzczetokaPrice) / 90;
      const wlPerDay = nn2(h.wlRazW) / 7;
      if (h.wlSzampon) daily += wlPerDay * (nn2(h.wlSzamponWyc) * 5 / Math.max(1, nn2(h.wlSzamponMl))) * nn2(h.wlSzamponPrice);
      if (h.wlOdzywka) daily += wlPerDay * (nn2(h.wlOdzywkaWyc) * 5 / Math.max(1, nn2(h.wlOdzywkaMl))) * nn2(h.wlOdzywkaPrice);
      const kapPerDay = nn2(h.kapRazW) / 7;
      if (h.kapZel) daily += kapPerDay * (nn2(h.kapZelWyc) * 5 / Math.max(1, nn2(h.kapZelMl))) * nn2(h.kapZelPrice);
      if (h.kapMydlo) daily += kapPerDay * (5 / Math.max(1, nn2(h.kapMydloG))) * nn2(h.kapMydloPrice);
      daily += (nn2(h.papierDailyRolls) / Math.max(1, nn2(h.papierRollsPerPkg))) * nn2(h.papierPkgPrice);
      (h.inneItems || []).forEach(ci => { daily += (n(ci.perMonth) * n(ci.pkgPrice)) / 30; });
    } else if (ot.key === 'zmywanie') {
      if (o.useReczne) {
        const dur = n(o.pkgDuration) * (o.durationUnit === 'miesiace' ? 30 : 1);
        daily += n(o.pkgPrice) / Math.max(1, dur);
      }
      if (o.useZmywarka) {
        daily += (n(o.usesPerWeek) / 7) * (n(o.kapsulkiPkgPrice) / Math.max(1, n(o.kapsPerPkg)));
      }
    } else if (ot.key === 'zwierze') {
      if (o.suchaE) daily += (n(o.suchaG) / Math.max(1, n(o.suchaPkgG))) * n(o.suchaPrice);
      if (o.mokraE) daily += n(o.mokraSzt) * n(o.mokraPrice);
      if (o.zwierekE) daily += (n(o.zwierekL) / Math.max(1, n(o.zwierekPkgL))) * n(o.zwierekPrice) / Math.max(1, n(o.zwierekDni));
      if (o.wetE) daily += n(o.wet) / 30;
      if (o.pielegnacjaE) daily += n(o.pielegnacja) / 30;
      if (o.akcesoriaE) daily += n(o.akcesoria) / 30;
      (o.extraItems || []).forEach(ci => { daily += n(ci.price) / 30; });
    } else if (ot.key === 'dziecko') {
      [['przedszkole', 'przedszkoleE'], ['obiad', 'obiadE'], ['zajecia', 'zajeciaE'], ['korepetycje', 'korepetycjeE'],
        ['materialy', 'materialyE'], ['dojazdy', 'dojazdyE'], ['odziez', 'odziezdE'], ['kieszonkowe', 'kieszonkoweE'], ['zabawki', 'zabawkiE'], ['kosmetyki', 'kosmetykiE']]
        .forEach(([k, e]) => { if (o[e]) daily += n(o[k]) / 30; });
      if (o.pieluchyEnabled) daily += (n(o.pieluchyPerDay) / Math.max(1, n(o.pieluchyPerPkg))) * n(o.pieluchyPrice);
      if (o.mlekoEnabled) daily += (n(o.mlekoPerDay) / Math.max(1, n(o.mlekoPkgScoops))) * n(o.mlekoPrice);
      (o.extraItems || []).forEach(ci => { daily += n(ci.price) / 30; });
    } else if (ot.key === 'lekarze') {
      const wizD = n(o.wizyty) / 30;
      const lekD = n(o.leki) / 30;
      if (wizD > 0) list.push({ daily: wizD, total: wizD * days, _dk: 'lekarze' });
      if (lekD > 0) list.push({ daily: lekD, total: lekD * days, _dk: 'lekarze' });
      return;
    } else if (ot.key === 'biurowe') {
      if (o.papierA4E) daily += n(o.papierA4) / 30;
      if (o.tuszE) daily += n(o.tusz) / 30;
      if (o.notatnikE) daily += n(o.notatnik) / 30;
      if (o.dlugopisyE) daily += n(o.dlugopisy) / 30;
      (o.extraItems || []).forEach(ci => { daily += n(ci.price) / 30; });
    } else if (ot.key === 'paliwo') {
      daily = (n(o.kmPerDay) / 100) * n(o.consumption) * n(o.fuelPrice);
    } else if (ot.key === 'media') {
      if (o.internetE) daily += n(o.internet) / 30;
      if (o.telefonE) daily += n(o.telefon) / 30;
      if (o.tvE) daily += n(o.tv) / 30;
    } else {
      daily = n(o.monthlyAmount) / 30;
    }
    list.push({ daily, total: daily * days, _dk: ot.key });
  });

  return list;
}

/** Wspólne kategorie (czynsz, prąd…) — raz na konto; reszta × liczba zaznaczonych domowników. */
function expenseMemberMultiplier(key, includedMemberCount) {
  if (SHARED_KEYS.has(key)) return 1;
  return Math.max(1, includedMemberCount);
}

export function sumEnabledExpenses(days, productList = [], includedMemberCount = 1) {
  const drinks = loadDrinksFromStorage();
  const otherExpenses = loadOtherExpensesFromStorage();
  const { effCukierPrice, effSlodzikPrice } = resolveSugarPrices(productList);
  const items = computeExpenseItems(days, drinks, otherExpenses, effCukierPrice, effSlodzikPrice);
  return items.reduce(
    (s, i) => s + i.total * expenseMemberMultiplier(i._dk, includedMemberCount),
    0,
  );
}

export const SUMMARY_MONTH_DAYS = 30;
