import React, { useState, useEffect, useMemo } from 'react';
import { products as productsApi } from '../api';

export default function IngredientMapping() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    productsApi.ingredientMapping()
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return rows.filter(row => {
      if (q && !row.product_name.toLowerCase().includes(q) &&
          !row.original_name?.toLowerCase().includes(q) &&
          !row.ingredient_aliases?.some(a => a.toLowerCase().includes(q))) {
        return false;
      }
      if (onlyProblems && row.price_per_100 > 0) return false;
      return true;
    });
  }, [rows, filter, onlyProblems]);

  const scoreColor = (s) => {
    if (!s) return '#6b7280';
    if (s >= 95) return '#10b981';
    if (s >= 85) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) return (
    <div style={{ padding: 24, color: '#9ca3af', textAlign: 'center' }}>Ładowanie…</div>
  );

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1200 }}>
      <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
        Dopasowania składników → produkty
      </h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Szukaj składnika lub produktu…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #374151',
            background: '#1f2937', color: '#f1f5f9', fontSize: 14,
          }}
        />
        <label style={{ color: '#9ca3af', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyProblems} onChange={e => setOnlyProblems(e.target.checked)} />
          Tylko bez ceny
        </label>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{filtered.length} / {rows.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#111827', color: '#9ca3af', textAlign: 'left' }}>
              <th style={th}>Produkt sklepowy</th>
              <th style={th}>Oryginalna nazwa</th>
              <th style={th}>Aliasy z przepisów</th>
              <th style={{...th, textAlign:'right'}}>PKG</th>
              <th style={{...th, textAlign:'right'}}>zł/100</th>
              <th style={{...th, textAlign:'right'}}>cena pkg</th>
              <th style={{...th, textAlign:'right'}}>kcal</th>
              <th style={{...th, textAlign:'right'}}>score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1f2937', background: i % 2 === 0 ? '#111827' : 'transparent' }}>
                <td style={{ ...td, color: '#f1f5f9', fontWeight: 600 }}>{row.product_name}</td>
                <td style={{ ...td, color: '#6b7280', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={row.original_name}>{row.original_name}</td>
                <td style={{ ...td, color: '#9ca3af' }}>
                  {row.ingredient_aliases?.length > 0
                    ? row.ingredient_aliases.map((a, j) => (
                        <span key={j} style={{ background: '#1e3a5f', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: 11, display: 'inline-block' }}>{a}</span>
                      ))
                    : <span style={{ color: '#374151' }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#9ca3af' }}>
                  {row.package_weight ? `${row.package_weight} ${row.unit}` : '?'}
                </td>
                <td style={{ ...td, textAlign: 'right', color: row.price_per_100 ? '#f1f5f9' : '#ef4444', fontWeight: row.price_per_100 ? 400 : 600 }}>
                  {row.price_per_100 ? `${row.price_per_100.toFixed(2)}` : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                  {row.price_package ? `${row.price_package.toFixed(2)} zł` : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right', color: '#9ca3af' }}>
                  {row.kcal != null ? row.kcal : '—'}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {row.fuzzy_score != null
                    ? <span style={{ color: scoreColor(row.fuzzy_score), fontWeight: 600 }}>{row.fuzzy_score.toFixed(0)}</span>
                    : <span style={{ color: '#374151' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #374151',
};

const td = {
  padding: '7px 12px',
  verticalAlign: 'middle',
};
