import React, { useState, useEffect } from 'react';
import { products as api } from '../api';

function Products() {
  const [productList, setProductList] = useState([]);
  const [form, setForm] = useState({ name: '', package_weight: '', price: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await api.getAll();
      setProductList(res.data);
    } catch (e) {
      setError('Błąd ładowania produktów');
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.package_weight || !form.price) {
      setError('Wypełnij wszystkie pola');
      return;
    }
    try {
      await api.create({
        name: form.name,
        package_weight: parseFloat(form.package_weight),
        price: parseFloat(form.price),
      });
      setForm({ name: '', package_weight: '', price: '' });
      setError('');
      loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Błąd dodawania produktu');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Usunąć produkt?')) return;
    try {
      await api.delete(id);
      loadProducts();
    } catch (e) {
      setError('Błąd usuwania produktu');
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Dodaj produkt</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <div className="form-row">
          <input
            placeholder="Nazwa produktu"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Gramatura opakowania (g)"
            type="number"
            value={form.package_weight}
            onChange={e => setForm({ ...form, package_weight: e.target.value })}
          />
          <input
            placeholder="Cena (zł)"
            type="number"
            step="0.01"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
          />
          <button className="btn btn-primary" onClick={handleSubmit}>
            Dodaj
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Lista produktów</h2>
        <table>
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Gramatura opakowania</th>
              <th>Cena</th>
              <th>Cena za gram</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productList.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.package_weight}g</td>
                <td>{p.price.toFixed(2)} zł</td>
                <td>{(p.price / p.package_weight).toFixed(4)} zł/g</td>
                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(p.id)}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
            {productList.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>
                  Brak produktów — dodaj pierwszy!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Products;