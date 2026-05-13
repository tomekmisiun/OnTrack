import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { mealPlan as api, recipes as recipesApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

const COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
const getColor = (pos) => COLORS[(pos - 1) % 5];

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return dateToStr(d);
}
function toEU(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
function getUpcomingMondays(count = 16) {
  const mondays = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - (today.getDay() + 6) % 7);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    mondays.push(dateToStr(d));
  }
  return mondays;
}
function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - (firstDay.getDay() + 6) % 7);
  const end = new Date(lastDay);
  const endDow = (lastDay.getDay() + 6) % 7;
  if (endDow < 6) end.setDate(end.getDate() + (6 - endDow));
  const days = [];
  const c = new Date(start);
  while (c <= end) { days.push(new Date(c)); c.setDate(c.getDate() + 1); }
  return days;
}

// ─── Draggable recipe ─────────────────────────────────────────────────────────
function DraggableRecipe({ recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`, data: { type: 'recipe', recipe },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      flexShrink:0, width:110, padding:'10px 10px 8px',
      background:'linear-gradient(145deg, #667eea, #764ba2)', color:'white',
      borderRadius:10, fontSize:12, cursor:'grab', opacity: isDragging ? 0.35 : 1,
      userSelect:'none', touchAction:'none', boxShadow:'0 2px 8px rgba(102,126,234,0.35)',
      display:'flex', flexDirection:'column', gap:4,
    }}>
      <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,marginBottom:2}}>🍽️</div>
      <div style={{fontWeight:600,lineHeight:1.2,fontSize:11}}>{recipe.name}</div>
      <div style={{fontSize:10,opacity:0.75}}>{recipe.total_cost.toFixed(2)} zł</div>
    </div>
  );
}

// ─── Draggable meal ───────────────────────────────────────────────────────────
function DraggableMeal({ meal, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.id}`, data: { type: 'meal', meal },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      background:getColor(meal.position), color:'white', borderRadius:3,
      padding:'1px 4px', fontSize:11, cursor:'grab', opacity: isDragging ? 0.35 : 1,
      display:'flex', alignItems:'center', gap:2,
      userSelect:'none', touchAction:'none', width:'100%', minWidth:0,
    }}>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{meal.recipe.name}</span>
      <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(meal.id);}}
        style={{background:'rgba(0,0,0,0.25)',border:'none',color:'white',borderRadius:2,cursor:'pointer',padding:'0 3px',fontSize:9,lineHeight:'14px',flexShrink:0}}>✕</button>
    </div>
  );
}

// ─── Drag handle for day ──────────────────────────────────────────────────────
function DraggableDayHandle({ dateStr, meals }) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `day-${dateStr}`, data: { type: 'day', dateStr, meals },
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} title={t('drag_day_title')}
      style={{cursor:'grab',opacity:isDragging?0.4:1,fontSize:10,color:'#bbb',marginLeft:2,userSelect:'none',touchAction:'none'}}>⠿</span>
  );
}

// ─── Droppable day header ─────────────────────────────────────────────────────
function DroppableDayHeader({ dateStr, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-header-${dateStr}`, data: { type: 'day-target', dateStr },
  });
  return (
    <div ref={setNodeRef} style={{background: isOver ? 'rgba(102,126,234,0.18)' : 'transparent', transition:'background 0.1s'}}>
      {children}
    </div>
  );
}

// ─── Calendar meal slot ───────────────────────────────────────────────────────
function MealSlot({ date, position, meal, onDelete, showLabel }) {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${position}`, data: { date, position },
  });
  return (
    <div ref={setNodeRef} style={{
      height:22, borderBottom: position<5 ? '1px solid #f0f0f0' : 'none',
      background: isOver && !meal ? 'rgba(102,126,234,0.12)' : 'transparent',
      display:'flex', alignItems:'center', padding:'1px 4px', transition:'background 0.1s',
    }}>
      {meal
        ? <DraggableMeal meal={meal} onDelete={onDelete} />
        : showLabel && <span style={{fontSize:9,color:'#c0b8d4',userSelect:'none',whiteSpace:'nowrap',overflow:'hidden',width:'100%',textAlign:'center',display:'block'}}>{t('slot_labels')[position-1]}</span>
      }
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────
function DayCell({ date, dateStr, meals, isToday, isPast, isCurrentMonth, onDelete, onDeleteAll, onCopy, onPaste, copiedDay }) {
  const { t } = useLanguage();
  const mealsByPos = {};
  meals.forEach(m => { mealsByPos[m.position] = m; });
  const hasMeals = meals.length > 0;
  const canPaste = copiedDay && copiedDay !== dateStr;

  return (
    <div style={{
      border:`1px solid ${isToday ? '#667eea' : '#e8e8e8'}`,
      borderRadius:4, overflow:'hidden',
      background: isPast ? '#f7f7f7' : isToday ? '#faf9ff' : 'white',
      opacity: !isCurrentMonth ? 0.45 : 1,
    }}>
      <DroppableDayHeader dateStr={dateStr}>
        <div style={{
          padding:'2px 4px', fontSize:11, fontWeight: isToday ? 700 : 400,
          color: isPast ? '#bbb' : isToday ? '#764ba2' : '#555',
          borderBottom:'1px solid #f0f0f0',
          background: isToday ? 'rgba(102,126,234,0.08)' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <span style={{display:'flex',alignItems:'center',gap:2}}>
            {date.getDate()}
            {hasMeals && <DraggableDayHandle dateStr={dateStr} meals={meals} />}
          </span>
          <span style={{display:'flex',gap:1}}>
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onCopy(dateStr)}
                title={t('copy_day_title')}
                style={{background: copiedDay===dateStr ? '#667eea' : 'none', color: copiedDay===dateStr ? 'white' : '#bbb', border:'none', cursor:'pointer', fontSize:9, padding:'0 2px', borderRadius:2}}>⧉</button>
            )}
            {canPaste && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onPaste(dateStr)}
                title={t('paste_day_title')}
                style={{background:'none',color:'#667eea',border:'none',cursor:'pointer',fontSize:9,padding:'0 2px',borderRadius:2}}>⎘</button>
            )}
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onDeleteAll(dateStr)}
                title={t('del_day_title')}
                style={{background:'none',color:'#ff6b81',border:'none',cursor:'pointer',fontSize:9,padding:'0 2px',borderRadius:2}}>🗑</button>
            )}
          </span>
        </div>
      </DroppableDayHeader>
      <div>
        {[1,2,3,4,5].map(pos => (
          <MealSlot key={pos} date={dateStr} position={pos}
            meal={mealsByPos[pos]} onDelete={onDelete} showLabel={isToday} />
        ))}
      </div>
    </div>
  );
}

// ─── Template slot (droppable) ────────────────────────────────────────────────
function TemplateSlot({ dayIndex, position, recipe, onRemove }) {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: `tpl-${dayIndex}-${position}`, data: { type: 'tpl-slot', dayIndex, position },
  });
  return (
    <div ref={setNodeRef} style={{
      height:22, borderBottom: position<5 ? '1px solid #f0f0f0' : 'none',
      background: isOver && !recipe ? 'rgba(102,126,234,0.12)' : 'transparent',
      display:'flex', alignItems:'center', padding:'1px 3px', transition:'background 0.1s',
    }}>
      {recipe ? (
        <div style={{background:getColor(position),color:'white',borderRadius:3,padding:'1px 4px',fontSize:10,display:'flex',alignItems:'center',gap:2,width:'100%',minWidth:0}}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{recipe.name}</span>
          <button onClick={()=>onRemove(dayIndex,position)}
            style={{background:'rgba(0,0,0,0.25)',border:'none',color:'white',borderRadius:2,cursor:'pointer',padding:'0 2px',fontSize:8,lineHeight:'13px',flexShrink:0}}>✕</button>
        </div>
      ) : (
        <span style={{fontSize:8,color:'#d0cde8',width:'100%',textAlign:'center',display:'block',userSelect:'none'}}>{t('slot_labels')[position-1]}</span>
      )}
    </div>
  );
}

// ─── Template editor/viewer ───────────────────────────────────────────────────
function TemplateSection({ templates, tplSlots: editSlots, setTplSlots: setEditSlots, onSave, onApply, onDelete }) {
  const { t } = useLanguage();
  const [editName, setEditName]   = useState('');
  const [applyWeek, setApplyWeek] = useState({});
  const [open, setOpen]           = useState(false);
  const mondays = getUpcomingMondays(16);

  const handleRemove = (dayIndex, position) => {
    const k = `${dayIndex}-${position}`;
    setEditSlots(prev => { const n = {...prev}; delete n[k]; return n; });
  };

  const filledCount = Object.keys(editSlots).length;
  const dayShort = t('day_short');
  const dayFull  = t('day_full');

  return (
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',padding:'12px 18px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:600,color:'#667eea'}}>
        <span>{t('tpl_title')}</span>
        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#667eea',fontWeight:400}}>
          {open ? t('collapse') : t('expand')}
          <span style={{fontSize:16,transition:'transform 0.2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
        </span>
      </button>
      {open && (
      <div style={{padding:'0 16px 16px',borderTop:'1px solid #f0f0f0'}}>

      <div style={{marginBottom:20,marginTop:14}}>
        <div style={{fontSize:12,color:'#888',marginBottom:8}}>{t('tpl_drag_hint')}</div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:10}}>
          {dayFull.map((name, di) => (
            <div key={di} style={{border:'1px solid #e0e4ff',borderRadius:6,overflow:'hidden'}}>
              <div style={{background:'#f0f2ff',padding:'3px 6px',fontSize:10,fontWeight:600,color:'#667eea',textAlign:'center',borderBottom:'1px solid #e0e4ff'}}>
                {dayShort[di]}
              </div>
              {[1,2,3,4,5].map(pos => (
                <TemplateSlot key={pos} dayIndex={di} position={pos}
                  recipe={editSlots[`${di}-${pos}`] || null}
                  onRemove={handleRemove} />
              ))}
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input value={editName} onChange={e=>setEditName(e.target.value)}
            placeholder={t('tpl_name_ph')}
            style={{flex:1,padding:'7px 10px',border:'1px solid #ddd',borderRadius:6,fontSize:13}} />
          <button className="btn btn-primary" style={{padding:'7px 16px',fontSize:13}}
            disabled={!editName.trim() || !filledCount}
            onClick={()=>{
              if (!editName.trim() || !filledCount) return;
              const meals = Object.entries(editSlots).map(([k,r])=>{
                const [di,pos] = k.split('-').map(Number);
                return {dayOffset:di, position:pos, recipe_id:r.id, recipe_name:r.name};
              });
              onSave(editName.trim(), meals);
              setEditSlots({}); setEditName('');
            }}>
            {t('save_tpl')}
          </button>
          {filledCount > 0 && (
            <button className="btn" style={{padding:'7px 12px',fontSize:13,background:'#eee',color:'#555'}}
              onClick={()=>setEditSlots({})}>
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      <div style={{fontWeight:700,fontSize:13,color:'#444',marginBottom:10,paddingTop:4,borderTop:'1px solid #f0f0f0'}}>{t('your_tpls')}</div>
      {templates.length === 0 ? (
        <p style={{color:'#bbb',fontSize:13,textAlign:'center',margin:0}}>{t('no_tpls')}</p>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {templates.map((tpl, ti) => {
            const byDay = {};
            tpl.meals.forEach(m => {
              if (!byDay[m.dayOffset]) byDay[m.dayOffset] = {};
              byDay[m.dayOffset][m.position] = m;
            });
            return (
              <div key={ti} style={{border:'1px solid #e8e8e8',borderRadius:8,overflow:'hidden'}}>
                <div style={{background:'#f8f9ff',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #e8e8e8'}}>
                  <div>
                    <strong style={{fontSize:13}}>{tpl.name}</strong>
                    <span style={{fontSize:11,color:'#aaa',marginLeft:8}}>{t('meals_count')(tpl.meals.length)}</span>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:12,color:'#666'}}>{t('apply_from_mon')}</span>
                    <select value={applyWeek[ti] || mondays[0]}
                      onChange={e=>setApplyWeek({...applyWeek,[ti]:e.target.value})}
                      style={{padding:'4px 8px',border:'1px solid #ddd',borderRadius:6,fontSize:12}}>
                      {mondays.map(m=>(
                        <option key={m} value={m}>{toEU(m)}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" style={{padding:'5px 12px',fontSize:12}}
                      onClick={()=>onApply(tpl, applyWeek[ti] || mondays[0])}>
                      {t('apply')}
                    </button>
                    <button onClick={()=>onDelete(ti)}
                      style={{background:'none',border:'none',color:'#ff4757',cursor:'pointer',fontSize:14}}>✕</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,padding:8}}>
                  {[0,1,2,3,4,5,6].map(di => (
                    <div key={di} style={{border:'1px solid #f0f0f0',borderRadius:4,overflow:'hidden'}}>
                      <div style={{background:'#f8f9ff',padding:'2px 4px',fontSize:9,fontWeight:600,color:'#667eea',textAlign:'center',borderBottom:'1px solid #f0f0f0'}}>
                        {dayShort[di]}
                      </div>
                      {[1,2,3,4,5].map(pos => {
                        const meal = byDay[di]?.[pos];
                        return (
                          <div key={pos} style={{height:16,borderBottom:pos<5?'1px solid #f8f8f8':'none',display:'flex',alignItems:'center',padding:'0 3px'}}>
                            {meal && <div style={{background:getColor(pos),color:'white',borderRadius:2,padding:'0 3px',fontSize:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%'}}>{meal.recipe_name}</div>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}
    </div>
  );
}

// ─── Drag overlay ─────────────────────────────────────────────────────────────
function OverlayContent({ dragData }) {
  const { t } = useLanguage();
  if (!dragData) return null;
  const isDay = dragData.type === 'day';
  const label = isDay
    ? `${dragData.dateStr} (${dragData.meals?.length||0} ${t('meals_count')(dragData.meals?.length||0).replace(/^\d+ /,'')})`
    : dragData.type==='recipe' ? dragData.recipe.name : dragData.meal.recipe.name;
  const bg = isDay ? 'linear-gradient(135deg,#43e97b,#38f9d7)'
    : dragData.type==='recipe' ? 'linear-gradient(135deg,#667eea,#764ba2)'
    : getColor(dragData.meal.position);
  return (
    <div style={{background:bg,color:'white',padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,0.25)',whiteSpace:'nowrap',pointerEvents:'none'}}>
      {label}
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
export default function Calendar() {
  const { t } = useLanguage();
  const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
  const todayStr = dateToStr(todayMidnight);

  const [year,setYear]   = useState(todayMidnight.getFullYear());
  const [month,setMonth] = useState(todayMidnight.getMonth());
  const [recipes,setRecipes]         = useState([]);
  const [mealsByDate,setMealsByDate] = useState({});
  const [activeDrag,setActiveDrag]   = useState(null);
  const [error,setError]             = useState('');
  const [copiedDay,setCopiedDay]     = useState(null);
  const [copiedWeek,setCopiedWeek]   = useState(null);
  const [toast,setToast]             = useState(null);
  const [howToOpen,setHowToOpen]     = useState(false);
  const [tplSlots,setTplSlots]       = useState({});

  const [templates,setTemplates] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('weekTemplates')||'[]'); } catch { return []; }
  });

  const showToast = (msg, color='#0066cc')=>{
    setToast({msg,color});
    setTimeout(()=>setToast(null), 3000);
  };

  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}));
  const days = getMonthGrid(year, month);

  useEffect(()=>{
    recipesApi.getAll().then(r=>setRecipes(r.data)).catch(()=>setError(t('err_load_recipes')));
  },[]);

  const loadMonth = useCallback(async(y,m)=>{
    const grid = getMonthGrid(y,m);
    const start = dateToStr(grid[0]);
    const end   = dateToStr(grid[grid.length-1]);
    try { setMealsByDate((await api.getRange(start,end)).data); }
    catch { setError(t('err_load_plan')); }
  },[]);

  useEffect(()=>{ loadMonth(year,month); },[year,month,loadMonth]);

  const prevMonth = ()=> month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1);
  const nextMonth = ()=> month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1);

  const handleDelete = async(mealId)=>{
    try { await api.deleteMeal(mealId); await loadMonth(year,month); }
    catch { setError(t('err_del_meal')); }
  };

  const handleDeleteAll = async(dateStr)=>{
    const meals = mealsByDate[dateStr]||[];
    if (!meals.length) return;
    if (!window.confirm(t('confirm_del_day')(meals.length, dateStr))) return;
    try {
      await Promise.all(meals.map(m=>api.deleteMeal(m.id)));
      await loadMonth(year,month);
    } catch { setError(t('err_del_meals')); }
  };

  const handleCopyDay  = (ds)=>{ setCopiedDay(ds); setError(''); showToast(t('toast_copy_day')(toEU(ds))); };
  const handlePasteDay = async(target)=>{
    if (!copiedDay) return;
    try { await api.copyRange({source_start:copiedDay,source_end:copiedDay,target_start:target}); await loadMonth(year,month); }
    catch(e){ setError(e.response?.data?.error||t('err_paste_day')); }
  };

  const handleDeleteWeek = async(mondayStr)=>{
    const allMeals = [];
    for (let i=0; i<7; i++) {
      const ds = addDays(mondayStr, i);
      (mealsByDate[ds]||[]).forEach(m=>allMeals.push(m));
    }
    if (!allMeals.length) return;
    if (!window.confirm(t('confirm_del_week')(allMeals.length))) return;
    try {
      await Promise.all(allMeals.map(m=>api.deleteMeal(m.id)));
      await loadMonth(year, month);
    } catch { setError(t('err_del_week')); }
  };

  const handleCopyWeek = (mon)=>{
    setCopiedWeek(mon);
    setError('');
    const newSlots = {};
    for (let i=0; i<7; i++) {
      const ds = addDays(mon, i);
      (mealsByDate[ds]||[]).forEach(m=>{
        newSlots[`${i}-${m.position}`] = {id:m.recipe.id, name:m.recipe.name};
      });
    }
    setTplSlots(newSlots);
    showToast(t('toast_copy_week'));
  };
  const handlePasteWeek = async(mon)=>{
    if (!copiedWeek) return;
    try { await api.copyRange({source_start:copiedWeek,source_end:addDays(copiedWeek,6),target_start:mon}); await loadMonth(year,month); }
    catch(e){ setError(e.response?.data?.error||t('err_paste_week')); }
  };

  const saveTemplate = (name, meals)=>{
    const updated = [...templates,{name,meals}];
    setTemplates(updated);
    localStorage.setItem('weekTemplates',JSON.stringify(updated));
  };
  const deleteTemplate = (i)=>{
    const updated = templates.filter((_,idx)=>idx!==i);
    setTemplates(updated);
    localStorage.setItem('weekTemplates',JSON.stringify(updated));
  };
  const applyTemplate = async(template, targetMon)=>{
    for (const entry of template.meals) {
      const date = addDays(targetMon, entry.dayOffset);
      const existing = (mealsByDate[date]||[]).find(m=>m.position===entry.position);
      if (!existing) {
        try { await api.addMeal({date, position:entry.position, recipe_id:entry.recipe_id}); }
        catch {}
      }
    }
    await loadMonth(year,month);
  };

  const handleDragStart = ({active})=>setActiveDrag(active.data.current);
  const handleDragCancel = ()=>setActiveDrag(null);

  const handleDragEnd = async({active,over})=>{
    setActiveDrag(null);
    if (!over) return;
    const drag = active.data.current;
    const drop = over.data.current;
    if (!drop) return;

    if (drop.type==='tpl-slot') {
      if (drag.type!=='recipe') return;
      const k = `${drop.dayIndex}-${drop.position}`;
      setTplSlots(prev=>({...prev,[k]:{id:drag.recipe.id,name:drag.recipe.name}}));
      return;
    }

    if (drag.type==='day') {
      if (drop.type!=='day-target') return;
      if (drag.dateStr===drop.dateStr) return;
      try { await api.copyRange({source_start:drag.dateStr,source_end:drag.dateStr,target_start:drop.dateStr}); await loadMonth(year,month); }
      catch(e){ setError(e.response?.data?.error||t('err_copy_day')); }
      return;
    }

    if (drop.type==='day-target') return;

    const {date:targetDate, position:targetPos} = drop;
    const slotOccupied = (mealsByDate[targetDate]||[]).some(m=>m.position===targetPos);

    if (drag.type==='recipe') {
      if (slotOccupied) return;
      try { await api.addMeal({date:targetDate,position:targetPos,recipe_id:drag.recipe.id}); await loadMonth(year,month); }
      catch { setError(t('err_add_meal')); }
    } else if (drag.type==='meal') {
      const {meal} = drag;
      const srcDate = Object.keys(mealsByDate).find(d=>(mealsByDate[d]||[]).some(m=>m.id===meal.id));
      if (srcDate===targetDate && meal.position===targetPos) return;
      if (slotOccupied) return;
      try {
        await api.deleteMeal(meal.id);
        await api.addMeal({date:targetDate,position:targetPos,recipe_id:meal.recipe.id});
        await loadMonth(year,month);
      } catch { setError(t('err_move_meal')); }
    }
  };

  const weeks = [];
  for (let i=0; i<days.length; i+=7) weeks.push(days.slice(i,i+7));

  const monthNames = t('month_names');
  const dayShort   = t('day_short');

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      {error && <div style={{background:'#ffe0e0',color:'#c00',padding:12,borderRadius:8,marginBottom:16}}>{error}</div>}

      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
          background:toast.color,color:'white',padding:'16px 28px',borderRadius:12,
          fontSize:15,fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
          zIndex:9999,pointerEvents:'none',whiteSpace:'nowrap',textAlign:'center'}}>
          {toast.msg}
          {copiedDay && <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:0.85}}>{t('paste_day_hint')}</div>}
          {copiedWeek && !copiedDay && <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:0.85}}>{t('paste_week_hint')}</div>}
        </div>
      )}

      {(copiedDay||copiedWeek) && !toast && (
        <div style={{background:'#f0f9ff',border:'1px solid #bde0ff',borderRadius:8,padding:'6px 12px',marginBottom:10,fontSize:11,color:'#0066cc',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>
            {copiedDay && t('clipboard_day')(copiedDay)}
            {copiedWeek && t('clipboard_week')(toEU(copiedWeek))}
          </span>
          <button onClick={()=>{setCopiedDay(null);setCopiedWeek(null);}} style={{background:'none',border:'none',color:'#0066cc',cursor:'pointer',fontSize:12}}>{t('clear_clipboard')}</button>
        </div>
      )}

      {/* How to use — collapsible */}
      <div className="card" style={{padding:0,marginBottom:16,overflow:'hidden'}}>
        <button onClick={()=>setHowToOpen(o=>!o)}
          style={{width:'100%',padding:'12px 18px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:600,color:'#667eea'}}>
          <span>{t('how_to_title')}</span>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#667eea',fontWeight:400}}>
            {howToOpen ? t('collapse') : t('expand')}
            <span style={{fontSize:16,transition:'transform 0.2s',transform:howToOpen?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
          </span>
        </button>
        {howToOpen && (
          <div style={{padding:'0 18px 16px',fontSize:12,lineHeight:1.8,borderTop:'1px solid #f0f0f0'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginTop:14}}>
              <div>
                <div style={{fontWeight:700,color:'#667eea',marginBottom:6}}>{t('ht_meals_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#555'}}>
                  <li>{t('ht_meals_1')}</li>
                  <li>{t('ht_meals_2')}</li>
                  <li>{t('ht_meals_3')}</li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#667eea',marginBottom:6}}>{t('ht_copy_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#555'}}>
                  <li>{t('ht_copy_1')}</li>
                  <li>{t('ht_copy_2')}</li>
                  <li>{t('ht_copy_3')}</li>
                  <li>{t('ht_copy_4')}</li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#667eea',marginBottom:6}}>{t('ht_tpl_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#555'}}>
                  <li>{t('ht_tpl_1')}</li>
                  <li>{t('ht_tpl_2')}</li>
                  <li>{t('ht_tpl_3')}</li>
                  <li>{t('ht_tpl_4')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="card" style={{padding:16,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <button className="btn btn-primary" onClick={prevMonth} style={{padding:'5px 14px'}}>‹</button>
          <h2 style={{margin:0,fontSize:17}}>{monthNames[month]} {year}</h2>
          <button className="btn btn-primary" onClick={nextMonth} style={{padding:'5px 14px'}}>›</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'44px repeat(7,1fr)',gap:3,marginBottom:3}}>
          <div/>
          {dayShort.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:11,fontWeight:600,color:'#667eea',padding:'3px 0'}}>{d}</div>
          ))}
        </div>

        {weeks.map((weekDays,wi)=>{
          const mondayStr = dateToStr(weekDays[0]);
          const isCopied  = copiedWeek===mondayStr;
          const btnBase   = {borderRadius:5,cursor:'pointer',lineHeight:1.3,padding:'5px 0',width:38,fontSize:16,display:'block',textAlign:'center'};
          return (
            <div key={wi} style={{display:'grid',gridTemplateColumns:'44px repeat(7,1fr)',gap:3,marginBottom:3}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3}}>
                <button onClick={()=>handleCopyWeek(mondayStr)} title={t('copy_week_title')}
                  style={{...btnBase,background:isCopied?'#667eea':'#f0f2ff',border:'1px solid #c0caff',color:isCopied?'white':'#667eea'}}>⧉</button>
                {copiedWeek && copiedWeek!==mondayStr && (
                  <button onClick={()=>handlePasteWeek(mondayStr)} title={t('paste_week_title')}
                    style={{...btnBase,background:'#e8f4ff',border:'1px solid #90caff',color:'#0066cc'}}>⎘</button>
                )}
                <button onClick={()=>handleDeleteWeek(mondayStr)} title={t('del_week_title')}
                  style={{...btnBase,background:'none',border:'1px solid #ffc0cb',color:'#ff6b81'}}>🗑</button>
              </div>
              {weekDays.map(date=>{
                const ds = dateToStr(date);
                return (
                  <DayCell key={ds} date={date} dateStr={ds}
                    meals={mealsByDate[ds]||[]}
                    isToday={ds===todayStr} isPast={date<todayMidnight}
                    isCurrentMonth={date.getMonth()===month}
                    onDelete={handleDelete} onDeleteAll={handleDeleteAll}
                    onCopy={handleCopyDay} onPaste={handlePasteDay} copiedDay={copiedDay} />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Recipe carousel */}
      <div className="card" style={{padding:'14px 16px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <h2 style={{margin:0,fontSize:15}}>{t('carousel_title')}</h2>
          <span style={{fontSize:11,color:'#aaa'}}>{t('drag_to_cal')}</span>
        </div>
        {recipes.length===0
          ? <p style={{fontSize:13,color:'#bbb',margin:0}}>{t('no_recipes_cal')}</p>
          : <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:6,scrollbarWidth:'thin',scrollbarColor:'#ddd transparent'}}>
              {recipes.map(r=><DraggableRecipe key={r.id} recipe={r}/>)}
            </div>
        }
      </div>

      <TemplateSection
        templates={templates}
        tplSlots={tplSlots}
        setTplSlots={setTplSlots}
        onSave={saveTemplate}
        onApply={applyTemplate}
        onDelete={deleteTemplate}
      />

      <DragOverlay dropAnimation={null}>
        {activeDrag && <OverlayContent dragData={activeDrag}/>}
      </DragOverlay>
    </DndContext>
  );
}
