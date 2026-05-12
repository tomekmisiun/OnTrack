import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { mealPlan as api, recipes as recipesApi } from '../api';

function Calendar() {
  const [recipes, setRecipes] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayMeals, setDayMeals] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(1);
  const [copyForm, setCopyForm] = useState({ source_start: '', source_end: '', target_start: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const res = await recipesApi.getAll();
      setRecipes(res.data);
    } catch (e) {
      setError('Błąd ładowania przepisów');
    }
  };

  const loadMonth = async (info) => {
    try {
      const start = info.startStr.split('T')[0];
      const end = info.endStr.split('T')[0];
      const res = await api.getRange(start, end);
      const data = res.data;

      const newEvents = [];
      Object.entries(data).forEach(([date, meals]) => {
        meals.forEach(meal => {
          newEvents.push({
            id: meal.id,
            title: `${meal.position}. ${meal.recipe.name}`,
            date: date,
            backgroundColor: getColor(meal.position),
            borderColor: 'transparent',
            extendedProps: { meal },
          });
        });
      });
      setEvents(newEvents);
    } catch (e) {
      setError('Błąd ładowania planu');
    }
  };

  const getColor = (position) => {
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    return colors[position - 1] || '#667eea';
  };

  const handleDateClick = async (info) => {
    setSelectedDate(info.dateStr);
    setError('');
    setSuccess('');
    try {
      const res = await api.getDay(info.dateStr);
      setDayMeals(res.data);
    } catch (e) {
      setError('Błąd ładowania dnia');
    }
  };

  const handleAddMeal = async () => {
    if (!selectedRecipe) {
      setError('Wybierz przepis');
      return;
    }
    try {
      await api.addMeal({
        date: selectedDate,
        position: selectedPosition,
        recipe_id: parseInt(selectedRecipe),
      });
      setSuccess('Dodano posiłek!');
      setError('');
      const res = await api.getDay(selectedDate);
      setDayMeals(res.data);
      loadMonth({ startStr: selectedDate, endStr: selectedDate });
    } catch (e) {
      setError(e.response?.data?.error || 'Błąd dodawania posiłku');
    }
  };

  const handleDeleteMeal = async (id) => {
    try {
      await api.deleteMeal(id);
      const res = await api.getDay(selectedDate);
      setDayMeals(res.data);
    } catch (e) {
      setError('Błąd usuwania posiłku');
    }
  };

  const handleCopy = async () => {
    if (!copyForm.source_start || !copyForm.source_end || !copyForm.target_start) {
      setError('Wypełnij wszystkie pola kopiowania');
      return;
    }
    try {
      const res = await api.copyRange(copyForm);
      setSuccess(res.data.message);
      setError('');
    } catch (e) {
      setError('Błąd kopiowania planu');
    }
  };

  const availablePositions = () => {
    const used = dayMeals.map(m => m.position);
    return [1, 2, 3, 4, 5].filter(p => !used.includes(p));
  };

  return (
    <div>
      {error && <div style={{ background: '#ffe0e0', color: '#c00', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ background: '#e0ffe0', color: '#060', padding: 12, borderRadius: 8, marginBottom: 16 }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div className="card">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="pl"
            events={events}
            dateClick={handleDateClick}
            datesSet={loadMonth}
            height="auto"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth',
            }}
          />
        </div>

        <div>
          {selectedDate ? (
            <div className="card">
              <h2>📅 {selectedDate}</h2>

              <div style={{ marginBottom: 16 }}>
                {dayMeals.length === 0 && (
                  <p style={{ color: '#999', marginBottom: 12 }}>Brak posiłków w tym dniu</p>
                )}
                {dayMeals.map(meal => (
                  <div key={meal.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <div>
                      <span style={{
                        background: getColor(meal.position),
                        color: 'white',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        marginRight: 8
                      }}>
                        {meal.position}
                      </span>
                      <strong>{meal.recipe.name}</strong>
                      <span style={{ color: '#667eea', marginLeft: 8, fontSize: 12 }}>
                        {meal.recipe.total_cost.toFixed(2)} zł
                      </span>
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDeleteMeal(meal.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {availablePositions().length > 0 && (
                <div>
                  <select
                    value={selectedRecipe}
                    onChange={e => setSelectedRecipe(e.target.value)}
                    style={{ marginBottom: 8 }}
                  >
                    <option value="">Wybierz przepis</option>
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.total_cost.toFixed(2)} zł)
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedPosition}
                    onChange={e => setSelectedPosition(parseInt(e.target.value))}
                    style={{ marginBottom: 8 }}
                  >
                    {availablePositions().map(p => (
                      <option key={p} value={p}>Posiłek {p}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={handleAddMeal} style={{ width: '100%' }}>
                    + Dodaj posiłek
                  </button>
                </div>
              )}
              {availablePositions().length === 0 && (
                <p style={{ color: '#999', fontSize: 13 }}>Maksymalna liczba posiłków (5) osiągnięta</p>
              )}
            </div>
          ) : (
            <div className="card">
              <p style={{ color: '#999', textAlign: 'center' }}>
                Kliknij dzień w kalendarzu żeby zarządzać posiłkami
              </p>
            </div>
          )}

          <div className="card">
            <h2>📋 Kopiuj plan</h2>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
              Skopiuj posiłki z wybranego okresu na nowy termin
            </p>
            <input
              type="date"
              placeholder="Od"
              value={copyForm.source_start}
              onChange={e => setCopyForm({ ...copyForm, source_start: e.target.value })}
              style={{ marginBottom: 8 }}
            />
            <input
              type="date"
              placeholder="Do"
              value={copyForm.source_end}
              onChange={e => setCopyForm({ ...copyForm, source_end: e.target.value })}
              style={{ marginBottom: 8 }}
            />
            <input
              type="date"
              placeholder="Kopiuj od dnia"
              value={copyForm.target_start}
              onChange={e => setCopyForm({ ...copyForm, target_start: e.target.value })}
              style={{ marginBottom: 12 }}
            />
            <button className="btn btn-primary" onClick={handleCopy} style={{ width: '100%' }}>
              Kopiuj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Calendar;