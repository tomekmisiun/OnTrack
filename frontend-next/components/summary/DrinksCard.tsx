"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode, type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { getFuelPrices } from "@/lib/api/fuel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMarketCurrency } from "@/hooks/useMarketCurrency";
import { expenseI18nKey, drinkI18nKey } from "@/lib/i18n/expenseKeys";
import {
  OTHER_TYPES,
  OTHER_DEFAULTS,
  DRINKS_DEFAULTS,
  SHARED_KEYS,
  DRINK_TYPES,
} from "@/lib/summary/expenseDefaults";
import { loadDrinksFromStorage, type ExpenseLineItem } from "@/lib/summary/expenseItems";
import type { Product } from "@/types/product";
import "@/components/summary/summary.css";

import type { TranslationKey } from "@/lib/i18n/translations";
import { tFormat, tFormatN, tString } from "@/lib/i18n/translate";

import type { DrinkKey } from "@/lib/summary/expenseDefaults";
type Tuple4 = [string, string, string, string];
type Tuple2 = [string, string];
/** Persisted localStorage config — normalize at inputs via cfgStr/cfgNum. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy localStorage JSON shape
type ConfigBucket = Record<string, any>;
interface DrinksState {
  kawa: ConfigBucket;
  herbata: ConfigBucket;
  napoje: ConfigBucket;
  woda: ConfigBucket;
  sodaStream: ConfigBucket;
}
type OtherExpensesState = Record<string, ConfigBucket>;

function cfgStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function cfgNum(val: unknown): number {
  return parseFloat(String(val)) || 0;
}

function asDrinksState(raw: Record<string, Record<string, unknown>>): DrinksState {
  return raw as unknown as DrinksState;
}

function itemList(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val) ? (val as Array<Record<string, unknown>>) : [];
}

function parsePriceInput(v: string): number | null {
  if (v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}


function FieldBox({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:10, color:'#6b7280' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>{children}</div>
    </div>
  );
}

const _inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 };
const _clamp = (v: string) => { if (v === '') return ''; const n = parseFloat(v); return isNaN(n) ? '' : String(Math.min(99999, Math.max(0, n))); };

function FI({ label, val, onChange, step = '1', max = '99999', ph = '' }: { label: ReactNode; val: unknown; onChange: (v: string) => void; step?: string; max?: string; ph?: string }) {
  return (
    <FieldBox label={label}>
      <input type="number" className="no-spin" min="0" max={max} step={step} style={_inp} placeholder={ph} value={cfgStr(val)} onChange={e=>onChange(_clamp(e.target.value))} />
    </FieldBox>
  );
}

function MI({ label, val, onChange, step = '0.01', ph = '' }: { label: ReactNode; val: unknown; onChange: (v: string) => void; step?: string; ph?: string }) {
  return (
    <FieldBox label={label}>
      <input type="number" className="no-spin" min="0" max="99999" step={step} style={_inp} placeholder={ph} value={cfgStr(val)} onChange={e=>onChange(_clamp(e.target.value))} />
    </FieldBox>
  );
}

function InnerSec({ title, children, mb = 10, flex = false }: { title: ReactNode; children: ReactNode; mb?: number; flex?: boolean }) {
  return (
    <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, marginBottom:mb, ...(flex && { display:'flex', flexDirection:'column', gap:5 }) }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: flex ? 2 : 6 }}>{title}</div>
      {children}
    </div>
  );
}

function TogBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex:1, padding:'5px 4px', border:'1px solid #374151', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
        background:active?'#1e3a3a':'transparent', color:active?'#2dd4bf':'#6b7280' }}>
      {label}
    </button>
  );
}

type DrinksCardProps = {
  days: number;
  periodLabel: string;
  productList: Product[];
  onUpdate: (items: ExpenseLineItem[]) => void;
  pieCategories?: Array<{ label: string; value: number; color: string }>;
};

function DrinksCard({ days, periodLabel: _periodLabel, productList, onUpdate, pieCategories: _pieCategories = [] }: DrinksCardProps) {
  const { t, lang } = useLanguage();
  const { label: cur } = useMarketCurrency();
  const eg = tString(t, 'eg_prefix');
  const _itemLabel = (name: string) => {
    const map: Record<string, string> = { 'Cukier': tString(t, 'dc_sugar'), 'Słodzik': tString(t, 'dc_sweetener'), 'Mleko': tString(t, 'dc_milk'), 'Śmietanka': tString(t, 'dc_cream') };
    return map[name] || name;
  };
  const [drinks, setDrinks] = useState<DrinksState>(() => asDrinksState(loadDrinksFromStorage()));
  const [expandedDrink, setExpandedDrink] = useState<DrinkKey | null>(null);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpensesState>(() => {
    try { const s = JSON.parse(localStorage.getItem('otherExpenses')||'{}') as Record<string, ConfigBucket>; return Object.fromEntries(OTHER_TYPES.map((ot) => [ot.key, { ...OTHER_DEFAULTS[ot.key], ...(s[ot.key] || {}) }])); } catch { return { ...OTHER_DEFAULTS } as OtherExpensesState; }
  });
  const [otherExpanded, setOtherExpanded] = useState<string | null>(null);
  const [fetchingFuelPrices, setFetchingFuelPrices] = useState(false);
  const [fetchFuelError, setFetchFuelError] = useState('');
  const [cukierPrice, setCukierPrice] = useState(() => { const v = localStorage.getItem('drinksCukierPrice'); return v !== null ? parseFloat(v) : null; });
  const [slodzikPrice, setSlodzikPrice] = useState(() => { const v = localStorage.getItem('drinksSlodzikPrice'); return v !== null ? parseFloat(v) : null; });

  const cukierProduct = useMemo(() => productList.find(p => /cukier/i.test(p.name) && p.unit === 'g'), [productList]);
  const slodzikProduct = useMemo(() => productList.find(p => /słodzik/i.test(p.name) && p.unit === 'g'), [productList]);
  const effCukierPrice = cukierPrice !== null ? cukierPrice : (cukierProduct ? (cukierProduct.price ?? 0) * 10 : 3.5);
  const effSlodzikPrice = slodzikPrice !== null ? slodzikPrice : (slodzikProduct ? (slodzikProduct.price ?? 0) * 10 : 15);

  const upd = (key: DrinkKey, val: Record<string, unknown>) =>
    setDrinks((d) => ({ ...d, [key]: { ...(d[key] ?? {}), ...val } }));
  const fi: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13 };
  const cl = (val: string, max: number) => { if (val === '') return ''; const n = parseFloat(val); return isNaN(n) ? '' : String(Math.min(max, Math.max(0, n))); };

  const drinkTilePreview = (key: DrinkKey) => {
    const nn = (v: unknown) => cfgNum(v);
    const pft = (sugarKind: string) => (3/1000)*(sugarKind==='cukier'?effCukierPrice:effSlodzikPrice);
    const d = drinks; let daily = 0;
    if (key==='kawa')      {
      daily=(nn(d.kawa.cupsPerDay)*nn(d.kawa.spoonsPerCup)*3/Math.max(1,nn(d.kawa.pkgG)))*nn(d.kawa.pkgPrice);
      if(d.kawa.sugarType) daily+=nn(d.kawa.cupsPerDay)*nn(d.kawa.sugarSpoons)*pft(String(d.kawa.sugarType));
      if(d.kawa.milkType && nn(d.kawa.milkPkgMl)>0) daily+=nn(d.kawa.cupsPerDay)*nn(d.kawa.milkMlPerCup)/nn(d.kawa.milkPkgMl)*nn(d.kawa.milkPrice);
    }
    else if(key==='herbata'){
      daily=(nn(d.herbata.cupsPerDay)/Math.max(1,nn(d.herbata.sachetPerPkg)))*nn(d.herbata.pkgPrice);
      if(d.herbata.sugarType) daily+=nn(d.herbata.cupsPerDay)*nn(d.herbata.sugarSpoons)*pft(String(d.herbata.sugarType));
      if(d.herbata.milkType && nn(d.herbata.milkPkgMl)>0) daily+=nn(d.herbata.cupsPerDay)*nn(d.herbata.milkMlPerCup)/nn(d.herbata.milkPkgMl)*nn(d.herbata.milkPrice);
    }
    else if(key==='napoje') { daily=(nn(d.napoje.litersPerDay)/Math.max(0.001,nn(d.napoje.pkgL)))*nn(d.napoje.pkgPrice); }
    else if(key==='woda')   { daily=(nn(d.woda.litersPerDay)/Math.max(0.001,nn(d.woda.pkgL)))*nn(d.woda.pkgPrice); }
    else if(key==='sodaStream'){
      daily = nn(d.sodaStream.litersPerDay)*(nn(d.sodaStream.mlPer1L)/Math.max(1,nn(d.sodaStream.syrupMl)))*nn(d.sodaStream.syrupPrice);
      if(nn(d.sodaStream.cylinderDays)>0) daily += nn(d.sodaStream.cylinderCost)/nn(d.sodaStream.cylinderDays);
    }
    return daily * days;
  };
  const otherTilePreview = (key: string) => {
    const o = otherExpenses[key] ?? (OTHER_DEFAULTS[key] as ConfigBucket); if (!o) return 0;
    const n2 = (v: unknown) => Math.min(99999, cfgNum(v));
    return items.filter((i) => i._dk === key).reduce((s,i)=>s+i.total,0) ||
           (n2(o.monthlyAmount)/30)*days;
  };
  const cardRef = useRef<HTMLDivElement | null>(null);

  // 1. klik → zaznacz + otwórz | 2. klik → zwiń | 3. klik → odznacz
  const updOther = (key: string, val: Record<string, unknown>) => setOtherExpenses((d) => ({ ...d, [key]: { ...d[key], ...val } }));
  const handleOtherClick = (key: string) => {
    const enabled = Boolean(otherExpenses[key]?.enabled);
    const expanded = otherExpanded === key;
    if (!enabled) { updOther(key, { enabled: true }); setOtherExpanded(key); }
    else if (expanded) { setOtherExpanded(null); }
    else { updOther(key, { enabled: false }); }
  };

  const handleTileClick = (key: DrinkKey) => {
    const enabled = Boolean(drinks[key]?.enabled);
    const expanded = expandedDrink === key;
    if (!enabled) { upd(key, { enabled: true }); setExpandedDrink(key); }
    else if (expanded) { setExpandedDrink(null); }
    else { upd(key, { enabled: false }); }
  };

  // Kliknięcie poza kartą → zwiń panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && e.target instanceof Node && !cardRef.current.contains(e.target)) {
        setExpandedDrink(null);
        setOtherExpanded(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { localStorage.setItem('drinksConfig', JSON.stringify(drinks)); }, [drinks]);
  useEffect(() => { localStorage.setItem('otherExpenses', JSON.stringify(otherExpenses)); }, [otherExpenses]);
  useEffect(() => { if (cukierPrice !== null) localStorage.setItem('drinksCukierPrice', String(cukierPrice)); else localStorage.removeItem('drinksCukierPrice'); }, [cukierPrice]);
  useEffect(() => { if (slodzikPrice !== null) localStorage.setItem('drinksSlodzikPrice', String(slodzikPrice)); else localStorage.removeItem('drinksSlodzikPrice'); }, [slodzikPrice]);

  const items = useMemo(() => {
    const n = (v: unknown) => cfgNum(v);
    const list: ExpenseLineItem[] = [];
    const priceForType = (sugarKind: string) => (3 / 1000) * (sugarKind === 'cukier' ? effCukierPrice : effSlodzikPrice);
    const d = drinks;
    if (Boolean(d.kawa.enabled)) {
      const gPerDay = n(d.kawa.cupsPerDay) * n(d.kawa.spoonsPerCup) * 3;
      const daily = (gPerDay / Math.max(1, n(d.kawa.pkgG))) * n(d.kawa.pkgPrice);
      list.push({ name: tString(t, drinkI18nKey('kawa') as TranslationKey), daily, total: daily * days, _dk: 'kawa' });
      if (d.kawa.sugarType) { const sd = n(d.kawa.cupsPerDay) * n(d.kawa.sugarSpoons) * priceForType(String(d.kawa.sugarType)); list.push({ name:`${d.kawa.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (kawa)`, daily:sd, total:sd*days, _dk:'kawa' }); }
      if (d.kawa.milkType && n(d.kawa.milkPkgMl)>0) { const md = n(d.kawa.cupsPerDay)*n(d.kawa.milkMlPerCup)/n(d.kawa.milkPkgMl)*n(d.kawa.milkPrice); list.push({ name:`${d.kawa.milkType==='mleko'?'Mleko':'Śmietanka'} (kawa)`, daily:md, total:md*days, _dk:'kawa' }); }
    }
    if (Boolean(d.herbata.enabled)) {
      const daily = (n(d.herbata.cupsPerDay) / Math.max(1, n(d.herbata.sachetPerPkg))) * n(d.herbata.pkgPrice);
      list.push({ name: tString(t, drinkI18nKey('herbata') as TranslationKey), daily, total: daily * days, _dk: 'herbata' });
      if (d.herbata.sugarType) { const sd = n(d.herbata.cupsPerDay) * n(d.herbata.sugarSpoons) * priceForType(String(d.herbata.sugarType)); list.push({ name:`${d.herbata.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (herbata)`, daily:sd, total:sd*days, _dk:'herbata' }); }
      if (d.herbata.milkType && n(d.herbata.milkPkgMl)>0) { const md = n(d.herbata.cupsPerDay)*n(d.herbata.milkMlPerCup)/n(d.herbata.milkPkgMl)*n(d.herbata.milkPrice); list.push({ name:`${d.herbata.milkType==='mleko'?'Mleko':'Śmietanka'} (herbata)`, daily:md, total:md*days, _dk:'herbata' }); }
    }
    if (Boolean(d.napoje.enabled))    { const daily = (n(d.napoje.litersPerDay) / Math.max(0.001, n(d.napoje.pkgL))) * n(d.napoje.pkgPrice); list.push({ name: tString(t, drinkI18nKey('napoje') as TranslationKey), daily, total: daily * days, _dk: 'napoje' }); }
    if (Boolean(d.woda.enabled))      { const daily = (n(d.woda.litersPerDay)   / Math.max(0.001, n(d.woda.pkgL)))   * n(d.woda.pkgPrice);   list.push({ name: tString(t, drinkI18nKey('woda') as TranslationKey),   daily, total: daily * days, _dk: 'woda' }); }
    if (Boolean(d.sodaStream.enabled)){
      const syrupDaily = n(d.sodaStream.litersPerDay) * (n(d.sodaStream.mlPer1L) / Math.max(1, n(d.sodaStream.syrupMl))) * n(d.sodaStream.syrupPrice);
      const cylDaily = n(d.sodaStream.cylinderDays) > 0 ? n(d.sodaStream.cylinderCost) / n(d.sodaStream.cylinderDays) : 0;
      const daily = syrupDaily + cylDaily;
      list.push({ name: tString(t, drinkI18nKey('sodaStream') as TranslationKey), daily, total: daily * days, _dk: 'sodaStream' });
    }
    OTHER_TYPES.forEach(ot => {
      const o = otherExpenses[ot.key];
      if (!o?.enabled) return;
      const nExp = (v: unknown) => Math.min(99999, cfgNum(v));
      let daily = 0;
      if (ot.key === 'papier') {
        daily = (nExp(o.dailyRolls) / Math.max(1, nExp(o.rollsPerPkg))) * nExp(o.pkgPrice);
      } else if (ot.key === 'pranie') {
        const washesPerDay = nExp(o.washesPerWeek) / 7;
        let det = 0;
        if (o.detergentType === 'proszek')   det = (nExp(o.proszekPerWash) / Math.max(1, nExp(o.proszekPkgKg) * 1000)) * nExp(o.proszekPkgPrice);
        else if (o.detergentType === 'plyn') det = (nExp(o.plynPerWash) / Math.max(1, nExp(o.plynPkgL) * 1000)) * nExp(o.plynPkgPrice);
        else                                  det = nExp(o.kapsulkiPkgPrice) / Math.max(1, nExp(o.kapsulkiPerPkg));
        let plu = 0;
        if (o.plukanie) plu = (nExp(o.plukaniePerWash) / Math.max(1, nExp(o.plukanieL) * 1000)) * nExp(o.plukaniePkgPrice);
        daily = (det + plu) * washesPerDay;
      } else if (ot.key === 'sprzatan') {
        const bagDaily = (nExp(o.bagsPerWeek) / 7) * (nExp(o.bagsPkgPrice) / Math.max(1, nExp(o.bagsPerPkg)));
        const cleanDaily = itemList(o.cleaningItems).reduce((s, ci) => s + (nExp(ci.perMonth) * nExp(ci.pkgPrice)) / 30, 0);
        daily = bagDaily + cleanDaily;
      } else if (ot.key === 'higiena') {
        const h = o; const nn2 = (v: unknown) => Math.min(99999, cfgNum(v));
        // zęby
        daily += (nn2(h.zbRazDzien) * nn2(h.zbPastaG) / Math.max(1, nn2(h.zbTubkaMl))) * nn2(h.zbTubkaPrice);
        daily += nn2(h.zbSzczetokaPrice) / 90;
        // włosy
        const wlPerDay = nn2(h.wlRazW) / 7;
        if (h.wlSzampon) daily += wlPerDay * (nn2(h.wlSzamponWyc)*5 / Math.max(1, nn2(h.wlSzamponMl))) * nn2(h.wlSzamponPrice);
        if (h.wlOdzywka) daily += wlPerDay * (nn2(h.wlOdzywkaWyc)*5 / Math.max(1, nn2(h.wlOdzywkaMl))) * nn2(h.wlOdzywkaPrice);
        // kąpiel
        const kapPerDay = nn2(h.kapRazW) / 7;
        if (h.kapZel)   daily += kapPerDay * (nn2(h.kapZelWyc)*5 / Math.max(1, nn2(h.kapZelMl))) * nn2(h.kapZelPrice);
        if (h.kapMydlo) daily += kapPerDay * (5 / Math.max(1, nn2(h.kapMydloG))) * nn2(h.kapMydloPrice);
        // papier toaletowy
        daily += (nn2(h.papierDailyRolls) / Math.max(1, nn2(h.papierRollsPerPkg))) * nn2(h.papierPkgPrice);
        // inne
        itemList(h.inneItems).forEach((ci: Record<string, unknown>) => { daily += (nExp(ci.perMonth)*nExp(ci.pkgPrice))/30; });
      } else if (ot.key === 'zmywanie') {
        if (o.useReczne) {
          const dur = nExp(o.pkgDuration) * (o.durationUnit === 'miesiace' ? 30 : 1);
          daily += nExp(o.pkgPrice) / Math.max(1, dur);
        }
        if (o.useZmywarka) {
          daily += (nExp(o.usesPerWeek) / 7) * (nExp(o.kapsulkiPkgPrice) / Math.max(1, nExp(o.kapsPerPkg)));
        }
      } else if (ot.key === 'zwierze') {
        if (o.suchaE) daily += (nExp(o.suchaG) / Math.max(1, nExp(o.suchaPkgG))) * nExp(o.suchaPrice);
        if (o.mokraE) daily += nExp(o.mokraSzt) * nExp(o.mokraPrice);
        if (o.zwierekE) daily += (nExp(o.zwierekL) / Math.max(1, nExp(o.zwierekPkgL))) * nExp(o.zwierekPrice) / Math.max(1, nExp(o.zwierekDni));
        if (o.wetE) daily += nExp(o.wet) / 30;
        if (o.pielegnacjaE) daily += nExp(o.pielegnacja) / 30;
        if (o.akcesoriaE) daily += nExp(o.akcesoria) / 30;
        itemList(o.extraItems).forEach((ci: Record<string, unknown>) => { daily += nExp(ci.price) / 30; });
      } else if (ot.key === 'dziecko') {
        ([['przedszkole','przedszkoleE'],['obiad','obiadE'],['zajecia','zajeciaE'],['korepetycje','korepetycjeE'],
         ['materialy','materialyE'],['dojazdy','dojazdyE'],['odziez','odziezdE'],['kieszonkowe','kieszonkoweE'],['zabawki','zabawkiE'],['kosmetyki','kosmetykiE']] as const)
          .forEach(([k, e]) => { if (o[e]) daily += nExp(o[k]) / 30; });
        if (o.pieluchyEnabled) daily += (nExp(o.pieluchyPerDay) / Math.max(1, nExp(o.pieluchyPerPkg))) * nExp(o.pieluchyPrice);
        if (o.mlekoEnabled) daily += (nExp(o.mlekoPerDay) / Math.max(1, nExp(o.mlekoPkgScoops))) * nExp(o.mlekoPrice);
        itemList(o.extraItems).forEach((ci: Record<string, unknown>) => { daily += nExp(ci.price) / 30; });
      } else if (ot.key === 'lekarze') {
        const wizD = nExp(o.wizyty) / 30;
        const lekD = nExp(o.leki) / 30;
        if (wizD > 0) list.push({ name: tString(t, 'dc_doctors'), _tkey: 'dc_doctors', daily: wizD, total: wizD * days, _dk: 'lekarze' });
        if (lekD > 0) list.push({ name: tString(t, 'dc_medicine'), _tkey: 'dc_medicine', daily: lekD, total: lekD * days, _dk: 'lekarze' });
        return;
      } else if (ot.key === 'biurowe') {
        if (o.papierA4E) daily += nExp(o.papierA4) / 30;
        if (o.tuszE) daily += nExp(o.tusz) / 30;
        if (o.notatnikE) daily += nExp(o.notatnik) / 30;
        if (o.dlugopisyE) daily += nExp(o.dlugopisy) / 30;
        itemList(o.extraItems).forEach((ci: Record<string, unknown>) => { daily += nExp(ci.price) / 30; });
      } else if (ot.key === 'paliwo') {
        daily = (nExp(o.kmPerDay) / 100) * nExp(o.consumption) * nExp(o.fuelPrice);
      } else if (ot.key === 'media') {
        if (o.internetE) daily += nExp(o.internet) / 30;
        if (o.telefonE) daily += nExp(o.telefon) / 30;
        if (o.tvE) daily += nExp(o.tv) / 30;
      } else {
        daily = nExp(o.monthlyAmount) / 30;
      }
      list.push({ name: tString(t, expenseI18nKey(ot.key) as TranslationKey), daily, total: daily * days, _dk: ot.key });
    });
    return list;
  }, [drinks, days, effCukierPrice, effSlodzikPrice, otherExpenses, t]);

  useEffect(() => { onUpdate(items); }, [items, onUpdate]);



  const btnSugar = (drinkKey: DrinkKey, type: 'cukier' | 'slodzik') => {
    const cur = drinks[drinkKey].sugarType;
    return (
      <button type="button" onClick={() => upd(drinkKey, { sugarType: cur === type ? null : type })}
        style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
          background: cur === type ? '#0d9488' : '#2d3748',
          borderColor: cur === type ? '#0d9488' : '#374151',
          color: cur === type ? 'white' : '#9ca3af' }}>
        {type === 'cukier' ? tString(t, 'dc_sugar') : tString(t, 'dc_sweetener')}
      </button>
    );
  };

  const renderTile = ({ key, label: _label, emoji, gradient }: { key: string; label: string; emoji: string; gradient: string }) => {
  const enabled = Boolean(otherExpenses[key]?.enabled);
  const expanded = otherExpanded === key;
  const isShared = SHARED_KEYS.has(key);
  return (
    <div key={key} style={{ display:'flex', flexDirection:'column' }}>
      <div onClick={() => handleOtherClick(key)}
        onMouseEnter={e => e.currentTarget.style.filter='brightness(1.35)'}
        onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
        style={{
          height:70, borderRadius:10, cursor:'pointer',
          background: gradient,
          border: `2px solid ${enabled ? '#0d9488' : 'transparent'}`,
          boxShadow: enabled ? '0 0 10px rgba(13,148,136,0.35)' : '0 2px 6px rgba(0,0,0,0.4)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
          opacity: enabled ? 1 : 0.55,
          transition:'all 0.2s', userSelect:'none', position:'relative', overflow:'hidden',
        }}>
        <div style={{ position:'absolute', inset:0, background: enabled ? 'transparent' : 'rgba(0,0,0,0.2)' }} />
        {isShared && (
          <div style={{
            position:'absolute', top:4, right:4, zIndex:3,
            display:'flex', alignItems:'center', gap:3,
            background:'rgba(45,212,191,0.18)', border:'1px solid rgba(45,212,191,0.4)',
            borderRadius:5, padding:'3px 6px',
          }}>
            <Icon icon="heroicons:users-solid" style={{ width:11, height:11, color:'#2dd4bf', flexShrink:0 }} />
            <span style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', letterSpacing:'0.3px', lineHeight:1 }}>{tString(t, 'expenses_shared')}</span>
          </div>
        )}
        <span style={{ fontSize:16, lineHeight:1, position:'relative', zIndex:1 }}>{emoji}</span>
        <span style={{ fontSize:9, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 3px', lineHeight:1.3 }}>{tString(t, expenseI18nKey(key) as TranslationKey)}</span>
        {(() => { const pv = otherTilePreview(key); return pv>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'3px 4px', textAlign:'center', fontSize:10, fontWeight:800, color:'#2dd4bf', zIndex:2, opacity: enabled?1:0.7 }}>{pv.toFixed(2)} {cur}</div> : null; })()}
      </div>
      {expanded && (() => {
        const o = otherExpenses[key] ?? (OTHER_DEFAULTS[key] as ConfigBucket);
        const tot = items.filter((i) => i._dk === key).reduce((s,i)=>s+i.total,0);
        const Summary = () => (
          <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5 }}>
            <div style={{ fontSize:9, color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#0d9488' }}>{tot.toFixed(2)} {cur}</div>
          </div>
        );
        const inp2 = { ...fi, width:'100%' };
        const cl2 = (v: string) => cl(v, 99999);
        if (key === 'papier') {
          const nn2 = (v: unknown) => Math.min(99999, cfgNum(v));
          const rollsUsed = nn2(o.dailyRolls) * days;
          const papierCost = (nn2(o.dailyRolls) / Math.max(1, nn2(o.rollsPerPkg))) * nn2(o.pkgPrice) * days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:6 }}>
              <FieldBox label={tString(t, 'dc_rolls_per_day')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={cfgStr(o.dailyRolls)} placeholder="0.5" onChange={e=>updOther(key,{dailyRolls:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_rolls_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.rollsPerPkg)} placeholder="16" onChange={e=>updOther(key,{rollsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(o.pkgPrice)} placeholder="23" onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>{tFormat(t, 'dc_rolls_used', rollsUsed.toFixed(1))}</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{papierCost.toFixed(2)} {cur}</span>
              </div>
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{papierCost.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'pranie') {
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const washesTotal = (nn(o.washesPerWeek) / 7) * days;
          let detDaily = 0;
          let detLabel = '';
          if (o.detergentType === 'proszek')   { detDaily = (nn(o.proszekPerWash) / Math.max(1, nn(o.proszekPkgKg)*1000)) * nn(o.proszekPkgPrice); detLabel = tString(t, 'dc_powder'); }
          else if (o.detergentType === 'plyn') { detDaily = (nn(o.plynPerWash) / Math.max(1, nn(o.plynPkgL)*1000)) * nn(o.plynPkgPrice); detLabel = tString(t, 'dc_liquid'); }
          else                                  { detDaily = nn(o.kapsulkiPkgPrice) / Math.max(1, nn(o.kapsulkiPerPkg)); detLabel = tString(t, 'dc_capsules'); }
          const detCost = detDaily * washesTotal;
          let pluCost = 0;
          if (o.plukanie) pluCost = (nn(o.plukaniePerWash) / Math.max(1, nn(o.plukanieL)*1000)) * nn(o.plukaniePkgPrice) * washesTotal;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={tString(t, 'exp_laundry')}>
              <FieldBox label={tString(t, 'dc_washes_per_week')}><input type="number" className="no-spin" min="0" max="99999" step="0.5" style={inp2} value={cfgStr(o.washesPerWeek)} placeholder="5" onChange={e=>updOther(key,{washesPerWeek:cl2(e.target.value)})} /></FieldBox>
            </InnerSec>
            <InnerSec title={tString(t, 'dc_detergent')}>
            <div style={{ display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid #374151' }}>
              {['proszek','plyn','kapsulki'].map((type,i) => (
                <button key={type} type="button" onClick={()=>updOther(key,{detergentType:type})}
                  style={{ flex:1, padding:'5px 4px', border:'none', borderRight:i<2?'1px solid #374151':'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o.detergentType===type?'#1e3a3a':'transparent', color:o.detergentType===type?'#2dd4bf':'#6b7280' }}>
                  {type==='proszek'?tString(t, 'dc_powder'):type==='plyn'?tString(t, 'dc_liquid'):tString(t, 'dc_capsules')}
                </button>
              ))}
            </div>
            {o.detergentType === 'proszek' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_powder')}</div>
              <FieldBox label={tString(t, 'dc_grams_per_wash')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.proszekPerWash)} placeholder="75" onChange={e=>updOther(key,{proszekPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_capacity_kg')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={cfgStr(o.proszekPkgKg)} placeholder="3" onChange={e=>updOther(key,{proszekPkgKg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(o.proszekPkgPrice)} placeholder="40" onChange={e=>updOther(key,{proszekPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'plyn' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_liquid')}</div>
              <FieldBox label="ml / wash"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.plynPerWash)} onChange={e=>updOther(key,{plynPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_capacity_l')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={cfgStr(o.plynPkgL)} onChange={e=>updOther(key,{plynPkgL:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(o.plynPkgPrice)} onChange={e=>updOther(key,{plynPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'kapsulki' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_capsules')}</div>
              <FieldBox label={tString(t, 'dc_capsules_per_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.kapsulkiPerPkg)} onChange={e=>updOther(key,{kapsulkiPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(o.kapsulkiPkgPrice)} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            </InnerSec>
            <InnerSec title={tString(t, 'dc_fabric_softener_section')}>
              <button type="button" onClick={()=>updOther(key,{plukanie:!o.plukanie})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:o.plukanie?'#1e3a3a':'transparent', borderColor:'#374151', color:o.plukanie?'#2dd4bf':'#6b7280' }}>
                {tString(t, 'dc_fabric_softener')}
              </button>
              {o.plukanie && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_fabric_softener')}</div>
                <FieldBox label="ml / wash"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.plukaniePerWash)} placeholder="25" onChange={e=>updOther(key,{plukaniePerWash:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={tString(t, 'dc_pkg_capacity_l')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={cfgStr(o.plukanieL)} placeholder="1.5" onChange={e=>updOther(key,{plukanieL:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(o.plukaniePkgPrice)} placeholder="15" onChange={e=>updOther(key,{plukaniePkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>}
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>{detLabel} ({Math.round(washesTotal)} washes)</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{detCost.toFixed(2)} {cur}</span>
              </div>
              {o.plukanie && pluCost > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                  <span style={{ color:'#6b7280' }}>{tString(t, 'dc_fabric_softener')}</span>
                  <span style={{ color:'#9ca3af', fontWeight:600 }}>{pluCost.toFixed(2)} {cur}</span>
                </div>
              )}
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{(detCost + pluCost).toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'higiena') {
          const h = o; const nn2 = (v: unknown) => Math.min(99999, cfgNum(v));
          const updH = (val: Record<string, unknown>) => updOther(key, val);
          const updInne = (items: Array<Record<string, unknown>>) => updH({ inneItems: items });
          const zbCost = ((nn2(h.zbRazDzien)*nn2(h.zbPastaG)/Math.max(1,nn2(h.zbTubkaMl)))*nn2(h.zbTubkaPrice) + nn2(h.zbSzczetokaPrice)/90)*days;
          const wlPerDay=nn2(h.wlRazW)/7; const wlCost=((h.wlSzampon?(wlPerDay*(nn2(h.wlSzamponWyc)*5/Math.max(1,nn2(h.wlSzamponMl)))*nn2(h.wlSzamponPrice)):0)+(h.wlOdzywka?(wlPerDay*(nn2(h.wlOdzywkaWyc)*5/Math.max(1,nn2(h.wlOdzywkaMl)))*nn2(h.wlOdzywkaPrice)):0))*days;
          const kapPerDay=nn2(h.kapRazW)/7; const kapCost=((h.kapZel?(kapPerDay*(nn2(h.kapZelWyc)*5/Math.max(1,nn2(h.kapZelMl)))*nn2(h.kapZelPrice)):0)+(h.kapMydlo?(kapPerDay*(5/Math.max(1,nn2(h.kapMydloG)))*nn2(h.kapMydloPrice)):0))*days;
          const inneCost=itemList(h.inneItems).reduce((s: number, ci: Record<string, unknown>)=>s+(nn2(ci.perMonth)*nn2(ci.pkgPrice))/30*days,0);
          const papierCostH = (nn2(h.papierDailyRolls)/Math.max(1,nn2(h.papierRollsPerPkg)))*nn2(h.papierPkgPrice)*days;
          const totalH = zbCost+wlCost+kapCost+inneCost+papierCostH;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={tString(t, 'dc_toothbrushing')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label={tString(t, 'dc_brushing_times')} val={h.zbRazDzien} onChange={v=>updH({zbRazDzien:v})} max="50" ph="2" />
                <FI label={tString(t, 'dc_toothpaste_g')} val={h.zbPastaG} onChange={v=>updH({zbPastaG:v})} step="0.5" ph="1" />
                <FI label={tString(t, 'dc_tube_ml')} val={h.zbTubkaMl} onChange={v=>updH({zbTubkaMl:v})} ph="75" />
                <FI label={tString(t, 'dc_tube_price')} val={h.zbTubkaPrice} onChange={v=>updH({zbTubkaPrice:v})} step="0.01" ph="8" />
                <FI label={tString(t, 'dc_toothbrush_price')} val={h.zbSzczetokaPrice} onChange={v=>updH({zbSzczetokaPrice:v})} step="0.01" ph="15" />
              </div>
            </InnerSec>
            <InnerSec title={tString(t, 'dc_hairwashing')}>
              <FI label={tString(t, 'dc_hair_times_week')} val={h.wlRazW} onChange={v=>updH({wlRazW:v})} max="14" ph="3" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={Boolean(h.wlSzampon)} onClick={()=>updH({wlSzampon:!h.wlSzampon})} label={tString(t, 'dc_shampoo')} />
                <TogBtn active={Boolean(h.wlOdzywka)} onClick={()=>updH({wlOdzywka:!h.wlOdzywka})} label={tString(t, 'dc_conditioner')} />
              </div>
              {Boolean(h.wlSzampon) && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_shampoo')}</div>
                <FI label={tString(t, 'dc_pumps')} val={h.wlSzamponWyc} onChange={v=>updH({wlSzamponWyc:v})} ph="2" />
                <FI label={tString(t, 'dc_pkg_capacity_ml')} val={h.wlSzamponMl} onChange={v=>updH({wlSzamponMl:v})} ph="400" />
                <FI label={tString(t, 'dc_pkg_price')} val={h.wlSzamponPrice} onChange={v=>updH({wlSzamponPrice:v})} step="0.01" ph="18" />
              </div>}
              {Boolean(h.wlOdzywka) && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_conditioner')}</div>
                <FI label={tString(t, 'dc_pumps')} val={h.wlOdzywkaWyc} onChange={v=>updH({wlOdzywkaWyc:v})} ph="2" />
                <FI label={tString(t, 'dc_pkg_capacity_ml')} val={h.wlOdzywkaMl} onChange={v=>updH({wlOdzywkaMl:v})} ph="300" />
                <FI label={tString(t, 'dc_pkg_price')} val={h.wlOdzywkaPrice} onChange={v=>updH({wlOdzywkaPrice:v})} step="0.01" ph="20" />
              </div>}
            </InnerSec>
            <InnerSec title={tString(t, 'dc_bathing')}>
              <FI label={tString(t, 'dc_hair_times_week')} val={h.kapRazW} onChange={v=>updH({kapRazW:v})} max="14" ph="7" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={Boolean(h.kapZel)} onClick={()=>updH({kapZel:!h.kapZel})} label={tString(t, 'dc_gel')} />
                <TogBtn active={Boolean(h.kapMydlo)} onClick={()=>updH({kapMydlo:!h.kapMydlo})} label={tString(t, 'dc_soap')} />
              </div>
              {Boolean(h.kapZel) && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_gel')}</div>
                <FI label={tString(t, 'dc_pumps')} val={h.kapZelWyc} onChange={v=>updH({kapZelWyc:v})} ph="3" />
                <FI label={tString(t, 'dc_pkg_capacity_ml')} val={h.kapZelMl} onChange={v=>updH({kapZelMl:v})} ph="400" />
                <FI label={tString(t, 'dc_pkg_price')} val={h.kapZelPrice} onChange={v=>updH({kapZelPrice:v})} step="0.01" ph="12" />
              </div>}
              {Boolean(h.kapMydlo) && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{tString(t, 'dc_soap')} <span style={{ fontWeight:400, color:'#6b7280' }}>(5g / use)</span></div>
                <FI label={tString(t, 'dc_bar_size_g')} val={h.kapMydloG} onChange={v=>updH({kapMydloG:v})} ph="100" />
                <FI label={tString(t, 'dc_pkg_price')} val={h.kapMydloPrice} onChange={v=>updH({kapMydloPrice:v})} step="0.01" ph="5" />
              </div>}
            </InnerSec>
            <InnerSec title={tString(t, 'dc_toilet_paper')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label={tString(t, 'dc_rolls_per_day')} val={h.papierDailyRolls} onChange={v=>updH({papierDailyRolls:v})} step="0.1" ph="0.5" />
                <FI label={tString(t, 'dc_rolls_in_pkg')} val={h.papierRollsPerPkg} onChange={v=>updH({papierRollsPerPkg:v})} ph="16" />
                <FI label={tString(t, 'dc_pkg_price_full2')} val={h.papierPkgPrice} onChange={v=>updH({papierPkgPrice:v})} step="0.01" ph="23" />
              </div>
            </InnerSec>
            <InnerSec title={tString(t, 'dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5, overflow:'hidden' }}>
                {itemList(h.inneItems).map((ci: Record<string, unknown>, idx: number) => (
                  <div key={String(ci.id ?? idx)} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={cfgStr(ci.name)} maxLength={30} placeholder={tString(t, 'dc_deodorant_ph')}
                        onChange={e=>{const a=[...itemList(h.inneItems)];a[idx]={...a[idx],name:e.target.value};updInne(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updInne(itemList(h.inneItems).filter((_: Record<string, unknown>, i: number)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label={tString(t, 'dc_pcs_per_month')}><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'5px 4px', fontSize:12 }} value={cfgStr(ci.perMonth)} onChange={e=>{const a=[...itemList(h.inneItems)];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updInne(a);}} /></FieldBox>
                    <FieldBox label={tString(t, 'dc_price_per_pkg2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(ci.pkgPrice)} onChange={e=>{const a=[...itemList(h.inneItems)];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updInne(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={()=>updInne([...itemList(h.inneItems),{id:Date.now(),name:'',perMonth:'1',pkgPrice:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {tString(t, 'dc_add_item')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {zbCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_teeth_lbl')}</span><span style={{ color:'#9ca3af' }}>{zbCost.toFixed(2)} {cur}</span></div>}
              {wlCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_hair_lbl')}</span><span style={{ color:'#9ca3af' }}>{wlCost.toFixed(2)} {cur}</span></div>}
              {kapCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_bath_lbl')}</span><span style={{ color:'#9ca3af' }}>{kapCost.toFixed(2)} {cur}</span></div>}
              {papierCostH>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_toilet_paper_short')}</span><span style={{ color:'#9ca3af' }}>{papierCostH.toFixed(2)} {cur}</span></div>}
              {inneCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{inneCost.toFixed(2)} {cur}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{totalH.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'sprzatan') {
          const nn2 = (v: unknown) => Math.min(99999, cfgNum(v));
          const bagCost = (nn2(o.bagsPerWeek) / 7) * (nn2(o.bagsPkgPrice) / Math.max(1, nn2(o.bagsPerPkg))) * days;
          const cleanCost = itemList(o.cleaningItems).reduce((s, ci) => s + (nn2(ci.perMonth) * nn2(ci.pkgPrice)) / 30 * days, 0);
          const updItems = (newItems: Array<Record<string, unknown>>) => updOther(key, { cleaningItems: newItems });
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={tString(t, 'dc_trash')}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <FieldBox label={tString(t, 'dc_bags_per_week')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={cfgStr(o.bagsPerWeek)} placeholder="4" onChange={e=>updOther(key,{bagsPerWeek:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={tString(t, 'dc_bags_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="20" value={cfgStr(o.bagsPerPkg)} onChange={e=>updOther(key,{bagsPerPkg:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={tString(t, 'dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="12" value={cfgStr(o.bagsPkgPrice)} onChange={e=>updOther(key,{bagsPkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>
            </InnerSec>
            <InnerSec title={tString(t, 'dc_cleaning_fluids')}>
              <div style={{ display:'flex', flexDirection:'column', gap:6, overflow:'hidden' }}>
                {itemList(o.cleaningItems).map((ci: Record<string, unknown>, idx: number) => (
                  <div key={String(ci.id ?? idx)} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={cfgStr(ci.name)} maxLength={30} placeholder={tString(t, 'dc_cleaning_fluid_ph')}
                        onChange={e => { const a=[...itemList(o.cleaningItems)]; a[idx]={...a[idx],name:e.target.value}; updItems(a); }}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={() => updItems(itemList(o.cleaningItems).filter((_: Record<string, unknown>, i: number)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label={tString(t, 'dc_pcs_per_month')}><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'6px 8px', fontSize:13 }} value={cfgStr(ci.perMonth)} onChange={e=>{const a=[...itemList(o.cleaningItems)];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updItems(a);}} /></FieldBox>
                    <FieldBox label={tString(t, 'dc_price_per_pkg2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={cfgStr(ci.pkgPrice)} onChange={e=>{const a=[...itemList(o.cleaningItems)];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updItems(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={() => updItems([...itemList(o.cleaningItems), { id:Date.now(), name:'', perMonth:'1', pkgPrice:'' }])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {tString(t, 'dc_add_item')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {bagCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_rubbish_bags_lbl')}</span><span style={{ color:'#9ca3af' }}>{bagCost.toFixed(2)} {cur}</span></div>}
              {cleanCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_cleaning_fluids')}</span><span style={{ color:'#9ca3af' }}>{cleanCost.toFixed(2)} {cur}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{(bagCost + cleanCost).toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'zmywanie') {
          const nn2 = (v: unknown) => Math.min(99999, cfgNum(v));
          const dur = nn2(o.pkgDuration) * (o.durationUnit === 'miesiace' ? 30 : 1);
          const recznyCost = o.useReczne && dur > 0 ? (nn2(o.pkgPrice) / dur) * days : 0;
          const zmywarkaCost = o.useZmywarka ? (nn2(o.usesPerWeek) / 7) * (nn2(o.kapsulkiPkgPrice) / Math.max(1, nn2(o.kapsPerPkg))) * days : 0;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px', marginTop:4 }}>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {([['useReczne', tString(t, 'dc_hand_wash')],['useZmywarka', tString(t, 'dc_dishwasher')]] as Tuple2[]).map(([field, lbl]) => (
                <button key={field} type="button" onClick={()=>updOther(key,{[field]:!o[field]})}
                  style={{ flex:1, padding:'5px 4px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o[field]?'#1e3a3a':'transparent', color:o[field]?'#2dd4bf':'#6b7280' }}>
                  {lbl}
                </button>
              ))}
            </div>
            {Boolean(o.useReczne) && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>{tString(t, 'dc_hand_wash')}</div>
              <div>
                <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{tString(t, 'dc_how_long_lasts')}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:4 }}>
                  {['dni','miesiace'].map(u => (
                    <button key={u} type="button" onClick={()=>updOther(key,{durationUnit:u})}
                      style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                        background:o.durationUnit===u?'#1e3a3a':'transparent', borderColor:'#374151', color:o.durationUnit===u?'#2dd4bf':'#6b7280' }}>
                      {u==='dni'?tString(t, 'dc_days_unit'):tString(t, 'dc_months_unit')}
                    </button>
                  ))}
                </div>
                <input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={cfgStr(o.pkgDuration)} onChange={e=>updOther(key,{pkgDuration:cl2(e.target.value)})} />
              </div>
              <FieldBox label={tString(t, 'dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="9" value={cfgStr(o.pkgPrice)} onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {Boolean(o.useZmywarka) && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>{tString(t, 'dc_dishwasher')}</div>
              <FieldBox label={tString(t, 'dc_uses_per_week')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="7" value={cfgStr(o.usesPerWeek)} onChange={e=>updOther(key,{usesPerWeek:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pods_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={cfgStr(o.kapsPerPkg)} onChange={e=>updOther(key,{kapsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={tString(t, 'dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="25" value={cfgStr(o.kapsulkiPkgPrice)} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {(o.useReczne || o.useZmywarka) && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                {recznyCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_hand_wash')}</span><span style={{ color:'#9ca3af' }}>{recznyCost.toFixed(2)} {cur}</span></div>}
                {zmywarkaCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_dishwasher')}</span><span style={{ color:'#9ca3af' }}>{zmywarkaCost.toFixed(2)} {cur}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                  <span style={{ color:'#0d9488' }}>{(recznyCost + zmywarkaCost).toFixed(2)} {cur}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'dziecko') {
          const d = o;
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const updD = (val: Record<string, unknown>) => updOther(key, val);
          const updExtra = (items: Array<Record<string, unknown>>) => updD({ extraItems: items });
          const totalPieluchy = d.pieluchyEnabled ? (nn(d.pieluchyPerDay) / Math.max(1, nn(d.pieluchyPerPkg))) * nn(d.pieluchyPrice) * days : 0;
          const totalMleko = d.mlekoEnabled ? (nn(d.mlekoPerDay) / Math.max(1, nn(d.mlekoPkgScoops))) * nn(d.mlekoPrice) * days : 0;
          const totalFixed = ([['przedszkole','przedszkoleE'],['obiad','obiadE'],['zajecia','zajeciaE'],['korepetycje','korepetycjeE'],['materialy','materialyE'],['dojazdy','dojazdyE'],['odziez','odziezdE'],['kieszonkowe','kieszonkoweE'],['zabawki','zabawkiE'],['kosmetyki','kosmetykiE']] as Tuple2[]).reduce((s,[k,e])=>s+(d[e]?nn(d[k])/30*days:0),0);
          const totalExtra = itemList(d.extraItems).reduce((s: number, ci: Record<string, unknown>)=>s+nn(ci.price)/30*days,0);
          const totalAll = totalFixed + totalPieluchy + totalMleko + totalExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {([
              ['przedszkoleE','przedszkole', tString(t, 'dc_nursery'),'1200'],
              ['obiadE','obiad', tString(t, 'dc_school_lunch'),'150'],
              ['zajeciaE','zajecia', tString(t, 'dc_activities'),'200'],
              ['korepetycjeE','korepetycje', tString(t, 'dc_tutoring'),'300'],
              ['materialyE','materialy', tString(t, 'dc_school_supplies'),'80'],
              ['dojazdyE','dojazdy', tString(t, 'dc_school_transport'),'150'],
              ['odziezdE','odziez', tString(t, 'dc_clothing'),'200'],
              ['kieszonkoweE','kieszonkowe', tString(t, 'dc_pocket_money'),'200'],
              ['zabawkiE','zabawki', tString(t, 'dc_toys'),'100'],
              ['kosmetykiE','kosmetyki', tString(t, 'dc_cosmetics_lbl'),'50'],
            ] as Tuple4[]).map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updD({[eKey]:!d[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:d[eKey]?'#1e3a3a':'transparent', color:d[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {d[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <MI label={tString(t, 'dc_per_month_lbl')} val={cfgStr(d[vKey])} onChange={v=>updD({[vKey]:v})} ph={ph} />
                </div>}
              </div>
            ))}
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({pieluchyEnabled:!d.pieluchyEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.pieluchyEnabled?'#1e3a3a':'transparent', color:d.pieluchyEnabled?'#2dd4bf':'#6b7280' }}>
                {tString(t, 'dc_nappies')}
              </button>
              {d.pieluchyEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label={tString(t, 'dc_nappies_per_day')} val={d.pieluchyPerDay} onChange={v=>updD({pieluchyPerDay:v})} step="1" ph="8" />
                <MI label={tString(t, 'dc_nappies_in_pkg')} val={d.pieluchyPerPkg} onChange={v=>updD({pieluchyPerPkg:v})} step="1" ph="50" />
                <MI label={tString(t, 'dc_pkg_price_full2')} val={d.pieluchyPrice} onChange={v=>updD({pieluchyPrice:v})} ph="60" />
              </div>}
            </div>
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({mlekoEnabled:!d.mlekoEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.mlekoEnabled?'#1e3a3a':'transparent', color:d.mlekoEnabled?'#2dd4bf':'#6b7280' }}>
                {tString(t, 'dc_formula')}
              </button>
              {d.mlekoEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label={tString(t, 'dc_servings_per_day')} val={d.mlekoPerDay} onChange={v=>updD({mlekoPerDay:v})} step="1" ph="5" />
                <MI label={tString(t, 'dc_servings_in_pkg')} val={d.mlekoPkgScoops} onChange={v=>updD({mlekoPkgScoops:v})} step="1" ph="21" />
                <MI label={tString(t, 'dc_pkg_price_full2')} val={d.mlekoPrice} onChange={v=>updD({mlekoPrice:v})} ph="90" />
              </div>}
            </div>
            <InnerSec title={tString(t, 'dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {itemList(d.extraItems).map((ci: Record<string, unknown>, idx: number) => (
                  <div key={String(ci.id ?? idx)} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={cfgStr(ci.name)} maxLength={30} placeholder={tString(t, 'dc_holiday_ph')}
                        onChange={e=>{const a=[...itemList(d.extraItems)];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(itemList(d.extraItems).filter((_: Record<string, unknown>, i: number)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={tString(t, 'dc_per_month_ph')}
                      value={cfgStr(ci.price)}
                      onChange={e=>{const a=[...itemList(d.extraItems)];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...itemList(d.extraItems),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {tString(t, 'dc_add_expense')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_fixed_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} {cur}</span></div>}
              {totalPieluchy>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_nappies_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalPieluchy.toFixed(2)} {cur}</span></div>}
              {totalMleko>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_formula_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalMleko.toFixed(2)} {cur}</span></div>}
              {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} {cur}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'zwierze') {
          const z = o;
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const updZ = (val: Record<string, unknown>) => updOther(key, val);
          const ZI = ({label, field, step='1', max='99999', ph=''}: {label: ReactNode; field: string; step?: string; max?: string; ph?: string}) => (
            <FieldBox label={label}>
              <input type="number" className="no-spin" min="0" max={max} step={step} style={inp2}
                placeholder={ph} value={cfgStr(z[field])} onChange={e=>updZ({[field]:cl2(e.target.value)})} />
            </FieldBox>
          );
          const Tog = ({eKey, label}: {eKey: string; label: ReactNode}) => (
            <button type="button" onClick={()=>updZ({[eKey]:!z[eKey]})}
              style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s', marginBottom:6,
                background:z[eKey]?'#1e3a3a':'transparent', color:z[eKey]?'#2dd4bf':'#6b7280' }}>
              {label}
            </button>
          );
          const tSucha = z.suchaE ? (nn(z.suchaG)/Math.max(1,nn(z.suchaPkgG)))*nn(z.suchaPrice)*days : 0;
          const tMokra = z.mokraE ? nn(z.mokraSzt)*nn(z.mokraPrice)*days : 0;
          const tZwierek = z.zwierekE ? (nn(z.zwierekL)/Math.max(1,nn(z.zwierekPkgL)))*nn(z.zwierekPrice)/Math.max(1,nn(z.zwierekDni))*days : 0;
          const tMies = (z.wetE?nn(z.wet):0)+(z.pielegnacjaE?nn(z.pielegnacja):0)+(z.akcesoriaE?nn(z.akcesoria):0);
          const tExtra = itemList(z.extraItems).reduce((s: number, ci: Record<string, unknown>)=>s+nn(ci.price)/30*days,0);
          const tAll = tSucha+tMokra+tZwierek+tMies/30*days+tExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {Tog({eKey:"suchaE", label:tString(t, 'dc_dry_food')})}
            {z.suchaE && <InnerSec mb={6} flex title={tString(t, 'dc_dry_food')}>
              {ZI({label:tString(t, 'dc_dry_g_per_day'), field:"suchaG", ph:"50"})}
              {ZI({label:tString(t, 'dc_pkg_size_g'), field:"suchaPkgG", ph:"2000"})}
              {ZI({label:tString(t, 'dc_pkg_price_full2'), field:"suchaPrice", step:"0.01", ph:"60"})}
            </InnerSec>}
            {Tog({eKey:"mokraE", label:tString(t, 'dc_wet_food')})}
            {z.mokraE && <InnerSec mb={6} flex title={tString(t, 'dc_wet_food')}>
              {ZI({label:tString(t, 'dc_cans_per_day'), field:"mokraSzt", ph:"2"})}
              {ZI({label:tString(t, 'dc_can_weight_g'), field:"mokraGram", ph:"400"})}
              {ZI({label:tString(t, 'dc_can_price'), field:"mokraPrice", step:"0.01", ph:"2.50"})}
            </InnerSec>}
            {Tog({eKey:"zwierekE", label:tString(t, 'dc_litter')})}
            {z.zwierekE && <InnerSec mb={6} flex title={tString(t, 'dc_litter')}>
              {ZI({label:tString(t, 'dc_change_days'), field:"zwierekDni", ph:"7"})}
              {ZI({label:tString(t, 'dc_litter_per_change'), field:"zwierekL", step:"0.5", ph:"3"})}
              {ZI({label:tString(t, 'dc_pkg_size_l'), field:"zwierekPkgL", step:"0.5", ph:"5"})}
              {ZI({label:tString(t, 'dc_pkg_price_full2'), field:"zwierekPrice", step:"0.01", ph:"20"})}
            </InnerSec>}
            {Tog({eKey:"wetE", label:tString(t, 'dc_vet')})}
            {z.wetE && <InnerSec mb={6} flex title={tString(t, 'dc_vet')}>
              {ZI({label:tString(t, 'dc_per_month_lbl'), field:"wet", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"pielegnacjaE", label:tString(t, 'dc_grooming')})}
            {z.pielegnacjaE && <InnerSec mb={6} flex title={tString(t, 'dc_grooming')}>
              {ZI({label:tString(t, 'dc_per_month_lbl'), field:"pielegnacja", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"akcesoriaE", label:tString(t, 'dc_accessories')})}
            {z.akcesoriaE && <InnerSec mb={6} flex title={tString(t, 'dc_accessories')}>
              {ZI({label:tString(t, 'dc_per_month_lbl'), field:"akcesoria", step:"0.01", ph:"30"})}
            </InnerSec>}
            <InnerSec mb={6} flex title={tString(t, 'dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {itemList(z.extraItems).map((ci: Record<string, unknown>, idx: number) => (
                  <div key={String(ci.id ?? idx)} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={cfgStr(ci.name)} maxLength={30} placeholder={tString(t, 'dc_pet_toy_ph')}
                        onChange={e=>{const a=[...itemList(z.extraItems)];a[idx]={...a[idx],name:e.target.value};updZ({extraItems:a});}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updZ({extraItems:itemList(z.extraItems).filter((_: Record<string, unknown>, i: number)=>i!==idx)})}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={tString(t, 'dc_per_month_ph')}
                      value={cfgStr(ci.price)}
                      onChange={e=>{const a=[...itemList(z.extraItems)];a[idx]={...a[idx],price:cl2(e.target.value)};updZ({extraItems:a});}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updZ({extraItems:[...itemList(z.extraItems),{id:Date.now(),name:'',price:''}]})}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {tString(t, 'dc_add_expense')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6, marginTop:4 }}>
              {tSucha>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_dry_food')}</span><span style={{ color:'#9ca3af' }}>{tSucha.toFixed(2)} {cur}</span></div>}
              {tMokra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_wet_food')}</span><span style={{ color:'#9ca3af' }}>{tMokra.toFixed(2)} {cur}</span></div>}
              {tZwierek>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_litter')}</span><span style={{ color:'#9ca3af' }}>{tZwierek.toFixed(2)} {cur}</span></div>}
              {tMies>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_vet_short')}</span><span style={{ color:'#9ca3af' }}>{(tMies/30*days).toFixed(2)} {cur}</span></div>}
              {tExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{tExtra.toFixed(2)} {cur}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{tAll.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'lekarze') {
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const total = (nn(o.wizyty) + nn(o.leki)) / 30 * days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={tString(t, 'dc_doctors')} mb={8}>
              <FieldBox label={tString(t, 'dc_per_month_lbl')}>
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="100" value={cfgStr(o.wizyty)} onChange={e=>updOther(key,{wizyty:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <InnerSec title={tString(t, 'dc_medicine')} mb={6}>
              <FieldBox label={tString(t, 'dc_per_month_lbl')}>
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="50" value={cfgStr(o.leki)} onChange={e=>updOther(key,{leki:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_doctors')}</span><span style={{ color:'#9ca3af' }}>{(nn(o.wizyty)/30*days).toFixed(2)} {cur}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_medicine')}</span><span style={{ color:'#9ca3af' }}>{(nn(o.leki)/30*days).toFixed(2)} {cur}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                <span style={{ color:'#0d9488' }}>{total.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'biurowe') {
          const b = o;
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const updB = (val: Record<string, unknown>) => updOther(key, val);
          const updExtra = (items: Array<Record<string, unknown>>) => updB({ extraItems: items });
          const totalFixed = ([['papierA4','papierA4E'],['tusz','tuszE'],['notatnik','notatnikE'],['dlugopisy','dlugopisyE']] as Tuple2[]).reduce((s,[k,e])=>s+(b[e]?nn(b[k])/30*days:0),0);
          const totalExtra = itemList(b.extraItems).reduce((s: number, ci: Record<string, unknown>)=>s+nn(ci.price)/30*days,0);
          const totalAll = totalFixed + totalExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {([
              ['papierA4E','papierA4', tString(t, 'dc_paper_a4'),'25'],
              ['tuszE','tusz', tString(t, 'dc_ink'),'60'],
              ['notatnikE','notatnik', tString(t, 'dc_notebook'),'20'],
              ['dlugopisyE','dlugopisy', tString(t, 'dc_pens'),'10'],
            ] as Tuple4[]).map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updB({[eKey]:!b[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:b[eKey]?'#1e3a3a':'transparent', color:b[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {b[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label={tString(t, 'dc_per_month_lbl')}>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={cfgStr(b[vKey])} onChange={e=>updB({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{tString(t, 'dc_other_lbl')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {itemList(b.extraItems).map((ci: Record<string, unknown>, idx: number) => (
                  <div key={String(ci.id ?? idx)} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={cfgStr(ci.name)} maxLength={30} placeholder={tString(t, 'dc_pencils_ph')}
                        onChange={e=>{const a=[...itemList(b.extraItems)];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(itemList(b.extraItems).filter((_: Record<string, unknown>, i: number)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={tString(t, 'dc_per_month_ph')}
                      value={cfgStr(ci.price)}
                      onChange={e=>{const a=[...itemList(b.extraItems)];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...itemList(b.extraItems),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {tString(t, 'dc_add_item')}
                </button>
              </div>
            </div>
            {(totalFixed > 0 || totalExtra > 0) && (
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
                {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_supplies_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} {cur}</span></div>}
                {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{tString(t, 'dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} {cur}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                  <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} {cur}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'paliwo') {
          const p = o;
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const updP = (val: Record<string, unknown>) => updOther(key, val);
          const fetchPrices = async () => {
            setFetchingFuelPrices(true); setFetchFuelError('');
            try {
              const fp = await getFuelPrices(lang);
              updP({ fetchedPrices: fp, fuelPrice: String(fp[p.fuelType] || '') });
            } catch {
              setFetchFuelError(tString(t, 'dc_fetch_fuel_error'));
            } finally {
              setFetchingFuelPrices(false);
            }
          };
          const dailyCost = (nn(p.kmPerDay) / 100) * nn(p.consumption) * nn(p.fuelPrice) * days;
          const FUEL_LABELS: Record<string, string> = { diesel: 'Diesel', benzyna: tString(t, 'dc_fuel_petrol'), gaz: 'LPG' };
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <div style={{ display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid #374151', marginBottom:10 }}>
              {['diesel','benzyna','gaz'].map((type, i) => (
                <button key={type} type="button"
                  onClick={()=>updP({ fuelType:type, fuelPrice: String(p.fetchedPrices[type]||'') })}
                  style={{ flex:1, padding:'5px 4px', border:'none', borderRight:i<2?'1px solid #374151':'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:p.fuelType===type?'#1e3a3a':'transparent', color:p.fuelType===type?'#2dd4bf':'#6b7280' }}>
                  {FUEL_LABELS[type]}
                </button>
              ))}
            </div>
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:6 }}>
              <FieldBox label={tString(t, 'dc_fuel_price_lbl')}>
                <input type="number" className="no-spin" min="0" max="99" step="0.01" style={inp2}
                  placeholder={`${eg} 6.20`} value={p.fuelPrice} onChange={e=>updP({fuelPrice:cl2(e.target.value)})} />
              </FieldBox>
              <button type="button" onClick={fetchPrices} disabled={fetchingFuelPrices}
                style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600 }}>
                {fetchingFuelPrices ? '...' : tString(t, 'dc_fetch_fuel')}
              </button>
              {fetchFuelError && <div style={{ fontSize:10, color:'#ef4444' }}>{fetchFuelError}</div>}
              {p.fetchedPrices && Object.keys(p.fetchedPrices).length > 0 && (
                <div style={{ display:'flex', gap:8, fontSize:10, color:'#6b7280' }}>
                  {Object.entries(FUEL_LABELS).map(([k,lbl]) => p.fetchedPrices[k] &&
                    <span key={k}>{lbl}: <span style={{ color:'#9ca3af' }}>{p.fetchedPrices[k]} {cur}</span></span>
                  )}
                </div>
              )}
              <FieldBox label={tString(t, 'dc_km_per_day')}>
                <input type="number" className="no-spin" min="0" max="99999" step="1" style={inp2}
                  placeholder={`${eg} 40`} value={cfgStr(p.kmPerDay)} onChange={e=>updP({kmPerDay:cl2(e.target.value)})} />
              </FieldBox>
              <FieldBox label={tString(t, 'dc_consumption_lbl')}>
                <input type="number" className="no-spin" min="0" max="99" step="0.1" style={inp2}
                  placeholder={`${eg} 6.5`} value={cfgStr(p.consumption)} onChange={e=>updP({consumption:cl2(e.target.value)})} />
              </FieldBox>
            </div>
            {dailyCost > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                  <span style={{ color:'#6b7280' }}>{FUEL_LABELS[String(p.fuelType)] ?? ''} ({(nn(p.kmPerDay)*days).toFixed(0)} km)</span>
                  <span style={{ color:'#9ca3af' }}>{dailyCost.toFixed(2)} {cur}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                  <span style={{ color:'#0d9488' }}>{dailyCost.toFixed(2)} {cur}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'media') {
          const m = o;
          const nn = (v: unknown) => Math.min(99999, cfgNum(v));
          const updM = (val: Record<string, unknown>) => updOther(key, val);
          const total = ((m.internetE?nn(m.internet):0)+(m.telefonE?nn(m.telefon):0)+(m.tvE?nn(m.tv):0))/30*days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {([['internetE','internet','Internet','60'],['telefonE','telefon',tString(t, 'dc_media_phone'),'50'],['tvE','tv','TV','40']] as Tuple4[]).map(([eKey,vKey,label,ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updM({[eKey]:!m[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:m[eKey]?'#1e3a3a':'transparent', color:m[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {Boolean(m[eKey]) && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label={tString(t, 'dc_per_month_lbl')}>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={cfgStr(m[vKey])} onChange={e=>updM({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            {total > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:4, paddingTop:6 }}>
                {Boolean(m.internetE)&&nn(m.internet)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Internet</span><span style={{ color:'#9ca3af' }}>{(nn(m.internet)/30*days).toFixed(2)} {cur}</span></div>}
                {Boolean(m.telefonE)&&nn(m.telefon)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Phone</span><span style={{ color:'#9ca3af' }}>{(nn(m.telefon)/30*days).toFixed(2)} {cur}</span></div>}
                {Boolean(m.tvE)&&nn(m.tv)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>TV</span><span style={{ color:'#9ca3af' }}>{(nn(m.tv)/30*days).toFixed(2)} {cur}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{tFormatN(t, 'dc_days_label', days)}</span>
                  <span style={{ color:'#0d9488' }}>{total.toFixed(2)} {cur}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        const OPLATY_PH = { czynsz:'1500', prad:'200', gaz_oplata:'80', ogrzewanie:'300', kredyt:'800' };
        return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px', marginTop:4 }}>
            <FieldBox label={tString(t, 'dc_per_month_lbl')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder={OPLATY_PH[key as keyof typeof OPLATY_PH] || ''} value={cfgStr(o.monthlyAmount)} onChange={e=>updOther(key,{monthlyAmount:cl2(e.target.value)})} /></FieldBox>
            {Summary()}
          </div>
        );
      })()}
      {expanded && (
        <button type="button" onClick={e => { e.stopPropagation(); updOther(key, {...OTHER_DEFAULTS[key], enabled: true}); }}
          className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
          {tString(t, 'clear')}
        </button>
      )}
    </div>
  );
  };

  return (
    <div ref={cardRef}>

      <div style={{ marginBottom: 8 }}>
        <span className="card-section-title">{tString(t, 'expenses_select_title')}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:4, marginBottom:4 }}>
        {OTHER_TYPES.map(renderTile)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:4, marginBottom:8 }}>
        {DRINK_TYPES.map(({ key, emoji, gradient }) => {
          const enabled = Boolean(drinks[key]?.enabled);
          const expanded = expandedDrink === key;
          const cfg = { background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px 10px', marginTop:6 };
          return (
            <div key={key} style={{ display:'flex', flexDirection:'column' }}>
              <div onClick={() => handleTileClick(key)}
                onMouseEnter={e => e.currentTarget.style.filter='brightness(1.35)'}
                onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}
                style={{
                  height:100, borderRadius:12, cursor:'pointer',
                  background: gradient,
                  border: `2px solid ${enabled ? '#0d9488' : 'transparent'}`,
                  boxShadow: enabled ? '0 0 12px rgba(13,148,136,0.4)' : '0 2px 8px rgba(0,0,0,0.4)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                  opacity: enabled ? 1 : 0.55,
                  transition:'all 0.2s', userSelect:'none', position:'relative', overflow:'hidden',
                }}>
                <div style={{ position:'absolute', inset:0, background: enabled ? 'transparent' : 'rgba(0,0,0,0.2)' }} />
                <span style={{ fontSize:24, lineHeight:1, position:'relative', zIndex:1 }}>{emoji}</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 4px' }}>{tString(t, drinkI18nKey(key) as TranslationKey)}</span>
                {(() => { const pv = drinkTilePreview(key); return pv>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'4px 6px', textAlign:'center', fontSize:12, fontWeight:800, color:'#2dd4bf', zIndex:2, letterSpacing:'0.2px', opacity: enabled?1:0.7 }}>{pv.toFixed(2)} {cur}</div> : null; })()}
              </div>

              {/* Panel konfiguracji — szerokość tile'a */}
              {expanded && (() => {
                const tileTotal = items.filter((i) => i._dk === key).reduce((s,i)=>s+i.total,0);
                if (key === 'kawa') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={tString(t, 'dc_consumption_sec')}>
                        <FieldBox label={tString(t, 'dc_cups_per_day2')}><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={cfgStr(drinks.kawa.cupsPerDay)} onChange={e => upd('kawa',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tFormatN(t, 'dc_spoons_per_cup2', (cfgNum(drinks.kawa.spoonsPerCup))*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={cfgStr(drinks.kawa.spoonsPerCup)} onChange={e => upd('kawa',{spoonsPerCup:cl(e.target.value,20)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_sweetener_q')}><div style={{ display:'flex', gap:4 }}>{btnSugar('kawa','cukier')}{btnSugar('kawa','slodzik')}</div></FieldBox></div>
                        {Boolean(drinks.kawa.sugarType) && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.sugarType==='cukier'?tString(t, 'dc_sugar'):tString(t, 'dc_sweetener')}</div>
                          <FieldBox label={tFormatN(t, 'dc_spoons_s', (cfgNum(drinks.kawa.sugarSpoons))*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={cfgStr(drinks.kawa.sugarSpoons)} onChange={e => upd('kawa',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{tString(t, 'dc_price_per_kg')}</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.kawa.sugarType==='cukier'?'3.50':'15'} value={drinks.kawa.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999); if (drinks.kawa.sugarType==='cukier') setCukierPrice(parsePriceInput(v)); else setSlodzikPrice(parsePriceInput(v));}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label={tString(t, 'dc_milk_q')}>
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('kawa',{milkType: drinks.kawa.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.kawa.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.kawa.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.kawa.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?tString(t, 'dc_milk'):tString(t, 'dc_cream')}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {Boolean(drinks.kawa.milkType) && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.milkType==='mleko'?tString(t, 'dc_milk'):tString(t, 'dc_cream')}</div>
                            <FieldBox label="ml / cup"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={cfgStr(drinks.kawa.milkMlPerCup)} onChange={e => upd('kawa',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label={tString(t, 'dc_pkg_capacity_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={cfgStr(drinks.kawa.milkPkgMl)} onChange={e => upd('kawa',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={cfgStr(drinks.kawa.milkPrice)} onChange={e => upd('kawa',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title={tString(t, 'dc_packaging_sec')}>
                        <FieldBox label={tString(t, 'dc_pkg_weight_g')}><input type="number" className="no-spin" min="0" style={fi} placeholder="250" value={cfgStr(drinks.kawa.pkgG)} onChange={e => upd('kawa',{pkgG:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="18" value={cfgStr(drinks.kawa.pkgPrice)} onChange={e => upd('kawa',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[tFormatN(t, 'dc_cups_summary', cfgNum(drinks.kawa.cupsPerDay)), tFormatN(t, 'dc_days_label', days), tFormatN(t, 'dc_cups_total', cfgNum(drinks.kawa.cupsPerDay)*days)].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:tString(t, drinkI18nKey('kawa') as TranslationKey),val:items.filter(i=>i._dk==='kawa'&&i.name===tString(t, drinkI18nKey('kawa') as TranslationKey)).reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='kawa'&&i.name!==tString(t, drinkI18nKey('kawa') as TranslationKey)).map(i=>({label:_itemLabel((i.name ?? '').replace(' (kawa)','')),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} {cur}</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {cur}</div>
                    </div>
                  </div>
                );
                if (key === 'herbata') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={tString(t, 'dc_consumption_sec')}>
                        <FieldBox label={tString(t, 'dc_cups_per_day2')}><input type="number" className="no-spin" min="0" style={fi} placeholder="3" value={cfgStr(drinks.herbata.cupsPerDay)} onChange={e => upd('herbata',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_sweetener_q')}><div style={{ display:'flex', gap:4 }}>{btnSugar('herbata','cukier')}{btnSugar('herbata','slodzik')}</div></FieldBox></div>
                        {Boolean(drinks.herbata.sugarType) && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.sugarType==='cukier'?tString(t, 'dc_sugar'):tString(t, 'dc_sweetener')}</div>
                          <FieldBox label={tFormatN(t, 'dc_spoons_s', (cfgNum(drinks.herbata.sugarSpoons))*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={cfgStr(drinks.herbata.sugarSpoons)} onChange={e => upd('herbata',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{tString(t, 'dc_price_per_kg')}</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.herbata.sugarType==='cukier'?'3.50':'15'} value={drinks.herbata.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999); if (drinks.herbata.sugarType==='cukier') setCukierPrice(parsePriceInput(v)); else setSlodzikPrice(parsePriceInput(v));}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label={tString(t, 'dc_milk_q')}>
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('herbata',{milkType: drinks.herbata.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.herbata.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.herbata.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.herbata.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?tString(t, 'dc_milk'):tString(t, 'dc_cream')}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {Boolean(drinks.herbata.milkType) && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.milkType==='mleko'?tString(t, 'dc_milk'):tString(t, 'dc_cream')}</div>
                            <FieldBox label="ml / cup"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={cfgStr(drinks.herbata.milkMlPerCup)} onChange={e => upd('herbata',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label={tString(t, 'dc_pkg_capacity_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={cfgStr(drinks.herbata.milkPkgMl)} onChange={e => upd('herbata',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={cfgStr(drinks.herbata.milkPrice)} onChange={e => upd('herbata',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title={tString(t, 'dc_packaging_sec')}>
                        <FieldBox label={tString(t, 'dc_sachets_in_pkg')}><input type="number" className="no-spin" min="0" style={fi} placeholder="100" value={cfgStr(drinks.herbata.sachetPerPkg)} onChange={e => upd('herbata',{sachetPerPkg:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="8" value={cfgStr(drinks.herbata.pkgPrice)} onChange={e => upd('herbata',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[tFormatN(t, 'dc_cups_summary', cfgNum(drinks.herbata.cupsPerDay)), tFormatN(t, 'dc_days_label', days), tFormatN(t, 'dc_cups_total', cfgNum(drinks.herbata.cupsPerDay)*days)].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:tString(t, drinkI18nKey('herbata') as TranslationKey),val:items.filter(i=>i._dk==='herbata'&&i.name===tString(t, drinkI18nKey('herbata') as TranslationKey)).reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='herbata'&&i.name!==tString(t, drinkI18nKey('herbata') as TranslationKey)).map(i=>({label:_itemLabel((i.name ?? '').replace(' (herbata)','')),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} {cur}</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {cur}</div>
                    </div>
                  </div>
                );
                if (key === 'napoje') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={tString(t, 'dc_packaging_sec')}>
                        <FieldBox label={tString(t, 'dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={cfgStr(drinks.napoje.litersPerDay)} onChange={e => upd('napoje',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_capacity_l2')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="2" value={cfgStr(drinks.napoje.pkgL)} onChange={e => upd('napoje',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="4" value={cfgStr(drinks.napoje.pkgPrice)} onChange={e => upd('napoje',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[tFormatN(t, 'dc_liters_summary', cfgNum(drinks.napoje.litersPerDay)), tFormatN(t, 'dc_days_label', days), tFormat(t, 'dc_liters_total', (cfgNum(drinks.napoje.litersPerDay)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {cur}</div>
                    </div>
                  </div>
                );
                if (key === 'woda') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={tString(t, 'dc_packaging_sec')}>
                        <FieldBox label={tString(t, 'dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1.5" value={cfgStr(drinks.woda.litersPerDay)} onChange={e => upd('woda',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_capacity_l2')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="5" value={cfgStr(drinks.woda.pkgL)} onChange={e => upd('woda',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3" value={cfgStr(drinks.woda.pkgPrice)} onChange={e => upd('woda',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[tFormatN(t, 'dc_liters_summary', cfgNum(drinks.woda.litersPerDay)), tFormatN(t, 'dc_days_label', days), tFormat(t, 'dc_liters_total', (cfgNum(drinks.woda.litersPerDay)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {cur}</div>
                    </div>
                  </div>
                );
                if (key === 'sodaStream') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={tString(t, 'dc_consumption_sec')}>
                        <FieldBox label={tString(t, 'dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={cfgStr(drinks.sodaStream.litersPerDay)} onChange={e => upd('sodaStream',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}>
                          <div style={{ fontSize:10, color:'#6b7280', marginBottom:4 }}>{tString(t, 'dc_sweetness')}</div>
                          <div style={{ display:'flex', gap:4 }}>
                            {[{label:'Light',ml:30},{label:'Sweet',ml:45},{label:'Very Sweet',ml:55}].map(({label:lbl,ml}) => (
                              <button key={ml} type="button" onClick={() => upd('sodaStream',{mlPer1L:ml})}
                                style={{ flex:1, padding:'5px 4px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                  background: drinks.sodaStream.mlPer1L===ml?'#1e3a3a':'transparent', borderColor:'#374151', color: drinks.sodaStream.mlPer1L===ml?'#2dd4bf':'#6b7280' }}>
                                {lbl}<br/><span style={{ fontSize:9, opacity:0.8 }}>{ml}ml/L</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </InnerSec>
                      <InnerSec title={tString(t, 'dc_syrup_sec')}>
                        <FieldBox label={tString(t, 'dc_syrup_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="440" value={cfgStr(drinks.sodaStream.syrupMl)} onChange={e => upd('sodaStream',{syrupMl:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_syrup_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="25" value={cfgStr(drinks.sodaStream.syrupPrice)} onChange={e => upd('sodaStream',{syrupPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                      <InnerSec title={tString(t, 'dc_gas_cylinder')}>
                        <FieldBox label={tString(t, 'dc_exchange_days')}><input type="number" className="no-spin" min="0" style={fi} placeholder={`${eg} 30`} value={cfgStr(drinks.sodaStream.cylinderDays)} onChange={e => upd('sodaStream',{cylinderDays:cl(e.target.value,3650)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={tString(t, 'dc_exchange_cost')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder={`${eg} 50`} value={cfgStr(drinks.sodaStream.cylinderCost)} onChange={e => upd('sodaStream',{cylinderCost:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[tFormatN(t, 'dc_liters_summary', cfgNum(drinks.sodaStream.litersPerDay)), tFormatN(t, 'dc_days_label', days), tFormat(t, 'dc_liters_total', (cfgNum(drinks.sodaStream.litersPerDay)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {cur}</div>
                    </div>
                  </div>
                );
                return null;
              })()}
              {expanded && (
                <button type="button" onClick={e => { e.stopPropagation(); upd(key, {...DRINKS_DEFAULTS[key], enabled: true}); }}
                  className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
                  {tString(t, 'clear')}
                </button>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default DrinksCard;
