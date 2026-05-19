import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { fuel as fuelApi } from '../api';

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

const OTHER_TYPES = [
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
const SHARED_KEYS = new Set(['czynsz','prad','gaz_oplata','media','ogrzewanie','zwierze','pranie','zmywanie','sprzatan']);
const OTHER_DEFAULTS = {
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
  { key:'kawa',       label:'Kawa',             emoji:'☕', gradient:'linear-gradient(135deg,#2d1000,#7a3800)' },
  { key:'herbata',    label:'Herbata',           emoji:'🍵', gradient:'linear-gradient(135deg,#0a1f0a,#1a5a1a)' },
  { key:'napoje',     label:'Napoje',            emoji:'🥤', gradient:'linear-gradient(135deg,#0a1040,#1a3a8a)' },
  { key:'woda',       label:'Woda',              emoji:'💧', gradient:'linear-gradient(135deg,#001828,#006080)' },
  { key:'sodaStream', label:'Soda Stream',       emoji:'🫧', gradient:'linear-gradient(135deg,#100a30,#3a0a6a)' },
];

const DRINKS_DEFAULTS = {
  kawa:       { enabled:false, cupsPerDay:2, spoonsPerCup:2, pkgG:200, pkgPrice:'', sugarType:null, sugarSpoons:1, milkType:null, milkMlPerCup:'', milkPkgMl:'', milkPrice:'' },
  herbata:    { enabled:false, cupsPerDay:2, sachetPerPkg:20, pkgPrice:'', sugarType:null, sugarSpoons:1, milkType:null, milkMlPerCup:'', milkPkgMl:'', milkPrice:'' },
  napoje:     { enabled:false, litersPerDay:1,  pkgL:1.5, pkgPrice:'' },
  woda:       { enabled:false, litersPerDay:2,  pkgL:1.5, pkgPrice:'' },
  sodaStream: { enabled:false, litersPerDay:1,  syrupMl:440, syrupPrice:'', mlPer1L:25, cylinderDays:'', cylinderCost:'' },
};
function loadDrinksFromLS() {
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
      list.push({ name:'Kawa', daily, total: daily * days, _dk:'kawa' });
      if (d.kawa.sugarType) { const sd = n(d.kawa.cupsPerDay) * n(d.kawa.sugarSpoons) * priceForType(d.kawa.sugarType); list.push({ name:`${d.kawa.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (kawa)`, daily:sd, total:sd*days, _dk:'kawa' }); }
      if (d.kawa.milkType && n(d.kawa.milkPkgMl)>0) { const md = n(d.kawa.cupsPerDay)*n(d.kawa.milkMlPerCup)/n(d.kawa.milkPkgMl)*n(d.kawa.milkPrice); list.push({ name:`${d.kawa.milkType==='mleko'?'Mleko':'Śmietanka'} (kawa)`, daily:md, total:md*days, _dk:'kawa' }); }
    }
    if (d.herbata.enabled) {
      const daily = (n(d.herbata.cupsPerDay) / Math.max(1, n(d.herbata.sachetPerPkg))) * n(d.herbata.pkgPrice);
      list.push({ name:'Herbata', daily, total: daily * days, _dk:'herbata' });
      if (d.herbata.sugarType) { const sd = n(d.herbata.cupsPerDay) * n(d.herbata.sugarSpoons) * priceForType(d.herbata.sugarType); list.push({ name:`${d.herbata.sugarType === 'cukier' ? 'Cukier' : 'Słodzik'} (herbata)`, daily:sd, total:sd*days, _dk:'herbata' }); }
      if (d.herbata.milkType && n(d.herbata.milkPkgMl)>0) { const md = n(d.herbata.cupsPerDay)*n(d.herbata.milkMlPerCup)/n(d.herbata.milkPkgMl)*n(d.herbata.milkPrice); list.push({ name:`${d.herbata.milkType==='mleko'?'Mleko':'Śmietanka'} (herbata)`, daily:md, total:md*days, _dk:'herbata' }); }
    }
    if (d.napoje.enabled)    { const daily = (n(d.napoje.litersPerDay) / Math.max(0.001, n(d.napoje.pkgL))) * n(d.napoje.pkgPrice); list.push({ name:'Napoje',          daily, total:daily*days, _dk:'napoje' }); }
    if (d.woda.enabled)      { const daily = (n(d.woda.litersPerDay)   / Math.max(0.001, n(d.woda.pkgL)))   * n(d.woda.pkgPrice);   list.push({ name:'Woda',            daily, total:daily*days, _dk:'woda' }); }
    if (d.sodaStream.enabled){
      const syrupDaily = n(d.sodaStream.litersPerDay) * (n(d.sodaStream.mlPer1L) / Math.max(1, n(d.sodaStream.syrupMl))) * n(d.sodaStream.syrupPrice);
      const cylDaily = n(d.sodaStream.cylinderDays) > 0 ? n(d.sodaStream.cylinderCost) / n(d.sodaStream.cylinderDays) : 0;
      const daily = syrupDaily + cylDaily;
      list.push({ name:'Syrop Soda Stream', daily, total:daily*days, _dk:'sodaStream' });
    }
    OTHER_TYPES.forEach(t => {
      const o = otherExpenses[t.key];
      if (!o?.enabled) return;
      const n = v => Math.min(99999, parseFloat(v) || 0);
      let daily = 0;
      if (t.key === 'papier') {
        daily = (n(o.dailyRolls) / Math.max(1, n(o.rollsPerPkg))) * n(o.pkgPrice);
      } else if (t.key === 'pranie') {
        const washesPerDay = n(o.washesPerWeek) / 7;
        let det = 0;
        if (o.detergentType === 'proszek')   det = (n(o.proszekPerWash) / Math.max(1, n(o.proszekPkgKg) * 1000)) * n(o.proszekPkgPrice);
        else if (o.detergentType === 'plyn') det = (n(o.plynPerWash) / Math.max(1, n(o.plynPkgL) * 1000)) * n(o.plynPkgPrice);
        else                                  det = n(o.kapsulkiPkgPrice) / Math.max(1, n(o.kapsulkiPerPkg));
        let plu = 0;
        if (o.plukanie) plu = (n(o.plukaniePerWash) / Math.max(1, n(o.plukanieL) * 1000)) * n(o.plukaniePkgPrice);
        daily = (det + plu) * washesPerDay;
      } else if (t.key === 'sprzatan') {
        const bagDaily = (n(o.bagsPerWeek) / 7) * (n(o.bagsPkgPrice) / Math.max(1, n(o.bagsPerPkg)));
        const cleanDaily = (o.cleaningItems || []).reduce((s, ci) => s + (n(ci.perMonth) * n(ci.pkgPrice)) / 30, 0);
        daily = bagDaily + cleanDaily;
      } else if (t.key === 'higiena') {
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
      } else if (t.key === 'zmywanie') {
        if (o.useReczne) {
          const dur = n(o.pkgDuration) * (o.durationUnit === 'miesiace' ? 30 : 1);
          daily += n(o.pkgPrice) / Math.max(1, dur);
        }
        if (o.useZmywarka) {
          daily += (n(o.usesPerWeek) / 7) * (n(o.kapsulkiPkgPrice) / Math.max(1, n(o.kapsPerPkg)));
        }
      } else if (t.key === 'zwierze') {
        if (o.suchaE) daily += (n(o.suchaG) / Math.max(1, n(o.suchaPkgG))) * n(o.suchaPrice);
        if (o.mokraE) daily += n(o.mokraSzt) * n(o.mokraPrice);
        if (o.zwierekE) daily += (n(o.zwierekL) / Math.max(1, n(o.zwierekPkgL))) * n(o.zwierekPrice) / Math.max(1, n(o.zwierekDni));
        if (o.wetE) daily += n(o.wet) / 30;
        if (o.pielegnacjaE) daily += n(o.pielegnacja) / 30;
        if (o.akcesoriaE) daily += n(o.akcesoria) / 30;
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (t.key === 'dziecko') {
        [['przedszkole','przedszkoleE'],['obiad','obiadE'],['zajecia','zajeciaE'],['korepetycje','korepetycjeE'],
         ['materialy','materialyE'],['dojazdy','dojazdyE'],['odziez','odziezdE'],['kieszonkowe','kieszonkoweE'],['zabawki','zabawkiE'],['kosmetyki','kosmetykiE']]
          .forEach(([k,e]) => { if (o[e]) daily += n(o[k]) / 30; });
        if (o.pieluchyEnabled) daily += (n(o.pieluchyPerDay) / Math.max(1, n(o.pieluchyPerPkg))) * n(o.pieluchyPrice);
        if (o.mlekoEnabled) daily += (n(o.mlekoPerDay) / Math.max(1, n(o.mlekoPkgScoops))) * n(o.mlekoPrice);
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (t.key === 'lekarze') {
        const wizD = n(o.wizyty) / 30;
        const lekD = n(o.leki) / 30;
        if (wizD > 0) list.push({ name:'Wizyty lekarskie', daily:wizD, total:wizD*days, _dk:'lekarze' });
        if (lekD > 0) list.push({ name:'Leki', daily:lekD, total:lekD*days, _dk:'lekarze' });
        return;
      } else if (t.key === 'biurowe') {
        if (o.papierA4E) daily += n(o.papierA4) / 30;
        if (o.tuszE) daily += n(o.tusz) / 30;
        if (o.notatnikE) daily += n(o.notatnik) / 30;
        if (o.dlugopisyE) daily += n(o.dlugopisy) / 30;
        (o.extraItems||[]).forEach(ci => { daily += n(ci.price) / 30; });
      } else if (t.key === 'paliwo') {
        daily = (n(o.kmPerDay) / 100) * n(o.consumption) * n(o.fuelPrice);
      } else if (t.key === 'media') {
        if (o.internetE) daily += n(o.internet) / 30;
        if (o.telefonE) daily += n(o.telefon) / 30;
        if (o.tvE) daily += n(o.tv) / 30;
      } else {
        daily = n(o.monthlyAmount) / 30;
      }
      list.push({ name: t.label, daily, total: daily * days, _dk: t.key });
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
        {type === 'cukier' ? 'Cukier' : 'Słodzik'}
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
            position:'absolute', top:3, right:3, zIndex:3,
            display:'flex', alignItems:'center', gap:2,
            background:'rgba(45,212,191,0.12)', border:'1px solid rgba(45,212,191,0.25)',
            borderRadius:4, padding:'2px 4px',
          }}>
            <Icon icon="heroicons:users-solid" style={{ width:8, height:8, color:'#2dd4bf', flexShrink:0 }} />
            <span style={{ fontSize:7, fontWeight:700, color:'#2dd4bf', letterSpacing:'0.2px', lineHeight:1 }}>wspólne</span>
          </div>
        )}
        <span style={{ fontSize:16, lineHeight:1, position:'relative', zIndex:1 }}>{emoji}</span>
        <span style={{ fontSize:9, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 3px', lineHeight:1.3 }}>{label}</span>
        {(() => { const t = otherTilePreview(key); return t>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'3px 4px', textAlign:'center', fontSize:10, fontWeight:800, color:'#2dd4bf', zIndex:2, opacity: enabled?1:0.7 }}>{t.toFixed(2)} zł</div> : null; })()}
      </div>
      {expanded && (() => {
        const o = otherExpenses[key];
        const tot = items.filter(i=>i._dk===key).reduce((s,i)=>s+i.total,0);
        const Summary = () => (
          <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5 }}>
            <div style={{ fontSize:9, color:'#6b7280' }}>× {days} dni</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#0d9488' }}>{tot.toFixed(2)} zł</div>
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
              <FieldBox label="Dzienne zużycie (rolki)"><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.dailyRolls} placeholder="0.5" onChange={e=>updOther(key,{dailyRolls:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Liczba rolek w op."><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.rollsPerPkg} placeholder="16" onChange={e=>updOther(key,{rollsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Cena opakowania (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.pkgPrice} placeholder="23" onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>Rolki ({rollsUsed.toFixed(1)} szt.)</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{papierCost.toFixed(2)} zł</span>
              </div>
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{papierCost.toFixed(2)} zł</span>
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
          if (o.detergentType === 'proszek')   { detDaily = (nn(o.proszekPerWash) / Math.max(1, nn(o.proszekPkgKg)*1000)) * nn(o.proszekPkgPrice); detLabel = 'Proszek'; }
          else if (o.detergentType === 'plyn') { detDaily = (nn(o.plynPerWash) / Math.max(1, nn(o.plynPkgL)*1000)) * nn(o.plynPkgPrice); detLabel = 'Płyn'; }
          else                                  { detDaily = nn(o.kapsulkiPkgPrice) / Math.max(1, nn(o.kapsulkiPerPkg)); detLabel = 'Kapsułki'; }
          const detCost = detDaily * washesTotal;
          let pluCost = 0;
          if (o.plukanie) pluCost = (nn(o.plukaniePerWash) / Math.max(1, nn(o.plukanieL)*1000)) * nn(o.plukaniePkgPrice) * washesTotal;
          return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'12px', marginTop:4 }}>
            <InnerSec title="Pranie">
              <FieldBox label="Ilość prań / tydzień"><input type="number" className="no-spin" min="0" max="99999" step="0.5" style={inp2} value={o.washesPerWeek} placeholder="5" onChange={e=>updOther(key,{washesPerWeek:cl2(e.target.value)})} /></FieldBox>
            </InnerSec>
            <InnerSec title="Środek piorący">
            <div style={{ display:'flex', borderRadius:6, overflow:'hidden', border:'1px solid #374151' }}>
              {['proszek','plyn','kapsulki'].map((type,i) => (
                <button key={type} type="button" onClick={()=>updOther(key,{detergentType:type})}
                  style={{ flex:1, padding:'5px 4px', border:'none', borderRight:i<2?'1px solid #374151':'none', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o.detergentType===type?'#1e3a3a':'transparent', color:o.detergentType===type?'#2dd4bf':'#6b7280' }}>
                  {type==='proszek'?'Proszek':type==='plyn'?'Płyn':'Kapsułki'}
                </button>
              ))}
            </div>
            {o.detergentType === 'proszek' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Proszek</div>
              <FieldBox label="Gramów na pranie"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.proszekPerWash} placeholder="75" onChange={e=>updOther(key,{proszekPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Pojemność op. (kg)"><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.proszekPkgKg} placeholder="3" onChange={e=>updOther(key,{proszekPkgKg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.proszekPkgPrice} placeholder="40" onChange={e=>updOther(key,{proszekPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'plyn' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Płyn</div>
              <FieldBox label="ml na pranie"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.plynPerWash} onChange={e=>updOther(key,{plynPerWash:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Pojemność op. (l)"><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.plynPkgL} onChange={e=>updOther(key,{plynPkgL:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.plynPkgPrice} onChange={e=>updOther(key,{plynPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.detergentType === 'kapsulki' && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Kapsułki</div>
              <FieldBox label="Szt. w opakowaniu"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.kapsulkiPerPkg} onChange={e=>updOther(key,{kapsulkiPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.kapsulkiPkgPrice} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            </InnerSec>
            <InnerSec title="Płyn do płukania">
              <button type="button" onClick={()=>updOther(key,{plukanie:!o.plukanie})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:o.plukanie?'#1e3a3a':'transparent', borderColor:'#374151', color:o.plukanie?'#2dd4bf':'#6b7280' }}>
                Płyn do płukania
              </button>
              {o.plukanie && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Płyn do płukania</div>
                <FieldBox label="ml na pranie"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.plukaniePerWash} placeholder="25" onChange={e=>updOther(key,{plukaniePerWash:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label="Pojemność op. (l)"><input type="number" className="no-spin" min="0" max="99999" step="0.1" style={inp2} value={o.plukanieL} placeholder="1.5" onChange={e=>updOther(key,{plukanieL:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={o.plukaniePkgPrice} placeholder="15" onChange={e=>updOther(key,{plukaniePkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>}
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:6, paddingTop:5, display:'flex', flexDirection:'column', gap:2 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{ color:'#6b7280' }}>{detLabel} ({Math.round(washesTotal)} prań)</span>
                <span style={{ color:'#9ca3af', fontWeight:600 }}>{detCost.toFixed(2)} zł</span>
              </div>
              {o.plukanie && pluCost > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                  <span style={{ color:'#6b7280' }}>Płyn do płukania</span>
                  <span style={{ color:'#9ca3af', fontWeight:600 }}>{pluCost.toFixed(2)} zł</span>
                </div>
              )}
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2, display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{(detCost + pluCost).toFixed(2)} zł</span>
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
            <InnerSec title="Mycie zębów">
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label="Razy dziennie" val={h.zbRazDzien} onChange={v=>updH({zbRazDzien:v})} max="50" ph="2" />
                <FI label="Pasty na raz (g)" val={h.zbPastaG} onChange={v=>updH({zbPastaG:v})} step="0.5" ph="1" />
                <FI label="Pojemność tubki (ml)" val={h.zbTubkaMl} onChange={v=>updH({zbTubkaMl:v})} ph="75" />
                <FI label="Cena tubki (zł)" val={h.zbTubkaPrice} onChange={v=>updH({zbTubkaPrice:v})} step="0.01" ph="8" />
                <FI label="Cena szczoteczki (zł) — co 3 mies." val={h.zbSzczetokaPrice} onChange={v=>updH({zbSzczetokaPrice:v})} step="0.01" ph="15" />
              </div>
            </InnerSec>
            <InnerSec title="Mycie włosów">
              <FI label="Razy w tygodniu" val={h.wlRazW} onChange={v=>updH({wlRazW:v})} max="14" ph="3" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={h.wlSzampon} onClick={()=>updH({wlSzampon:!h.wlSzampon})} label="Szampon" />
                <TogBtn active={h.wlOdzywka} onClick={()=>updH({wlOdzywka:!h.wlOdzywka})} label="Odżywka" />
              </div>
              {h.wlSzampon && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Szampon</div>
                <FI label="Wyciśnięcia (1=5ml)" val={h.wlSzamponWyc} onChange={v=>updH({wlSzamponWyc:v})} ph="2" />
                <FI label="Pojemność op. (ml)" val={h.wlSzamponMl} onChange={v=>updH({wlSzamponMl:v})} ph="400" />
                <FI label="Cena (zł)" val={h.wlSzamponPrice} onChange={v=>updH({wlSzamponPrice:v})} step="0.01" ph="18" />
              </div>}
              {h.wlOdzywka && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Odżywka</div>
                <FI label="Wyciśnięcia (1=5ml)" val={h.wlOdzywkaWyc} onChange={v=>updH({wlOdzywkaWyc:v})} ph="2" />
                <FI label="Pojemność op. (ml)" val={h.wlOdzywkaMl} onChange={v=>updH({wlOdzywkaMl:v})} ph="300" />
                <FI label="Cena (zł)" val={h.wlOdzywkaPrice} onChange={v=>updH({wlOdzywkaPrice:v})} step="0.01" ph="20" />
              </div>}
            </InnerSec>
            <InnerSec title="Kąpiel / prysznic">
              <FI label="Razy w tygodniu" val={h.kapRazW} onChange={v=>updH({kapRazW:v})} max="14" ph="7" />
              <div style={{ display:'flex', gap:4, marginTop:5 }}>
                <TogBtn active={h.kapZel} onClick={()=>updH({kapZel:!h.kapZel})} label="Żel" />
                <TogBtn active={h.kapMydlo} onClick={()=>updH({kapMydlo:!h.kapMydlo})} label="Mydło" />
              </div>
              {h.kapZel && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Żel</div>
                <FI label="Wyciśnięcia (1=5ml)" val={h.kapZelWyc} onChange={v=>updH({kapZelWyc:v})} ph="3" />
                <FI label="Pojemność op. (ml)" val={h.kapZelMl} onChange={v=>updH({kapZelMl:v})} ph="400" />
                <FI label="Cena (zł)" val={h.kapZelPrice} onChange={v=>updH({kapZelPrice:v})} step="0.01" ph="12" />
              </div>}
              {h.kapMydlo && <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>Mydło <span style={{ fontWeight:400, color:'#6b7280' }}>(5g / mycie)</span></div>
                <FI label="Wielkość kostki (g)" val={h.kapMydloG} onChange={v=>updH({kapMydloG:v})} ph="100" />
                <FI label="Cena (zł)" val={h.kapMydloPrice} onChange={v=>updH({kapMydloPrice:v})} step="0.01" ph="5" />
              </div>}
            </InnerSec>
            <InnerSec title="Papier toaletowy">
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <FI label="Dzienne zużycie (rolki)" val={h.papierDailyRolls} onChange={v=>updH({papierDailyRolls:v})} step="0.1" ph="0.5" />
                <FI label="Rolek w opakowaniu" val={h.papierRollsPerPkg} onChange={v=>updH({papierRollsPerPkg:v})} ph="16" />
                <FI label="Cena opakowania (zł)" val={h.papierPkgPrice} onChange={v=>updH({papierPkgPrice:v})} step="0.01" ph="23" />
              </div>
            </InnerSec>
            <InnerSec title="Inne">
              <div style={{ display:'flex', flexDirection:'column', gap:5, overflow:'hidden' }}>
                {(h.inneItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={ci.name} maxLength={30} placeholder="np. Dezodorant"
                        onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],name:e.target.value};updInne(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updInne(h.inneItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label="Szt./mies."><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'5px 4px', fontSize:12 }} value={ci.perMonth} onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updInne(a);}} /></FieldBox>
                    <FieldBox label="Cena/opak. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={ci.pkgPrice} onChange={e=>{const a=[...h.inneItems];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updInne(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={()=>updInne([...(h.inneItems||[]),{id:Date.now(),name:'',perMonth:'1',pkgPrice:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  + Dodaj produkt
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {zbCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Zęby</span><span style={{ color:'#9ca3af' }}>{zbCost.toFixed(2)} zł</span></div>}
              {wlCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Włosy</span><span style={{ color:'#9ca3af' }}>{wlCost.toFixed(2)} zł</span></div>}
              {kapCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Kąpiel</span><span style={{ color:'#9ca3af' }}>{kapCost.toFixed(2)} zł</span></div>}
              {papierCostH>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Papier toa.</span><span style={{ color:'#9ca3af' }}>{papierCostH.toFixed(2)} zł</span></div>}
              {inneCost>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Inne</span><span style={{ color:'#9ca3af' }}>{inneCost.toFixed(2)} zł</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{totalH.toFixed(2)} zł</span>
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
            <InnerSec title="Śmieci">
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <FieldBox label="Worków w tygodniu"><input type="number" className="no-spin" min="0" max="99999" style={inp2} value={o.bagsPerWeek} placeholder="4" onChange={e=>updOther(key,{bagsPerWeek:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label="Worków w opakowaniu"><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="20" value={o.bagsPerPkg} onChange={e=>updOther(key,{bagsPerPkg:cl2(e.target.value)})} /></FieldBox>
                <FieldBox label="Cena opakowania (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="12" value={o.bagsPkgPrice} onChange={e=>updOther(key,{bagsPkgPrice:cl2(e.target.value)})} /></FieldBox>
              </div>
            </InnerSec>
            <InnerSec title="Płyny i akcesoria">
              <div style={{ display:'flex', flexDirection:'column', gap:6, overflow:'hidden' }}>
                {(o.cleaningItems || []).map((ci, idx) => (
                  <div key={ci.id || idx} style={{ background:'#111827', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4, overflow:'hidden' }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                      <input value={ci.name} maxLength={30} placeholder="np. Płyn uniwersalny"
                        onChange={e => { const a=[...o.cleaningItems]; a[idx]={...a[idx],name:e.target.value}; updItems(a); }}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={() => updItems(o.cleaningItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <FieldBox label="Szt./mies."><input type="number" className="no-spin" min="0" max="999" style={{ width:52, boxSizing:'border-box', padding:'6px 8px', fontSize:13 }} value={ci.perMonth} onChange={e=>{const a=[...o.cleaningItems];a[idx]={...a[idx],perMonth:cl(e.target.value,999)};updItems(a);}} /></FieldBox>
                    <FieldBox label="Cena/opak. (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} value={ci.pkgPrice} onChange={e=>{const a=[...o.cleaningItems];a[idx]={...a[idx],pkgPrice:cl2(e.target.value)};updItems(a);}} /></FieldBox>
                  </div>
                ))}
                <button type="button" onClick={() => updItems([...(o.cleaningItems||[]), { id:Date.now(), name:'', perMonth:'1', pkgPrice:'' }])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  + Dodaj produkt
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {bagCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Worki na śmieci</span><span style={{ color:'#9ca3af' }}>{bagCost.toFixed(2)} zł</span></div>}
              {cleanCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Płyny i akcesoria</span><span style={{ color:'#9ca3af' }}>{cleanCost.toFixed(2)} zł</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{(bagCost + cleanCost).toFixed(2)} zł</span>
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
              {[['useReczne','Ręcznie'],['useZmywarka','Zmywarka']].map(([field, lbl]) => (
                <button key={field} type="button" onClick={()=>updOther(key,{[field]:!o[field]})}
                  style={{ flex:1, padding:'5px 4px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:o[field]?'#1e3a3a':'transparent', color:o[field]?'#2dd4bf':'#6b7280' }}>
                  {lbl}
                </button>
              ))}
            </div>
            {o.useReczne && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>Ręcznie</div>
              <div>
                <div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Na ile wystarcza pojemnik?</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:4 }}>
                  {['dni','miesiace'].map(u => (
                    <button key={u} type="button" onClick={()=>updOther(key,{durationUnit:u})}
                      style={{ width:'100%', padding:'5px 8px', border:'1px solid', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                        background:o.durationUnit===u?'#1e3a3a':'transparent', borderColor:'#374151', color:o.durationUnit===u?'#2dd4bf':'#6b7280' }}>
                      {u==='dni'?'Dni':'Miesiące'}
                    </button>
                  ))}
                </div>
                <input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={o.pkgDuration} onChange={e=>updOther(key,{pkgDuration:cl2(e.target.value)})} />
              </div>
              <FieldBox label="Cena opakowania (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="9" value={o.pkgPrice} onChange={e=>updOther(key,{pkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {o.useZmywarka && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#0d9488' }}>Zmywarka</div>
              <FieldBox label="Użyć na tydzień"><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="7" value={o.usesPerWeek} onChange={e=>updOther(key,{usesPerWeek:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Kapsułek w opakowaniu"><input type="number" className="no-spin" min="0" max="99999" style={inp2} placeholder="30" value={o.kapsPerPkg} onChange={e=>updOther(key,{kapsPerPkg:cl2(e.target.value)})} /></FieldBox>
              <FieldBox label="Cena opakowania (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder="25" value={o.kapsulkiPkgPrice} onChange={e=>updOther(key,{kapsulkiPkgPrice:cl2(e.target.value)})} /></FieldBox>
            </div>}
            {(o.useReczne || o.useZmywarka) && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                {recznyCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Ręcznie</span><span style={{ color:'#9ca3af' }}>{recznyCost.toFixed(2)} zł</span></div>}
                {zmywarkaCost > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Zmywarka</span><span style={{ color:'#9ca3af' }}>{zmywarkaCost.toFixed(2)} zł</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>× {days} dni</span>
                  <span style={{ color:'#0d9488' }}>{(recznyCost + zmywarkaCost).toFixed(2)} zł</span>
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
              ['przedszkoleE','przedszkole','Przedszkole / Żłobek','1200'],
              ['obiadE','obiad','Obiad w szkole / Żłobku','150'],
              ['zajeciaE','zajecia','Zajęcia dodatkowe','200'],
              ['korepetycjeE','korepetycje','Korepetycje','300'],
              ['materialyE','materialy','Materiały szkolne','80'],
              ['dojazdyE','dojazdy','Dojazdy do szkoły','150'],
              ['odziezdE','odziez','Odzież i obuwie','200'],
              ['kieszonkoweE','kieszonkowe','Kieszonkowe','200'],
              ['zabawkiE','zabawki','Zabawki','100'],
              ['kosmetykiE','kosmetyki','Kosmetyki','50'],
            ].map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updD({[eKey]:!d[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:d[eKey]?'#1e3a3a':'transparent', color:d[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {d[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <MI label="zł / miesiąc" val={d[vKey]} onChange={v=>updD({[vKey]:v})} ph={ph} />
                </div>}
              </div>
            ))}
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({pieluchyEnabled:!d.pieluchyEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.pieluchyEnabled?'#1e3a3a':'transparent', color:d.pieluchyEnabled?'#2dd4bf':'#6b7280' }}>
                Pieluchy
              </button>
              {d.pieluchyEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label="Ile dziennie (szt.)" val={d.pieluchyPerDay} onChange={v=>updD({pieluchyPerDay:v})} step="1" ph="8" />
                <MI label="Ilość w opakowaniu" val={d.pieluchyPerPkg} onChange={v=>updD({pieluchyPerPkg:v})} step="1" ph="50" />
                <MI label="Cena opakowania (zł)" val={d.pieluchyPrice} onChange={v=>updD({pieluchyPrice:v})} ph="60" />
              </div>}
            </div>
            <div style={{ marginBottom:10 }}>
              <button type="button" onClick={()=>updD({mlekoEnabled:!d.mlekoEnabled})}
                style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                  background:d.mlekoEnabled?'#1e3a3a':'transparent', color:d.mlekoEnabled?'#2dd4bf':'#6b7280' }}>
                Mleko modyfikowane
              </button>
              {d.mlekoEnabled && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10, display:'flex', flexDirection:'column', gap:5 }}>
                <MI label="Ile porcji dziennie" val={d.mlekoPerDay} onChange={v=>updD({mlekoPerDay:v})} step="1" ph="5" />
                <MI label="Porcji w opakowaniu" val={d.mlekoPkgScoops} onChange={v=>updD({mlekoPkgScoops:v})} step="1" ph="21" />
                <MI label="Cena opakowania (zł)" val={d.mlekoPrice} onChange={v=>updD({mlekoPrice:v})} ph="90" />
              </div>}
            </div>
            <InnerSec title="Inne">
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(d.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder="np. Kolonia"
                        onChange={e=>{const a=[...d.extraItems];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(d.extraItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder="zł/mies."
                      value={ci.price}
                      onChange={e=>{const a=[...d.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...(d.extraItems||[]),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  + Dodaj ekstra wydatek
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
              {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Stałe</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} zł</span></div>}
              {totalPieluchy>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Pieluchy</span><span style={{ color:'#9ca3af' }}>{totalPieluchy.toFixed(2)} zł</span></div>}
              {totalMleko>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Mleko</span><span style={{ color:'#9ca3af' }}>{totalMleko.toFixed(2)} zł</span></div>}
              {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Inne</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} zł</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} zł</span>
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
            {Tog({eKey:"suchaE", label:"Sucha karma"})}
            {z.suchaE && <InnerSec mb={6} flex title="Sucha karma">
              {ZI({label:"Dzienne spożycie (g)", field:"suchaG", ph:"50"})}
              {ZI({label:"Wielkość opakowania (g)", field:"suchaPkgG", ph:"2000"})}
              {ZI({label:"Cena opakowania (zł)", field:"suchaPrice", step:"0.01", ph:"60"})}
            </InnerSec>}
            {Tog({eKey:"mokraE", label:"Mokra karma"})}
            {z.mokraE && <InnerSec mb={6} flex title="Mokra karma">
              {ZI({label:"Puszek / saszetek dziennie", field:"mokraSzt", ph:"2"})}
              {ZI({label:"Gramatura puszki / saszetki (g)", field:"mokraGram", ph:"400"})}
              {ZI({label:"Cena puszki / saszetki (zł)", field:"mokraPrice", step:"0.01", ph:"2.50"})}
            </InnerSec>}
            {Tog({eKey:"zwierekE", label:"Żwirek / ściółka"})}
            {z.zwierekE && <InnerSec mb={6} flex title="Żwirek / ściółka">
              {ZI({label:"Wymiana co ile dni", field:"zwierekDni", ph:"7"})}
              {ZI({label:"Ilość na wymianę (l)", field:"zwierekL", step:"0.5", ph:"3"})}
              {ZI({label:"Wielkość opakowania (l)", field:"zwierekPkgL", step:"0.5", ph:"5"})}
              {ZI({label:"Cena opakowania (zł)", field:"zwierekPrice", step:"0.01", ph:"20"})}
            </InnerSec>}
            {Tog({eKey:"wetE", label:"Weterynarz"})}
            {z.wetE && <InnerSec mb={6} flex title="Weterynarz">
              {ZI({label:"Miesięcznie (zł)", field:"wet", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"pielegnacjaE", label:"Pielęgnacja"})}
            {z.pielegnacjaE && <InnerSec mb={6} flex title="Pielęgnacja">
              {ZI({label:"Miesięcznie (zł)", field:"pielegnacja", step:"0.01", ph:"50"})}
            </InnerSec>}
            {Tog({eKey:"akcesoriaE", label:"Akcesoria / zabawki"})}
            {z.akcesoriaE && <InnerSec mb={6} flex title="Akcesoria / zabawki">
              {ZI({label:"Miesięcznie (zł)", field:"akcesoria", step:"0.01", ph:"30"})}
            </InnerSec>}
            <InnerSec mb={6} flex title="Inne">
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(z.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder="np. Zabawki"
                        onChange={e=>{const a=[...z.extraItems];a[idx]={...a[idx],name:e.target.value};updZ({extraItems:a});}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updZ({extraItems:z.extraItems.filter((_,i)=>i!==idx)})}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder="zł/mies."
                      value={ci.price}
                      onChange={e=>{const a=[...z.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updZ({extraItems:a});}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updZ({extraItems:[...(z.extraItems||[]),{id:Date.now(),name:'',price:''}]})}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  + Dodaj ekstra wydatek
                </button>
              </div>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6, marginTop:4 }}>
              {tSucha>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Sucha karma</span><span style={{ color:'#9ca3af' }}>{tSucha.toFixed(2)} zł</span></div>}
              {tMokra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Mokra karma</span><span style={{ color:'#9ca3af' }}>{tMokra.toFixed(2)} zł</span></div>}
              {tZwierek>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Żwirek / ściółka</span><span style={{ color:'#9ca3af' }}>{tZwierek.toFixed(2)} zł</span></div>}
              {tMies>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Wet. / piel. / akc.</span><span style={{ color:'#9ca3af' }}>{(tMies/30*days).toFixed(2)} zł</span></div>}
              {tExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Inne</span><span style={{ color:'#9ca3af' }}>{tExtra.toFixed(2)} zł</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{tAll.toFixed(2)} zł</span>
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
            <InnerSec title="Wizyty lekarskie" mb={8}>
              <FieldBox label="zł / miesiąc">
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="100" value={o.wizyty} onChange={e=>updOther(key,{wizyty:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <InnerSec title="Leki" mb={6}>
              <FieldBox label="zł / miesiąc">
                <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                  placeholder="50" value={o.leki} onChange={e=>updOther(key,{leki:cl2(e.target.value)})} />
              </FieldBox>
            </InnerSec>
            <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Wizyty lekarskie</span><span style={{ color:'#9ca3af' }}>{(nn(o.wizyty)/30*days).toFixed(2)} zł</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Leki</span><span style={{ color:'#9ca3af' }}>{(nn(o.leki)/30*days).toFixed(2)} zł</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                <span style={{ color:'#6b7280' }}>× {days} dni</span>
                <span style={{ color:'#0d9488' }}>{total.toFixed(2)} zł</span>
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
              ['papierA4E','papierA4','Papier A4 (ryza 500 ark.)','25'],
              ['tuszE','tusz','Tusz / toner do drukarki','60'],
              ['notatnikE','notatnik','Notatnik / Zeszyty','20'],
              ['dlugopisyE','dlugopisy','Długopisy','10'],
            ].map(([eKey, vKey, label, ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updB({[eKey]:!b[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:b[eKey]?'#1e3a3a':'transparent', color:b[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {b[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label="zł / miesiąc">
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={b[vKey]} onChange={e=>updB({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            <div style={{ borderLeft:'2px solid #2dd4bf', paddingLeft:10, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Inne</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {(b.extraItems||[]).map((ci,idx) => (
                  <div key={ci.id||idx} style={{ background:'#1a2433', borderRadius:6, padding:'6px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                      <input value={ci.name} maxLength={30} placeholder="np. Kredki"
                        onChange={e=>{const a=[...b.extraItems];a[idx]={...a[idx],name:e.target.value};updExtra(a);}}
                        style={{ fontSize:11, flex:1, minWidth:0, padding:'5px 6px', boxSizing:'border-box' }} />
                      <button onClick={()=>updExtra(b.extraItems.filter((_,i)=>i!==idx))}
                        style={{ background:'#ef444420', border:'none', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 7px', fontSize:12, fontWeight:700 }}>×</button>
                    </div>
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" placeholder="zł/mies."
                      value={ci.price}
                      onChange={e=>{const a=[...b.extraItems];a[idx]={...a[idx],price:cl2(e.target.value)};updExtra(a);}}
                      style={{ ...inp2, width:'100%' }} />
                  </div>
                ))}
                <button type="button" onClick={()=>updExtra([...(b.extraItems||[]),{id:Date.now(),name:'',price:''}])}
                  style={{ padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s' }}>
                  + Dodaj produkt
                </button>
              </div>
            </div>
            {(totalFixed > 0 || totalExtra > 0) && (
              <div style={{ borderTop:'1px solid #1a3a38', paddingTop:6 }}>
                {totalFixed>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Artykuły</span><span style={{ color:'#9ca3af' }}>{totalFixed.toFixed(2)} zł</span></div>}
                {totalExtra>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Inne</span><span style={{ color:'#9ca3af' }}>{totalExtra.toFixed(2)} zł</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>× {days} dni</span>
                  <span style={{ color:'#0d9488' }}>{totalAll.toFixed(2)} zł</span>
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
              const res = await fuelApi.getPrices();
              const fp = res.data;
              updP({ fetchedPrices: fp, fuelPrice: String(fp[p.fuelType] || '') });
            } catch {
              setFetchFuelError('Nie udało się pobrać cen');
            } finally {
              setFetchingFuelPrices(false);
            }
          };
          const dailyCost = (nn(p.kmPerDay) / 100) * nn(p.consumption) * nn(p.fuelPrice) * days;
          const FUEL_LABELS = { diesel: 'Diesel', benzyna: 'Benzyna', gaz: 'LPG' };
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
              <FieldBox label="Cena paliwa (zł/l)">
                <input type="number" className="no-spin" min="0" max="99" step="0.01" style={inp2}
                  placeholder="np. 6.20" value={p.fuelPrice} onChange={e=>updP({fuelPrice:cl2(e.target.value)})} />
              </FieldBox>
              <button type="button" onClick={fetchPrices} disabled={fetchingFuelPrices}
                style={{ width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid #374151', background:'#1e3a3a', color:'#2dd4bf', cursor:'pointer', fontSize:10, fontWeight:600 }}>
                {fetchingFuelPrices ? '...' : '↻ Pobierz cenę z internetu'}
              </button>
              {fetchFuelError && <div style={{ fontSize:10, color:'#ef4444' }}>{fetchFuelError}</div>}
              {p.fetchedPrices && Object.keys(p.fetchedPrices).length > 0 && (
                <div style={{ display:'flex', gap:8, fontSize:10, color:'#6b7280' }}>
                  {Object.entries(FUEL_LABELS).map(([k,lbl]) => p.fetchedPrices[k] &&
                    <span key={k}>{lbl}: <span style={{ color:'#9ca3af' }}>{p.fetchedPrices[k]} zł</span></span>
                  )}
                </div>
              )}
              <FieldBox label="Km dziennie">
                <input type="number" className="no-spin" min="0" max="99999" step="1" style={inp2}
                  placeholder="np. 40" value={p.kmPerDay} onChange={e=>updP({kmPerDay:cl2(e.target.value)})} />
              </FieldBox>
              <FieldBox label="Spalanie (l/100km)">
                <input type="number" className="no-spin" min="0" max="99" step="0.1" style={inp2}
                  placeholder="np. 6.5" value={p.consumption} onChange={e=>updP({consumption:cl2(e.target.value)})} />
              </FieldBox>
            </div>
            {dailyCost > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}>
                  <span style={{ color:'#6b7280' }}>{FUEL_LABELS[p.fuelType]} ({(nn(p.kmPerDay)*days).toFixed(0)} km)</span>
                  <span style={{ color:'#9ca3af' }}>{dailyCost.toFixed(2)} zł</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>× {days} dni</span>
                  <span style={{ color:'#0d9488' }}>{dailyCost.toFixed(2)} zł</span>
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
            {[['internetE','internet','Internet','60'],['telefonE','telefon','Telefon','50'],['tvE','tv','TV','40']].map(([eKey,vKey,label,ph]) => (
              <div key={eKey} style={{ marginBottom:8 }}>
                <button type="button" onClick={()=>updM({[eKey]:!m[eKey]})}
                  style={{ width:'100%', padding:'5px 8px', border:'1px solid #374151', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:600, transition:'all 0.15s',
                    background:m[eKey]?'#1e3a3a':'transparent', color:m[eKey]?'#2dd4bf':'#6b7280' }}>
                  {label}
                </button>
                {m[eKey] && <div style={{ marginTop:6, borderLeft:'2px solid #2dd4bf', paddingLeft:10 }}>
                  <FieldBox label="zł / miesiąc">
                    <input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2}
                      placeholder={ph} value={m[vKey]} onChange={e=>updM({[vKey]:cl2(e.target.value)})} />
                  </FieldBox>
                </div>}
              </div>
            ))}
            {total > 0 && (
              <div style={{ borderTop:'1px solid #1a3a38', marginTop:4, paddingTop:6 }}>
                {m.internetE&&nn(m.internet)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Internet</span><span style={{ color:'#9ca3af' }}>{(nn(m.internet)/30*days).toFixed(2)} zł</span></div>}
                {m.telefonE&&nn(m.telefon)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>Telefon</span><span style={{ color:'#9ca3af' }}>{(nn(m.telefon)/30*days).toFixed(2)} zł</span></div>}
                {m.tvE&&nn(m.tv)>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:2 }}><span style={{ color:'#6b7280' }}>TV</span><span style={{ color:'#9ca3af' }}>{(nn(m.tv)/30*days).toFixed(2)} zł</span></div>}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:800, borderTop:'1px solid #1a3a38', paddingTop:4, marginTop:2 }}>
                  <span style={{ color:'#6b7280' }}>× {days} dni</span>
                  <span style={{ color:'#0d9488' }}>{total.toFixed(2)} zł</span>
                </div>
              </div>
            )}
          </div>
          );
        }
        const OPLATY_PH = { czynsz:'1500', prad:'200', gaz_oplata:'80', ogrzewanie:'300', kredyt:'800' };
        return (
          <div style={{ background:'#111827', border:'1px solid #374151', borderRadius:8, padding:'8px', marginTop:4 }}>
            <FieldBox label="Miesięcznie (zł)"><input type="number" className="no-spin" min="0" max="99999" step="0.01" style={inp2} placeholder={OPLATY_PH[key]||''} value={o.monthlyAmount} onChange={e=>updOther(key,{monthlyAmount:cl2(e.target.value)})} /></FieldBox>
            {Summary()}
          </div>
        );
      })()}
      {expanded && (
        <button type="button" onClick={e => { e.stopPropagation(); updOther(key, {...OTHER_DEFAULTS[key], enabled: true}); }}
          className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
          Wyczyść
        </button>
      )}
    </div>
  );
  };

  return (
    <div ref={cardRef}>

      <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
        Wybierz wydatki które chcesz sumować
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
                <span style={{ fontSize:11, fontWeight:700, color:'#fff', textAlign:'center', position:'relative', zIndex:1, textShadow:'0 1px 3px rgba(0,0,0,0.8)', padding:'0 4px' }}>{label}</span>
                {(() => { const t = drinkTilePreview(key); return t>0 ? <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)', padding:'4px 6px', textAlign:'center', fontSize:12, fontWeight:800, color:'#2dd4bf', zIndex:2, letterSpacing:'0.2px', opacity: enabled?1:0.7 }}>{t.toFixed(2)} zł</div> : null; })()}
              </div>

              {/* Panel konfiguracji — szerokość tile'a */}
              {expanded && (() => {
                const tileTotal = items.filter(i=>i._dk===key).reduce((s,i)=>s+i.total,0);
                if (key === 'kawa') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title="Zużycie">
                        <FieldBox label="Kubków / dzień"><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={drinks.kawa.cupsPerDay} onChange={e => upd('kawa',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label={`Łyżek kawy / kubek (=${(parseFloat(drinks.kawa.spoonsPerCup)||0)*3}g)`}><input type="number" className="no-spin" min="0" style={fi} placeholder="2" value={drinks.kawa.spoonsPerCup} onChange={e => upd('kawa',{spoonsPerCup:cl(e.target.value,20)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label="Słodzi?"><div style={{ display:'flex', gap:4 }}>{btnSugar('kawa','cukier')}{btnSugar('kawa','slodzik')}</div></FieldBox></div>
                        {drinks.kawa.sugarType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.sugarType==='cukier'?'Cukier':'Słodzik'}</div>
                          <FieldBox label={`Łyżek / kubek (=${(parseFloat(drinks.kawa.sugarSpoons)||0)*3}g)`}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={drinks.kawa.sugarSpoons} onChange={e => upd('kawa',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Cena (zł/kg)</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.kawa.sugarType==='cukier'?'3.50':'15'} value={drinks.kawa.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999);drinks.kawa.sugarType==='cukier'?setCukierPrice(v):setSlodzikPrice(v);}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label="Mleko / Śmietanka?">
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('kawa',{milkType: drinks.kawa.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.kawa.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.kawa.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.kawa.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?'Mleko':'Śmietanka'}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {drinks.kawa.milkType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.kawa.milkType==='mleko'?'Mleko':'Śmietanka'}</div>
                            <FieldBox label="ml / kubek"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={drinks.kawa.milkMlPerCup} onChange={e => upd('kawa',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label="Pojemność op. (ml)"><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={drinks.kawa.milkPkgMl} onChange={e => upd('kawa',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={drinks.kawa.milkPrice} onChange={e => upd('kawa',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title="Opakowanie">
                        <FieldBox label="Waga op. (g)"><input type="number" className="no-spin" min="0" style={fi} placeholder="250" value={drinks.kawa.pkgG} onChange={e => upd('kawa',{pkgG:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="18" value={drinks.kawa.pkgPrice} onChange={e => upd('kawa',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[`${parseFloat(drinks.kawa.cupsPerDay)||0} kub./dzień`,`× ${days} dni`,`= ${(parseFloat(drinks.kawa.cupsPerDay)||0)*days} kubków`].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:'Kawa',val:items.filter(i=>i._dk==='kawa'&&i.name==='Kawa').reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='kawa'&&i.name!=='Kawa').map(i=>({label:i.name.replace(' (kawa)',''),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} zł</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} zł</div>
                    </div>
                  </div>
                );
                if (key === 'herbata') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title="Zużycie">
                        <FieldBox label="Kubków / dzień"><input type="number" className="no-spin" min="0" style={fi} placeholder="3" value={drinks.herbata.cupsPerDay} onChange={e => upd('herbata',{cupsPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Słodzi?"><div style={{ display:'flex', gap:4 }}>{btnSugar('herbata','cukier')}{btnSugar('herbata','slodzik')}</div></FieldBox></div>
                        {drinks.herbata.sugarType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.sugarType==='cukier'?'Cukier':'Słodzik'}</div>
                          <FieldBox label={`Łyżek / kubek (=${(parseFloat(drinks.herbata.sugarSpoons)||0)*3}g)`}><input type="number" className="no-spin" min="0" style={fi} placeholder="1" value={drinks.herbata.sugarSpoons} onChange={e => upd('herbata',{sugarSpoons:cl(e.target.value,20)})} /></FieldBox>
                          <div><div style={{ fontSize:10, color:'#6b7280', marginBottom:3 }}>Cena (zł/kg)</div><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder={drinks.herbata.sugarType==='cukier'?'3.50':'15'} value={drinks.herbata.sugarType==='cukier'?effCukierPrice:effSlodzikPrice} onChange={e=>{const v=cl(e.target.value,9999);drinks.herbata.sugarType==='cukier'?setCukierPrice(v):setSlodzikPrice(v);}} /></div>
                        </div>}
                        <div style={{ marginTop:8 }}>
                          <FieldBox label="Mleko / Śmietanka?">
                            <div style={{ display:'flex', gap:4 }}>
                              {['mleko','smietanka'].map(mt => (
                                <button key={mt} type="button" onClick={() => upd('herbata',{milkType: drinks.herbata.milkType===mt ? null : mt})}
                                  style={{ padding:'6px 12px', border:'1px solid', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap', transition:'all 0.15s',
                                    background: drinks.herbata.milkType===mt?'#0d9488':'#2d3748',
                                    borderColor: drinks.herbata.milkType===mt?'#0d9488':'#374151',
                                    color: drinks.herbata.milkType===mt?'white':'#9ca3af' }}>
                                  {mt==='mleko'?'Mleko':'Śmietanka'}
                                </button>
                              ))}
                            </div>
                          </FieldBox>
                          {drinks.herbata.milkType && <div style={{ marginTop:8, borderLeft:'2px solid #2dd4bf', paddingLeft:8, display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#2dd4bf' }}>{drinks.herbata.milkType==='mleko'?'Mleko':'Śmietanka'}</div>
                            <FieldBox label="ml / kubek"><input type="number" className="no-spin" min="0" style={fi} placeholder="30" value={drinks.herbata.milkMlPerCup} onChange={e => upd('herbata',{milkMlPerCup:cl(e.target.value,500)})} /></FieldBox>
                            <FieldBox label="Pojemność op. (ml)"><input type="number" className="no-spin" min="0" style={fi} placeholder="1000" value={drinks.herbata.milkPkgMl} onChange={e => upd('herbata',{milkPkgMl:cl(e.target.value,9999)})} /></FieldBox>
                            <FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3.50" value={drinks.herbata.milkPrice} onChange={e => upd('herbata',{milkPrice:cl(e.target.value,9999)})} /></FieldBox>
                          </div>}
                        </div>
                      </InnerSec>
                      <InnerSec title="Opakowanie">
                        <FieldBox label="Saszetek w op."><input type="number" className="no-spin" min="0" style={fi} placeholder="100" value={drinks.herbata.sachetPerPkg} onChange={e => upd('herbata',{sachetPerPkg:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="8" value={drinks.herbata.pkgPrice} onChange={e => upd('herbata',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[`${parseFloat(drinks.herbata.cupsPerDay)||0} kub./dzień`,`× ${days} dni`,`= ${(parseFloat(drinks.herbata.cupsPerDay)||0)*days} kubków`].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      {[{label:'Herbata',val:items.filter(i=>i._dk==='herbata'&&i.name==='Herbata').reduce((s,i)=>s+i.total,0)},...items.filter(i=>i._dk==='herbata'&&i.name!=='Herbata').map(i=>({label:i.name.replace(' (herbata)',''),val:i.total}))].filter(b=>b.val>0).map((b,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}><span style={{ color:'#6b7280' }}>{b.label}</span><span style={{ color:'#9ca3af', fontWeight:600 }}>{b.val.toFixed(2)} zł</span></div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} zł</div>
                    </div>
                  </div>
                );
                if (key === 'napoje') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title="Opakowanie">
                        <FieldBox label="Litrów / dzień"><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={drinks.napoje.litersPerDay} onChange={e => upd('napoje',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Pojemność op. (l)"><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="2" value={drinks.napoje.pkgL} onChange={e => upd('napoje',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="4" value={drinks.napoje.pkgPrice} onChange={e => upd('napoje',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[`${parseFloat(drinks.napoje.litersPerDay)||0} l/dzień`,`× ${days} dni`,`= ${((parseFloat(drinks.napoje.litersPerDay)||0)*days).toFixed(1)} l`].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} zł</div>
                    </div>
                  </div>
                );
                if (key === 'woda') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title="Opakowanie">
                        <FieldBox label="Litrów / dzień"><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1.5" value={drinks.woda.litersPerDay} onChange={e => upd('woda',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Pojemność op. (l)"><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="5" value={drinks.woda.pkgL} onChange={e => upd('woda',{pkgL:cl(e.target.value,9999)})} /></FieldBox></div>
                        <div style={{ marginTop:8 }}><FieldBox label="Cena op. (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="3" value={drinks.woda.pkgPrice} onChange={e => upd('woda',{pkgPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[`${parseFloat(drinks.woda.litersPerDay)||0} l/dzień`,`× ${days} dni`,`= ${((parseFloat(drinks.woda.litersPerDay)||0)*days).toFixed(1)} l`].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} zł</div>
                    </div>
                  </div>
                );
                if (key === 'sodaStream') return (
                  <div style={{ ...cfg }}>
                      <InnerSec title="Zużycie">
                        <FieldBox label="Litrów / dzień"><input type="number" className="no-spin" min="0" step="0.1" style={fi} placeholder="1" value={drinks.sodaStream.litersPerDay} onChange={e => upd('sodaStream',{litersPerDay:cl(e.target.value,50)})} /></FieldBox>
                        <div style={{ marginTop:8 }}>
                          <div style={{ fontSize:10, color:'#6b7280', marginBottom:4 }}>Słodkość</div>
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
                      <InnerSec title="Syrop">
                        <FieldBox label="Pojemność syropu (ml)"><input type="number" className="no-spin" min="0" style={fi} placeholder="440" value={drinks.sodaStream.syrupMl} onChange={e => upd('sodaStream',{syrupMl:cl(e.target.value,9999)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Cena syropu (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="25" value={drinks.sodaStream.syrupPrice} onChange={e => upd('sodaStream',{syrupPrice:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                      <InnerSec title="Butla gazowa">
                        <FieldBox label="Wymiana co (dni)"><input type="number" className="no-spin" min="0" style={fi} placeholder="np. 30" value={drinks.sodaStream.cylinderDays} onChange={e => upd('sodaStream',{cylinderDays:cl(e.target.value,3650)})} /></FieldBox>
                        <div style={{ marginTop:8 }}><FieldBox label="Koszt wymiany (zł)"><input type="number" className="no-spin" min="0" step="0.01" style={fi} placeholder="np. 50" value={drinks.sodaStream.cylinderCost} onChange={e => upd('sodaStream',{cylinderCost:cl(e.target.value,9999)})} /></FieldBox></div>
                      </InnerSec>
                    <div style={{ borderTop:'1px solid #1a3a38', marginTop:8, paddingTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                      {[`${parseFloat(drinks.sodaStream.litersPerDay)||0} l/dzień`,`× ${days} dni`,`= ${((parseFloat(drinks.sodaStream.litersPerDay)||0)*days).toFixed(1)} l`].map((l,i)=><div key={i} style={{ fontSize:10, color:'#6b7280' }}>{l}</div>)}
                      <div style={{ fontSize:13, fontWeight:800, color:'#0d9488', marginTop:2 }}>{tileTotal.toFixed(2)} zł</div>
                    </div>
                  </div>
                );
                return null;
              })()}
              {expanded && (
                <button type="button" onClick={e => { e.stopPropagation(); upd(key, {...DRINKS_DEFAULTS[key], enabled: true}); }}
                  className="btn btn-danger" style={{ width:'100%', marginTop:4, fontSize:10 }}>
                  Wyczyść
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

export { OTHER_TYPES, SHARED_KEYS };
export default DrinksCard;
