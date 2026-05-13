import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { mealPlan as api, recipes as recipesApi } from '../api';

const COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
const getColor = (pos) => COLORS[(pos - 1) % 5];

const SLOT_LABELS = ['Śniadanie', 'Drugie śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja'];

const MONTH_NAMES = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
];
const DAY_NAMES = ['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'];

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDate = new Date(firstDay);
  const startDow = (firstDay.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - startDow);

  const endDate = new Date(lastDay);
  const endDow = (lastDay.getDay() + 6) % 7;
  if (endDow < 6) endDate.setDate(endDate.getDate() + (6 - endDow));

  const days = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function DraggableRecipe({ recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { type: 'recipe', recipe },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        flexShrink: 0,
        width: 110,
        padding: '10px 10px 8px',
        background: 'linear-gradient(145deg, #667eea, #764ba2)',
        color: 'white',
        borderRadius: 10,
        fontSize: 12,
        cursor: 'grab',
        opacity: isDragging ? 0.35 : 1,
        userSelect: 'none',
        touchAction: 'none',
        boxShadow: '0 2px 8px rgba(102,126,234,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        marginBottom: 2,
      }}>
        🍽️
      </div>
      <div style={{ fontWeight: 600, lineHeight: 1.2, fontSize: 11 }}>{recipe.name}</div>
      <div style={{ fontSize: 10, opacity: 0.75 }}>{recipe.total_cost.toFixed(2)} zł</div>
    </div>
  );
}

function DraggableMeal({ meal, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.id}`,
    data: { type: 'meal', meal },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: getColor(meal.position),
        color: 'white',
        borderRadius: 3,
        padding: '1px 4px',
        fontSize: 11,
        cursor: 'grab',
        opacity: isDragging ? 0.35 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        userSelect: 'none',
        touchAction: 'none',
        width: '100%',
        minWidth: 0,
      }}
    >
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        minWidth: 0,
      }}>
        {meal.recipe.name}
      </span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }}
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: 'none',
          color: 'white',
          borderRadius: 2,
          cursor: 'pointer',
          padding: '0 3px',
          fontSize: 9,
          lineHeight: '14px',
          flexShrink: 0,
        }}
      >✕</button>
    </div>
  );
}

function MealSlot({ date, position, meal, onDelete, showLabel }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${date}-${position}`,
    data: { date, position },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        height: 22,
        borderBottom: position < 5 ? '1px solid #f0f0f0' : 'none',
        background: isOver && !meal ? 'rgba(102,126,234,0.12)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        padding: '1px 4px',
        transition: 'background 0.1s',
      }}
    >
      {meal
        ? <DraggableMeal meal={meal} onDelete={onDelete} />
        : showLabel && (
          <span style={{ fontSize: 9, color: '#c0b8d4', userSelect: 'none', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center', display: 'block' }}>
            {SLOT_LABELS[position - 1]}
          </span>
        )
      }
    </div>
  );
}

function DayCell({ date, dateStr, meals, isToday, isPast, isCurrentMonth, onDelete }) {
  const mealsByPos = {};
  meals.forEach((m) => { mealsByPos[m.position] = m; });

  return (
    <div style={{
      border: `1px solid ${isToday ? '#667eea' : '#e8e8e8'}`,
      borderRadius: 4,
      overflow: 'hidden',
      background: isPast
        ? '#f7f7f7'
        : isToday
        ? '#faf9ff'
        : 'white',
      opacity: !isCurrentMonth ? 0.45 : 1,
    }}>
      <div style={{
        padding: '2px 5px',
        fontSize: 11,
        fontWeight: isToday ? 700 : 400,
        color: isPast ? '#bbb' : isToday ? '#764ba2' : '#555',
        borderBottom: '1px solid #f0f0f0',
        background: isToday ? 'rgba(102,126,234,0.08)' : 'transparent',
      }}>
        {date.getDate()}
      </div>
      <div>
        {[1, 2, 3, 4, 5].map((pos) => (
          <MealSlot
            key={pos}
            date={dateStr}
            position={pos}
            meal={mealsByPos[pos]}
            onDelete={onDelete}
            showLabel={isToday}
          />
        ))}
      </div>
    </div>
  );
}

function OverlayContent({ dragData }) {
  if (!dragData) return null;
  const label = dragData.type === 'recipe' ? dragData.recipe.name : dragData.meal.recipe.name;
  const bg = dragData.type === 'recipe'
    ? 'linear-gradient(135deg, #667eea, #764ba2)'
    : getColor(dragData.meal.position);
  return (
    <div style={{
      background: bg,
      color: 'white',
      padding: '6px 12px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      {label}
    </div>
  );
}

export default function Calendar() {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStr = dateToStr(todayMidnight);

  const [year, setYear] = useState(todayMidnight.getFullYear());
  const [month, setMonth] = useState(todayMidnight.getMonth());
  const [recipes, setRecipes] = useState([]);
  const [mealsByDate, setMealsByDate] = useState({});
  const [activeDrag, setActiveDrag] = useState(null);
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const days = getMonthGrid(year, month);

  useEffect(() => {
    recipesApi.getAll()
      .then((r) => setRecipes(r.data))
      .catch(() => setError('Błąd ładowania przepisów'));
  }, []);

  const loadMonth = useCallback(async (y, m) => {
    const grid = getMonthGrid(y, m);
    const start = dateToStr(grid[0]);
    const end = dateToStr(grid[grid.length - 1]);
    try {
      const res = await api.getRange(start, end);
      setMealsByDate(res.data);
    } catch {
      setError('Błąd ładowania planu');
    }
  }, []);

  useEffect(() => {
    loadMonth(year, month);
  }, [year, month, loadMonth]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const handleDelete = async (mealId) => {
    try {
      await api.deleteMeal(mealId);
      await loadMonth(year, month);
    } catch {
      setError('Błąd usuwania posiłku');
    }
  };

  const handleDragStart = ({ active }) => {
    setActiveDrag(active.data.current);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;

    const dragData = active.data.current;
    const dropData = over.data.current;
    if (!dropData) return;

    const { date: targetDate, position: targetPos } = dropData;
    const targetMeals = mealsByDate[targetDate] || [];
    const slotOccupied = targetMeals.some((m) => m.position === targetPos);

    if (dragData.type === 'recipe') {
      if (slotOccupied) return;
      try {
        await api.addMeal({ date: targetDate, position: targetPos, recipe_id: dragData.recipe.id });
        await loadMonth(year, month);
      } catch {
        setError('Błąd dodawania posiłku');
      }
    } else if (dragData.type === 'meal') {
      const { meal } = dragData;
      const sourceDate = Object.keys(mealsByDate).find((d) =>
        (mealsByDate[d] || []).some((m) => m.id === meal.id)
      );
      if (sourceDate === targetDate && meal.position === targetPos) return;
      if (slotOccupied) return;
      try {
        await api.deleteMeal(meal.id);
        await api.addMeal({ date: targetDate, position: targetPos, recipe_id: meal.recipe.id });
        await loadMonth(year, month);
      } catch {
        setError('Błąd przenoszenia posiłku');
      }
    }
  };

  const handleDragCancel = () => setActiveDrag(null);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {error && (
        <div style={{ background: '#ffe0e0', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Calendar */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={prevMonth} style={{ padding: '5px 14px' }}>‹</button>
          <h2 style={{ margin: 0, fontSize: 17 }}>{MONTH_NAMES[month]} {year}</h2>
          <button className="btn btn-primary" onClick={nextMonth} style={{ padding: '5px 14px' }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#667eea', padding: '3px 0' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {days.map((date) => {
            const ds = dateToStr(date);
            return (
              <DayCell
                key={ds}
                date={date}
                dateStr={ds}
                meals={mealsByDate[ds] || []}
                isToday={ds === todayStr}
                isPast={date < todayMidnight}
                isCurrentMonth={date.getMonth() === month}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      </div>

      {/* Recipe carousel */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Przepisy</h2>
          <span style={{ fontSize: 11, color: '#aaa' }}>Chwyć i przeciągnij na wybrany dzień i slot</span>
        </div>
        {recipes.length === 0 ? (
          <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>Brak przepisów — dodaj je w zakładce Przepisy</p>
        ) : (
          <div style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 6,
            scrollbarWidth: 'thin',
            scrollbarColor: '#ddd transparent',
          }}>
            {recipes.map((r) => (
              <DraggableRecipe key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && <OverlayContent dragData={activeDrag} />}
      </DragOverlay>
    </DndContext>
  );
}
