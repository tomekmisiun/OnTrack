import React, { useState } from 'react';
import { mealPlan as api } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

function Summary() {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (!dateRange.start || !dateRange.end) { setError(t('err_select_range')); return; }
    if (dateRange.start > dateRange.end) { setError(t('err_date_order')); return; }
    try {
      setLoading(true); setError('');
      const res = await api.getSummary(dateRange.start, dateRange.end);
      setSummary(res.data);
    } catch { setError(t('err_load_summary')); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="card">
        <h2>{t('summary_title')}</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <div className="form-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#999' }}>{t('date_from')}</label>
            <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, color: '#999' }}>{t('date_to')}</label>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleLoad} disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? t('generating') : t('generate')}
          </button>
        </div>
      </div>

      {summary && (
        <>
          <div className="card">
            <h2>{t('shopping_list_title')}</h2>
            <table>
              <thead>
                <tr>
                  <th>{t('col_name')}</th>
                  <th>{t('col_total_weight')}</th>
                  <th>{t('col_exact_pkgs')}</th>
                  <th>{t('col_buy_pkgs')}</th>
                  <th>{t('col_price_per_pkg')}</th>
                  <th>{t('col_total_cost')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item, i) => (
                  <tr key={i}>
                    <td><strong>{item.product_name}</strong></td>
                    <td>{item.total_weight}g</td>
                    <td style={{ color: '#667eea' }}>{item.packages_exact}</td>
                    <td>
                      <span style={{ background: '#667eea', color: 'white', padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
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

          <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ opacity: 0.8, marginBottom: 4 }}>{t('summary_period')(dateRange.start, dateRange.end)}</p>
                <p style={{ opacity: 0.8 }}>{t('summary_prod_count')(summary.items.length)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ opacity: 0.8, fontSize: 14 }}>{t('total_cost_lbl')}</p>
                <p style={{ fontSize: 36, fontWeight: 700 }}>{summary.total_cost.toFixed(2)} zł</p>
              </div>
            </div>
          </div>
        </>
      )}

      {summary && summary.items.length === 0 && (
        <div className="card">
          <p style={{ textAlign: 'center', color: '#999' }}>{t('no_meals_range')}</p>
        </div>
      )}
    </div>
  );
}

export default Summary;
