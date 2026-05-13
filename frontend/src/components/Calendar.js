import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { mealPlan as api, recipes as recipesApi } from '../api';

const COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
const getColor = (pos) => COLORS[(pos - 1) % 5];
const SLOT_LABELS = ['Śniadanie', 'Drugie śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'];
const MONTH_NAMES = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const DAY_NAMES = ['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'];

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return dateToStr(d);
}
function getMondayStr(dateStr) {
  const d = new Date(dateStr);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return dateToStr(d);
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

// ─── Draggable recipe (from carousel) ────────────────────────────────────────
function DraggableRecipe({ recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`, data: { type: 'recipe', recipe },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      flexShrink: 0, width: 110, padding: '10px 10px 8px',
      background: 'linear-gradient(145deg, #667eea, #764ba2)', color: 'white',
      borderRadius: 10, fontSize: 12, cursor: 'grab', opacity: isDragging ? 0.35 : 1,
      userSelect: 'none', touchAction: 'none', boxShadow: '0 2px 8px rgba(102,126,234,0.35)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, marginBottom:2 }}>🍽️</div>
      <div style={{ fontWeight:600, lineHeight:1.2, fontSize:11 }}>{recipe.name}</div>
      <div style={{ fontSize:10, opacity:0.75 }}>{recipe.total_cost.toFixed(2)} zł</div>
    </div>
  );
}

// ─── Draggable meal in slot ───────────────────────────────────────────────────
function DraggableMeal({ meal, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.id}`, data: { type: 'meal', meal },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      background: getColor(meal.position), color: 'white', borderRadius: 3,
      padding: '1px 4px', fontSize: 11, cursor: 'grab', opacity: isDragging ? 0.35 : 1,
      display: 'flex', alignItems: 'center', gap: 2,
      userSelect: 'none', touchAction: 'none', width: '100%', minWidth: 0,
    }}>
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, minWidth:0 }}>
        {meal.recipe.name}
      </span>
      <button onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(meal.id); }}
        style={{ background:'rgba(0,0,0,0.25)', border:'none', color:'white', borderRadius:2, cursor:'pointer', padding:'0 3px', fontSize:9, lineHeight:'14px', flexShrink:0 }}>✕</button>
    </div>
  );
}

// ─── Draggable day header (Opcja B) ──────────────────────────────────────────
function DraggableDayHandle({ dateStr, meals }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `day-${dateStr}`, data: { type: 'day', dateStr, meals },
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      title="Przeciągnij żeby skopiować ten dzień"
      style={{ cursor: 'grab', opacity: isDragging ? 0.4 : 1, fontSize: 10, color: '#bbb', marginLeft: 3, userSelect: 'none', touchAction: 'none' }}>
      ⠿
    </span>
  );
}

// ─── Droppable day header (drop zone for day drag) ───────────────────────────
function DroppableDayHeader({ dateStr, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-header-${dateStr}`, data: { type: 'day-target', dateStr },
  });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? 'rgba(102,126,234,0.18)' : 'transparent', transition: 'background 0.1s' }}>
      {children}
    </div>
  );
}

// ─── Meal slot ────────────────────────────────────────────────────────────────
function MealSlot({ date, position, meal, onDelete, showLabel }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${position}`, data: { date, position },
  });
  return (
    <div ref={setNodeRef} style={{
      height: 22, borderBottom: position < 5 ? '1px solid #f0f0f0' : 'none',
      background: isOver && !meal ? 'rgba(102,126,234,0.12)' : 'transparent',
      display: 'flex', alignItems: 'center', padding: '1px 4px', transition: 'background 0.1s',
    }}>
      {meal
        ? <DraggableMeal meal={meal} onDelete={onDelete} />
        : showLabel && (
          <span style={{ fontSize:9, color:'#c0b8d4', userSelect:'none', whiteSpace:'nowrap', overflow:'hidden', width:'100%', textAlign:'center', display:'block' }}>
            {SLOT_LABELS[position - 1]}
          </span>
        )
      }
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────
function DayCell({ date, dateStr, meals, isToday, isPast, isCurrentMonth, onDelete, onCopy, onPaste, copiedDay }) {
  const mealsByPos = {};
  meals.forEach(m => { mealsByPos[m.position] = m; });
  const hasMeals = meals.length > 0;
  const canPaste = copiedDay && copiedDay !== dateStr;

  return (
    <div style={{
      border: `1px solid ${isToday ? '#667eea' : '#e8e8e8'}`,
      borderRadius: 4, overflow: 'hidden',
      background: isPast ? '#f7f7f7' : isToday ? '#faf9ff' : 'white',
      opacity: !isCurrentMonth ? 0.45 : 1,
    }}>
      <DroppableDayHeader dateStr={dateStr}>
        <div style={{
          padding: '2px 4px', fontSize: 11,
          fontWeight: isToday ? 700 : 400,
          color: isPast ? '#bbb' : isToday ? '#764ba2' : '#555',
          borderBottom: '1px solid #f0f0f0',
          background: isToday ? 'rgba(102,126,234,0.08)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {date.getDate()}
            {hasMeals && <DraggableDayHandle dateStr={dateStr} meals={meals} />}
          </span>
          <span style={{ display: 'flex', gap: 2 }}>
            {hasMeals && (
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onCopy(dateStr)}
                title="Kopiuj ten dzień"
                style={{ background: copiedDay === dateStr ? '#667eea' : 'none', color: copiedDay === dateStr ? 'white' : '#bbb', border: 'none', cursor: 'pointer', fontSize: 9, padding: '0 2px', borderRadius: 2 }}>
                ⧉
              </button>
            )}
            {canPaste && (
              <button onPointerDown={e => e.stopPropagation()} onClick={() => onPaste(dateStr)}
                title="Wklej skopiowany dzień"
                style={{ background: 'none', color: '#667eea', border: 'none', cursor: 'pointer', fontSize: 9, padding: '0 2px', borderRadius: 2 }}>
                ⎘
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
    </div>
  );
}

// ─── Drag overlay ─────────────────────────────────────────────────────────────
function OverlayContent({ dragData }) {
  if (!dragData) return null;
  const isDay = dragData.type === 'day';
  const label = isDay
    ? `Dzień ${dragData.dateStr} (${dragData.meals?.length || 0} posiłków)`
    : dragData.type === 'recipe' ? dragData.recipe.name : dragData.meal.recipe.name;
  const bg = isDay ? 'linear-gradient(135deg, #43e97b, #38f9d7)'
    : dragData.type === 'recipe' ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : getColor(dragData.meal.position);
  return (
    <div style={{ background: bg, color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
      {label}
    </div>
  );
}

// ─── Template modal ───────────────────────────────────────────────────────────
function TemplateModal({ templates, onSave, onApply, onDelete, onClose, currentWeekStart, mealsByDate }) {
  const [newName, setNewName] = useState('');
  const [applyTarget, setApplyTarget] = useState({});

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#667eea' }}>Szablony tygodnia</h3>

        {/* Zapisz bieżący tydzień */}
        <div style={{ background: '#f8f9ff', border: '1px solid #e0e4ff', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Zapisz bieżący tydzień jako szablon</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Nazwa szablonu (np. Tydzień fit)"
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
            <button className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}
              onClick={() => { if (newName.trim()) { onSave(newName.trim(), currentWeekStart, mealsByDate); setNewName(''); } }}>
              Zapisz
            </button>
          </div>
        </div>

        {/* Lista szablonów */}
        {templates.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center' }}>Brak zapisanych szablonów.</p>
        ) : templates.map((t, i) => (
          <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{t.name}</strong>
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>{t.meals.length} posiłków</span>
              </div>
              <button onClick={() => onDelete(i)}
                style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#666' }}>Zastosuj od:</span>
              <input type="date" value={applyTarget[i] || currentWeekStart}
                onChange={e => setApplyTarget({ ...applyTarget, [i]: e.target.value })}
                style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12 }} />
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}
                onClick={() => onApply(t, applyTarget[i] || currentWeekStart)}>
                Zastosuj
              </button>
            </div>
          </div>
        ))}
        <button className="btn" style={{ width: '100%', marginTop: 8, background: '#eee', color: '#555' }} onClick={onClose}>Zamknij</button>
      </div>
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
export default function Calendar() {
  const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
  const todayStr = dateToStr(todayMidnight);

  const [year, setYear]       = useState(todayMidnight.getFullYear());
  const [month, setMonth]     = useState(todayMidnight.getMonth());
  const [recipes, setRecipes] = useState([]);
  const [mealsByDate, setMealsByDate] = useState({});
  const [activeDrag, setActiveDrag]   = useState(null);
  const [error, setError]     = useState('');
  const [copiedDay, setCopiedDay]     = useState(null);  // Opcja A
  const [copiedWeek, setCopiedWeek]   = useState(null);  // Opcja C
  const [showTemplates, setShowTemplates] = useState(false); // Opcja D
  const [templates, setTemplates]     = useState(() => { // Opcja D
    try { return JSON.parse(localStorage.getItem('weekTemplates') || '[]'); } catch { return []; }
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const days = getMonthGrid(year, month);

  useEffect(() => {
    recipesApi.getAll().then(r => setRecipes(r.data)).catch(() => setError('Błąd ładowania przepisów'));
  }, []);

  const loadMonth = useCallback(async (y, m) => {
    const grid = getMonthGrid(y, m);
    const start = dateToStr(grid[0]);
    const end   = dateToStr(grid[grid.length - 1]);
    try { setMealsByDate((await api.getRange(start, end)).data); }
    catch { setError('Błąd ładowania planu'); }
  }, []);

  useEffect(() => { loadMonth(year, month); }, [year, month, loadMonth]);

  const prevMonth = () => month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1);
  const nextMonth = () => month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1);

  const handleDelete = async (mealId) => {
    try { await api.deleteMeal(mealId); await loadMonth(year, month); }
    catch { setError('Błąd usuwania posiłku'); }
  };

  // ── Opcja A: kopiuj/wklej dzień ──────────────────────────────────────────
  const handleCopyDay = (dateStr) => {
    setCopiedDay(dateStr);
    setError('');
  };

  const handlePasteDay = async (targetDate) => {
    if (!copiedDay) return;
    try {
      await api.copyRange({ source_start: copiedDay, source_end: copiedDay, target_start: targetDate });
      await loadMonth(year, month);
    } catch (e) { setError(e.response?.data?.error || 'Błąd wklejania dnia'); }
  };

  // ── Opcja B: drag day ────────────────────────────────────────────────────
  const handleDragStart = ({ active }) => setActiveDrag(active.data.current);

  const handleDragEnd = async ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;
    const drag = active.data.current;
    const drop = over.data.current;
    if (!drop) return;

    if (drag.type === 'day') {
      // Opcja B: upuść dzień na dzień
      if (drop.type !== 'day-target') return;
      const targetDate = drop.dateStr;
      if (drag.dateStr === targetDate) return;
      try {
        await api.copyRange({ source_start: drag.dateStr, source_end: drag.dateStr, target_start: targetDate });
        await loadMonth(year, month);
      } catch (e) { setError(e.response?.data?.error || 'Błąd kopiowania dnia'); }
      return;
    }

    if (drop.type === 'day-target') return; // nie upuszczaj przepisu na nagłówek dnia

    const { date: targetDate, position: targetPos } = drop;
    const targetMeals = mealsByDate[targetDate] || [];
    const slotOccupied = targetMeals.some(m => m.position === targetPos);

    if (drag.type === 'recipe') {
      if (slotOccupied) return;
      try { await api.addMeal({ date: targetDate, position: targetPos, recipe_id: drag.recipe.id }); await loadMonth(year, month); }
      catch { setError('Błąd dodawania posiłku'); }
    } else if (drag.type === 'meal') {
      const { meal } = drag;
      const sourceDate = Object.keys(mealsByDate).find(d => (mealsByDate[d]||[]).some(m => m.id === meal.id));
      if (sourceDate === targetDate && meal.position === targetPos) return;
      if (slotOccupied) return;
      try {
        await api.deleteMeal(meal.id);
        await api.addMeal({ date: targetDate, position: targetPos, recipe_id: meal.recipe.id });
        await loadMonth(year, month);
      } catch { setError('Błąd przenoszenia posiłku'); }
    }
  };

  const handleDragCancel = () => setActiveDrag(null);

  // ── Opcja C: kopiuj/wklej tydzień ───────────────────────────────────────
  const handleCopyWeek = (mondayStr) => {
    setCopiedWeek(mondayStr);
    setError('');
  };

  const handlePasteWeek = async (targetMondayStr) => {
    if (!copiedWeek) return;
    const sourceEnd = addDays(copiedWeek, 6);
    try {
      await api.copyRange({ source_start: copiedWeek, source_end: sourceEnd, target_start: targetMondayStr });
      await loadMonth(year, month);
    } catch (e) { setError(e.response?.data?.error || 'Błąd wklejania tygodnia'); }
  };

  // ── Opcja D: szablony ────────────────────────────────────────────────────
  const saveTemplate = (name, weekStart, allMeals) => {
    const meals = [];
    for (let i = 0; i < 7; i++) {
      const ds = addDays(weekStart, i);
      (allMeals[ds] || []).forEach(m => {
        meals.push({ dayOffset: i, position: m.position, recipe_id: m.recipe.id, recipe_name: m.recipe.name });
      });
    }
    const updated = [...templates, { name, meals, savedAt: weekStart }];
    setTemplates(updated);
    localStorage.setItem('weekTemplates', JSON.stringify(updated));
  };

  const applyTemplate = async (template, targetMondayStr) => {
    for (const entry of template.meals) {
      const date = addDays(targetMondayStr, entry.dayOffset);
      const existing = (mealsByDate[date] || []).find(m => m.position === entry.position);
      if (!existing) {
        try { await api.addMeal({ date, position: entry.position, recipe_id: entry.recipe_id }); }
        catch {}
      }
    }
    await loadMonth(year, month);
    setShowTemplates(false);
  };

  const deleteTemplate = (i) => {
    const updated = templates.filter((_, idx) => idx !== i);
    setTemplates(updated);
    localStorage.setItem('weekTemplates', JSON.stringify(updated));
  };

  // Grupuj dni w tygodnie (wiersze po 7)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      {error && <div style={{ background:'#ffe0e0', color:'#c00', padding:12, borderRadius:8, marginBottom:16 }}>{error}</div>}

      {/* Pasek stanu kopiowania */}
      {(copiedDay || copiedWeek) && (
        <div style={{ background:'#f0f9ff', border:'1px solid #bde0ff', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:12, color:'#0066cc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>
            {copiedDay && `⧉ Skopiowano dzień ${copiedDay} — kliknij ⎘ na innym dniu żeby wkleić`}
            {copiedWeek && `⧉ Skopiowano tydzień od ${copiedWeek} — kliknij ⎘ przy innym tygodniu żeby wkleić`}
          </span>
          <button onClick={() => { setCopiedDay(null); setCopiedWeek(null); }}
            style={{ background:'none', border:'none', color:'#0066cc', cursor:'pointer', fontSize:13 }}>✕</button>
        </div>
      )}

      {/* Kalendarz */}
      <div className="card" style={{ padding:16, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <button className="btn btn-primary" onClick={prevMonth} style={{ padding:'5px 14px' }}>‹</button>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <h2 style={{ margin:0, fontSize:17 }}>{MONTH_NAMES[month]} {year}</h2>
            <button onClick={() => setShowTemplates(true)}
              style={{ background:'#f0f2ff', border:'1px solid #c0caff', color:'#667eea', borderRadius:6, padding:'4px 10px', fontSize:12, cursor:'pointer', fontWeight:600 }}>
              📋 Szablony
            </button>
          </div>
          <button className="btn btn-primary" onClick={nextMonth} style={{ padding:'5px 14px' }}>›</button>
        </div>

        {/* Nagłówki dni tygodnia */}
        <div style={{ display:'grid', gridTemplateColumns:'28px repeat(7, 1fr)', gap:3, marginBottom:3 }}>
          <div/>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:'#667eea', padding:'3px 0' }}>{d}</div>
          ))}
        </div>

        {/* Wiersze tygodni */}
        {weeks.map((weekDays, wi) => {
          const mondayStr = dateToStr(weekDays[0]);
          const isCopiedWeek = copiedWeek === mondayStr;
          return (
            <div key={wi} style={{ display:'grid', gridTemplateColumns:'28px repeat(7, 1fr)', gap:3, marginBottom:3 }}>
              {/* Kontrolki tygodnia — Opcja C */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 }}>
                <button onClick={() => handleCopyWeek(mondayStr)}
                  title="Kopiuj ten tydzień"
                  style={{ background: isCopiedWeek ? '#667eea' : '#f0f2ff', border:'1px solid #c0caff', color: isCopiedWeek ? 'white' : '#667eea', borderRadius:4, padding:'2px 4px', fontSize:9, cursor:'pointer', lineHeight:1.2 }}>
                  ⧉
                </button>
                {copiedWeek && copiedWeek !== mondayStr && (
                  <button onClick={() => handlePasteWeek(mondayStr)}
                    title="Wklej skopiowany tydzień tutaj"
                    style={{ background:'#e8f4ff', border:'1px solid #90caff', color:'#0066cc', borderRadius:4, padding:'2px 4px', fontSize:9, cursor:'pointer', lineHeight:1.2 }}>
                    ⎘
                  </button>
                )}
              </div>
              {weekDays.map(date => {
                const ds = dateToStr(date);
                return (
                  <DayCell key={ds} date={date} dateStr={ds}
                    meals={mealsByDate[ds] || []}
                    isToday={ds === todayStr}
                    isPast={date < todayMidnight}
                    isCurrentMonth={date.getMonth() === month}
                    onDelete={handleDelete}
                    onCopy={handleCopyDay}
                    onPaste={handlePasteDay}
                    copiedDay={copiedDay}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Karuzela przepisów */}
      <div className="card" style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <h2 style={{ margin:0, fontSize:15 }}>Przepisy</h2>
          <span style={{ fontSize:11, color:'#aaa' }}>Chwyć i przeciągnij na wybrany dzień i slot</span>
        </div>
        {recipes.length === 0
          ? <p style={{ fontSize:13, color:'#bbb', margin:0 }}>Brak przepisów — dodaj je w zakładce Przepisy</p>
          : <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:6, scrollbarWidth:'thin', scrollbarColor:'#ddd transparent' }}>
              {recipes.map(r => <DraggableRecipe key={r.id} recipe={r} />)}
            </div>
        }
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && <OverlayContent dragData={activeDrag} />}
      </DragOverlay>

      {/* Modal szablonów — Opcja D */}
      {showTemplates && (
        <TemplateModal
          templates={templates}
          onSave={saveTemplate}
          onApply={applyTemplate}
          onDelete={deleteTemplate}
          onClose={() => setShowTemplates(false)}
          currentWeekStart={getMondayStr(todayStr)}
          mealsByDate={mealsByDate}
        />
      )}
    </DndContext>
  );
}
