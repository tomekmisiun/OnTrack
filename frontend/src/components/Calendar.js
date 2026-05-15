import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { Icon } from '@iconify/react';
import { mealPlan as api, recipes as recipesApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useMember } from '../contexts/MemberContext';

const COLORS = ['#4a6fa5', '#93c5fd', '#fcd34d', '#c2410c', '#6366f1'];
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
function DraggableRecipe({ recipe, onToggleFavorite }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`, data: { type: 'recipe', recipe },
  });
  const hasKcal = recipe.total_kcal > 0;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      flexShrink:0, width:128, height:148,
      background:'linear-gradient(135deg, #0d9488, #0f766e)',
      borderRadius:12, cursor:'grab', opacity: isDragging ? 0.3 : 1,
      userSelect:'none', touchAction:'none',
      boxShadow:'0 4px 12px rgba(85,72,160,0.45)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    }}>
      {/* Name + star */}
      <div style={{flex:1, padding:'8px 11px 6px', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4}}>
          <div style={{
            fontWeight:700, fontSize:11.5, lineHeight:1.4, color:'#1f2937',
            display:'-webkit-box', WebkitLineClamp:3,
            WebkitBoxOrient:'vertical', overflow:'hidden', flex:1,
          }}>
            {recipe.name}
          </div>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleFavorite(recipe.id); }}
            style={{
              background:'none', border:'none', cursor:'pointer', padding:0,
              fontSize:14, lineHeight:1, flexShrink:0, marginTop:1,
              color: recipe.is_favorite ? '#facc15' : 'transparent',
              WebkitTextStroke: recipe.is_favorite ? '0' : '1.2px rgba(255,255,255,0.5)',
            }}>★</button>
        </div>
      </div>

      {/* kcal + macros — pinned just above price */}
      <div style={{padding:'0 8px 7px'}}>
        {hasKcal ? (
          <>
            <div style={{display:'flex', alignItems:'baseline', gap:3, padding:'0 3px', marginBottom:5}}>
              <span style={{fontSize:18, fontWeight:800, color:'#1f2937', lineHeight:1}}>
                {recipe.total_kcal}
              </span>
              <span style={{fontSize:9, fontWeight:500, color:'rgba(255,255,255,0.55)'}}>kcal</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3}}>
              {[['B', recipe.total_protein], ['T', recipe.total_fat], ['W', recipe.total_carbs]].map(([lbl, val]) => (
                <div key={lbl} style={{
                  background:'rgba(255,255,255,0.14)', borderRadius:5,
                  padding:'3px 0', textAlign:'center',
                }}>
                  <div style={{fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.55)', letterSpacing:'0.3px'}}>{lbl}</div>
                  <div style={{fontSize:10, fontWeight:700, color:'#1f2937'}}>{Math.round(val)}g</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* placeholder so price stays at the same position */
          <div style={{height:52}} />
        )}
      </div>

      {/* Price footer */}
      <div style={{
        borderTop:'1px solid rgba(255,255,255,0.12)',
        background:'rgba(0,0,0,0.18)',
        padding:'4px 11px',
        fontSize:10.5, fontWeight:600,
        color:'rgba(255,255,255,0.75)',
        textAlign:'right',
        flexShrink:0,
      }}>
        {recipe.total_cost.toFixed(2)} zł
      </div>
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
      background:getColor(meal.position), color:'#1f2937', borderRadius:3,
      padding:'1px 4px', fontSize:11, cursor:'grab', opacity: isDragging ? 0.35 : 1,
      display:'flex', alignItems:'center', gap:2,
      userSelect:'none', touchAction:'none', width:'100%', minWidth:0,
    }}>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{meal.recipe.name}</span>
      <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(meal.id);}}
        style={{background:'rgba(0,0,0,0.25)',border:'none',color:'#1f2937',borderRadius:2,cursor:'pointer',padding:'0 3px',fontSize:9,lineHeight:'14px',flexShrink:0}}>✕</button>
    </div>
  );
}

// ─── Drag handle for template day ─────────────────────────────────────────────
function DraggableTplDayHandle({ dayIndex, slots }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tpl-day-${dayIndex}`, data: { type: 'tpl-day', dayIndex, slots },
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      style={{cursor:'grab',opacity:isDragging?0.4:1,userSelect:'none',touchAction:'none',
        background:'#374151',border:'none',borderRadius:3,padding:'1px 5px',
        fontSize:8,fontWeight:600,color:'#9ca3af',lineHeight:1.4,display:'inline-flex',alignItems:'center'}}>
      Przeciągnij
    </span>
  );
}

function DroppableTplDayHeader({ dayIndex, isOver, children }) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({
    id: `tpl-day-header-${dayIndex}`, data: { type: 'tpl-day-target', dayIndex },
  });
  return (
    <div ref={setNodeRef} style={{background: dndIsOver ? 'rgba(45,212,191,0.12)' : 'transparent', transition:'background 0.1s'}}>
      {children}
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
      style={{cursor:'grab',opacity:isDragging?0.4:1,marginLeft:3,userSelect:'none',touchAction:'none',
        background:'#374151',borderRadius:3,padding:'1px 4px',
        fontSize:7,fontWeight:600,color:'#9ca3af',display:'inline-flex',alignItems:'center',verticalAlign:'middle'}}>
      Przeciągnij
    </span>
  );
}

// ─── Droppable day header ─────────────────────────────────────────────────────
function DroppableDayHeader({ dateStr, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-header-${dateStr}`, data: { type: 'day-target', dateStr },
  });
  return (
    <div ref={setNodeRef} style={{background: isOver ? 'rgba(13,148,136,0.18)' : 'transparent', transition:'background 0.1s'}}>
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
      height:22, borderBottom: position<5 ? '1px solid #2d3748' : 'none',
      background: isOver && !meal ? 'rgba(45,212,191,0.1)' : 'transparent',
      display:'flex', alignItems:'center', padding:'1px 4px', transition:'background 0.1s',
    }}>
      {meal
        ? <DraggableMeal meal={meal} onDelete={onDelete} />
        : showLabel && <span style={{fontSize:9,color:'#9ca3af',userSelect:'none',whiteSpace:'nowrap',overflow:'hidden',width:'100%',textAlign:'center',display:'block'}}>{t('slot_labels')[position-1]}</span>
      }
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────
function macroColor(actual, goal) {
  if (!goal || goal <= 0) return null;
  const pct = Math.abs((actual - goal) / goal * 100);
  return pct <= 10 ? '#22c55e' : pct <= 25 ? '#eab308' : '#ef4444';
}

function DayCell({ date, dateStr, meals, isToday, isPast, isCurrentMonth, onDelete, onDeleteAll, onCopy, onPaste, copiedDay, macroGoals }) {
  const { t } = useLanguage();
  const mealsByPos = {};
  meals.forEach(m => { mealsByPos[m.position] = m; });
  const hasMeals = meals.length > 0;
  const canPaste = copiedDay && copiedDay !== dateStr;

  const totalKcal    = meals.reduce((s, m) => s + (m.recipe.total_kcal    || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.recipe.total_protein || 0), 0);
  const totalFat     = meals.reduce((s, m) => s + (m.recipe.total_fat     || 0), 0);
  const totalCarbs   = meals.reduce((s, m) => s + (m.recipe.total_carbs   || 0), 0);
  const hasAnyMacro  = totalKcal > 0 || totalProtein > 0 || totalFat > 0 || totalCarbs > 0;

  return (
    <div style={{
      border:`1px solid ${isToday ? '#2dd4bf' : '#374151'}`,
      borderRadius:4, overflow:'hidden',
      background: isPast ? '#161d2d' : isToday ? '#162626' : '#1f2937',
      opacity: !isCurrentMonth ? 0.45 : 1,
    }}>
      <DroppableDayHeader dateStr={dateStr}>
        <div style={{
          padding:'3px 5px',
          borderBottom:'1px solid #374151',
          background: isToday ? 'rgba(45,212,191,0.08)' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:2,
        }}>
          {/* Date number + drag handle */}
          <span style={{
            display:'flex', alignItems:'center', gap:3,
            fontSize:11, fontWeight: isToday ? 700 : 400,
            color: isPast ? '#4b5563' : isToday ? '#2dd4bf' : '#94a3b8',
            flexShrink:0,
          }}>
            {date.getDate()}
            {hasMeals && <DraggableDayHandle dateStr={dateStr} meals={meals} />}
          </span>
          {/* Action buttons — colored labeled pills */}
          <span style={{display:'flex', gap:2, flexWrap:'nowrap'}}>
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onCopy(dateStr)}
                title={t('copy_day_title')}
                style={{
                  background: copiedDay===dateStr ? '#0d9488' : '#1e3a3a',
                  color: copiedDay===dateStr ? 'white' : '#2dd4bf',
                  border:'none', borderRadius:3, cursor:'pointer',
                  fontSize:8, fontWeight:700, padding:'2px 5px', lineHeight:1.2,
                }}>
                {copiedDay===dateStr ? 'Skopiowano' : 'Kopiuj'}
              </button>
            )}
            {canPaste && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onPaste(dateStr)}
                title={t('paste_day_title')}
                style={{
                  background:'#0d9488', color:'#1f2937',
                  border:'none', borderRadius:3, cursor:'pointer',
                  fontSize:8, fontWeight:700, padding:'2px 5px', lineHeight:1.2,
                }}>
                Wklej
              </button>
            )}
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onDeleteAll(dateStr)}
                title={t('del_day_title')}
                style={{
                  background:'#2d1515', color:'#f87171',
                  border:'none', borderRadius:3, cursor:'pointer',
                  fontSize:8, fontWeight:700, padding:'2px 5px', lineHeight:1.2,
                }}>
                Usuń
              </button>
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
      {hasMeals && hasAnyMacro && (
        <div style={{
          borderTop:'1px solid #374151', background: isPast ? '#161d2d' : '#162626',
          padding:'2px 4px',
        }}>
          <div style={{fontSize:10,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            <span style={{color: macroGoals ? macroColor(totalKcal, macroGoals.kcal) : '#2dd4bf'}}>{totalKcal}</span>
            {macroGoals && <span style={{color:'#6b7280',fontWeight:400}}>/{macroGoals.kcal}</span>}
            <span style={{color:'#6b7280',fontWeight:400}}> kcal</span>
          </div>
          <div style={{fontSize:9,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {[['B',Math.round(totalProtein),macroGoals?.protein],['T',Math.round(totalFat),macroGoals?.fat],['W',Math.round(totalCarbs),macroGoals?.carbs]].map(([lbl,val,tgt],i)=>(
              <span key={lbl} style={{marginLeft:i>0?3:0}}>
                <span style={{color:'#6b7280'}}>{lbl}:</span>
                <span style={{color: tgt ? macroColor(val,tgt) : '#9ca3af'}}>{val}</span>
                {tgt && <span style={{color:'#6b7280'}}>/{tgt}</span>}
                <span style={{color:'#6b7280'}}>g</span>
              </span>
            ))}
          </div>
        </div>
      )}
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
      height:22, borderBottom: position<5 ? '1px solid #2d3748' : 'none',
      background: isOver && !recipe ? 'rgba(45,212,191,0.1)' : 'transparent',
      display:'flex', alignItems:'center', padding:'1px 3px', transition:'background 0.1s',
    }}>
      {recipe ? (
        <div style={{background:getColor(position),color:'#1f2937',borderRadius:3,padding:'1px 4px',fontSize:10,display:'flex',alignItems:'center',gap:2,width:'100%',minWidth:0}}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{recipe.name}</span>
          <button onClick={()=>onRemove(dayIndex,position)}
            style={{background:'rgba(0,0,0,0.25)',border:'none',color:'#1f2937',borderRadius:2,cursor:'pointer',padding:'0 2px',fontSize:8,lineHeight:'13px',flexShrink:0}}>✕</button>
        </div>
      ) : (
        <span style={{fontSize:8,color:'#9ca3af',width:'100%',textAlign:'center',display:'block',userSelect:'none'}}>{t('slot_labels')[position-1]}</span>
      )}
    </div>
  );
}

// ─── Template editor/viewer ───────────────────────────────────────────────────
function TemplateSection({ templates, tplSlots: editSlots, setTplSlots: setEditSlots, onSave, onApply, onDelete, open, setOpen }) {
  const { t } = useLanguage();
  const [editName, setEditName]     = useState('');
  const [applyWeek, setApplyWeek]   = useState({});
  const [copiedTplDay, setCopiedTplDay] = useState(null);
  const mondays = getUpcomingMondays(16);

  const handleRemove = (dayIndex, position) => {
    const k = `${dayIndex}-${position}`;
    setEditSlots(prev => { const n = {...prev}; delete n[k]; return n; });
  };

  const handleClearDay = (di) => {
    setEditSlots(prev => {
      const n = {...prev};
      [1,2,3,4,5].forEach(pos => delete n[`${di}-${pos}`]);
      return n;
    });
  };

  const handleCopyTplDay = (di) => setCopiedTplDay(di);

  const handlePasteTplDay = (di) => {
    if (copiedTplDay === null) return;
    setEditSlots(prev => {
      const n = {...prev};
      [1,2,3,4,5].forEach(pos => {
        const src = prev[`${copiedTplDay}-${pos}`];
        if (src) n[`${di}-${pos}`] = src;
        else delete n[`${di}-${pos}`];
      });
      return n;
    });
  };

  const filledCount = Object.keys(editSlots).length;
  const dayShort = t('day_short');
  const dayFull  = t('day_full');

  return (
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',padding:'12px 18px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:600,color:'#0d9488'}}>
        <span>{t('tpl_title')}</span>
        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#0d9488',fontWeight:400}}>
          {open ? t('collapse') : t('expand')}
          <span style={{fontSize:16,transition:'transform 0.2s',transform:open?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
        </span>
      </button>
      {open && (
      <div style={{padding:'0 16px 16px',borderTop:'1px solid #374151'}}>

      <div id="tpl-editor" style={{marginBottom:20,marginTop:14}}>
        <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>{t('tpl_drag_hint')}</div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:10}}>
          {dayFull.map((name, di) => {
            const dayHasContent = [1,2,3,4,5].some(pos => editSlots[`${di}-${pos}`]);
            const isCopied = copiedTplDay === di;
            const btnStyle = {background:'none',border:'none',cursor:'pointer',padding:'0 2px',lineHeight:1,fontSize:11};
            return (
              <div key={di} style={{border:'1px solid #374151',borderRadius:6,overflow:'hidden'}}>
                <DroppableTplDayHeader dayIndex={di}>
                <div style={{background:'#1c3534',borderBottom:'1px solid #374151',padding:'3px 4px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:2}}>
                  <span style={{fontSize:10,fontWeight:600,color:'#2dd4bf',flexShrink:0}}>{dayShort[di]}</span>
                  {dayHasContent && <DraggableTplDayHandle dayIndex={di} slots={editSlots} />}
                  {dayHasContent && (
                    <button onClick={()=>handleClearDay(di)}
                      style={{background:'#2d1515',color:'#f87171',border:'none',borderRadius:3,cursor:'pointer',fontSize:8,fontWeight:700,padding:'1px 4px',lineHeight:1.4,flexShrink:0}}>
                      Usuń
                    </button>
                  )}
                </div>
                </DroppableTplDayHeader>
                {[1,2,3,4,5].map(pos => (
                  <TemplateSlot key={pos} dayIndex={di} position={pos}
                    recipe={editSlots[`${di}-${pos}`] || null}
                    onRemove={handleRemove} />
                ))}
              </div>
            );
          })}
        </div>

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{flex:1}}>
            <input value={editName} onChange={e=>setEditName(e.target.value.slice(0,50))}
              maxLength={50}
              placeholder={t('tpl_name_ph')}
              style={{width:'100%',boxSizing:'border-box',padding:'7px 10px',border:'1px solid #374151',borderRadius:6,fontSize:13}} />
            <div style={{fontSize:10,color:editName.length>45?'#f87171':'#6b7280',textAlign:'right',marginTop:2}}>
              {editName.length} / 50
            </div>
          </div>
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
            <button className="btn" style={{padding:'7px 12px',fontSize:13,background:'#374151',color:'#9ca3af'}}
              onClick={()=>setEditSlots({})}>
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      <div style={{fontWeight:700,fontSize:13,color:'#d1d5db',marginBottom:10,paddingTop:4,borderTop:'1px solid #374151'}}>{t('your_tpls')}</div>
      {templates.length === 0 ? (
        <p style={{color:'#4b5563',fontSize:13,textAlign:'center',margin:0}}>{t('no_tpls')}</p>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {templates.map((tpl, ti) => {
            const byDay = {};
            tpl.meals.forEach(m => {
              if (!byDay[m.dayOffset]) byDay[m.dayOffset] = {};
              byDay[m.dayOffset][m.position] = m;
            });
            return (
              <div key={ti} style={{border:'1px solid #374151',borderRadius:8,overflow:'hidden'}}>
                <div style={{background:'#1c3534',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #374151'}}>
                  <div>
                    <strong style={{fontSize:13}}>{tpl.name}</strong>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:12,color:'#9ca3af'}}>{t('apply_from_mon')}</span>
                    <select value={applyWeek[ti] || mondays[0]}
                      onChange={e=>setApplyWeek({...applyWeek,[ti]:e.target.value})}
                      style={{padding:'4px 8px',border:'1px solid #374151',borderRadius:6,fontSize:12}}>
                      {mondays.map(m=>(
                        <option key={m} value={m}>{toEU(m)}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary" style={{padding:'5px 12px',fontSize:12}}
                      onClick={()=>onApply(tpl, applyWeek[ti] || mondays[0])}>
                      {t('apply')}
                    </button>
                    <button className="btn btn-primary" style={{padding:'5px 12px',fontSize:12,background:'#1c3534',color:'#0d9488',border:'1px solid #374151'}}
                      onClick={()=>{
                        const slots = {};
                        tpl.meals.forEach(m => { slots[`${m.dayOffset}-${m.position}`] = {id:m.recipe_id,name:m.recipe_name}; });
                        setEditSlots(slots);
                        setEditName(tpl.name);
                        onDelete(ti);
                        document.getElementById('tpl-editor')?.scrollIntoView({behavior:'smooth'});
                      }}>
                      Edytuj
                    </button>
                    <button className="btn btn-danger" style={{padding:'5px 12px',fontSize:12}}
                      onClick={()=>onDelete(ti)}>Usuń</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,padding:8}}>
                  {[0,1,2,3,4,5,6].map(di => (
                    <div key={di} style={{border:'1px solid #374151',borderRadius:6,overflow:'hidden'}}>
                      <div style={{background:'#1c3534',padding:'3px 4px',fontSize:10,fontWeight:600,color:'#2dd4bf',textAlign:'center',borderBottom:'1px solid #374151'}}>
                        {dayShort[di]}
                      </div>
                      {[1,2,3,4,5].map(pos => {
                        const meal = byDay[di]?.[pos];
                        return (
                          <div key={pos} style={{height:22,borderBottom:pos<5?'1px solid #2d3748':'none',display:'flex',alignItems:'center',padding:'1px 3px'}}>
                            {meal
                              ? <div style={{background:getColor(pos),color:'#1f2937',borderRadius:3,padding:'1px 4px',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%'}}>{meal.recipe_name}</div>
                              : <span style={{fontSize:8,color:'#4b5563',width:'100%',textAlign:'center',display:'block',userSelect:'none'}}>{t('slot_labels')[pos-1]}</span>
                            }
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
  const isDay    = dragData.type === 'day';
  const isTplDay = dragData.type === 'tpl-day';
  const label = isDay
    ? `${dragData.dateStr} (${dragData.meals?.length||0} ${t('meals_count')(dragData.meals?.length||0).replace(/^\d+ /,'')})`
    : isTplDay ? 'Przeciągnij dzień szablonu'
    : dragData.type==='recipe' ? dragData.recipe.name : dragData.meal.recipe.name;
  const bg = isDay || isTplDay ? 'linear-gradient(135deg,#0d9488,#0f766e)'
    : dragData.type==='recipe' ? 'linear-gradient(135deg,#0d9488,#0f766e)'
    : getColor(dragData.meal.position);
  return (
    <div style={{background:bg,color:'#1f2937',padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,0.25)',whiteSpace:'nowrap',pointerEvents:'none'}}>
      {label}
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
function snapCenterToCursor({ activatorEvent, draggingNodeRect, transform }) {
  if (!activatorEvent || !draggingNodeRect) return transform;
  return {
    ...transform,
    x: transform.x + activatorEvent.clientX - (draggingNodeRect.left + draggingNodeRect.width  / 2),
    y: transform.y + activatorEvent.clientY - (draggingNodeRect.top  + draggingNodeRect.height / 2),
  };
}

function Btn({ children, danger, paste }) {
  const bg = danger ? '#2d1515' : paste ? '#1e3358' : '#1e3a3a';
  const color = danger ? '#f87171' : paste ? '#93c5fd' : '#2dd4bf';
  const border = danger ? '1px solid #4b1515' : 'none';
  return (
    <span style={{display:'inline-flex',alignItems:'center',background:bg,color,border,borderRadius:3,
      padding:'1px 5px',fontSize:9,fontWeight:700,verticalAlign:'middle',margin:'0 2px',userSelect:'none'}}>
      {children}
    </span>
  );
}

export default function Calendar({ onGoToTab }) {
  const { t } = useLanguage();
  const { showError, showSuccess, showConfirm } = useToast();
  const { activeMember } = useMember();
  const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
  const todayStr = dateToStr(todayMidnight);

  const [year,setYear]   = useState(todayMidnight.getFullYear());
  const [month,setMonth] = useState(todayMidnight.getMonth());
  const [recipes,setRecipes]         = useState([]);
  const [mealsByDate,setMealsByDate] = useState({});
  const [activeDrag,setActiveDrag]   = useState(null);
  const [copiedDay,setCopiedDay]     = useState(null);
  const [copiedWeek,setCopiedWeek]   = useState(null);
  const [toast,setToast]             = useState(null);
  const [howToOpen,setHowToOpen]     = useState(false);
  const [tplSlots,setTplSlots]       = useState({});
  const [tplOpen,setTplOpen]         = useState(false);
  const containerRef                 = useRef(null);

  useEffect(() => {
    if (Object.keys(tplSlots).length === 0) setCopiedWeek(null);
  }, [tplSlots]);

  // Click outside calendar → cancel copy mode
  useEffect(() => {
    if (!copiedDay && !copiedWeek) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setCopiedDay(null);
        setCopiedWeek(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [copiedDay, copiedWeek]);

  const [templates,setTemplates] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('weekTemplates')||'[]'); } catch { return []; }
  });

  const macroGoals = activeMember?.macro_goals || null;

  const showToast = (msg, color='#0066cc')=>{
    setToast({msg,color});
    setTimeout(()=>setToast(null), 3000);
  };

  const sensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}));
  const days = getMonthGrid(year, month);

  useEffect(()=>{
    recipesApi.getAll().then(r=>setRecipes(r.data)).catch(()=>showError(t('err_load_recipes')));
  },[]);

  const loadMonth = useCallback(async(y,m)=>{
    const grid = getMonthGrid(y,m);
    const start = dateToStr(grid[0]);
    const end   = dateToStr(grid[grid.length-1]);
    const mid = activeMember?.id;
    try { setMealsByDate((await api.getRange(start,end,mid?[mid]:[])).data); }
    catch { showError(t('err_load_plan')); }
  },[activeMember?.id]);

  useEffect(()=>{ loadMonth(year,month); },[year,month,loadMonth]);

  const prevMonth = ()=> month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1);
  const nextMonth = ()=> month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1);

  const handleDelete = async(mealId)=>{
    try { await api.deleteMeal(mealId); await loadMonth(year,month); }
    catch { showError(t('err_del_meal')); }
  };

  const handleDeleteAll = (dateStr)=>{
    const meals = mealsByDate[dateStr]||[];
    if (!meals.length) return;
    showConfirm({
      title: 'Usuń cały dzień',
      message: `Usunąć wszystkie posiłki (${meals.length}) z dnia ${toEU(dateStr)}?`,
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try { await Promise.all(meals.map(m=>api.deleteMeal(m.id))); showSuccess('Dzień usunięty'); await loadMonth(year,month); }
        catch { showError(t('err_del_meals')); }
      },
    });
  };

  const handleCopyDay  = (ds)=>{
    if (copiedDay === ds) { setCopiedDay(null); return; }
    setCopiedDay(ds);  showToast(t('toast_copy_day')(toEU(ds)));
  };
  const handlePasteDay = async(target)=>{
    if (!copiedDay) return;
    try { await api.copyRange({source_start:copiedDay,source_end:copiedDay,target_start:target,member_id:activeMember?.id}); await loadMonth(year,month); }
    catch(e){ showError(e.response?.data?.error||t('err_paste_day')); }
  };

  const handleDeleteWeek = (mondayStr)=>{
    const allMeals = [];
    for (let i=0; i<7; i++) {
      const ds = addDays(mondayStr, i);
      (mealsByDate[ds]||[]).forEach(m=>allMeals.push(m));
    }
    if (!allMeals.length) return;
    showConfirm({
      title: 'Usuń cały tydzień',
      message: `Usunąć wszystkie posiłki tego tygodnia (${allMeals.length})?`,
      confirmLabel: 'Usuń',
      onConfirm: async () => {
        try { await Promise.all(allMeals.map(m=>api.deleteMeal(m.id))); showSuccess('Tydzień usunięty'); await loadMonth(year, month); }
        catch { showError(t('err_del_week')); }
      },
    });
  };

  const handleCopyWeek = (mon)=>{
    if (copiedWeek === mon) { setCopiedWeek(null); return; }
    setCopiedWeek(mon);
    
    const newSlots = {};
    for (let i=0; i<7; i++) {
      const ds = addDays(mon, i);
      (mealsByDate[ds]||[]).forEach(m=>{
        newSlots[`${i}-${m.position}`] = {id:m.recipe.id, name:m.recipe.name};
      });
    }
    setTplSlots(newSlots);
    setTplOpen(true);
    showToast(t('toast_copy_week'));
  };
  const handlePasteWeek = async(mon)=>{
    if (!copiedWeek) return;
    try { await api.copyRange({source_start:copiedWeek,source_end:addDays(copiedWeek,6),target_start:mon,member_id:activeMember?.id}); await loadMonth(year,month); }
    catch(e){ showError(e.response?.data?.error||t('err_paste_week')); }
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
    // Delete existing meals in every day covered by the template (overwrite)
    const offsets = [...new Set(template.meals.map(m => m.dayOffset))];
    const deletes = offsets.flatMap(offset => mealsByDate[addDays(targetMon, offset)] || []);
    await Promise.all(deletes.map(m => api.deleteMeal(m.id)));
    // Add template meals
    for (const entry of template.meals) {
      try { await api.addMeal({date:addDays(targetMon,entry.dayOffset), position:entry.position, recipe_id:entry.recipe_id, member_id:activeMember?.id}); }
      catch {}
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

    if (drag.type==='tpl-day') {
      const srcDi = drag.dayIndex;
      const tgtDi = drop.type==='tpl-day-target' ? drop.dayIndex
                  : drop.type==='tpl-slot'        ? drop.dayIndex
                  : null;
      if (tgtDi===null || tgtDi===srcDi) return;
      setTplSlots(prev=>{
        const n={...prev};
        [1,2,3,4,5].forEach(pos=>{
          const src=prev[`${srcDi}-${pos}`];
          if (src) n[`${tgtDi}-${pos}`]=src; else delete n[`${tgtDi}-${pos}`];
        });
        return n;
      });
      return;
    }

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
      catch(e){ showError(e.response?.data?.error||t('err_copy_day')); }
      return;
    }

    if (drop.type==='day-target') return;

    const {date:targetDate, position:targetPos} = drop;
    const slotOccupied = (mealsByDate[targetDate]||[]).some(m=>m.position===targetPos);

    if (drag.type==='recipe') {
      try {
        if (slotOccupied) {
          const existing = (mealsByDate[targetDate]||[]).find(m=>m.position===targetPos);
          if (existing) await api.deleteMeal(existing.id);
        }
        await api.addMeal({date:targetDate,position:targetPos,recipe_id:drag.recipe.id,member_id:activeMember?.id});
        await loadMonth(year,month);
      } catch { showError(t('err_add_meal')); }
    } else if (drag.type==='meal') {
      const {meal} = drag;
      const srcDate = Object.keys(mealsByDate).find(d=>(mealsByDate[d]||[]).some(m=>m.id===meal.id));
      if (srcDate===targetDate && meal.position===targetPos) return;
      try {
        if (slotOccupied) {
          const existing = (mealsByDate[targetDate]||[]).find(m=>m.position===targetPos);
          if (existing && existing.id!==meal.id) await api.deleteMeal(existing.id);
        }
        await api.deleteMeal(meal.id);
        await api.addMeal({date:targetDate,position:targetPos,recipe_id:meal.recipe.id,member_id:activeMember?.id});
        await loadMonth(year,month);
      } catch { showError(t('err_move_meal')); }
    }
  };

  const weeks = [];
  for (let i=0; i<days.length; i+=7) weeks.push(days.slice(i,i+7));

  const monthNames = t('month_names');
  const dayShort   = t('day_short');

  return (
    <div ref={containerRef}>
    <DndContext sensors={sensors} modifiers={[snapCenterToCursor]} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>

      {toast && (
        <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
          background:toast.color,color:'#1f2937',padding:'16px 28px',borderRadius:12,
          fontSize:15,fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
          zIndex:9999,pointerEvents:'none',whiteSpace:'nowrap',textAlign:'center'}}>
          {toast.msg}
          {copiedDay && <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:0.85}}>{t('paste_day_hint')}</div>}
          {copiedWeek && !copiedDay && <div style={{fontSize:12,fontWeight:400,marginTop:4,opacity:0.85}}>{t('paste_week_hint')}</div>}
        </div>
      )}


      {/* How to use — collapsible */}
      <div style={{background:'#1c3534',border:'1px solid #374151',borderRadius:8,marginBottom:16,overflow:'hidden'}}>
        <button onClick={()=>setHowToOpen(o=>!o)}
          style={{width:'100%',padding:'12px 18px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:700,color:'#0d9488'}}>
          <span>{t('how_to_title')}</span>
          <span style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'#0d9488',fontWeight:400}}>
            {howToOpen ? t('collapse') : t('expand')}
            <span style={{fontSize:16,transition:'transform 0.2s',transform:howToOpen?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
          </span>
        </button>
        {howToOpen && (
          <div style={{padding:'0 18px 16px',fontSize:12,lineHeight:1.8,borderTop:'1px solid #374151'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginTop:14}}>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_meals_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li>Chwyć przepis z{' '}
                    <button onClick={()=>document.getElementById('recipe-carousel')?.scrollIntoView({behavior:'smooth'})}
                      style={{background:'none',border:'none',color:'#2dd4bf',cursor:'pointer',padding:0,fontSize:12,textDecoration:'underline'}}>
                      Przepisy
                    </button>
                    {' '}pod kalendarzem i przeciągnij na wybrany slot w dniu
                  </li>
                  <li>Posiłek możesz przenieść między dniami przeciągając go za nazwę</li>
                  <li>Kliknij{' '}
                    <Btn>✕</Btn>{' '}
                    przy posiłku żeby go usunąć, lub{' '}
                    <Btn danger>Usuń</Btn>{' '}
                    w nagłówku dnia żeby wyczyścić cały dzień
                  </li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_copy_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li><Btn>Kopiuj</Btn> w nagłówku dnia kopiuje dzień do schowka</li>
                  <li><Btn paste>Wklej</Btn> w nagłówku dnia wkleja schowek na inny dzień</li>
                  <li>Przeciągaj dzień na inny dzień żeby skopiować go bezpośrednio</li>
                  <li>Kopiuj, wklej lub usuń cały tydzień przyciskami po lewej każdego wiersza</li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_tpl_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li>Kliknij <Btn>Kopiuj</Btn> obok tygodnia — załaduje posiłki do edytora szablonu</li>
                  <li>W edytorze przeciągaj przepisy z Przepisów na dni tygodnia
                    <br/>
                    <button onClick={()=>{document.getElementById('template-section')?.scrollIntoView({behavior:'smooth'});setTplOpen(true);}}
                      style={{background:'none',border:'none',color:'#99f6e4',cursor:'pointer',padding:0,fontSize:11,display:'inline'}}>
                      przejdź do Stwórz szablon →
                    </button>
                  </li>
                  <li>Wpisz nazwę i kliknij <Btn>Zapisz szablon</Btn></li>
                  <li>Szablon możesz zastosować na dowolny przyszły tydzień</li>
                </ul>
              </div>
            </div>
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #374151'}}>
              <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_macro_title')}</div>
              <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                <li>Zapisz cele makro w zakładce{' '}
                  <button onClick={()=>onGoToTab?.('macro')}
                    style={{background:'none',border:'none',color:'#2dd4bf',cursor:'pointer',padding:0,fontSize:12,textDecoration:'underline'}}>
                    Kalkulator Makro
                  </button>
                  {' '}(kcal, białko, tłuszcze, węgle)
                </li>
                <li>Pod każdym dniem z posiłkami pojawi się podsumowanie: aktualna / cel</li>
                <li>
                  {t('ht_macro_3').split('·').map((part, i, arr) => {
                    const colors = ['#22c55e','#eab308','#ef4444'];
                    return (
                      <span key={i}>
                        <span style={{color: colors[i], fontWeight:600}}>{part.trim()}</span>
                        {i < arr.length - 1 && <span style={{color:'#6b7280'}}> · </span>}
                      </span>
                    );
                  })}
                </li>
              </ul>
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

        <div style={{display:'grid',gridTemplateColumns:'72px repeat(7,1fr)',gap:3,marginBottom:3}}>
          <div/>
          {dayShort.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:11,fontWeight:600,color:'#0d9488',padding:'3px 0'}}>{d}</div>
          ))}
        </div>

        {weeks.map((weekDays,wi)=>{
          const mondayStr    = dateToStr(weekDays[0]);
          const isCopied     = copiedWeek===mondayStr;
          const weekHasMeals = weekDays.some(d=>(mealsByDate[dateToStr(d)]||[]).length>0);
          const wBtn = {
            display:'flex', alignItems:'center', justifyContent:'center', gap:4,
            width:'100%', padding:'5px 4px', borderRadius:6, cursor:'pointer',
            fontSize:9, fontWeight:700, lineHeight:1.2, whiteSpace:'nowrap',
          };
          return (
            <div key={wi} style={{display:'grid',gridTemplateColumns:'72px repeat(7,1fr)',gap:3,marginBottom:3}}>
              <div style={{display:'flex',flexDirection:'column',gap:3,padding:'2px 0'}}>
                {weekHasMeals && (
                  <button onClick={()=>handleCopyWeek(mondayStr)} title={t('copy_week_title')}
                    style={{...wBtn, background:isCopied?'#0d9488':'#1e3a3a', color:isCopied?'white':'#2dd4bf', border:'1px solid #374151'}}>
                    {isCopied ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                )}
                {copiedWeek && copiedWeek!==mondayStr && (
                  <button onClick={()=>handlePasteWeek(mondayStr)} title={t('paste_week_title')}
                    style={{...wBtn, background:'#1e3358', color:'#93c5fd', border:'1px solid #374151'}}>
                    Wklej
                  </button>
                )}
                {weekHasMeals && (
                  <button onClick={()=>handleDeleteWeek(mondayStr)} title={t('del_week_title')}
                    style={{...wBtn, background:'#2d1515', color:'#f87171', border:'1px solid #4b1515'}}>
                    Usuń
                  </button>
                )}
              </div>
              {weekDays.map(date=>{
                const ds = dateToStr(date);
                return (
                  <DayCell key={ds} date={date} dateStr={ds}
                    meals={mealsByDate[ds]||[]}
                    isToday={ds===todayStr} isPast={date<todayMidnight}
                    isCurrentMonth={date.getMonth()===month}
                    onDelete={handleDelete} onDeleteAll={handleDeleteAll}
                    onCopy={handleCopyDay} onPaste={handlePasteDay} copiedDay={copiedDay}
                    macroGoals={macroGoals} />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Recipe carousel */}
      <div id="recipe-carousel" className="card" style={{padding:'14px 16px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div>
            <h2 style={{margin:0,fontSize:15,color:'#0d9488'}}>{t('carousel_title')}</h2>
            <button onClick={() => onGoToTab?.('recipes')}
              style={{background:'none',border:'none',padding:0,cursor:'pointer',fontSize:11,color:'#99f6e4',display:'block',marginTop:2}}>
              przejdź do Przepisów →
            </button>
          </div>
          <span style={{fontSize:11,color:'#6b7280'}}>{t('drag_to_cal')}</span>
        </div>
        {recipes.length===0
          ? <p style={{fontSize:13,color:'#4b5563',margin:0}}>{t('no_recipes_cal')}</p>
          : <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:6,scrollbarWidth:'thin',scrollbarColor:'#374151 transparent'}}>
              {[...recipes].sort((a,b)=>(b.is_favorite?1:0)-(a.is_favorite?1:0)).map(r=><DraggableRecipe key={r.id} recipe={r} onToggleFavorite={async (id)=>{ await recipesApi.toggleFavorite(id); recipesApi.getAll().then(res=>setRecipes(res.data)); }}/>)}
            </div>
        }
      </div>

      <div id="template-section" />
      <TemplateSection
        templates={templates}
        tplSlots={tplSlots}
        setTplSlots={setTplSlots}
        onSave={saveTemplate}
        onApply={applyTemplate}
        onDelete={deleteTemplate}
        open={tplOpen}
        setOpen={setTplOpen}
      />

      <DragOverlay dropAnimation={null}>
        {activeDrag && <OverlayContent dragData={activeDrag}/>}
      </DragOverlay>
    </DndContext>
    </div>
  );
}
