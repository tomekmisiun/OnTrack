import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { Icon } from '@iconify/react';
import { mealPlan as api, recipes as recipesApi, products as productsApi } from '../api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useMember } from '../contexts/MemberContext';
import { dateToStr, addDays, toEU, getUpcomingMondays, getCalGrid as getMonthGrid } from '../utils/dates';
import { fuzzySearch } from '../utils/search';
import {
  upsertMealInState,
  removeMealFromState,
  clearDayInState,
  findMealDate,
  buildOptimisticMeal,
  resolveMealIdsForAllMembers,
} from '../utils/mealPlanState';
import './Calendar.css';


const COLORS = ['#4a6fa5', '#93c5fd', '#fcd34d', '#c2410c', '#6366f1'];
const getColor = (pos) => COLORS[(pos - 1) % 5];

function resolveMealSlot(drop) {
  if (!drop) return null;
  if (drop.type === 'meal' && drop.meal) {
    return { targetDate: drop.meal.date, targetPos: drop.meal.position };
  }
  if (drop.date != null && drop.position != null) {
    return { targetDate: drop.date, targetPos: drop.position };
  }
  return null;
}


// ─── Recipe preview modal ─────────────────────────────────────────────────────
function RecipePreviewModal({ recipe, onClose }) {
  const { showError } = useToast();
  const { t } = useLanguage();
  const [fullRecipe, setFullRecipe] = useState(null);
  const [localIngredients, setLocalIngredients] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVals, setEditVals] = useState({ kcal: '', protein: '', fat: '', carbs: '' });

  useEffect(() => {
    if (!recipe) { setFullRecipe(null); setLocalIngredients([]); return; }
    setFullRecipe(null);
    recipesApi.get(recipe.id).then(res => {
      setFullRecipe(res.data);
      setLocalIngredients(res.data.ingredients || []);
    }).catch(() => setLocalIngredients([]));
  }, [recipe?.id]);

  const startEdit = (i, ing) => {
    setEditingIdx(i);
    setEditVals({
      kcal:    ing.kcal    != null ? String(ing.kcal)    : '',
      protein: ing.protein != null ? String(ing.protein) : '',
      fat:     ing.fat     != null ? String(ing.fat)     : '',
      carbs:   ing.carbs   != null ? String(ing.carbs)   : '',
    });
  };

  const saveEdit = async (ing) => {
    const toNum = v => v === '' ? null : parseFloat(v) || 0;
    const payload = {
      kcal:    toNum(editVals.kcal),
      protein: toNum(editVals.protein),
      fat:     toNum(editVals.fat),
      carbs:   toNum(editVals.carbs),
    };
    try {
      await productsApi.update(ing.product_id, payload);
      setLocalIngredients(prev => prev.map((x, j) =>
        j === editingIdx ? { ...x, ...payload } : x
      ));
    } catch (e) {
      showError(t('err_save_notes'));
    }
    setEditingIdx(null);
  };

  if (!recipe) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        {/* Header — zdjęcie jako tło */}
        <div style={{
          position: 'relative', minHeight: 180,
          background: recipe.image_url
            ? `url(${recipe.image_url}) center/cover`
            : 'linear-gradient(135deg,#0d9488,#0f766e)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '16px 20px',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
          }}>×</button>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.8)', marginBottom: 10 }}>
              {recipe.name}
            </div>
            {(() => {
              const r = fullRecipe || recipe;
              const kcal = r.total_kcal > 0 ? r.total_kcal : r.kcal_100g;
              const per100 = r.total_kcal === 0 && r.kcal_100g != null;
              if (!kcal) return null;
              return (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '4px 12px' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{Math.round(kcal)}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginLeft: 3 }}>kcal{per100 ? '/100g' : ''}</span>
                  </div>
                  {[[t('macro_protein'), per100 ? r.protein_100g : r.total_protein], [t('macro_fat'), per100 ? r.fat_100g : r.total_fat], [t('macro_carbs'), per100 ? r.carbs_100g : r.total_carbs]].map(([lbl, val]) => val != null && (
                    <div key={lbl} style={{ background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '4px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 1 }}>{lbl}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{Math.round(val)}g</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        {/* Składniki */}
        <div className="dark-scroll" style={{ background: '#1c2433', overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('show_ingredients')}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
              {t('edit_notes')}
            </div>
          </div>
          {!fullRecipe && <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, padding: '12px 0' }}>{t('loading')}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {localIngredients.map((ing, i) => {
              const factor  = (ing.unit === 'szt') ? ing.weight : (ing.weight / 100);
              const kcal    = ing.kcal    != null ? Math.round(ing.kcal    * factor) : null;
              const protein = ing.protein != null ? Math.round(ing.protein * factor * 10) / 10 : null;
              const fat     = ing.fat     != null ? Math.round(ing.fat     * factor * 10) / 10 : null;
              const carbs   = ing.carbs   != null ? Math.round(ing.carbs   * factor * 10) / 10 : null;
              const isEditing = editingIdx === i;
              const inpStyle = { width: 36, padding: '1px 3px', fontSize: 11, background: '#1f2937', border: '1px solid #0d9488', borderRadius: 4, color: '#e2e8f0', textAlign: 'center', minWidth: 0 };
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#111827', borderRadius: 7, minWidth: 0 }}>
                  {/* Ilość */}
                  <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
                    {ing.weight} {ing.unit === 'szt' ? t('unit_pcs') : ing.unit}
                  </span>
                  {/* Nazwa */}
                  <span style={{ fontSize: 13, color: '#e2e8f0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.product_name}</span>
                  {/* Makro — klik otwiera edycję */}
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                         onKeyDown={e => { if (e.key === 'Enter') saveEdit(ing); if (e.key === 'Escape') setEditingIdx(null); }}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>kcal</span>
                      <input autoFocus style={inpStyle} value={editVals.kcal}    onChange={e => setEditVals(v => ({ ...v, kcal:    e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_p')}</span>
                      <input style={inpStyle} value={editVals.protein} onChange={e => setEditVals(v => ({ ...v, protein: e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_f')}</span>
                      <input style={inpStyle} value={editVals.fat}     onChange={e => setEditVals(v => ({ ...v, fat:     e.target.value }))} placeholder="—" />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{t('macro_c')}</span>
                      <input style={inpStyle} value={editVals.carbs}   onChange={e => setEditVals(v => ({ ...v, carbs:   e.target.value }))} placeholder="—" />
                      <button onClick={() => saveEdit(ing)} style={{ padding: '2px 5px', fontSize: 11, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginLeft: 2, flexShrink: 0 }}>✓</button>
                      <button onClick={() => setEditingIdx(null)} style={{ padding: '2px 5px', fontSize: 11, background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startEdit(i, ing)}
                      title={t('click_edit_macro')}
                      style={{ fontSize: 11, color: kcal != null ? '#6b7280' : '#9ca3af', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', cursor: 'pointer', borderRadius: 4, padding: '1px 4px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1f2937'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {kcal != null ? `${kcal} kcal · ${t('macro_p')}${protein} ${t('macro_f')}${fat} ${t('macro_c')}${carbs}` : t('plus_macro')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            <span>{t('recipe_cost_lbl')}: <span style={{ color: '#0d9488', fontWeight: 700 }}>{recipe.total_cost?.toFixed(2)} {t('currency')}</span></span>
            {recipe.source_url && (
              <div style={{ marginTop: 4 }}>
                <a href={recipe.source_url} target="_blank" rel="noreferrer"
                   style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                  {t('see_recipe')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Draggable recipe ─────────────────────────────────────────────────────────
const DraggableRecipe = React.memo(function DraggableRecipe({ recipe, onToggleFavorite, onPreview }) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`, data: { type: 'recipe', recipe },
  });
  const pointerStart = React.useRef(null);
  const displayKcal    = recipe.total_kcal > 0 ? recipe.total_kcal    : recipe.kcal_100g;
  const displayProtein = recipe.total_kcal > 0 ? recipe.total_protein : recipe.protein_100g;
  const displayFat     = recipe.total_kcal > 0 ? recipe.total_fat     : recipe.fat_100g;
  const displayCarbs   = recipe.total_kcal > 0 ? recipe.total_carbs   : recipe.carbs_100g;
  const isPer100g      = recipe.total_kcal === 0 && recipe.kcal_100g != null;
  const hasKcal        = displayKcal != null;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={e => { pointerStart.current = { x: e.clientX, y: e.clientY }; listeners?.onPointerDown?.(e); }}
      onClick={e => {
        if (!pointerStart.current) return;
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.sqrt(dx*dx + dy*dy) < 8) onPreview(recipe);
      }}
      style={{
        flexShrink:0, width:128, height:148,
        background: 'linear-gradient(135deg, #0d9488, #0f766e)',
        borderRadius:12, cursor:'grab', opacity: isDragging ? 0.3 : 1,
        userSelect:'none', touchAction:'none',
        boxShadow:'0 4px 12px rgba(0,0,0,0.4)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        position:'relative',
      }}
    >
      {recipe.image_url && (
        <img
          src={recipe.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover', borderRadius:12, pointerEvents:'none',
          }}
        />
      )}
      {recipe.image_url && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', borderRadius:12 }} />}
      {/* Name + star */}
      <div style={{flex:1, padding:'8px 11px 6px', display:'flex', flexDirection:'column', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:4}}>
          <div style={{
            fontWeight:700, fontSize:11.5, lineHeight:1.4, color:'#fff',
            display:'-webkit-box', WebkitLineClamp:3,
            WebkitBoxOrient:'vertical', overflow:'hidden', flex:1,
            textShadow: recipe.image_url ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
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
      <div style={{padding:'0 8px 7px', position:'relative', zIndex:1}}>
        {hasKcal ? (
          <>
            <div style={{display:'flex', alignItems:'baseline', gap:3, padding:'0 3px', marginBottom:isPer100g ? 2 : 5}}>
              <span style={{fontSize:18, fontWeight:800, color:'#fff', lineHeight:1, textShadow:'0 1px 4px rgba(0,0,0,0.8)'}}>
                {Math.round(displayKcal)}
              </span>
              <span style={{fontSize:9, fontWeight:700, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,0.8)'}}>
                kcal{isPer100g ? '/100g' : ''}
              </span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:3}}>
              {(recipe.lang === 'en'
                ? [['P', displayProtein], ['F', displayFat], ['C', displayCarbs]]
                : [['B', displayProtein], ['T', displayFat], ['W', displayCarbs]]
              ).map(([lbl, val]) => (
                <div key={lbl} style={{
                  background:'rgba(0,0,0,0.45)', borderRadius:5,
                  padding:'3px 0', textAlign:'center',
                }}>
                  <div style={{fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'0.3px'}}>{lbl}</div>
                  <div style={{fontSize:10, fontWeight:700, color:'#fff'}}>{Math.round(val)}g</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{height:52}} />
        )}
      </div>

      {/* Price footer */}
      <div style={{
        borderTop:'1px solid rgba(255,255,255,0.2)',
        background:'rgba(0,0,0,0.35)',
        padding:'4px 8px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        flexShrink:0, position:'relative', zIndex:1,
      }}>
        <span style={{ fontSize:8.5, fontWeight:500, color:'rgba(255,255,255,0.5)', letterSpacing:'0.2px' }}>
          {t('est_cost')}
        </span>
        <span style={{ fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>
          {t('currency')}{recipe.total_cost.toFixed(2)}
        </span>
      </div>
    </div>
  );
});

// ─── Draggable meal ───────────────────────────────────────────────────────────
function DraggableMeal({ meal, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-${meal.id}`, data: { type: 'meal', meal },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{
      background:getColor(meal.position), color:'#1f2937', borderRadius:4,
      padding:'2px 5px', fontSize:12, cursor:'grab', opacity: isDragging ? 0.35 : 1,
      display:'flex', alignItems:'center', gap:3,
      userSelect:'none', touchAction:'none', width:'100%', minWidth:0,
    }}>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{meal.recipe.name}</span>
      <button onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(meal.id);}}
        style={{background:'rgba(0,0,0,0.25)',border:'none',color:'#1f2937',borderRadius:2,cursor:'pointer',padding:'0 4px',fontSize:10,lineHeight:'16px',flexShrink:0}}>✕</button>
    </div>
  );
}

// ─── Drag handle for template day ─────────────────────────────────────────────
function DraggableTplDayHandle({ dayIndex, slots }) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tpl-day-${dayIndex}`, data: { type: 'tpl-day', dayIndex, slots },
  });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      style={{cursor:'grab',opacity:isDragging?0.4:1,userSelect:'none',touchAction:'none',
        background:'#374151',border:'none',borderRadius:4,padding:'3px 7px',
        fontSize:10,fontWeight:700,color:'#9ca3af',lineHeight:1.3,display:'inline-flex',alignItems:'center'}}>
      {t('btn_grab')}
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
        background:'#374151',borderRadius:4,padding:'3px 8px',
        fontSize:10,fontWeight:700,color:'#9ca3af',display:'inline-flex',alignItems:'center',verticalAlign:'middle',lineHeight:1.3}}>
      {t('btn_grab')}
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
      height:40, borderBottom: position<5 ? '1px solid #2d3748' : 'none',
      background: isOver && !meal ? 'rgba(45,212,191,0.1)' : 'transparent',
      display:'flex', alignItems:'center', padding:'2px 4px', transition:'background 0.1s',
    }}>
      {meal
        ? <DraggableMeal meal={meal} onDelete={onDelete} />
        : showLabel && <span style={{fontSize:10,color:'#6b7280',userSelect:'none',whiteSpace:'nowrap',overflow:'hidden',width:'100%',textAlign:'center',display:'block'}}>{t('slot_labels')[position-1]}</span>
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

function pickRecipeMacros(recipe) {
  return {
    total_kcal: recipe.total_kcal || 0,
    total_protein: recipe.total_protein || 0,
    total_fat: recipe.total_fat || 0,
    total_carbs: recipe.total_carbs || 0,
    total_cost: recipe.total_cost || 0,
  };
}

function toTplSlot(recipe) {
  return { id: recipe.id, name: recipe.name, ...pickRecipeMacros(recipe) };
}

function resolveTplRecipe(slot, recipes) {
  if (!slot) return null;
  if (slot.total_kcal || slot.total_protein || slot.total_fat || slot.total_carbs) return slot;
  const full = recipes.find(r => r.id === slot.id);
  return full ? { ...slot, ...pickRecipeMacros(full) } : slot;
}

function sumDayMacros(items) {
  return items.reduce((s, r) => ({
    kcal: s.kcal + (r.total_kcal || 0),
    protein: s.protein + (r.total_protein || 0),
    fat: s.fat + (r.total_fat || 0),
    carbs: s.carbs + (r.total_carbs || 0),
    cost: s.cost + (r.total_cost || 0),
  }), { kcal: 0, protein: 0, fat: 0, carbs: 0, cost: 0 });
}

function DayMacroFooter({ totals, hasMeals, macroGoals, emptyLabel, background = 'transparent' }) {
  const { t } = useLanguage();
  const { kcal: totalKcal, protein: totalProtein, fat: totalFat, carbs: totalCarbs, cost: totalCost } = totals;
  const hasAnyMacro = totalKcal > 0 || totalProtein > 0 || totalFat > 0 || totalCarbs > 0;

  return (
    <div style={{
      borderTop: '1px solid #374151',
      background,
      padding: '3px 5px',
      height: 40,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {emptyLabel && !hasMeals && (
        <span style={{ fontSize: 10, color: '#4b5563', width: '100%', textAlign: 'center', display: 'block', lineHeight: '34px', userSelect: 'none' }}>
          {emptyLabel}
        </span>
      )}
      {hasMeals && hasAnyMacro && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              <span style={{ color: macroGoals ? macroColor(totalKcal, macroGoals.kcal) : '#2dd4bf' }}>{totalKcal}</span>
              {macroGoals && <span style={{ color: '#6b7280', fontWeight: 400 }}>/{macroGoals.kcal}</span>}
              <span style={{ color: '#6b7280', fontWeight: 400 }}> kcal</span>
            </div>
            {totalCost > 0 && (
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ color: '#6b7280', fontSize: 8, fontWeight: 500, lineHeight: 1 }}>{t('est_cost')}</div>
                <div style={{ color: '#0d9488', fontWeight: 700, fontSize: 11, lineHeight: 1.2 }}>{totalCost.toFixed(2)} {t('currency')}</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[[t('macro_p'), Math.round(totalProtein), macroGoals?.protein], [t('macro_f'), Math.round(totalFat), macroGoals?.fat], [t('macro_c'), Math.round(totalCarbs), macroGoals?.carbs]].map(([lbl, val, tgt], i) => (
              <span key={lbl} style={{ marginLeft: i > 0 ? 4 : 0 }}>
                <span style={{ color: '#6b7280' }}>{lbl}:</span>
                <span style={{ color: tgt ? macroColor(val, tgt) : '#9ca3af' }}>{val}</span>
                {tgt && <span style={{ color: '#6b7280' }}>/{tgt}</span>}
                <span style={{ color: '#6b7280' }}>g</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DayCell({ date, dateStr, meals, isToday, isPast, isCurrentMonth, onDelete, onDeleteAll, onCopy, onPaste, copiedDay, macroGoals }) {
  const { t } = useLanguage();
  const dayAbbr = t('day_short')[(date.getDay() + 6) % 7];
  const mealsByPos = {};
  meals.forEach(m => { mealsByPos[m.position] = m; });
  const hasMeals = meals.length > 0;
  const canPaste = copiedDay && copiedDay !== dateStr;

  const dayMacros = sumDayMacros(meals.map(m => m.recipe));

  return (
    <div id={isToday ? 'calendar-today' : undefined} style={{
      border:`1px solid ${isToday ? '#2dd4bf' : '#374151'}`,
      borderRadius:4, overflow:'hidden',
      background: isPast ? '#161d2d' : isToday ? '#162626' : '#1f2937',
      opacity: !isCurrentMonth ? 0.45 : 1,
    }}>
      <DroppableDayHeader dateStr={dateStr}>
        <div style={{
          padding:'7px 7px',
          borderBottom:'1px solid #374151',
          background: isToday ? 'rgba(45,212,191,0.08)' : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:3,
        }}>
          {/* Date number + day abbr */}
          <span style={{
            display:'flex', alignItems:'center', gap:4,
            fontSize:13, fontWeight: isToday ? 700 : 500,
            color: isPast ? '#4b5563' : isToday ? '#2dd4bf' : '#94a3b8',
            flexShrink:0,
          }}>
            {date.getDate()}
            <span style={{fontSize:13, fontWeight:500, color: isPast ? '#374151' : isToday ? '#2dd4bf' : '#4b5563'}}>{dayAbbr}</span>
          </span>
          {/* Chwyć + Kopiuj + Wklej + Usuń — razem */}
          <span style={{display:'flex', gap:3, flexWrap:'nowrap'}}>
            {hasMeals && <DraggableDayHandle dateStr={dateStr} meals={meals} />}
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onCopy(dateStr)}
                title={t('copy_day_title')}
                style={{
                  background: copiedDay===dateStr ? '#0d9488' : '#1e3a3a',
                  color: copiedDay===dateStr ? 'white' : '#2dd4bf',
                  border:'none', borderRadius:4, cursor:'pointer',
                  fontSize:10, fontWeight:700, padding:'3px 7px', lineHeight:1.3,
                }}>
                {copiedDay===dateStr ? t('btn_copied') : t('btn_copy')}
              </button>
            )}
            {canPaste && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onPaste(dateStr)}
                title={t('paste_day_title')}
                style={{
                  background:'#0d9488', color:'#1f2937',
                  border:'none', borderRadius:4, cursor:'pointer',
                  fontSize:10, fontWeight:700, padding:'3px 7px', lineHeight:1.3,
                }}>
                {t('btn_paste')}
              </button>
            )}
            {hasMeals && (
              <button onPointerDown={e=>e.stopPropagation()} onClick={()=>onDeleteAll(dateStr)}
                title={t('del_day_title')}
                style={{
                  background:'#2d1515', color:'#f87171',
                  border:'none', borderRadius:4, cursor:'pointer',
                  fontSize:10, fontWeight:700, padding:'3px 7px', lineHeight:1.3,
                }}>
                {t('btn_delete')}
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
      <DayMacroFooter
        totals={dayMacros}
        hasMeals={hasMeals}
        macroGoals={macroGoals}
        emptyLabel={isToday ? t('macro_day_label') : null}
        background={isPast ? '#161d2d' : isToday ? '#162626' : 'transparent'}
      />
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
      height:40, borderBottom: position<5 ? '1px solid #2d3748' : 'none',
      background: isOver && !recipe ? 'rgba(45,212,191,0.1)' : 'transparent',
      display:'flex', alignItems:'center', padding:'2px 4px', transition:'background 0.1s',
    }}>
      {recipe ? (
        <div style={{background:getColor(position),color:'#1f2937',borderRadius:4,padding:'2px 5px',fontSize:12,display:'flex',alignItems:'center',gap:3,width:'100%',minWidth:0}}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{recipe.name}</span>
          <button onClick={()=>onRemove(dayIndex,position)}
            style={{background:'rgba(0,0,0,0.25)',border:'none',color:'#1f2937',borderRadius:2,cursor:'pointer',padding:'0 4px',fontSize:10,lineHeight:'16px',flexShrink:0}}>✕</button>
        </div>
      ) : (
        <span style={{fontSize:10,color:'#6b7280',width:'100%',textAlign:'center',display:'block',userSelect:'none'}}>{t('slot_labels')[position-1]}</span>
      )}
    </div>
  );
}

// ─── Template editor/viewer ───────────────────────────────────────────────────
function TemplateSection({ templates, tplSlots: editSlots, setTplSlots: setEditSlots, onSave, onApply, onDelete, open, setOpen, macroGoals, recipes }) {
  const { t } = useLanguage();
  const [editName, setEditName]       = useState('');
  const [applyWeek, setApplyWeek]     = useState({});
  const [copiedTplDay, setCopiedTplDay] = useState(null);
  const [expandedTpls, setExpandedTpls] = useState(new Set());
  const mondays = getUpcomingMondays(16);

  const toggleTpl = (ti) => setExpandedTpls(prev => {
    const next = new Set(prev);
    next.has(ti) ? next.delete(ti) : next.add(ti);
    return next;
  });

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
        <Icon icon="heroicons:chevron-down" style={{width:20,height:20,transition:'transform 0.25s',transform:open?'rotate(180deg)':'rotate(0deg)',color:'#0d9488'}}/>
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
                <div style={{background:'#1c3534',borderBottom:'1px solid #374151',padding:'7px 7px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:3}}>
                  <span style={{fontSize:13,fontWeight:600,color:'#2dd4bf',flexShrink:0}}>{dayShort[di]}</span>
                  <span style={{display:'flex',gap:3,flexWrap:'nowrap'}}>
                    {dayHasContent && <DraggableTplDayHandle dayIndex={di} slots={editSlots} />}
                    {dayHasContent && (
                      <button onClick={()=>handleCopyTplDay(di)}
                        style={{background:copiedTplDay===di?'#0d9488':'#1e3a3a',color:copiedTplDay===di?'white':'#2dd4bf',border:'none',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700,padding:'3px 7px',lineHeight:1.3}}>
                        {copiedTplDay===di?t('btn_copied'):t('btn_copy')}
                      </button>
                    )}
                    {copiedTplDay!==null && copiedTplDay!==di && (
                      <button onClick={()=>handlePasteTplDay(di)}
                        style={{background:'#0d9488',color:'#1f2937',border:'none',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700,padding:'3px 7px',lineHeight:1.3}}>
                        {t('btn_paste')}
                      </button>
                    )}
                    {dayHasContent && (
                      <button onClick={()=>handleClearDay(di)}
                        style={{background:'#2d1515',color:'#f87171',border:'none',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700,padding:'3px 7px',lineHeight:1.3}}>
                        {t('btn_delete')}
                      </button>
                    )}
                  </span>
                </div>
                </DroppableTplDayHeader>
                {[1,2,3,4,5].map(pos => (
                  <TemplateSlot key={pos} dayIndex={di} position={pos}
                    recipe={editSlots[`${di}-${pos}`] || null}
                    onRemove={handleRemove} />
                ))}
                <DayMacroFooter
                  totals={sumDayMacros(
                    [1, 2, 3, 4, 5]
                      .map(pos => resolveTplRecipe(editSlots[`${di}-${pos}`], recipes))
                      .filter(Boolean)
                  )}
                  hasMeals={dayHasContent}
                  macroGoals={macroGoals}
                />
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

      <div style={{fontWeight:600,fontSize:14,color:'#0d9488',marginBottom:10,paddingTop:12,borderTop:'1px solid #374151'}}>{t('your_tpls')}</div>
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
            const isExpanded = expandedTpls.has(ti);
            return (
              <div key={ti} style={{border:'1px solid #374151',borderRadius:8,overflow:'hidden'}}>
                {/* Nagłówek — klik na nazwę/chevron zwija/rozwija */}
                <div style={{background:'#1c3534',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom: isExpanded ? '1px solid #374151' : 'none'}}>
                  <button onClick={()=>toggleTpl(ti)}
                    style={{display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:0,flex:1,minWidth:0}}>
                    <Icon icon="heroicons:chevron-right" style={{width:16,height:16,color:'#0d9488',flexShrink:0,transition:'transform 0.2s',transform:isExpanded?'rotate(90deg)':'rotate(0deg)'}}/>
                    <strong style={{fontSize:13,color:'#e2e8f0',textAlign:'left'}}>{tpl.name}</strong>
                  </button>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
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
                        tpl.meals.forEach(m => {
                          const full = recipes.find(r => r.id === m.recipe_id);
                          slots[`${m.dayOffset}-${m.position}`] = full
                            ? toTplSlot(full)
                            : { id: m.recipe_id, name: m.recipe_name };
                        });
                        setEditSlots(slots);
                        setEditName(tpl.name);
                        onDelete(ti);
                        document.getElementById('tpl-editor')?.scrollIntoView({behavior:'smooth'});
                      }}>
                      {t('edit_btn')}
                    </button>
                    <button className="btn btn-danger" style={{padding:'5px 12px',fontSize:12}}
                      onClick={()=>onDelete(ti)}>{t('btn_delete')}</button>
                  </div>
                </div>
                {/* Siatka dni — widoczna tylko po rozwinięciu */}
                {isExpanded && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,padding:8}}>
                    {[0,1,2,3,4,5,6].map(di => (
                      <div key={di} style={{border:'1px solid #374151',borderRadius:6,overflow:'hidden'}}>
                        <div style={{background:'#1c3534',padding:'7px 7px',fontSize:13,fontWeight:600,color:'#2dd4bf',textAlign:'center',borderBottom:'1px solid #374151'}}>
                          {dayShort[di]}
                        </div>
                        {[1,2,3,4,5].map(pos => {
                          const meal = byDay[di]?.[pos];
                          return (
                            <div key={pos} style={{height:40,borderBottom:pos<5?'1px solid #2d3748':'none',display:'flex',alignItems:'center',padding:'2px 4px'}}>
                              {meal
                                ? <div style={{background:getColor(pos),color:'#1f2937',borderRadius:4,padding:'2px 5px',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%'}}>{meal.recipe_name}</div>
                                : <span style={{fontSize:10,color:'#6b7280',width:'100%',textAlign:'center',display:'block',userSelect:'none'}}>{t('slot_labels')[pos-1]}</span>
                              }
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
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
    : isTplDay ? t('drag_day_title')
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

// ─── Carousel list (wirtualne okno — renderuje tylko widoczne karty) ──────────
const CARD_W = 138; // 128px width + 10px gap
const PAGE    = 20;

function CarouselList({ recipes, search, categoryFilter, visible, setVisible, scrollRef, dragRef, onPreview, onToggleFavorite, t }) {
  const filtered = useMemo(() => {
    const q = search.trim();
    let list = recipes;
    if (categoryFilter) list = list.filter(r => r.category === categoryFilter);
    const sorted = [...list].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
    return q ? sorted.filter(r => fuzzySearch(q, r.name)) : sorted;
  }, [recipes, search, categoryFilter]);

  // reset window when search or category filter changes
  const prevKey = useRef('');
  const filterKey = `${search}|${categoryFilter || ''}`;
  if (prevKey.current !== filterKey) {
    prevKey.current = filterKey;
    setVisible(12);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }

  const slice = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  if (filtered.length === 0) {
    return <p style={{fontSize:13,color:'#4b5563',margin:0}}>{search.trim() ? t('cal_no_recipes_match')(search) : t('no_recipes_cal')}</p>;
  }

  return (
    <div
      ref={scrollRef}
      className="recipe-carousel"
      style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:10 }}
      onScroll={e => {
        const el = e.currentTarget;
        if (hasMore && el.scrollLeft + el.clientWidth >= el.scrollWidth - CARD_W * 3) {
          setVisible(v => Math.min(v + PAGE, filtered.length));
        }
      }}
    >
      {slice.map(r => (
        <DraggableRecipe key={r.id} recipe={r} onToggleFavorite={onToggleFavorite} onPreview={onPreview} />
      ))}
      {hasMore && (
        <div style={{flexShrink:0,width:CARD_W-10,display:'flex',alignItems:'center',justifyContent:'center',color:'#4b5563',fontSize:11}}>
          +{filtered.length - visible}
        </div>
      )}
    </div>
  );
}

export default function Calendar({ onGoToTab, scrollToToday, onScrolledToToday }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showError, showSuccess, showConfirm } = useToast();
  const { activeMember, targetMemberIds } = useMember();
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
  const [carouselOpen,setCarouselOpen] = useState(true);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [carouselCatFilter, setCarouselCatFilter] = useState(null);
  const [carouselVisible, setCarouselVisible] = useState(12);
  const handleCarouselCatFilter = (val) => { setCarouselCatFilter(val); };
  const carouselScrollRef = useRef(null);
  const carouselDrag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const handleToggleFavorite = useCallback(async (id) => {
    await recipesApi.toggleFavorite(id);
    recipesApi.getAll().then(res => setRecipes(res.data));
  }, []);
  const [tplSlots,setTplSlots]       = useState({});
  const [tplOpen,setTplOpen]         = useState(false);
  const [previewRecipe,setPreviewRecipe] = useState(null);
  const containerRef                 = useRef(null);

  useEffect(() => {
    if (Object.keys(tplSlots).length === 0) setCopiedWeek(null);
  }, [tplSlots]);

  useEffect(() => {
    if (!scrollToToday) return undefined;
    const timer = setTimeout(() => {
      document.getElementById('calendar-today')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onScrolledToToday?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [scrollToToday, onScrolledToToday]);

  useEffect(() => {
    const handler = () => {
      setTplOpen(true);
      setTimeout(() => document.getElementById('template-section')?.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    };
    window.addEventListener('open-template', handler);
    return () => window.removeEventListener('open-template', handler);
  }, []);

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const days = getMonthGrid(year, month);

  useEffect(()=>{
    recipesApi.getAll().then(r=>setRecipes(r.data)).catch(()=>showError(t('err_load_recipes')));
  },[user?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMonth = useCallback(async(y,m)=>{
    const grid = getMonthGrid(y,m);
    const start = dateToStr(grid[0]);
    const end   = dateToStr(grid[grid.length-1]);
    const mid = activeMember?.id;
    try { setMealsByDate((await api.getRange(start,end,mid?[mid]:[])).data); }
    catch { showError(t('err_load_plan')); }
  },[activeMember?.id, user?.lang]);

  useEffect(()=>{ loadMonth(year,month); },[year,month,loadMonth]);

  const prevMonth = ()=> month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1);
  const nextMonth = ()=> month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1);

  const handleDelete = async(mealId)=>{
    const date = findMealDate(mealsByDate, mealId);
    const meal = date ? (mealsByDate[date] || []).find(m => m.id === mealId) : null;
    if (!meal || !targetMemberIds.length) return;

    let previous;
    setMealsByDate(prev => {
      previous = prev;
      return removeMealFromState(prev, mealId, date);
    });
    try {
      const ids = await resolveMealIdsForAllMembers({
        dateStr: date,
        position: meal.position,
        memberIds: targetMemberIds,
        mealsByDate,
        viewMemberId: activeMember?.id,
        getDay: api.getDay,
      });
      await Promise.all(ids.map(id => api.deleteMeal(id)));
    } catch {
      setMealsByDate(previous);
      showError(t('err_del_meal'));
    }
  };

  const handleDeleteAll = (dateStr)=>{
    const meals = mealsByDate[dateStr]||[];
    if (!meals.length) return;
    showConfirm({
      title: t('del_day_title'),
      message: t('confirm_del_day')(meals.length, toEU(dateStr)),
      confirmLabel: t('btn_delete'),
      onConfirm: async () => {
        let previous;
        setMealsByDate(prev => {
          previous = prev;
          return clearDayInState(prev, dateStr);
        });
        try {
          const ids = await resolveMealIdsForAllMembers({
            dateStr,
            memberIds: targetMemberIds,
            mealsByDate,
            viewMemberId: activeMember?.id,
            getDay: api.getDay,
          });
          await Promise.all(ids.map(id => api.deleteMeal(id)));
          showSuccess(t('day_deleted_ok'));
        } catch {
          setMealsByDate(previous);
          showError(t('err_del_meals'));
        }
      },
    });
  };

  const handleCopyDay  = (ds)=>{
    if (copiedDay === ds) { setCopiedDay(null); return; }
    setCopiedDay(ds);  showToast(t('toast_copy_day')(toEU(ds)));
  };
  const handlePasteDay = async(target)=>{
    if (!copiedDay || !targetMemberIds.length) return;
    try {
      await Promise.all(targetMemberIds.map(member_id =>
        api.copyRange({ source_start: copiedDay, source_end: copiedDay, target_start: target, member_id })
      ));
      await loadMonth(year,month);
    }
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
      title: t('del_week_title'),
      message: t('confirm_del_week')(allMeals.length),
      confirmLabel: t('btn_delete'),
      onConfirm: async () => {
        try {
          const idSet = new Set();
          for (let i = 0; i < 7; i++) {
            const ds = addDays(mondayStr, i);
            const ids = await resolveMealIdsForAllMembers({
              dateStr: ds,
              memberIds: targetMemberIds,
              mealsByDate,
              viewMemberId: activeMember?.id,
              getDay: api.getDay,
            });
            ids.forEach(id => idSet.add(id));
          }
          await Promise.all([...idSet].map(id => api.deleteMeal(id)));
          showSuccess(t('week_deleted_ok'));
          await loadMonth(year, month);
        }
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
        newSlots[`${i}-${m.position}`] = toTplSlot(m.recipe);
      });
    }
    setTplSlots(newSlots);
    setTplOpen(true);
    showToast(t('toast_copy_week'));
  };
  const handlePasteWeek = async(mon)=>{
    if (!copiedWeek || !targetMemberIds.length) return;
    try {
      await Promise.all(targetMemberIds.map(member_id =>
        api.copyRange({ source_start: copiedWeek, source_end: addDays(copiedWeek, 6), target_start: mon, member_id })
      ));
      await loadMonth(year,month);
    }
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
    if (!targetMemberIds.length) return;
    const offsets = [...new Set(template.meals.map(m => m.dayOffset))];

    for (const member_id of targetMemberIds) {
      for (const offset of offsets) {
        const ds = addDays(targetMon, offset);
        let dayMeals = [];
        if (member_id === activeMember?.id) {
          dayMeals = mealsByDate[ds] || [];
        } else {
          try {
            const res = await api.getDay(ds, member_id);
            dayMeals = res.data || [];
          } catch { dayMeals = []; }
        }
        await Promise.all(dayMeals.map(m => api.deleteMeal(m.id)));
      }
      for (const entry of template.meals) {
        try {
          await api.addMeal({
            date: addDays(targetMon, entry.dayOffset),
            position: entry.position,
            recipe_id: entry.recipe_id,
            member_id,
          });
        } catch {}
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
      setTplSlots(prev => ({ ...prev, [k]: toTplSlot(drag.recipe) }));
      return;
    }

    if (drag.type==='day') {
      if (drop.type!=='day-target') return;
      if (drag.dateStr===drop.dateStr || !targetMemberIds.length) return;
      try {
        await Promise.all(targetMemberIds.map(member_id =>
          api.copyRange({ source_start: drag.dateStr, source_end: drag.dateStr, target_start: drop.dateStr, member_id })
        ));
        await loadMonth(year,month);
      }
      catch(e){ showError(e.response?.data?.error||t('err_copy_day')); }
      return;
    }

    if (drop.type==='day-target') return;

    const slot = resolveMealSlot(drop);
    if (!slot) return;
    const { targetDate, targetPos } = slot;

    if (drag.type==='recipe') {
      if (!targetMemberIds.length) return;
      const displayMid = activeMember?.id;
      const tempId = `temp-${Date.now()}`;
      if (displayMid && targetMemberIds.includes(displayMid)) {
        const optimistic = buildOptimisticMeal({
          date: targetDate,
          position: targetPos,
          recipe: drag.recipe,
          memberId: displayMid,
          tempId,
        });
        let previous;
        setMealsByDate(prev => {
          previous = prev;
          return upsertMealInState(prev, optimistic);
        });
        try {
          const results = await Promise.all(targetMemberIds.map(member_id =>
            api.addMeal({ date: targetDate, position: targetPos, recipe_id: drag.recipe.id, member_id })
          ));
          const displayIdx = targetMemberIds.indexOf(displayMid);
          const res = displayIdx >= 0 ? results[displayIdx] : results[0];
          setMealsByDate(prev => {
            let next = removeMealFromState(prev, tempId, targetDate);
            return upsertMealInState(next, res.data);
          });
        } catch {
          setMealsByDate(previous);
          showError(t('err_add_meal'));
        }
      } else {
        try {
          await Promise.all(targetMemberIds.map(member_id =>
            api.addMeal({ date: targetDate, position: targetPos, recipe_id: drag.recipe.id, member_id })
          ));
          await loadMonth(year, month);
        } catch {
          showError(t('err_add_meal'));
        }
      }
    } else if (drag.type==='meal') {
      const {meal} = drag;
      if (meal.date===targetDate && meal.position===targetPos) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic = { ...meal, id: tempId, date: targetDate, position: targetPos };
      let previous;
      setMealsByDate(prev => {
        previous = prev;
        let next = removeMealFromState(prev, meal.id, meal.date);
        return upsertMealInState(next, optimistic);
      });
      try {
        await api.deleteMeal(meal.id);
        const res = await api.addMeal({
          date: targetDate,
          position: targetPos,
          recipe_id: meal.recipe.id,
          member_id: activeMember?.id,
        });
        setMealsByDate(prev => {
          let next = removeMealFromState(prev, meal.id, meal.date);
          next = removeMealFromState(next, tempId, targetDate);
          return upsertMealInState(next, res.data);
        });
      } catch {
        setMealsByDate(previous);
        showError(t('err_move_meal'));
        loadMonth(year, month);
      }
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


      {/* Recipe carousel */}
      <div id="recipe-carousel" className="card carousel-card">
        <div className="carousel-header">
          <button type="button" className="carousel-header-toggle" onClick={() => setCarouselOpen(o => !o)}>
            <span className="card-section-title">{t('carousel_title')}</span>
            {!carouselOpen && (
              <span className="carousel-header-count">{t('recipes_count')(recipes.length)}</span>
            )}
          </button>
          <button type="button" className="carousel-header-chevron" onClick={() => setCarouselOpen(o => !o)}>
            <Icon icon="heroicons:chevron-down" style={{ width: 20, height: 20, transition: 'transform 0.25s', transform: carouselOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#0d9488' }} />
          </button>
        </div>
        {carouselOpen && (
          <div className="carousel-body">
            <div className="carousel-toolbar">
              <input
                className="carousel-search"
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                placeholder={t('search_recipe_ph')}
              />
              <div className="carousel-filters">
                {[{ value: null, label: t('cat_all') }, ...[
                  { value: 'breakfast', label: t('cat_breakfast') },
                  { value: 'lunch', label: t('cat_lunch') },
                  { value: 'dinner', label: t('cat_dinner') },
                  { value: 'snack', label: t('cat_snack') },
                  { value: 'dessert', label: t('cat_dessert') },
                ]].map(cat => (
                  <button
                    key={cat.value ?? 'all'}
                    type="button"
                    className={`carousel-filter-chip${carouselCatFilter === cat.value ? ' carousel-filter-chip--active' : ''}`}
                    onClick={() => handleCarouselCatFilter(cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="carousel-toolbar-actions">
                <button
                  type="button"
                  className="carousel-action-btn"
                  onClick={() => onGoToTab?.('recipes')}
                >
                  {t('btn_create_recipe')}
                </button>
                <button
                  type="button"
                  className="carousel-action-btn"
                  onClick={() => {
                    setTplOpen(true);
                    setTimeout(() => document.getElementById('template-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                >
                  {t('btn_create_template')}
                </button>
              </div>
            </div>
            <CarouselList
              recipes={recipes}
              search={recipeSearch}
              categoryFilter={carouselCatFilter}
              visible={carouselVisible}
              setVisible={setCarouselVisible}
              scrollRef={carouselScrollRef}
              dragRef={carouselDrag}
              onPreview={setPreviewRecipe}
              onToggleFavorite={handleToggleFavorite}
              t={t}
            />
          </div>
        )}
      </div>

      <RecipePreviewModal recipe={previewRecipe} onClose={() => setPreviewRecipe(null)} />

      {/* Calendar */}
      <div className="card" style={{padding:16,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <button className="btn btn-primary" onClick={prevMonth} style={{padding:'5px 14px'}}>‹</button>
          <h2 style={{margin:0,fontSize:17}}>{monthNames[month]} {year}</h2>
          <button className="btn btn-primary" onClick={nextMonth} style={{padding:'5px 14px'}}>›</button>
        </div>

        {weeks.map((weekDays,wi)=>{
          const mondayStr    = dateToStr(weekDays[0]);
          const isCopied     = copiedWeek===mondayStr;
          const weekHasMeals = weekDays.some(d=>(mealsByDate[dateToStr(d)]||[]).length>0);
          const wBtn = {
            display:'flex', alignItems:'center', justifyContent:'center', gap:4,
            width:'100%', flex:1, padding:'4px', borderRadius:6, cursor:'pointer',
            fontSize:11, fontWeight:700, lineHeight:1.3, whiteSpace:'nowrap',
          };
          return (
            <div key={wi} style={{display:'grid',gridTemplateColumns:'72px repeat(7,1fr)',gap:3,marginBottom:3}}>
              <div style={{display:'flex',flexDirection:'column',gap:3,alignSelf:'stretch'}}>
                {weekHasMeals && (
                  <button onClick={()=>handleCopyWeek(mondayStr)} title={t('copy_week_title')}
                    style={{...wBtn, background:isCopied?'#0d9488':'#1e3a3a', color:isCopied?'white':'#2dd4bf', border:'1px solid #374151'}}>
                    {isCopied ? t('btn_copied') : t('btn_copy')}
                  </button>
                )}
                {copiedWeek && copiedWeek!==mondayStr && (
                  <button onClick={()=>handlePasteWeek(mondayStr)} title={t('paste_week_title')}
                    style={{...wBtn, background:'#1e3358', color:'#93c5fd', border:'1px solid #374151'}}>
                    {t('btn_paste')}
                  </button>
                )}
                {weekHasMeals && (
                  <button onClick={()=>handleDeleteWeek(mondayStr)} title={t('del_week_title')}
                    style={{...wBtn, background:'#2d1515', color:'#f87171', border:'1px solid #4b1515'}}>
                    {t('btn_delete')}
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
        macroGoals={macroGoals}
        recipes={recipes}
      />

      {/* How to use — collapsible, na dole */}
      <div style={{background:'#1c3534',border:'1px solid #374151',borderRadius:8,marginBottom:16,overflow:'hidden'}}>
        <button onClick={()=>setHowToOpen(o=>!o)}
          style={{width:'100%',padding:'12px 18px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,fontWeight:700,color:'#0d9488'}}>
          <span>{t('how_to_title')}</span>
          <Icon icon="heroicons:chevron-down" style={{width:20,height:20,transition:'transform 0.25s',transform:howToOpen?'rotate(180deg)':'rotate(0deg)',color:'#0d9488'}}/>
        </button>
        {howToOpen && (
          <div style={{padding:'0 18px 16px',fontSize:12,lineHeight:1.8,borderTop:'1px solid #374151'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginTop:14}}>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_meals_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li>{t('ht_meals_1')}</li>
                  <li>{t('ht_meals_2')}</li>
                  <li>{t('ht_meals_3')}</li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_copy_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li>{t('ht_copy_1')}</li>
                  <li>{t('ht_copy_2')}</li>
                  <li>{t('ht_copy_3')}</li>
                  <li>{t('ht_copy_4')}</li>
                </ul>
              </div>
              <div>
                <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_tpl_title')}</div>
                <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                  <li>{t('ht_tpl_1')}</li>
                  <li>{t('ht_tpl_2')}</li>
                  <li>{t('ht_tpl_3')}</li>
                  <li>{t('ht_tpl_4')}</li>
                </ul>
              </div>
            </div>
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #374151'}}>
              <div style={{fontWeight:700,color:'#0d9488',marginBottom:6}}>{t('ht_macro_title')}</div>
              <ul style={{margin:0,paddingLeft:16,color:'#9ca3af'}}>
                <li>{t('ht_macro_1')}</li>
                <li>{t('ht_macro_2')}</li>
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

      <DragOverlay dropAnimation={null}>
        {activeDrag && <OverlayContent dragData={activeDrag}/>}
      </DragOverlay>
    </DndContext>
    </div>
  );
}
