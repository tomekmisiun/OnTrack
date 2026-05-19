import React, { useState, useEffect } from 'react';
import { products as productsApi } from '../api';

function ProductTable({ items, onTotalChange }) {
  const [localItems, setLocalItems] = useState(items);
  const [editPkgId,    setEditPkgId]    = useState(null);
  const [editPkg,      setEditPkg]      = useState('');
  const [editSBW,      setEditSBW]      = useState(false);
  const [editPriceId,  setEditPriceId]  = useState(null);
  const [editPrice,    setEditPrice]    = useState('');

  useEffect(() => {
    setLocalItems(prev => {
      const byId = Object.fromEntries(prev.map(i => [i.product_id, i]));
      return items.map(item => ({
        ...item,
        stockMode: byId[item.product_id]?.stockMode || null,
        stockAmt:  byId[item.product_id]?.stockAmt  || '',
      }));
    });
  }, [items]);

  const getAdjustedCostFor = (item) => {
    if (item.stockMode === 'all') return 0;
    if (item.stockMode === 'part') {
      const stock = parseFloat(item.stockAmt) || 0;
      if (stock <= 0) return item.total_cost;
      const stockGrams = item.sold_by_weight ? stock : stock * item.package_weight;
      const remaining = Math.max(0, item.total_weight - stockGrams);
      if (remaining === 0) return 0;
      if (item.sold_by_weight) return remaining * item.price_per_package / item.package_weight;
      return Math.ceil(remaining / item.package_weight) * item.price_per_package;
    }
    return item.total_cost;
  };

  const updItem = (product_id, patch) =>
    setLocalItems(prev => {
      const next = prev.map(i => i.product_id === product_id ? { ...i, ...patch } : i);
      if (onTotalChange) {
        const total = next.reduce((s, i) => s + getAdjustedCostFor(i), 0);
        onTotalChange(total);
      }
      return next;
    });


  const recalcPkg = (item, newPkg, sbw) => {
    const pricePerUnit = item.unit === 'szt'
      ? item.price_per_package / item.package_weight
      : item.price_per_package * 100 / item.package_weight;
    const newPkgPrice = item.unit === 'szt' ? pricePerUnit * newPkg : pricePerUnit * newPkg / 100;
    const pkgsExact   = item.total_weight / newPkg;
    const pkgsRounded = sbw ? pkgsExact : Math.ceil(pkgsExact);
    return {
      ...item, package_weight: newPkg, sold_by_weight: sbw,
      price_per_package: newPkgPrice, packages_exact: pkgsExact,
      packages_rounded: pkgsRounded,
      actual_cost: pkgsExact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const recalcPrice = (item, newPkgPrice) => {
    const pkgsRounded = item.sold_by_weight ? item.packages_exact : Math.ceil(item.packages_exact);
    return {
      ...item, price_per_package: newPkgPrice,
      actual_cost: item.packages_exact * newPkgPrice,
      total_cost: pkgsRounded * newPkgPrice,
    };
  };

  const handleSavePkg = async (item) => {
    const pkg = Math.min(99999, parseFloat(editPkg));
    if (!pkg || pkg <= 0) { setEditPkgId(null); return; }
    const updated = recalcPkg(item, pkg, editSBW);
    setLocalItems(prev => prev.map(i => i.product_id === item.product_id ? updated : i));
    setEditPkgId(null);
    try { await productsApi.update(item.product_id, { package_weight: pkg, sold_by_weight: editSBW }); } catch {}
  };

  const handleSavePrice = async (item) => {
    const newPkgPrice = Math.min(99999, parseFloat(editPrice));
    if (isNaN(newPkgPrice) || newPkgPrice < 0) { setEditPriceId(null); return; }
    const updated = recalcPrice(item, newPkgPrice);
    setLocalItems(prev => prev.map(i => i.product_id === item.product_id ? updated : i));
    setEditPriceId(null);
    const unitPrice = item.unit === 'szt'
      ? newPkgPrice / item.package_weight
      : newPkgPrice * 100 / item.package_weight;
    try { await productsApi.update(item.product_id, { price: parseFloat(unitPrice.toFixed(4)) }); } catch {}
  };

  const inp = { padding: '2px 6px', fontSize: 12, width: 68, border: '1px solid #374151', borderRadius: 4, background: '#111827', color: '#e2e8f0' };
  const btn = (bg, color) => ({ padding:'1px 6px', fontSize:11, background:bg, color, border:'none', borderRadius:3, cursor:'pointer' });
  const hintStyle = { fontSize: 9, fontWeight: 400, color: '#2dd4bf', display: 'block', marginTop: 1 };

  return (
    <table className="compact-table" style={{ marginTop: 4 }}>
      <thead>
        <tr>
          <th>Produkt</th>
          <th>Gram. użyta</th>
          <th><span>Pojemność opak.</span><span style={hintStyle}>✎ kliknij aby edytować</span></th>
          <th>Szt.</th>
          <th><span>Cena/opak.</span><span style={hintStyle}>✎ kliknij aby edytować</span></th>
          <th style={{ whiteSpace:'nowrap' }}>
            <span>W zapasie</span>
            <span style={{ fontSize:9, fontWeight:400, color:'#2dd4bf', display:'block', marginTop:1 }}>zmniejsza koszt zakupy</span>
          </th>
          <th>zakupy</th>
          <th>koszt</th>
        </tr>
      </thead>
      <tbody>
        {localItems.map((item, i) => (
          <tr key={i}>
            <td style={{ fontSize:13, color:'#e2e8f0' }}>{item.product_name}</td>
            <td style={{ fontSize:13, color: '#9ca3af' }}>{item.total_weight} {item.unit || 'g'}</td>

            {/* Pojemność opak — editable */}
            <td style={{ cursor: 'pointer' }} onClick={() => {
              if (editPkgId === item.product_id) return;
              setEditPkgId(item.product_id); setEditPkg(String(item.package_weight));
              setEditSBW(!!item.sold_by_weight); setEditPriceId(null);
            }}>
              {editPkgId === item.product_id ? (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }} onClick={e => e.stopPropagation()}>
                  <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                    <input type="number" min="0" max="99999" value={editPkg} onChange={e => setEditPkg(e.target.value)}
                      className="no-spin" style={inp} autoFocus onKeyDown={e => { if (e.key==='Enter') handleSavePkg(item); if (e.key==='Escape') setEditPkgId(null); }} />
                    <span style={{ fontSize:11, color:'#6b7280' }}>{item.unit}</span>
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer' }}>
                    <input type="checkbox" checked={editSBW} onChange={e => setEditSBW(e.target.checked)} />
                    Produkt sprzedawany na wagę
                  </label>
                  <div style={{ display:'flex', gap:3 }}>
                    <button style={btn('#0d9488','#1f2937')} onClick={() => handleSavePkg(item)}>✓ Zapisz</button>
                    <button style={btn('#374151','#9ca3af')} onClick={() => setEditPkgId(null)}>✗</button>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize:13, color: '#9ca3af' }}>
                  {item.sold_by_weight ? 'Na wagę' : `${item.package_weight} ${item.unit || 'g'}`}
                </span>
              )}
            </td>

            {/* Szt */}
            <td>
              {item.sold_by_weight
                ? <span style={{ fontSize:13, color:'#9ca3af' }}>wagowo</span>
                : <span style={{ background:'#0d9488', color:'white', padding:'2px 8px', borderRadius:10, fontWeight:600, fontSize:13 }}>
                    {item.packages_rounded} szt.
                  </span>}
            </td>

            {/* Cena/opak — editable */}
            <td style={{ cursor: 'pointer' }} onClick={() => {
              if (editPriceId === item.product_id) return;
              setEditPriceId(item.product_id); setEditPrice(item.price_per_package.toFixed(2));
              setEditPkgId(null);
            }}>
              {editPriceId === item.product_id ? (
                <div style={{ display:'flex', gap:3, alignItems:'center' }} onClick={e => e.stopPropagation()}>
                  <input type="number" step="0.01" min="0" max="99999" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    className="no-spin" style={{ ...inp, width:72 }} autoFocus onKeyDown={e => { if (e.key==='Enter') handleSavePrice(item); if (e.key==='Escape') setEditPriceId(null); }} />
                  <span style={{ fontSize:11, color:'#6b7280' }}>zł</span>
                  <button style={btn('#0d9488','#1f2937')} onClick={() => handleSavePrice(item)}>✓</button>
                  <button style={btn('#374151','#9ca3af')} onClick={() => setEditPriceId(null)}>✗</button>
                </div>
              ) : (
                <span style={{ fontSize:13, color:'#9ca3af' }}>{item.price_per_package.toFixed(2)} zł</span>
              )}
            </td>

            {/* W zapasie */}
            <td>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {/* Całość */}
                <button
                  onClick={() => updItem(item.product_id, { stockMode: item.stockMode === 'all' ? null : 'all', stockAmt: '' })}
                  style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:'1px solid #374151', borderRadius:5, transition:'all 0.15s',
                    background: item.stockMode === 'all' ? '#0d9488' : '#2d3748',
                    color: item.stockMode === 'all' ? 'white' : '#9ca3af',
                  }}>
                  Całość
                </button>
                {/* Część + input */}
                <button
                  onClick={() => updItem(item.product_id, { stockMode: item.stockMode === 'part' ? null : 'part', stockAmt: '' })}
                  style={{
                    padding:'4px 8px', fontSize:11, fontWeight:600, cursor:'pointer',
                    border:'1px solid #374151', borderRadius:5, transition:'all 0.15s',
                    background: item.stockMode === 'part' ? '#0d9488' : '#2d3748',
                    color: item.stockMode === 'part' ? 'white' : '#9ca3af',
                  }}>
                  Część
                </button>
                {item.stockMode === 'part' && (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:3, marginTop:2 }}>
                    <span style={{ fontSize:13, color:'#9ca3af', whiteSpace:'nowrap' }}>Podaj ile</span>
                    <input type="number" min="0" max="99999" step={item.sold_by_weight ? 0.5 : 1}
                      value={item.stockAmt}
                      onChange={e => { const v = e.target.value; if (parseFloat(v) > 99999) return; updItem(item.product_id, { stockAmt: v }); }}
                      className="no-spin"
                      style={{ padding:'2px 4px', fontSize:13, width:44, boxSizing:'border-box', border:'1px solid #374151', borderRadius:4, background:'#111827', color:'#e2e8f0' }}
                      placeholder="0" />
                    <span style={{ fontSize:13, color:'#9ca3af' }}>{item.sold_by_weight ? (item.unit || 'g') : 'szt.'}</span>
                  </div>
                )}
              </div>
            </td>

            {/* Koszt zakupy */}
            <td>
              {(() => {
                const adj = getAdjustedCostFor(item);
                const reduced = item.stockMode && adj < item.total_cost;
                return (
                  <div>
                    <span style={{ fontSize:13, color: item.stockMode ? '#22c55e' : '#9ca3af' }}>{adj.toFixed(2)} zł</span>
                    {reduced && (
                      <div style={{ fontSize:11, color:'#4b5563', textDecoration:'line-through' }}>{item.total_cost.toFixed(2)} zł</div>
                    )}
                  </div>
                );
              })()}
            </td>

            <td style={{ fontSize:13, color: '#9ca3af' }}>
              {(() => {
                if (item.stockMode === 'all') return '0.00 zł';
                if (item.stockMode === 'part') {
                  const stock = parseFloat(item.stockAmt) || 0;
                  if (stock <= 0) return item.actual_cost.toFixed(2) + ' zł';
                  const remaining = Math.max(0, item.total_weight - stock);
                  if (remaining === 0) return '0.00 zł';
                  const adjActual = (remaining / item.total_weight) * item.actual_cost;
                  return adjActual.toFixed(2) + ' zł';
                }
                return item.actual_cost.toFixed(2) + ' zł';
              })()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ProductTable;
