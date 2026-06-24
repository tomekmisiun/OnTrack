import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { fuel as fuelApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { expenseI18nKey, drinkI18nKey } from '../i18n/expenseKeys';

function FieldBox({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:10, color:'#6b7280' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>{children}</div>
    </div>
  );
}

const _inp = { width:'100%', boxSizing:'border-box', padding:'6px 8px', fontSize:13 };
const _clamp = v => { if (v === '') return ''; const n = parseFloat(v); return isNaN(n) ? '' : String(Math.min(99999, Math.max(0, n))); };

function FI({ label, val, onChange, step='1', max='99999', ph='' }) {
  return (
    <FieldBox label={label}>
      <input type="number" className="no-spin" min="0" max={max} step={step} style={_inp} placeholder={ph} value={val} onChange={e=>onChange(_clamp(e.target.value))} />
    </FieldBox>
  );
}

function MI({ label, val, onChange, step='0.01', ph='' }) {
  return (
    <FieldBox label={label}>
      <input type="number" className="no-spin" min="0" max="99999" step={step} style={_inp} placeholder={ph} value={val} onChange={e=>onChange(_clamp(e.target.value))} />
    </FieldBox>
  );
}

function InnerSec({ title, children, mb=10, flex=false }) {
  return (
    <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, marginBottom:mb, ...(flex && { display:'flex', flexDirection:'column', gap:5 }) }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom: flex ? 2 : 6 }}>{title}</div>
      {children}
    </div>
  );
}

function TogBtn({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex:1, padding:'5px 4px', border:'1px solid #374151', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
        background:active?'#1e3a3a':'transparent', color:active?'#2dd4bf':'#6b7280' }}>
      {label}
    </button>
  );
}

export const OTHER_TYPES = [
  { key:'czynsz',     label:'Czynsz',         emoji:'🏠', gradient:'linear-gradient(135deg,#1a1020,#3a2050)' },
  { key:'prad',       label:'Prąd',           emoji:'⚡', gradient:'linear-gradient(135deg,#1a1800,#3a3800)' },
  { key:'gaz_oplata', label:'Gaz',            emoji:'🔥', gradient:'linear-gradient(135deg,#1a0a00,#4a2000)' },
  { key:'media',      label:'Media',          emoji:'📡', gradient:'linear-gradient(135deg,#001020,#002050)' },
  { key:'ogrzewanie', label:'Ogrzewanie',     emoji:'🌡️', gradient:'linear-gradient(135deg,#200a00,#502000)' },
  { key:'kredyt',     label:'Kredyt',         emoji:'💳', gradient:'linear-gradient(135deg,#001a10,#004030)' },
  { key:'dziecko',  label:'Dziecko',        emoji:'🧸', gradient:'linear-gradient(135deg,#2a1020,#5a2040)' },
  { key:'zwierze',  label:'Zwierzę',        emoji:'🐾', gradient:'linear-gradient(135deg,#1a1a0a,#3a3a10)' },
  { key:'lekarze',    label:'Lekarze i leki', emoji:'🏥', gradient:'linear-gradient(135deg,#0a1a10,#0a3a20)' },
  { key:'paliwo',     label:'Paliwo',         emoji:'⛽', gradient:'linear-gradient(135deg,#2a0a0a,#5a1a1a)' },
  { key:'pranie',   label:'Pranie',         emoji:'🫧', gradient:'linear-gradient(135deg,#0a2040,#1a5080)' },
  { key:'zmywanie', label:'Zmywanie',       emoji:'🍽️', gradient:'linear-gradient(135deg,#1a2a0a,#3a5a1a)' },
  { key:'sprzatan', label:'Sprzątanie',     emoji:'🧹', gradient:'linear-gradient(135deg,#2a1a0a,#5a3a1a)' },
  { key:'higiena',  label:'Higiena',        emoji:'🪥', gradient:'linear-gradient(135deg,#1a0a2a,#3a1a5a)' },
  { key:'biurowe',    label:'Art. biurowe',   emoji:'📎', gradient:'linear-gradient(135deg,#0a1a2a,#1a3a4a)' },
];
// Klucze wydatków domowych — współdzielone między profilami (jeden budżet na gospodarstwodo domowe)
const SHARED_KEYS = new Set(['czynsz','prad','gaz_oplata','media','ogrzewanie','dziecko','zwierze','pranie','zmywanie','sprzatan']);
export const OTHER_DEFAULTS = {
  papier:   { enabled:false, monthlyAmount:'', dailyRolls:'0.5', pkgPrice:'', rollsPerPkg:'8' },
  pranie:   { enabled:false, monthlyAmount:'', washesPerWeek:'5', detergentType:'proszek',
              proszekPerWash:'75', proszekPkgKg:'3', proszekPkgPrice:'',
              plynPerWash:'35', plynPkgL:'1.5', plynPkgPrice:'',
              kapsulkiPerPkg:'30', kapsulkiPkgPrice:'',
              plukanie:false, plukaniePerWash:'25', plukanieL:'1', plukaniePkgPrice:'' },
  zmywanie: { enabled:false, monthlyAmount:'', useReczne:false, useZmywarka:false,
              pkgDuration:'30', durationUnit:'dni', pkgPrice:'',
              usesPerWeek:'7', kapsPerPkg:'30', kapsulkiPkgPrice:'' },
  sprzatan: { enabled:false, monthlyAmount:'', bagsPerWeek:'', bagsPerPkg:'20', bagsPkgPrice:'',
              cleaningItems:[] },
  higiena:  { enabled:false, monthlyAmount:'',
              zbRazDzien:'2', zbPastaG:'1', zbTubkaMl:'75', zbTubkaPrice:'', zbSzczetokaPrice:'',
              wlRazW:'3', wlSzampon:false, wlSzamponWyc:'2', wlSzamponMl:'400', wlSzamponPrice:'',
                          wlOdzywka:false, wlOdzywkaWyc:'1', wlOdzywkaMl:'300', wlOdzywkaPrice:'',
              kapRazW:'7', kapZel:false, kapZelWyc:'3', kapZelMl:'400', kapZelPrice:'',
                           kapMydlo:false, kapMydloG:'90', kapMydloPrice:'',
              inneItems:[],
              papierE:false, papierDailyRolls:'', papierRollsPerPkg:'', papierPkgPrice:'' },
  dziecko:  { enabled:false, monthlyAmount:'',
              przedszkoleE:false, przedszkole:'',
              obiadE:false, obiad:'',
              zajeciaE:false, zajecia:'',
              korepetycjeE:false, korepetycje:'',
              materialyE:false, materialy:'',
              dojazdyE:false, dojazdy:'',
              odziezdE:false, odziez:'',
              kieszonkoweE:false, kieszonkowe:'',
              zabawkiE:false, zabawki:'',
              kosmetykiE:false, kosmetyki:'',
              pieluchyEnabled:false, pieluchyPerDay:'5', pieluchyPerPkg:'50', pieluchyPrice:'',
              mlekoEnabled:false, mlekoPerDay:'5', mlekoPkgScoops:'30', mlekoPrice:'',
              extraItems:[] },
  zwierze:  { enabled:false, monthlyAmount:'',
              suchaE:false, suchaG:'50', suchaPkgG:'2000', suchaPrice:'',
              mokraE:false, mokraSzt:'1', mokraGram:'400', mokraPrice:'',
              zwierekE:false, zwierekDni:'7', zwierekL:'3', zwierekPkgL:'5', zwierekPrice:'',
              wetE:false, wet:'',
              pielegnacjaE:false, pielegnacja:'',
              akcesoriaE:false, akcesoria:'', extraItems:[] },
  lekarze:  { enabled:false, monthlyAmount:'', wizyty:'', leki:'' },
  biurowe:  { enabled:false, monthlyAmount:'', papierA4E:false, papierA4:'', tuszE:false, tusz:'', notatnikE:false, notatnik:'', dlugopisyE:false, dlugopisy:'', extraItems:[] },
  paliwo:     { enabled:false, monthlyAmount:'', fuelType:'diesel', kmPerDay:'', consumption:'', fuelPrice:'', fetchedPrices:{} },
  czynsz:     { enabled:false, monthlyAmount:'' },
  prad:       { enabled:false, monthlyAmount:'' },
  gaz_oplata: { enabled:false, monthlyAmount:'' },
  media:      { enabled:false, monthlyAmount:'', internetE:false, internet:'', telefonE:false, telefon:'', tvE:false, tv:'' },
  ogrzewanie: { enabled:false, monthlyAmount:'' },
  kredyt:     { enabled:false, monthlyAmount:'' },
};

const DRINK_TYPES = [
  { key:'kawa',       emoji:'☕', gradient:'linear-gradient(135deg,#2d1000,#7a3800)' },
  { key:'herbata',    emoji:'🍵', gradient:'linear-gradient(135deg,#0a1f0a,#1a5a1a)' },
  { key:'napoje',     emoji:'🥤', gradient:'linear-gradient(135deg,#0a1040,#1a3a8a)' },
  { key:'woda',       emoji:'💧', gradient:'linear-gradient(135deg,#001828,#006080)' },
  { key:'sodaStream', emoji:'🫧', gradient:'linear-gradient(135deg,#100a30,#3a0a6a)' },
];

export const DRINKS_DEFAULTS = {
  kawa:       { enabled:false, cupsPerDay:2, spoonsPerCup:2, pkgG:200, pkgPrice:'', sugarType:null, sugarSpoons:1, milkType:null, milkMlPerCup:'', milkPkgMl:'', milkPrice:'' },
  herbata:    { enabled:false, cupsPerDay:2, sachetPerPkg:20, pkgPrice:'', sugarType:null, sugarSpoons:1, milkType:null, milkMlPerCup:'', milkPkgMl:'', milkPrice:'' },
  napoje:     { enabled:false, litersPerDay:1,  pkgL:1.5, pkgPrice:'' },
  woda:       { enabled:false, litersPerDay:2,  pkgL:1.5, pkgPrice:'' },
  sodaStream: { enabled:false, litersPerDay:1,  syrupMl:440, syrupPrice:'', mlPer1L:25, cylinderDays:'', cylinderCost:'' },
};
export function loadDrinksFromLS() {
  try {
    const saved = JSON.parse(localStorage.getItem('drinksConfig') || '{}');
    return Object.fromEntries(Object.entries(DRINKS_DEFAULTS).map(([k, def]) => {
      const s = { ...(saved[k] || {}) };
      if ('sugar' in s && !('sugarType' in s)) { s.sugarType = s.sugar ? 'cukier' : null; delete s.sugar; }
      return [k, { ...def, ...s }];
    }));
  } catch { return { ...DRINKS_DEFAULTS }; }
}

function DrinksCard({ days, periodLabel, productList, onUpdate, pieCategories = [] }) {
  const { t, lang } = useLanguage();
  const eg = t('eg_prefix');
  const _itemLabel = (name) => {
    const map = { 'Cukier': t('dc_sugar'), 'Słodzik': t('dc_sweetener'), 'Mleko': t('dc_milk'), 'Śmietanka': t('dc_cream') };
    return map[name] || name;
  };
  const [drinks, setDrinks] = useState(loadDrinksFromLS);
  const [expandedDrink, setExpandedDrink] = useState(null);
  const [otherExpenses, setOtherExpenses] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('otherExpenses')||'{}'); return Object.fromEntries(OTHER_TYPES.map(t=>[t.key,{...OTHER_DEFAULTS[t.key],...(s[t.key]||{})}])); } catch { return {...OTHER_DEFAULTS}; }
  });
  const [otherExpanded, setOtherExpanded] = useState(null);
  const [fetchingFuelPrices, setFetchingFuelPrices] = useState(false);
  const [fetchFuelError, setFetchFuelError] = useState('');
  const [cukierPrice, setCukierPrice] = useState(() => { const v = localStorage.getItem('drinksCukierPrice'); return v !== null ? parseFloat(v) : null; });
  const [slodzikPrice, setSlodzikPrice] = useState(() => { const v = localStorage.getItem('drinksSlodzikPrice'); return v !== null ? parseFloat(v) : null; });

  const cukierProduct = useMemo(() => productList.find(p => /cukier/i.test(p.name) && p.unit === 'g'), [productList]);
  const slodzikProduct = useMemo(() => productList.find(p => /słodzik/i.test(p.name) && p.unit === 'g'), [productList]);
  const effCukierPrice = cukierPrice !== null ? cukierPrice : (cukierProduct ? cukierProduct.price * 10 : 3.5);
  const effSlodzikPrice = slodzikPrice !== null ? slodzikPrice : (slodzikProduct ? slodzikProduct.price * 10 : 15);

  const upd = (key, val) => setDrinks(d => ({ ...d, [key]: { ...d[key], ...val } }));
  const fi = { width:'100%', boxSizing:'border-box', padding:'6px 8px', fontSize:13 };
  const cl = (val, max) => { if (val === '') return ''; const n = parseFloat(val); return isNaN(n) ? '' : String(Math.min(max, Math.max(0, n))); };

  const drinkTilePreview = (key) => {
    const nn = v => parseFloat(v) || 0;
    const pft = t => (3/1000)*(t==='cukier'?effCukierPrice:effSlodzikPrice);
    const d = drinks; let daily = 0;
    if (key==='kawa')      {
      daily=(nn(d.kawa.cupsPerDay)*nn(d.kawa.spoonsPerCup)*3/Math.max(1,nn(d.kawa.pkgG)))*nn(d.kawa.pkgPrice);
      if(d.kawa.sugarType) daily+=nn(d.kawa.cupsPerDay)*nn(d.kawa.sugarSpoons)*pft(d.kawa.sugarType);
      if(d.kawa.milkType && nn(d.kawa.milkPkgMl)>0) daily+=nn(d.kawa.cupsPerDay)*nn(d.kawa.milkMlPerCup)/nn(d.kawa.milkPkgMl)*nn(d.kawa.milkPrice);
    }
    else if(key==='herbata'){
      daily=(nn(d.herbata.cupsPerDay)/Math.max(1,nn(d.herbata.sachetPerPkg)))*nn(d.herbata.pkgPrice);
      if(d.herbata.sugarType) daily+=nn(d.herbata.cupsPerDay)*nn(d.herbata.sugarSpoons)*pft(d.herbata.sugarType);
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
  const otherTilePreview = (key) => {
    const o = otherExpenses[key]; if (!o) return 0;
    const n2 = v => Math.min(99999, parseFloat(v)||0);
    return items.filter(i=>i._dk===key).reduce((s,i)=>s+i.total,0) ||
           (n2(o.monthlyAmount)/30)*days;
  };
  const cardRef = React.useRef(null);

  // 1. klik → zaznacz + otwórz | 2. klik → zwiń | 3. klik → odznacz
  const updOther = (key, val) => setOtherExpenses(d => ({ ...d, [key]: { ...d[key], ...val } }));
  const handleOtherClick = (key) => {
    const enabled = otherExpenses[key].enabled;
    const expanded = otherExpanded === key;
    if (!enabled) { updOther(key, { enabled: true }); setOtherExpanded(key); }
    else if (expanded) { setOtherExpanded(null); }
    else { updOther(key, { enabled: false }); }
  };

  const handleTileClick = (key) => {
    const enabled = drinks[key].enabled;
    const expanded = expandedDrink === key;
    if (!enabled) { upd(key, { enabled: true }); setExpandedDrink(key); }
    else if (expanded) { setExpandedDrink(null); }
    else { upd(key, { enabled: false }); }
  };

  // Kliknięcie poza kartą → zwiń panel
  useEffect(() => {
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
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
    const n = (v) => parseFloat(v) || 0;
    const list = [];
    const priceForType = (t) => (3 / 1000) * (t === 'cukier' ? effCukierPrice : effSlodzikPrice);
    const d = drinks;
    if (d.kawa.enabled) {
      const gPerDay = n(d.kawa.cupsPerDay) * n(d.kawa.spoonsPerCup) * 3;
      const daily = (gPerDay / Math.max(1, n(d.kawa.pkgG))) * n(d.kawa.pkgPrice);
      list.push({ name: t(drinkI18nKey('kawa')), daily, total: daily * days, _dk: 'kawa' });
      if (d.kawa.sugarType) { const sd = n(d.kawa.cupsPerDay) * n(d.kawa.sugarSpoons) * priceForType(d.kawa.sugarType); list.push({ name:`${d.kawa.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (kawa)`, daily:sd, total:sd*days, _dk:'kawa' }); }
      if (d.kawa.milkType && n(d.kawa.milkPkgMl)>0) { const md = n(d.kawa.cupsPerDay)*n(d.kawa.milkMlPerCup)/n(d.kawa.milkPkgMl)*n(d.kawa.milkPrice); list.push({ name:`${d.kawa.milkType==='mleko'?'Mleko':'Śmietanka'} (kawa)`, daily:md, total:md*days, _dk:'kawa' }); }
    }
    if (d.herbata.enabled) {
      const daily = (n(d.herbata.cupsPerDay) / Math.max(1, n(d.herbata.sachetPerPkg))) * n(d.herbata.pkgPrice);
      list.push({ name: t(drinkI18nKey('herbata')), daily, total: daily * days, _dk: 'herbata' });
      if (d.herbata.sugarType) { const sd = n(d.herbata.cupsPerDay) * n(d.herbata.sugarSpoons) * priceForType(d.herbata.sugarType); list.push({ name:`${d.herbata.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (herbata)`, daily:sd, total:sd*days, _dk:'herbata' }); }
      if (d.herbata.milkType && n(d.herbata.milkPkgMl)>0) { const md = n(d.herbata.cupsPerDay)*n(d.herbata.milkMlPerCup)/n(d.herbata.milkPkgMl)*n(d.herbata.milkPrice); list.push({ name:`${d.herbata.milkType==='mleko'?'Mleko':'Śmietanka'} (herbata)`, daily:md, total:md*days, _dk:'herbata' }); }
    }
    if (d.napoje.enabled)    { const daily = (n(d.napoje.litersPerDay) / Math.max(0.001, n(d.napoje.pkgL))) * n(d.napoje.pkgPrice); list.push({ name: t(drinkI18nKey('napoje')), daily, total: daily * days, _dk: 'napoje' }); }
    if (d.woda.enabled)      { const daily = (n(d.woda.litersPerDay)   / Math.max(0.001, n(d.woda.pkgL)))   * n(d.woda.pkgPrice);   list.push({ name: t(drinkI18nKey('woda')),   daily, total: daily * days, _dk: 'woda' }); }
    if (d.sodaStream.enabled){
      const syrupDaily = n(d.sodaStream.litersPerDay) * (n(d.sodaStream.mlPer1L) / Math.max(1, n(d.sodaStream.syrupMl))) * n(d.sodaStream.syrupPrice);
      const cylDaily = n(d.sodaStream.cylinderDays) > 0 ? n(d.sodaStream.cylinderCost) / n(d.sodaStream.cylinderDays) : 0;
      const daily = syrupDaily + cylDaily;
      list.push({ name: t(drinkI18nKey('sodaStream')), daily, total: daily * days, _dk: 'sodaStream' });
    }
    OTHER_TYPES.forEach(ot => {
      const o = otherExpenses[ot.key];
      if (!o?.enabled) return;
      const n = v => Math.min(99999, parseFloat(v) || 0);
      let daily = 0;
      if (ot.key === 'papier') {
        daily = (n(o.dailyRolls) / Math.max(1, n(o.rollsPerPkg))) * n(o.pkgPrice);
      } else if (ot.key === 'pranie') {
        const washesPerDay = n(o.washesPerWeek) / 7;
        let det = 0;
        if (o.detergentType === 'proszek')   det = (n(o.proszekPerWash) / Math.max(1, n(o.proszekPkgKg) * 1000)) * n(o.proszekPkgPrice);
        else if (o.detergentType === 'plyn') det = (n(o.plynPerWash) / Math.max(1, n(o.plynPkgL) * 1000)) * n(o.plynPkgPrice);
        else                                  det = n(o.kapsulkiPkgPrice) / Math.max(1, n(o.kapsulkiPerPkg));
        let plu = 0;
        if (o.plukanie) plu = (n(o.plukaniePerWash) / Math.max(1, n(o.plukanieL) * 1000)) * n(o.plukaniePkgPrice);
        daily = (det + plu) * washesPerDay;
      } else if (ot.key === 'sprzatan') {
        const bagDaily = (n(o.bagsPerWeek) / 7) * (n(o.bagsPkgPrice) / Math.max(1, n(o.bagsPerPkg)));
        const cleanDaily = (o.cleaningItems || []).reduce((s, ci) => s + (n(ci.perMonth) * n(ci.pkgPrice)) / 30, 0);
        daily = bagDaily + cleanDaily;
      } else if (ot.key === 'higiena') {
        const h = o; const nn2 = v => Math.min(99999, parseFloat(v)||0);
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
        (h.inneItems||[]).forEach(ci => { daily += (n(ci.perMonth)*n(ci.pkgPrice))/30; });
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
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (ot.key === 'dziecko') {
        [['przedszkole','przedszkoleE'],['obiad','obiadE'],['zajecia','zajeciaE'],['korepetycje','korepetycjeE'],
         ['materialy','materialyE'],['dojazdy','dojazdyE'],['odziez','odziezdE'],['kieszonkowe','kieszonkoweE'],['zabawki','zabawkiE'],['kosmetyki','kosmetykiE']]
          .forEach(([k,e]) => { if (o[e]) daily += n(o[k]) / 30; });
        if (o.pieluchyEnabled) daily += (n(o.pieluchyPerDay) / Math.max(1, n(o.pieluchyPerPkg))) * n(o.pieluchyPrice);
        if (o.mlekoEnabled) daily += (n(o.mlekoPerDay) / Math.max(1, n(o.mlekoPkgScoops))) * n(o.mlekoPrice);
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (ot.key === 'lekarze') {
        const wizD = n(o.wizyty) / 30;
        const lekD = n(o.leki) / 30;
        if (wizD > 0) list.push({ name: t('dc_doctors'), _tkey: 'dc_doctors', daily: wizD, total: wizD * days, _dk: 'lekarze' });
        if (lekD > 0) list.push({ name: t('dc_medicine'), _tkey: 'dc_medicine', daily: lekD, total: lekD * days, _dk: 'lekarze' });
        return;
      } else if (ot.key === 'biurowe') {
        if (o.papierA4E) daily += n(o.papierA4) / 30;
        if (o.tuszE) daily += n(o.tusz) / 30;
        if (o.notatnikE) daily += n(o.notatnik) / 30;
        if (o.dlugopisyE) daily += n(o.dlugopisy) / 30;
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (ot.key === 'paliwo') {
        daily = (n(o.kmPerDay) / 100) * n(o.consumption) * n(o.fuelPrice);
      } else if (ot.key === 'media') {
        if (o.internetE) daily += n(o.internet) / 30;
        if (o.telefonE) daily += n(o.telefon) / 30;
        if (o.tvE) daily += n(o.tv) / 30;
      } else {
        daily = n(o.monthlyAmount) / 30;
      }
      list.push({ name: t(expenseI18nKey(ot.key)), daily, total: daily * days, _dk: ot.key });
    });
    return list;
  }, [drinks, days, effCukierPrice, effSlodzikPrice, otherExpenses]);

  useEffect(() => { onUpdate(items); }, [items]); // eslint-disable-line



  const btnSugar = (drinkKey, type) => {
    const cur = drinks[drinkKey].sugarType;
    return (
      <button type="button" onClick={() => upd(drinkKey, { sugarType: cur === type ? null : type })}
        style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
          background: cur === type ? '#0d9488' : '#2d3748',
          borderColor: cur === type ? '#0d9488' : '#374151',
          color: cur === type ? 'white' : '#9ca3af' }}>
        {type === 'cukier' ? t('dc_sugar') : t('dc_sweetener')}
      </button>
    );
  };

  const renderTile = ({ key, label, emoji, gradient }) => {
  const enabled = otherExpenses[key].enabled;
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
            <span style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', letterSpacing:'0.3px', lineHeight:1 }}>{t('expenses_shared')}</span>
          </div>
        )}
        <span style={{ fontSize:16, lineHeight:1, position:'relative', zIndex:1 }}>{emoji}</span>
        <span style={{ fontSize:9, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 3px', lineHeight:1.3 }}>{t(expenseI18nKey(key))}</span>
        {(() => { const pv = otherTilePreview(key); return pv>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'3px 4px', textAlign:'center', fontSize:10, fontWeight:800, color:'#2dd4bf', zIndex:2, opacity: enabled?1:0.7 }}>{pv.toFixed(2)} {t('currency')}</div> : null; })()}
      </div>
      {expanded && (() => {
        const o = otherExpenses[key];
        const tot = items.filter(i=>i._dk===key).reduce((s,i)=>s+i.total,0);
        const Summary = () => (
          <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5 }}>
            <div style={{ fontSize:9, color:'#6b7280' }}>{t('dc_days_label')(days)}</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#0d9488' }}>{tot.toFixed(2)} {t('currency')}</div>
          </div>
        );
        const inp2 = { ...fi, width:'100%' };
        const cl2 = v => cl(v, 99999);
        if (key === 'papier') {
          const nn2 = v => Math.min(99999, parseFloat(v)||0);
          const rollsUsed = nn2(o.dailyRolls) * days;
          const papierCost = (nn2(o.dailyRolls) / Math.max(1, nn2(o.rollsPerPkg))) * nn2(o.pkgPrice) * days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:6 }}>
              <FieldBox label={t('dc_rolls_per_day')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.dailyRolls} placeholder="0.5" onChange={e=>updOther(key,{dailyRolls:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_rolls_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.rollsPerPkg} placeholder="16" onChange={e=>updOther(key,{rollsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.pkgPrice} placeholder="23" onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_rolls_used')(rollsUsed.toFixed(1))}</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{papierCost.toFixed(2)} {t('currency')}</span>
              </div>
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{papierCost.toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'pranie') {
          const nn = v => Math.min(99999, parseFloat(v) || 0);
          const washesTotal = (nn(o.washesPerWeek) / 7) * days;
          let detDaily = 0;
          let detLabel = '';
          if (o.detergentType === 'proszek')   { detDaily = (nn(o.proszekPerWash) / Math.max(1, nn(o.proszekPkgKg)*1000)) * nn(o.proszekPkgPrice); detLabel = t('dc_powder'); }
          else if (o.detergentType === 'plyn') { detDaily = (nn(o.plynPerWash) / Math.max(1, nn(o.plynPkgL)*1000)) * nn(o.plynPkgPrice); detLabel = t('dc_liquid'); }
          else                                  { detDaily = nn(o.kapsulkiPkgPrice) / Math.max(1, nn(o.kapsulkiPerPkg)); detLabel = t('dc_capsules'); }
          const detCost = detDaily * washesTotal;
          let pluCost = 0;
          if (o.plukanie) pluCost = (nn(o.plukaniePerWash) / Math.max(1, nn(o.plukanieL)*1000)) * nn(o.plukaniePkgPrice) * washesTotal;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={t('exp_laundry')}>
              <FieldBox label={t('dc_washes_per_week')}><input type="number" className="no-spin" min="0" max="99999" step="0.5" style={inp2} value={o.washesPerWeek} placeholder="5" onChange={e=>updOther(key,{washesPerWeek:cl2(e.target.value)})} /></FieldBox>
            </InnerSec>
            <InnerSec title={t('dc_detergent')}>
            <div style={{ display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid #374151' }}>
              {['proszek','plyn','kapsulki'].map((type,i) => (
                <button key={type} type="button" onClick={()=>updOther(key,{detergentType:type})}
                  style={{ flex:1, padding:'5px 4px', border:'none', borderRight:i<2?'1px solid #374151':'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o.detergentType===type?'#1e3a3a':'transparent', color:o.detergentType===type?'#2dd4bf':'#6b7280' }}>
                  {type==='proszek'?t('dc_powder'):type==='plyn'?t('dc_liquid'):t('dc_capsules')}
                </button>
              ))}
            </div>
            {o.detergentType === 'proszek' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_powder')}</div>
              <FieldBox label={t('dc_grams_per_wash')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.proszekPerWash} placeholder="75" onChange={e=>updOther(key,{proszekPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_capacity_kg')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.proszekPkgKg} placeholder="3" onChange={e=>updOther(key,{proszekPkgKg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.proszekPkgPrice} placeholder="40" onChange={e=>updOther(key,{proszekPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'plyn' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_liquid')}</div>
              <FieldBox label="ml / wash"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.plynPerWash} onChange={e=>updOther(key,{plynPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_capacity_l')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.plynPkgL} onChange={e=>updOther(key,{plynPkgL:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.plynPkgPrice} onChange={e=>updOther(key,{plynPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'kapsulki' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_capsules')}</div>
              <FieldBox label={t('dc_capsules_per_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.kapsulkiPerPkg} onChange={e=>updOther(key,{kapsulkiPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.kapsulkiPkgPrice} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            </InnerSec>
            <InnerSec title={t('dc_fabric_softener_section')}>
              <button type="button" onClick={()=>updOther(key,{plukanie:!o.plukanie})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:o.plukanie?'#1e3a3a':'transparent', borderColor:'#374151', color:o.plukanie?'#2dd4bf':'#6b7280' }}>
                {t('dc_fabric_softener')}
              </button>
              {o.plukanie && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_fabric_softener')}</div>
                <FieldBox label="ml / wash"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.plukaniePerWash} placeholder="25" onChange={e=>updOther(key,{plukaniePerWash:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={t('dc_pkg_capacity_l')}><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.plukanieL} placeholder="1.5" onChange={e=>updOther(key,{plukanieL:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.plukaniePkgPrice} placeholder="15" onChange={e=>updOther(key,{plukaniePkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>}
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>{detLabel} ({Math.round(washesTotal)} washes)</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{detCost.toFixed(2)} {t('currency')}</span>
              </div>
              {o.plukanie && pluCost > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                  <span style={{ color:'#6b7280' }}>{t('dc_fabric_softener')}</span>
                  <span style={{ color:'#9ca3af', fontWeight:600 }}>{pluCost.toFixed(2)} {t('currency')}</span>
                </div>
              )}
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{(detCost + pluCost).toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'higiena') {
          const h = o; const nn2 = v => Math.min(99999, parseFloat(v)||0);
          const updH = val => updOther(key, val);
          const updInne = items => updH({ inneItems: items });
          const zbCost = ((nn2(h.zbRazDzien)*nn2(h.zbPastaG)/Math.max(1,nn2(h.zbTubkaMl)))*nn2(h.zbTubkaPrice) + nn2(h.zbSzczetokaPrice)/90)*days;
          const wlPerDay=nn2(h.wlRazW)/7; const wlCost=((h.wlSzampon?(wlPerDay*(nn2(h.wlSzamponWyc)*5/Math.max(1,nn2(h.wlSzamponMl)))*nn2(h.wlSzamponPrice)):0)+(h.wlOdzywka?(wlPerDay*(nn2(h.wlOdzywkaWyc)*5/Math.max(1,nn2(h.wlOdzywkaMl)))*nn2(h.wlOdzywkaPrice)):0))*days;
          const kapPerDay=nn2(h.kapRazW)/7; const kapCost=((h.kapZel?(kapPerDay*(nn2(h.kapZelWyc)*5/Math.max(1,nn2(h.kapZelMl)))*nn2(h.kapZelPrice)):0)+(h.kapMydlo?(kapPerDay*(5/Math.max(1,nn2(h.kapMydloG)))*nn2(h.kapMydloPrice)):0))*days;
          const inneCost=(h.inneItems||[]).reduce((s,ci)=>s+(nn2(ci.perMonth)*nn2(ci.pkgPrice))/30*days,0);
          const papierCostH = (nn2(h.papierDailyRolls)/Math.max(1,nn2(h.papierRollsPerPkg)))*nn2(h.papierPkgPrice)*days;
          const totalH = zbCost+wlCost+kapCost+inneCost+papierCostH;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={t('dc_toothbrushing')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label={t('dc_brushing_times')} val={h.zbRazDzien} onChange={v=>updH({zbRazDzien:v})} max="50" ph="2" />
                <FI label={t('dc_toothpaste_g')} val={h.zbPastaG} onChange={v=>updH({zbPastaG:v})} step="0.5" ph="1" />
                <FI label={t('dc_tube_ml')} val={h.zbTubkaMl} onChange={v=>updH({zbTubkaMl:v})} ph="75" />
                <FI label={t('dc_tube_price')} val={h.zbTubkaPrice} onChange={v=>updH({zbTubkaPrice:v})} step="0.01" ph="8" />
                <FI label={t('dc_toothbrush_price')} val={h.zbSzczetokaPrice} onChange={v=>updH({zbSzczetokaPrice:v})} step="0.01" ph="15" />
              </div>
            </InnerSec>
            <InnerSec title={t('dc_hairwashing')}>
              <FI label={t('dc_hair_times_week')} val={h.wlRazW} onChange={v=>updH({wlRazW:v})} max="14" ph="3" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={h.wlSzampon} onClick={()=>updH({wlSzampon:!h.wlSzampon})} label={t('dc_shampoo')} />
                <TogBtn active={h.wlOdzywka} onClick={()=>updH({wlOdzywka:!h.wlOdzywka})} label={t('dc_conditioner')} />
              </div>
              {h.wlSzampon && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_shampoo')}</div>
                <FI label={t('dc_pumps')} val={h.wlSzamponWyc} onChange={v=>updH({wlSzamponWyc:v})} ph="2" />
                <FI label={t('dc_pkg_capacity_ml')} val={h.wlSzamponMl} onChange={v=>updH({wlSzamponMl:v})} ph="400" />
                <FI label={t('dc_pkg_price')} val={h.wlSzamponPrice} onChange={v=>updH({wlSzamponPrice:v})} step="0.01" ph="18" />
              </div>}
              {h.wlOdzywka && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_conditioner')}</div>
                <FI label={t('dc_pumps')} val={h.wlOdzywkaWyc} onChange={v=>updH({wlOdzywkaWyc:v})} ph="2" />
                <FI label={t('dc_pkg_capacity_ml')} val={h.wlOdzywkaMl} onChange={v=>updH({wlOdzywkaMl:v})} ph="300" />
                <FI label={t('dc_pkg_price')} val={h.wlOdzywkaPrice} onChange={v=>updH({wlOdzywkaPrice:v})} step="0.01" ph="20" />
              </div>}
            </InnerSec>
            <InnerSec title={t('dc_bathing')}>
              <FI label={t('dc_hair_times_week')} val={h.kapRazW} onChange={v=>updH({kapRazW:v})} max="14" ph="7" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={h.kapZel} onClick={()=>updH({kapZel:!h.kapZel})} label={t('dc_gel')} />
                <TogBtn active={h.kapMydlo} onClick={()=>updH({kapMydlo:!h.kapMydlo})} label={t('dc_soap')} />
              </div>
              {h.kapZel && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_gel')}</div>
                <FI label={t('dc_pumps')} val={h.kapZelWyc} onChange={v=>updH({kapZelWyc:v})} ph="3" />
                <FI label={t('dc_pkg_capacity_ml')} val={h.kapZelMl} onChange={v=>updH({kapZelMl:v})} ph="400" />
                <FI label={t('dc_pkg_price')} val={h.kapZelPrice} onChange={v=>updH({kapZelPrice:v})} step="0.01" ph="12" />
              </div>}
              {h.kapMydlo && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{t('dc_soap')} <span style={{ fontWeight:400, color:'#6b7280' }}>(5g / use)</span></div>
                <FI label={t('dc_bar_size_g')} val={h.kapMydloG} onChange={v=>updH({kapMydloG:v})} ph="100" />
                <FI label={t('dc_pkg_price')} val={h.kapMydloPrice} onChange={v=>updH({kapMydloPrice:v})} step="0.01" ph="5" />
              </div>}
            </InnerSec>
            <InnerSec title={t('dc_toilet_paper')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label={t('dc_rolls_per_day')} val={h.papierDailyRolls} onChange={v=>updH({papierDailyRolls:v})} step="0.1" ph="0.5" />
                <FI label={t('dc_rolls_in_pkg')} val={h.papierRollsPerPkg} onChange={v=>updH({papierRollsPerPkg:v})} ph="16" />
                <FI label={t('dc_pkg_price_full2')} val={h.papierPkgPrice} onChange={v=>updH({papierPkgPrice:v})} step="0.01" ph="23" />
              </div>
            </InnerSec>
            <InnerSec title={t('dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5, overflow:'hidden' }}>
                {(h.inneItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={ci.name} maxLength={30} placeholder={t('dc_deodorant_ph')}
                        onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],name:e.target.value};updInne(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updInne(h.inneItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label={t('dc_pcs_per_month')}><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'5px 4px', fontSize:12 }} value={ci.perMonth} onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updInne(a);}} /></FieldBox>
                    <FieldBox label={t('dc_price_per_pkg2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={ci.pkgPrice} onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updInne(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={()=>updInne([...(h.inneItems||[]),{id:Date.now(),name:'',perMonth:'1',pkgPrice:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {t('dc_add_item')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {zbCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_teeth_lbl')}</span><span style={{ color:'#9ca3af' }}>{zbCost.toFixed(2)} {t('currency')}</span></div>}
              {wlCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_hair_lbl')}</span><span style={{ color:'#9ca3af' }}>{wlCost.toFixed(2)} {t('currency')}</span></div>}
              {kapCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_bath_lbl')}</span><span style={{ color:'#9ca3af' }}>{kapCost.toFixed(2)} {t('currency')}</span></div>}
              {papierCostH>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_toilet_paper_short')}</span><span style={{ color:'#9ca3af' }}>{papierCostH.toFixed(2)} {t('currency')}</span></div>}
              {inneCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{inneCost.toFixed(2)} {t('currency')}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{totalH.toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'sprzatan') {
          const nn2 = v => Math.min(99999, parseFloat(v) || 0);
          const bagCost = (nn2(o.bagsPerWeek) / 7) * (nn2(o.bagsPkgPrice) / Math.max(1, nn2(o.bagsPerPkg))) * days;
          const cleanCost = (o.cleaningItems || []).reduce((s, ci) => s + (nn2(ci.perMonth) * nn2(ci.pkgPrice)) / 30 * days, 0);
          const updItems = newItems => updOther(key, { cleaningItems: newItems });
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={t('dc_trash')}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <FieldBox label={t('dc_bags_per_week')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.bagsPerWeek} placeholder="4" onChange={e=>updOther(key,{bagsPerWeek:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={t('dc_bags_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="20" value={o.bagsPerPkg} onChange={e=>updOther(key,{bagsPerPkg:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label={t('dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="12" value={o.bagsPkgPrice} onChange={e=>updOther(key,{bagsPkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>
            </InnerSec>
            <InnerSec title={t('dc_cleaning_fluids')}>
              <div style={{ display:'flex', flexDirection:'column', gap:6, overflow:'hidden' }}>
                {(o.cleaningItems || []).map((ci, idx) => (
                  <div key={ci.id || idx} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={ci.name} maxLength={30} placeholder={t('dc_cleaning_fluid_ph')}
                        onChange={e => { const a=[...o.cleaningItems]; a[idx]={...a[idx],name:e.target.value}; updItems(a); }}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={() => updItems(o.cleaningItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label={t('dc_pcs_per_month')}><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'6px 8px', fontSize:13 }} value={ci.perMonth} onChange={e=>{const a=[...o.cleaningItems];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updItems(a);}} /></FieldBox>
                    <FieldBox label={t('dc_price_per_pkg2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={ci.pkgPrice} onChange={e=>{const a=[...o.cleaningItems];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updItems(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={() => updItems([...(o.cleaningItems||[]), { id:Date.now(), name:'', perMonth:'1', pkgPrice:'' }])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {t('dc_add_item')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {bagCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_rubbish_bags_lbl')}</span><span style={{ color:'#9ca3af' }}>{bagCost.toFixed(2)} {t('currency')}</span></div>}
              {cleanCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_cleaning_fluids')}</span><span style={{ color:'#9ca3af' }}>{cleanCost.toFixed(2)} {t('currency')}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{(bagCost + cleanCost).toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'zmywanie') {
          const nn2 = v => Math.min(99999, parseFloat(v) || 0);
          const dur = nn2(o.pkgDuration) * (o.durationUnit === 'miesiace' ? 30 : 1);
          const recznyCost = o.useReczne && dur > 0 ? (nn2(o.pkgPrice) / dur) * days : 0;
          const zmywarkaCost = o.useZmywarka ? (nn2(o.usesPerWeek) / 7) * (nn2(o.kapsulkiPkgPrice) / Math.max(1, nn2(o.kapsPerPkg))) * days : 0;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px', marginTop:4 }}>
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              {[['useReczne', t('dc_hand_wash')],['useZmywarka', t('dc_dishwasher')]].map(([field, lbl]) => (
                <button key={field} type="button" onClick={()=>updOther(key,{[field]:!o[field]})}
                  style={{ flex:1, padding:'5px 4px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o[field]?'#1e3a3a':'transparent', color:o[field]?'#2dd4bf':'#6b7280' }}>
                  {lbl}
                </button>
              ))}
            </div>
            {o.useReczne && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>{t('dc_hand_wash')}</div>
              <div>
                <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('dc_how_long_lasts')}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:4 }}>
                  {['dni','miesiace'].map(u => (
                    <button key={u} type="button" onClick={()=>updOther(key,{durationUnit:u})}
                      style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                        background:o.durationUnit===u?'#1e3a3a':'transparent', borderColor:'#374151', color:o.durationUnit===u?'#2dd4bf':'#6b7280' }}>
                      {u==='dni'?t('dc_days_unit'):t('dc_months_unit')}
                    </button>
                  ))}
                </div>
                <input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={o.pkgDuration} onChange={e=>updOther(key,{pkgDuration:cl2(e.target.value)})} />
              </div>
              <FieldBox label={t('dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="9" value={o.pkgPrice} onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.useZmywarka && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>{t('dc_dishwasher')}</div>
              <FieldBox label={t('dc_uses_per_week')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="7" value={o.usesPerWeek} onChange={e=>updOther(key,{usesPerWeek:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pods_in_pkg')}><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={o.kapsPerPkg} onChange={e=>updOther(key,{kapsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label={t('dc_pkg_price_full2')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="25" value={o.kapsulkiPkgPrice} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {(o.useReczne || o.useZmywarka) && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                {recznyCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_hand_wash')}</span><span style={{ color:'#9ca3af' }}>{recznyCost.toFixed(2)} {t('currency')}</span></div>}
                {zmywarkaCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_dishwasher')}</span><span style={{ color:'#9ca3af' }}>{zmywarkaCost.toFixed(2)} {t('currency')}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                  <span style={{ color:'#0d9488' }}>{(recznyCost + zmywarkaCost).toFixed(2)} {t('currency')}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'dziecko') {
          const d = o;
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const updD = val => updOther(key, val);
          const updExtra = items => updD({ extraItems: items });
          const totalPieluchy = d.pieluchyEnabled ? (nn(d.pieluchyPerDay) / Math.max(1, nn(d.pieluchyPerPkg))) * nn(d.pieluchyPrice) * days : 0;
          const totalMleko = d.mlekoEnabled ? (nn(d.mlekoPerDay) / Math.max(1, nn(d.mlekoPkgScoops))) * nn(d.mlekoPrice) * days : 0;
          const totalFixed = [['przedszkole','przedszkoleE'],['obiad','obiadE'],['zajecia','zajeciaE'],['korepetycje','korepetycjeE'],['materialy','materialyE'],['dojazdy','dojazdyE'],['odziez','odziezdE'],['kieszonkowe','kieszonkoweE'],['zabawki','zabawkiE'],['kosmetyki','kosmetykiE']].reduce((s,[k,e])=>s+(d[e]?nn(d[k])/30*days:0),0);
          const totalExtra = (d.extraItems||[]).reduce((s,ci)=>s+nn(ci.price)/30*days,0);
          const totalAll = totalFixed + totalPieluchy + totalMleko + totalExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {[
              ['przedszkoleE','przedszkole', t('dc_nursery'),'1200'],
              ['obiadE','obiad', t('dc_school_lunch'),'150'],
              ['zajeciaE','zajecia', t('dc_activities'),'200'],
              ['korepetycjeE','korepetycje', t('dc_tutoring'),'300'],
              ['materialyE','materialy', t('dc_school_supplies'),'80'],
              ['dojazdyE','dojazdy', t('dc_school_transport'),'150'],
              ['odziezdE','odziez', t('dc_clothing'),'200'],
              ['kieszonkoweE','kieszonkowe', t('dc_pocket_money'),'200'],
              ['zabawkiE','zabawki', t('dc_toys'),'100'],
              ['kosmetykiE','kosmetyki', t('dc_cosmetics_lbl'),'50'],
            ].map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updD({[eKey]:!d[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:d[eKey]?'#1e3a3a':'transparent', color:d[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {d[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <MI label={t('dc_per_month_lbl')} val={d[vKey]} onChange={v=>updD({[vKey]:v})} ph={ph} />
                </div>}
              </div>
            ))}
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({pieluchyEnabled:!d.pieluchyEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.pieluchyEnabled?'#1e3a3a':'transparent', color:d.pieluchyEnabled?'#2dd4bf':'#6b7280' }}>
                {t('dc_nappies')}
              </button>
              {d.pieluchyEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label={t('dc_nappies_per_day')} val={d.pieluchyPerDay} onChange={v=>updD({pieluchyPerDay:v})} step="1" ph="8" />
                <MI label={t('dc_nappies_in_pkg')} val={d.pieluchyPerPkg} onChange={v=>updD({pieluchyPerPkg:v})} step="1" ph="50" />
                <MI label={t('dc_pkg_price_full2')} val={d.pieluchyPrice} onChange={v=>updD({pieluchyPrice:v})} ph="60" />
              </div>}
            </div>
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({mlekoEnabled:!d.mlekoEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.mlekoEnabled?'#1e3a3a':'transparent', color:d.mlekoEnabled?'#2dd4bf':'#6b7280' }}>
                {t('dc_formula')}
              </button>
              {d.mlekoEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label={t('dc_servings_per_day')} val={d.mlekoPerDay} onChange={v=>updD({mlekoPerDay:v})} step="1" ph="5" />
                <MI label={t('dc_servings_in_pkg')} val={d.mlekoPkgScoops} onChange={v=>updD({mlekoPkgScoops:v})} step="1" ph="21" />
                <MI label={t('dc_pkg_price_full2')} val={d.mlekoPrice} onChange={v=>updD({mlekoPrice:v})} ph="90" />
              </div>}
            </div>
            <InnerSec title={t('dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(d.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder={t('dc_holiday_ph')}
                        onChange={e=>{const a=[...d.extraItems];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(d.extraItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={t('dc_per_month_ph')}
                      value={ci.price}
                      onChange={e=>{const a=[...d.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...(d.extraItems||[]),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {t('dc_add_expense')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_fixed_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} {t('currency')}</span></div>}
              {totalPieluchy>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_nappies_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalPieluchy.toFixed(2)} {t('currency')}</span></div>}
              {totalMleko>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_formula_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalMleko.toFixed(2)} {t('currency')}</span></div>}
              {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} {t('currency')}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'zwierze') {
          const z = o;
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const updZ = val => updOther(key, val);
          const ZI = ({label, field, step='1', max='99999', ph=''}) => (
            <FieldBox label={label}>
              <input type="number" className="no-spin" min="0" max={max} step={step} style={inp2}
                placeholder={ph} value={z[field]} onChange={e=>updZ({[field]:cl2(e.target.value)})} />
            </FieldBox>
          );
          const Tog = ({eKey, label}) => (
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
          const tExtra = (z.extraItems||[]).reduce((s,ci)=>s+nn(ci.price)/30*days,0);
          const tAll = tSucha+tMokra+tZwierek+tMies/30*days+tExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {Tog({eKey:"suchaE", label:t('dc_dry_food')})}
            {z.suchaE && <InnerSec mb={6} flex title={t('dc_dry_food')}>
              {ZI({label:t('dc_dry_g_per_day'), field:"suchaG", ph:"50"})}
              {ZI({label:t('dc_pkg_size_g'), field:"suchaPkgG", ph:"2000"})}
              {ZI({label:t('dc_pkg_price_full2'), field:"suchaPrice", step:"0.01", ph:"60"})}
            </InnerSec>}
            {Tog({eKey:"mokraE", label:t('dc_wet_food')})}
            {z.mokraE && <InnerSec mb={6} flex title={t('dc_wet_food')}>
              {ZI({label:t('dc_cans_per_day'), field:"mokraSzt", ph:"2"})}
              {ZI({label:t('dc_can_weight_g'), field:"mokraGram", ph:"400"})}
              {ZI({label:t('dc_can_price'), field:"mokraPrice", step:"0.01", ph:"2.50"})}
            </InnerSec>}
            {Tog({eKey:"zwierekE", label:t('dc_litter')})}
            {z.zwierekE && <InnerSec mb={6} flex title={t('dc_litter')}>
              {ZI({label:t('dc_change_days'), field:"zwierekDni", ph:"7"})}
              {ZI({label:t('dc_litter_per_change'), field:"zwierekL", step:"0.5", ph:"3"})}
              {ZI({label:t('dc_pkg_size_l'), field:"zwierekPkgL", step:"0.5", ph:"5"})}
              {ZI({label:t('dc_pkg_price_full2'), field:"zwierekPrice", step:"0.01", ph:"20"})}
            </InnerSec>}
            {Tog({eKey:"wetE", label:t('dc_vet')})}
            {z.wetE && <InnerSec mb={6} flex title={t('dc_vet')}>
              {ZI({label:t('dc_per_month_lbl'), field:"wet", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"pielegnacjaE", label:t('dc_grooming')})}
            {z.pielegnacjaE && <InnerSec mb={6} flex title={t('dc_grooming')}>
              {ZI({label:t('dc_per_month_lbl'), field:"pielegnacja", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"akcesoriaE", label:t('dc_accessories')})}
            {z.akcesoriaE && <InnerSec mb={6} flex title={t('dc_accessories')}>
              {ZI({label:t('dc_per_month_lbl'), field:"akcesoria", step:"0.01", ph:"30"})}
            </InnerSec>}
            <InnerSec mb={6} flex title={t('dc_other_lbl')}>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(z.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder={t('dc_pet_toy_ph')}
                        onChange={e=>{const a=[...z.extraItems];a[idx]={...a[idx],name:e.target.value};updZ({extraItems:a});}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updZ({extraItems:z.extraItems.filter((_,i)=>i!==idx)})}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={t('dc_per_month_ph')}
                      value={ci.price}
                      onChange={e=>{const a=[...z.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updZ({extraItems:a});}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updZ({extraItems:[...(z.extraItems||[]),{id:Date.now(),name:'',price:''}]})}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {t('dc_add_expense')}
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6, marginTop:4 }}>
              {tSucha>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_dry_food')}</span><span style={{ color:'#9ca3af' }}>{tSucha.toFixed(2)} {t('currency')}</span></div>}
              {tMokra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_wet_food')}</span><span style={{ color:'#9ca3af' }}>{tMokra.toFixed(2)} {t('currency')}</span></div>}
              {tZwierek>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_litter')}</span><span style={{ color:'#9ca3af' }}>{tZwierek.toFixed(2)} {t('currency')}</span></div>}
              {tMies>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_vet_short')}</span><span style={{ color:'#9ca3af' }}>{(tMies/30*days).toFixed(2)} {t('currency')}</span></div>}
              {tExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{tExtra.toFixed(2)} {t('currency')}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{tAll.toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'lekarze') {
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const total = (nn(o.wizyty) + nn(o.leki)) / 30 * days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title={t('dc_doctors')} mb={8}>
              <FieldBox label={t('dc_per_month_lbl')}>
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="100" value={o.wizyty} onChange={e=>updOther(key,{wizyty:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <InnerSec title={t('dc_medicine')} mb={6}>
              <FieldBox label={t('dc_per_month_lbl')}>
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="50" value={o.leki} onChange={e=>updOther(key,{leki:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_doctors')}</span><span style={{ color:'#9ca3af' }}>{(nn(o.wizyty)/30*days).toFixed(2)} {t('currency')}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_medicine')}</span><span style={{ color:'#9ca3af' }}>{(nn(o.leki)/30*days).toFixed(2)} {t('currency')}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                <span style={{ color:'#0d9488' }}>{total.toFixed(2)} {t('currency')}</span>
              </div>
            </div>
          </div>
          );
        }
        if (key === 'biurowe') {
          const b = o;
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const updB = val => updOther(key, val);
          const updExtra = items => updB({ extraItems: items });
          const totalFixed = [['papierA4','papierA4E'],['tusz','tuszE'],['notatnik','notatnikE'],['dlugopisy','dlugopisyE']].reduce((s,[k,e])=>s+(b[e]?nn(b[k])/30*days:0),0);
          const totalExtra = (b.extraItems||[]).reduce((s,ci)=>s+nn(ci.price)/30*days,0);
          const totalAll = totalFixed + totalExtra;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {[
              ['papierA4E','papierA4', t('dc_paper_a4'),'25'],
              ['tuszE','tusz', t('dc_ink'),'60'],
              ['notatnikE','notatnik', t('dc_notebook'),'20'],
              ['dlugopisyE','dlugopisy', t('dc_pens'),'10'],
            ].map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updB({[eKey]:!b[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:b[eKey]?'#1e3a3a':'transparent', color:b[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {b[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label={t('dc_per_month_lbl')}>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={b[vKey]} onChange={e=>updB({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{t('dc_other_lbl')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(b.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder={t('dc_pencils_ph')}
                        onChange={e=>{const a=[...b.extraItems];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(b.extraItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder={t('dc_per_month_ph')}
                      value={ci.price}
                      onChange={e=>{const a=[...b.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...(b.extraItems||[]),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  {t('dc_add_item')}
                </button>
              </div>
            </div>
            {(totalFixed > 0 || totalExtra > 0) && (
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
                {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_supplies_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} {t('currency')}</span></div>}
                {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>{t('dc_other_lbl')}</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} {t('currency')}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                  <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} {t('currency')}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'paliwo') {
          const p = o;
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const updP = val => updOther(key, val);
          const fetchPrices = async () => {
            setFetchingFuelPrices(true); setFetchFuelError('');
            try {
              const res = await fuelApi.getPrices(lang);
              const fp = res.data;
              updP({ fetchedPrices: fp, fuelPrice: String(fp[p.fuelType] || '') });
            } catch {
              setFetchFuelError(t('dc_fetch_fuel_error'));
            } finally {
              setFetchingFuelPrices(false);
            }
          };
          const dailyCost = (nn(p.kmPerDay) / 100) * nn(p.consumption) * nn(p.fuelPrice) * days;
          const FUEL_LABELS = { diesel: 'Diesel', benzyna: t('dc_fuel_petrol'), gaz: 'LPG' };
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
              <FieldBox label={t('dc_fuel_price_lbl')}>
                <input type="number" className="no-spin" min="0" max="99" step="0.01" style={inp2}
                  placeholder={`${eg} 6.20`} value={p.fuelPrice} onChange={e=>updP({fuelPrice:cl2(e.target.value)})} />
              </FieldBox>
              <button type="button" onClick={fetchPrices} disabled={fetchingFuelPrices}
                style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600 }}>
                {fetchingFuelPrices ? '...' : t('dc_fetch_fuel')}
              </button>
              {fetchFuelError && <div style={{ fontSize:10, color:'#ef4444' }}>{fetchFuelError}</div>}
              {p.fetchedPrices && Object.keys(p.fetchedPrices).length > 0 && (
                <div style={{ display:'flex', gap:8, fontSize:10, color:'#6b7280' }}>
                  {Object.entries(FUEL_LABELS).map(([k,lbl]) => p.fetchedPrices[k] &&
                    <span key={k}>{lbl}: <span style={{ color:'#9ca3af' }}>{p.fetchedPrices[k]} {t('currency')}</span></span>
                  )}
                </div>
              )}
              <FieldBox label={t('dc_km_per_day')}>
                <input type="number" className="no-spin" min="0" max="99999" step="1" style={inp2}
                  placeholder={`${eg} 40`} value={p.kmPerDay} onChange={e=>updP({kmPerDay:cl2(e.target.value)})} />
              </FieldBox>
              <FieldBox label={t('dc_consumption_lbl')}>
                <input type="number" className="no-spin" min="0" max="99" step="0.1" style={inp2}
                  placeholder={`${eg} 6.5`} value={p.consumption} onChange={e=>updP({consumption:cl2(e.target.value)})} />
              </FieldBox>
            </div>
            {dailyCost > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                  <span style={{ color:'#6b7280' }}>{FUEL_LABELS[p.fuelType]} ({(nn(p.kmPerDay)*days).toFixed(0)} km)</span>
                  <span style={{ color:'#9ca3af' }}>{dailyCost.toFixed(2)} {t('currency')}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                  <span style={{ color:'#0d9488' }}>{dailyCost.toFixed(2)} {t('currency')}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        if (key === 'media') {
          const m = o;
          const nn = v => Math.min(99999, parseFloat(v)||0);
          const updM = val => updOther(key, val);
          const total = ((m.internetE?nn(m.internet):0)+(m.telefonE?nn(m.telefon):0)+(m.tvE?nn(m.tv):0))/30*days;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            {[['internetE','internet','Internet','60'],['telefonE','telefon',t('dc_media_phone'),'50'],['tvE','tv','TV','40']].map(([eKey,vKey,label,ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updM({[eKey]:!m[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:m[eKey]?'#1e3a3a':'transparent', color:m[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {m[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label={t('dc_per_month_lbl')}>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={m[vKey]} onChange={e=>updM({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            {total > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:4, paddingTop:6 }}>
                {m.internetE&&nn(m.internet)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Internet</span><span style={{ color:'#9ca3af' }}>{(nn(m.internet)/30*days).toFixed(2)} {t('currency')}</span></div>}
                {m.telefonE&&nn(m.telefon)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Phone</span><span style={{ color:'#9ca3af' }}>{(nn(m.telefon)/30*days).toFixed(2)} {t('currency')}</span></div>}
                {m.tvE&&nn(m.tv)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>TV</span><span style={{ color:'#9ca3af' }}>{(nn(m.tv)/30*days).toFixed(2)} {t('currency')}</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>{t('dc_days_label')(days)}</span>
                  <span style={{ color:'#0d9488' }}>{total.toFixed(2)} {t('currency')}</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        const OPLATY_PH = { czynsz:'1500', prad:'200', gaz_oplata:'80', ogrzewanie:'300', kredyt:'800' };
        return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px', marginTop:4 }}>
            <FieldBox label={t('dc_per_month_lbl')}><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder={OPLATY_PH[key]||''} value={o.monthlyAmount} onChange={e=>updOther(key,{monthlyAmount:cl2(e.target.value)})} /></FieldBox>
            {Summary()}
          </div>
        );
      })()}
      {expanded && (
        <button type="button" onClick={e => { e.stopPropagation(); updOther(key, {...OTHER_DEFAULTS[key], enabled: true}); }}
          className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
          {t('clear')}
        </button>
      )}
    </div>
  );
  };

  return (
    <div ref={cardRef}>

      <div style={{ marginBottom: 8 }}>
        <span className="card-section-title">{t('expenses_select_title')}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:4, marginBottom:4 }}>
        {OTHER_TYPES.map(renderTile)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:4, marginBottom:8 }}>
        {DRINK_TYPES.map(({ key, label, emoji, gradient }) => {
          const enabled = drinks[key].enabled;
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
                <span style={{ fontSize:11, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 4px' }}>{t(drinkI18nKey(key))}</span>
                {(() => { const pv = drinkTilePreview(key); return pv>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'4px 6px', textAlign:'center', fontSize:12, fontWeight:800, color:'#2dd4bf', zIndex:2, letterSpacing:'0.2px', opacity: enabled?1:0.7 }}>{pv.toFixed(2)} {t('currency')}</div> : null; })()}
              </div>

              {/* Panel konfiguracji — szerokość tile'a */}
              {expanded && (() => {
                const tileTotal = items.filter(i=>i._dk===key).reduce((s,i)=>s+i.total,0);
                if (key === 'kawa') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={t('dc_consumption_sec')}>
                        <FieldBox label={t('dc_cups_per_day2')}><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={drinks.kawa.cupsPerDay} onChange={e => upd('kawa',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_spoons_per_cup2')((parseFloat(drinks.kawa.spoonsPerCup)||0)*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={drinks.kawa.spoonsPerCup} onChange={e => upd('kawa',{spoonsPerCup:cl(e.target.value,20)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_sweetener_q')}><div style={{ display:'flex', gap:4 }}>{btnSugar('kawa','cukier')}{btnSugar('kawa','slodzik')}</div></FieldBox></div>
                        {drinks.kawa.sugarType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.sugarType==='cukier'?t('dc_sugar'):t('dc_sweetener')}</div>
                          <FieldBox label={t('dc_spoons_s')((parseFloat(drinks.kawa.sugarSpoons)||0)*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={drinks.kawa.sugarSpoons} onChange={e => upd('kawa',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('dc_price_per_kg')}</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.kawa.sugarType==='cukier'?'3.50':'15'} value={drinks.kawa.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999);drinks.kawa.sugarType==='cukier'?setCukierPrice(v):setSlodzikPrice(v);}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label={t('dc_milk_q')}>
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('kawa',{milkType: drinks.kawa.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.kawa.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.kawa.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.kawa.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?t('dc_milk'):t('dc_cream')}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {drinks.kawa.milkType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.milkType==='mleko'?t('dc_milk'):t('dc_cream')}</div>
                            <FieldBox label="ml / cup"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={drinks.kawa.milkMlPerCup} onChange={e => upd('kawa',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label={t('dc_pkg_capacity_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={drinks.kawa.milkPkgMl} onChange={e => upd('kawa',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={drinks.kawa.milkPrice} onChange={e => upd('kawa',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title={t('dc_packaging_sec')}>
                        <FieldBox label={t('dc_pkg_weight_g')}><input type="number" className="no-spin" min="0" style={fi} placeholder="250" value={drinks.kawa.pkgG} onChange={e => upd('kawa',{pkgG:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="18" value={drinks.kawa.pkgPrice} onChange={e => upd('kawa',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[t('dc_cups_summary')(parseFloat(drinks.kawa.cupsPerDay)||0), t('dc_days_label')(days), t('dc_cups_total')((parseFloat(drinks.kawa.cupsPerDay)||0)*days)].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:t(drinkI18nKey('kawa')),val:items.filter(i=>i._dk==='kawa'&&i.name===t(drinkI18nKey('kawa'))).reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='kawa'&&i.name!==t(drinkI18nKey('kawa'))).map(i=>({label:_itemLabel(i.name.replace(' (kawa)','')),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} {t('currency')}</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {t('currency')}</div>
                    </div>
                  </div>
                );
                if (key === 'herbata') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={t('dc_consumption_sec')}>
                        <FieldBox label={t('dc_cups_per_day2')}><input type="number" className="no-spin" min="0" style={fi} placeholder="3" value={drinks.herbata.cupsPerDay} onChange={e => upd('herbata',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_sweetener_q')}><div style={{ display:'flex', gap:4 }}>{btnSugar('herbata','cukier')}{btnSugar('herbata','slodzik')}</div></FieldBox></div>
                        {drinks.herbata.sugarType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.sugarType==='cukier'?t('dc_sugar'):t('dc_sweetener')}</div>
                          <FieldBox label={t('dc_spoons_s')((parseFloat(drinks.herbata.sugarSpoons)||0)*3)}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={drinks.herbata.sugarSpoons} onChange={e => upd('herbata',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>{t('dc_price_per_kg')}</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.herbata.sugarType==='cukier'?'3.50':'15'} value={drinks.herbata.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999);drinks.herbata.sugarType==='cukier'?setCukierPrice(v):setSlodzikPrice(v);}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label={t('dc_milk_q')}>
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('herbata',{milkType: drinks.herbata.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.herbata.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.herbata.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.herbata.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?t('dc_milk'):t('dc_cream')}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {drinks.herbata.milkType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.milkType==='mleko'?t('dc_milk'):t('dc_cream')}</div>
                            <FieldBox label="ml / cup"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={drinks.herbata.milkMlPerCup} onChange={e => upd('herbata',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label={t('dc_pkg_capacity_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={drinks.herbata.milkPkgMl} onChange={e => upd('herbata',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={drinks.herbata.milkPrice} onChange={e => upd('herbata',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title={t('dc_packaging_sec')}>
                        <FieldBox label={t('dc_sachets_in_pkg')}><input type="number" className="no-spin" min="0" style={fi} placeholder="100" value={drinks.herbata.sachetPerPkg} onChange={e => upd('herbata',{sachetPerPkg:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="8" value={drinks.herbata.pkgPrice} onChange={e => upd('herbata',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[t('dc_cups_summary')(parseFloat(drinks.herbata.cupsPerDay)||0), t('dc_days_label')(days), t('dc_cups_total')((parseFloat(drinks.herbata.cupsPerDay)||0)*days)].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:t(drinkI18nKey('herbata')),val:items.filter(i=>i._dk==='herbata'&&i.name===t(drinkI18nKey('herbata'))).reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='herbata'&&i.name!==t(drinkI18nKey('herbata'))).map(i=>({label:_itemLabel(i.name.replace(' (herbata)','')),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} {t('currency')}</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {t('currency')}</div>
                    </div>
                  </div>
                );
                if (key === 'napoje') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={t('dc_packaging_sec')}>
                        <FieldBox label={t('dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={drinks.napoje.litersPerDay} onChange={e => upd('napoje',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_capacity_l2')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="2" value={drinks.napoje.pkgL} onChange={e => upd('napoje',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="4" value={drinks.napoje.pkgPrice} onChange={e => upd('napoje',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[t('dc_liters_summary')(parseFloat(drinks.napoje.litersPerDay)||0), t('dc_days_label')(days), t('dc_liters_total')(((parseFloat(drinks.napoje.litersPerDay)||0)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {t('currency')}</div>
                    </div>
                  </div>
                );
                if (key === 'woda') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={t('dc_packaging_sec')}>
                        <FieldBox label={t('dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1.5" value={drinks.woda.litersPerDay} onChange={e => upd('woda',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_capacity_l2')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="5" value={drinks.woda.pkgL} onChange={e => upd('woda',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_pkg_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3" value={drinks.woda.pkgPrice} onChange={e => upd('woda',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[t('dc_liters_summary')(parseFloat(drinks.woda.litersPerDay)||0), t('dc_days_label')(days), t('dc_liters_total')(((parseFloat(drinks.woda.litersPerDay)||0)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {t('currency')}</div>
                    </div>
                  </div>
                );
                if (key === 'sodaStream') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title={t('dc_consumption_sec')}>
                        <FieldBox label={t('dc_liters_per_day')}><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={drinks.sodaStream.litersPerDay} onChange={e => upd('sodaStream',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}>
                          <div style={{ fontSize:10, color:'#6b7280', marginBottom:4 }}>{t('dc_sweetness')}</div>
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
                      <InnerSec title={t('dc_syrup_sec')}>
                        <FieldBox label={t('dc_syrup_ml')}><input type="number" className="no-spin" min="0" style={fi} placeholder="440" value={drinks.sodaStream.syrupMl} onChange={e => upd('sodaStream',{syrupMl:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_syrup_price')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="25" value={drinks.sodaStream.syrupPrice} onChange={e => upd('sodaStream',{syrupPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                      <InnerSec title={t('dc_gas_cylinder')}>
                        <FieldBox label={t('dc_exchange_days')}><input type="number" className="no-spin" min="0" style={fi} placeholder={`${eg} 30`} value={drinks.sodaStream.cylinderDays} onChange={e => upd('sodaStream',{cylinderDays:cl(e.target.value,3650)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={t('dc_exchange_cost')}><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder={`${eg} 50`} value={drinks.sodaStream.cylinderCost} onChange={e => upd('sodaStream',{cylinderCost:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[t('dc_liters_summary')(parseFloat(drinks.sodaStream.litersPerDay)||0), t('dc_days_label')(days), t('dc_liters_total')(((parseFloat(drinks.sodaStream.litersPerDay)||0)*days).toFixed(1))].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} {t('currency')}</div>
                    </div>
                  </div>
                );
                return null;
              })()}
              {expanded && (
                <button type="button" onClick={e => { e.stopPropagation(); upd(key, {...DRINKS_DEFAULTS[key], enabled: true}); }}
                  className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
                  {t('clear')}
                </button>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─── Main Summary component ───────────────────────────────────────────────────

export { SHARED_KEYS };
export default DrinksCard;
