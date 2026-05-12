import React, { useState } from 'react';
import { mealPlan as api } from '../api';

function Summary() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (!dateRange.start || !dateRange.end) {
      setError('Wybierz zakres dat');
      return;
    }
    if (dateRange.start > dateRange.end) {
      setError('Data początkowa nie może być późniejsza niż końcowa');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await api.getSummary(dateRange.start, dateRange.end);
      setSummary(res.data);
    } catch (e) {
      setError('Błąd ładowania podsumowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>📊 Podsumowanie zakupów</h2>
        {error && (
          <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>
        )}
        <div className="form-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#999' }}>Od</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#999' }}>Do</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleLoad}
            disabled={loading}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? 'Ładowanie...' : 'Generuj'}
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="card">
            <h2>Lista zakupów</h2>
            <table>
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Łączna gramatura</th>
                  <th>Opakowania (dokładnie)</th>
                  <th>Opakowania (do kupienia)</th>
                  <th>Cena/opak.</th>
                  <th>Koszt całkowity</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item, i) => (
                  <tr key={i}>
                    <td><strong>{item.product_name}</strong></td>
                    <td>{item.total_weight}g</td>
                    <td style={{ color: '#667eea' }}>{item.packages_exact}</td>
                    <td>
                      <span style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontWeight: 600,
                      }}>
                        {item.packages_rounded} szt.
                      </span>
                    </td>
                    <td>{item.price_per_package.toFixed(2)} zł</td>
                    <td><strong>{item.total_cost.toFixed(2)} zł</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ opacity: 0.8, marginBottom: 4 }}>
                  Okres: {dateRange.start} — {dateRange.end}
                </p>
                <p style={{ opacity: 0.8 }}>
                  Liczba produktów: {summary.items.length}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ opacity: 0.8, fontSize: 14 }}>Łączny koszt zakupów</p>
                <p style={{ fontSize: 36, fontWeight: 700 }}>
                  {summary.total_cost.toFixed(2)} zł
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {summary && summary.items.length === 0 && (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#999' }}>
            Brak zaplanowanych posiłków w wybranym okresie
          </p>
        </div>
      )}
    </div>
  );
}

export default Summary;