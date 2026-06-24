import type { Product } from "@/types/product";
import {
  DRINKS_DEFAULTS,
  OTHER_DEFAULTS,
  OTHER_TYPES,
  SHARED_KEYS,
} from "@/lib/summary/expenseDefaults";

export type ExpenseLineItem = {
  name?: string;
  daily: number;
  total: number;
  _dk: string;
  _tkey?: string;
};

export function loadDrinksFromStorage(): Record<string, Record<string, unknown>> {
  try {
    const saved = JSON.parse(localStorage.getItem("drinksConfig") || "{}") as Record<
      string,
      Record<string, unknown>
    >;
    return Object.fromEntries(
      Object.entries(DRINKS_DEFAULTS).map(([k, def]) => {
        const s = { ...(saved[k] || {}) };
        if ("sugar" in s && !("sugarType" in s)) {
          s.sugarType = s.sugar ? "cukier" : null;
          delete s.sugar;
        }
        return [k, { ...def, ...s }];
      }),
    );
  } catch {
    return { ...DRINKS_DEFAULTS };
  }
}

export function loadOtherExpensesFromStorage(): Record<string, Record<string, unknown>> {
  try {
    const saved = JSON.parse(localStorage.getItem("otherExpenses") || "{}") as Record<
      string,
      Record<string, unknown>
    >;
    return Object.fromEntries(
      OTHER_TYPES.map((ot) => [ot.key, { ...OTHER_DEFAULTS[ot.key], ...(saved[ot.key] || {}) }]),
    );
  } catch {
    return { ...OTHER_DEFAULTS };
  }
}

export function resolveSugarPrices(productList: Product[] = []) {
  const cukierStored = localStorage.getItem("drinksCukierPrice");
  const slodzikStored = localStorage.getItem("drinksSlodzikPrice");
  const cukierProduct = productList.find((p) => /cukier/i.test(p.name) && p.unit === "g");
  const slodzikProduct = productList.find((p) => /słodzik/i.test(p.name) && p.unit === "g");
  const effCukierPrice =
    cukierStored !== null
      ? parseFloat(cukierStored)
      : cukierProduct
        ? cukierProduct.price * 10
        : 3.5;
  const effSlodzikPrice =
    slodzikStored !== null
      ? parseFloat(slodzikStored)
      : slodzikProduct
        ? slodzikProduct.price * 10
        : 15;
  return { effCukierPrice, effSlodzikPrice };
}

/** Same totals as DrinksCard enabled tiles + Summary pie chart extras. */
export function computeExpenseItems(
  days: number,
  drinks: Record<string, Record<string, unknown>>,
  otherExpenses: Record<string, Record<string, unknown>>,
  effCukierPrice: number,
  effSlodzikPrice: number,
): ExpenseLineItem[] {
  const n = (v: unknown) => parseFloat(String(v)) || 0;
  const list: ExpenseLineItem[] = [];
  const priceForType = (t: string) => (3 / 1000) * (t === "cukier" ? effCukierPrice : effSlodzikPrice);
  const d = drinks;

  const kawa = d.kawa;
  if (kawa?.enabled) {
    const gPerDay = n(kawa.cupsPerDay) * n(kawa.spoonsPerCup) * 3;
    const daily = (gPerDay / Math.max(1, n(kawa.pkgG))) * n(kawa.pkgPrice);
    list.push({ daily, total: daily * days, _dk: "kawa" });
    if (kawa.sugarType) {
      const sd = n(kawa.cupsPerDay) * n(kawa.sugarSpoons) * priceForType(String(kawa.sugarType));
      list.push({ daily: sd, total: sd * days, _dk: "kawa" });
    }
    if (kawa.milkType && n(kawa.milkPkgMl) > 0) {
      const md =
        (n(kawa.cupsPerDay) * n(kawa.milkMlPerCup)) / n(kawa.milkPkgMl) * n(kawa.milkPrice);
      list.push({ daily: md, total: md * days, _dk: "kawa" });
    }
  }

  const herbata = d.herbata;
  if (herbata?.enabled) {
    const daily =
      (n(herbata.cupsPerDay) / Math.max(1, n(herbata.sachetPerPkg))) * n(herbata.pkgPrice);
    list.push({ daily, total: daily * days, _dk: "herbata" });
    if (herbata.sugarType) {
      const sd =
        n(herbata.cupsPerDay) * n(herbata.sugarSpoons) * priceForType(String(herbata.sugarType));
      list.push({ daily: sd, total: sd * days, _dk: "herbata" });
    }
    if (herbata.milkType && n(herbata.milkPkgMl) > 0) {
      const md =
        (n(herbata.cupsPerDay) * n(herbata.milkMlPerCup)) /
        n(herbata.milkPkgMl) *
        n(herbata.milkPrice);
      list.push({ daily: md, total: md * days, _dk: "herbata" });
    }
  }

  if (d.napoje?.enabled) {
    const daily =
      (n(d.napoje.litersPerDay) / Math.max(0.001, n(d.napoje.pkgL))) * n(d.napoje.pkgPrice);
    list.push({ daily, total: daily * days, _dk: "napoje" });
  }
  if (d.woda?.enabled) {
    const daily = (n(d.woda.litersPerDay) / Math.max(0.001, n(d.woda.pkgL))) * n(d.woda.pkgPrice);
    list.push({ daily, total: daily * days, _dk: "woda" });
  }
  if (d.sodaStream?.enabled) {
    const syrupDaily =
      n(d.sodaStream.litersPerDay) *
      (n(d.sodaStream.mlPer1L) / Math.max(1, n(d.sodaStream.syrupMl))) *
      n(d.sodaStream.syrupPrice);
    const cylDaily =
      n(d.sodaStream.cylinderDays) > 0
        ? n(d.sodaStream.cylinderCost) / n(d.sodaStream.cylinderDays)
        : 0;
    const daily = syrupDaily + cylDaily;
    list.push({ daily, total: daily * days, _dk: "sodaStream" });
  }

  OTHER_TYPES.forEach((ot) => {
    const o = otherExpenses[ot.key];
    if (!o?.enabled) return;
    const nn = (v: unknown) => Math.min(99999, parseFloat(String(v)) || 0);
    let daily = 0;

    if (ot.key === "papier") {
      daily = (nn(o.dailyRolls) / Math.max(1, nn(o.rollsPerPkg))) * nn(o.pkgPrice);
    } else if (ot.key === "pranie") {
      const washesPerDay = nn(o.washesPerWeek) / 7;
      let det = 0;
      if (o.detergentType === "proszek") {
        det =
          (nn(o.proszekPerWash) / Math.max(1, nn(o.proszekPkgKg) * 1000)) * nn(o.proszekPkgPrice);
      } else if (o.detergentType === "plyn") {
        det = (nn(o.plynPerWash) / Math.max(1, nn(o.plynPkgL) * 1000)) * nn(o.plynPkgPrice);
      } else {
        det = nn(o.kapsulkiPkgPrice) / Math.max(1, nn(o.kapsulkiPerPkg));
      }
      let plu = 0;
      if (o.plukanie) {
        plu =
          (nn(o.plukaniePerWash) / Math.max(1, nn(o.plukanieL) * 1000)) * nn(o.plukaniePkgPrice);
      }
      daily = (det + plu) * washesPerDay;
    } else if (ot.key === "sprzatan") {
      const bagDaily =
        (nn(o.bagsPerWeek) / 7) * (nn(o.bagsPkgPrice) / Math.max(1, nn(o.bagsPerPkg)));
      const cleaningItems = Array.isArray(o.cleaningItems) ? o.cleaningItems : [];
      const cleanDaily = cleaningItems.reduce((s, ci) => {
        const row = ci as Record<string, unknown>;
        return s + (nn(row.perMonth) * nn(row.pkgPrice)) / 30;
      }, 0);
      daily = bagDaily + cleanDaily;
    } else if (ot.key === "higiena") {
      const h = o;
      daily += (nn(h.zbRazDzien) * nn(h.zbPastaG) / Math.max(1, nn(h.zbTubkaMl))) * nn(h.zbTubkaPrice);
      daily += nn(h.zbSzczetokaPrice) / 90;
      const wlPerDay = nn(h.wlRazW) / 7;
      if (h.wlSzampon) {
        daily +=
          wlPerDay * ((nn(h.wlSzamponWyc) * 5) / Math.max(1, nn(h.wlSzamponMl))) * nn(h.wlSzamponPrice);
      }
      if (h.wlOdzywka) {
        daily +=
          wlPerDay *
          ((nn(h.wlOdzywkaWyc) * 5) / Math.max(1, nn(h.wlOdzywkaMl))) *
          nn(h.wlOdzywkaPrice);
      }
      const kapPerDay = nn(h.kapRazW) / 7;
      if (h.kapZel) {
        daily += kapPerDay * ((nn(h.kapZelWyc) * 5) / Math.max(1, nn(h.kapZelMl))) * nn(h.kapZelPrice);
      }
      if (h.kapMydlo) {
        daily += kapPerDay * (5 / Math.max(1, nn(h.kapMydloG))) * nn(h.kapMydloPrice);
      }
      daily +=
        (nn(h.papierDailyRolls) / Math.max(1, nn(h.papierRollsPerPkg))) * nn(h.papierPkgPrice);
      const inneItems = Array.isArray(h.inneItems) ? h.inneItems : [];
      inneItems.forEach((ci) => {
        const row = ci as Record<string, unknown>;
        daily += (n(row.perMonth) * n(row.pkgPrice)) / 30;
      });
    } else if (ot.key === "zmywanie") {
      if (o.useReczne) {
        const dur = n(o.pkgDuration) * (o.durationUnit === "miesiace" ? 30 : 1);
        daily += n(o.pkgPrice) / Math.max(1, dur);
      }
      if (o.useZmywarka) {
        daily += (n(o.usesPerWeek) / 7) * (n(o.kapsulkiPkgPrice) / Math.max(1, n(o.kapsPerPkg)));
      }
    } else if (ot.key === "zwierze") {
      if (o.suchaE) daily += (n(o.suchaG) / Math.max(1, n(o.suchaPkgG))) * n(o.suchaPrice);
      if (o.mokraE) daily += n(o.mokraSzt) * n(o.mokraPrice);
      if (o.zwierekE) {
        daily +=
          ((n(o.zwierekL) / Math.max(1, n(o.zwierekPkgL))) * n(o.zwierekPrice)) /
          Math.max(1, n(o.zwierekDni));
      }
      if (o.wetE) daily += n(o.wet) / 30;
      if (o.pielegnacjaE) daily += n(o.pielegnacja) / 30;
      if (o.akcesoriaE) daily += n(o.akcesoria) / 30;
      const extraItems = Array.isArray(o.extraItems) ? o.extraItems : [];
      extraItems.forEach((ci) => {
        const row = ci as Record<string, unknown>;
        daily += n(row.price) / 30;
      });
    } else if (ot.key === "dziecko") {
      (
        [
          ["przedszkole", "przedszkoleE"],
          ["obiad", "obiadE"],
          ["zajecia", "zajeciaE"],
          ["korepetycje", "korepetycjeE"],
          ["materialy", "materialyE"],
          ["dojazdy", "dojazdyE"],
          ["odziez", "odziezdE"],
          ["kieszonkowe", "kieszonkoweE"],
          ["zabawki", "zabawkiE"],
          ["kosmetyki", "kosmetykiE"],
        ] as const
      ).forEach(([k, e]) => {
        if (o[e]) daily += n(o[k]) / 30;
      });
      if (o.pieluchyEnabled) {
        daily +=
          (n(o.pieluchyPerDay) / Math.max(1, n(o.pieluchyPerPkg))) * n(o.pieluchyPrice);
      }
      if (o.mlekoEnabled) {
        daily += (n(o.mlekoPerDay) / Math.max(1, n(o.mlekoPkgScoops))) * n(o.mlekoPrice);
      }
      const extraItems = Array.isArray(o.extraItems) ? o.extraItems : [];
      extraItems.forEach((ci) => {
        const row = ci as Record<string, unknown>;
        daily += n(row.price) / 30;
      });
    } else if (ot.key === "lekarze") {
      const wizD = n(o.wizyty) / 30;
      const lekD = n(o.leki) / 30;
      if (wizD > 0) list.push({ daily: wizD, total: wizD * days, _dk: "lekarze" });
      if (lekD > 0) list.push({ daily: lekD, total: lekD * days, _dk: "lekarze" });
      return;
    } else if (ot.key === "biurowe") {
      if (o.papierA4E) daily += n(o.papierA4) / 30;
      if (o.tuszE) daily += n(o.tusz) / 30;
      if (o.notatnikE) daily += n(o.notatnik) / 30;
      if (o.dlugopisyE) daily += n(o.dlugopisy) / 30;
      const extraItems = Array.isArray(o.extraItems) ? o.extraItems : [];
      extraItems.forEach((ci) => {
        const row = ci as Record<string, unknown>;
        daily += n(row.price) / 30;
      });
    } else if (ot.key === "paliwo") {
      daily = (n(o.kmPerDay) / 100) * n(o.consumption) * n(o.fuelPrice);
    } else if (ot.key === "media") {
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

function expenseMemberMultiplier(key: string, includedMemberCount: number) {
  if (SHARED_KEYS.has(key)) return 1;
  return Math.max(1, includedMemberCount);
}

export function sumEnabledExpenses(
  days: number,
  productList: Product[] = [],
  includedMemberCount = 1,
) {
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
